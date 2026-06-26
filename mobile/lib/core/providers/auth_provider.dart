import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/fcm_service.dart';
import '../services/socket_service.dart';

class AuthProvider with ChangeNotifier, WidgetsBindingObserver {
  User? _user;
  String? _token;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  bool _hasLocalAccount = false;
  Timer? _inactivityTimer;
  static const _inactivityDuration = Duration(minutes: 10);
  static const _inactivityGraceDuration = Duration(seconds: 30);
  static const _otpReauthDuration = Duration(hours: 48);
  String? _sessionDevice;
  DateTime? _sessionLoginAt;
  DateTime? _lastActivityAt;
  int _lastActivityWriteMs = 0;
  int? _lastOtpAuthMs;
  bool _otpRequiredForUnlock = false;
  String? _loginMemberId;
  VoidCallback? onSessionLocked;
  bool _unlockInProgress = false;
  DateTime? _unlockGraceUntil;
  Future<void>? _bootstrapFuture;
  bool _bootstrapDone = false;

  bool get bootstrapDone => _bootstrapDone;

  final _secureStorage = const FlutterSecureStorage();

  User? get user => _user;
  String? get token => _token;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  bool get hasLocalAccount => _hasLocalAccount;
  String? get sessionDevice => _sessionDevice;
  DateTime? get sessionLoginAt => _sessionLoginAt;
  bool get otpRequiredForUnlock => _otpRequiredForUnlock;
  /// True when periodic OTP re-verification is required (48h since last OTP login).
  bool get requiresOtpUnlock => _otpRequiredForUnlock;
  DateTime? get lastActivityAt => _lastActivityAt;
  String? get loginMemberId => _loginMemberId;

  AuthProvider() {
    WidgetsBinding.instance.addObserver(this);
    _bootstrapFuture = _loadFromStorage();
    ApiService.onUnauthorized = () async {
      await handleUnauthorized();
    };
  }

  Future<void> waitForBootstrap() async {
    await (_bootstrapFuture ?? _loadFromStorage());
  }

  /// Call this on any user interaction (tap, scroll, type) to reset idle timer
  void markUserInteraction() {
    resetInactivityTimer();
  }

  void resetInactivityTimer() {
    if (!_isAuthenticated) return;
    _recordActivity();
    _scheduleInactivityLock();
  }

  void _scheduleInactivityLock() {
    _inactivityTimer?.cancel();
    _inactivityTimer = Timer(_inactivityDuration + _inactivityGraceDuration, () {
      debugPrint('Inactivity timeout — locking app (biometric)');
      _lockSession(requireOtp: _isPeriodicOtpDue());
    });
  }

  void _stopInactivityTimer() {
    _inactivityTimer?.cancel();
    _inactivityTimer = null;
  }

  /// Periodic OTP is based on last OTP/full login — not last tap (daily use must still re-OTP after 48h).
  bool _isPeriodicOtpDue() {
    final anchorMs = _lastOtpAuthMs ??
        (_sessionLoginAt?.millisecondsSinceEpoch);
    if (anchorMs == null || anchorMs <= 0) return false;
    final elapsed = DateTime.now().difference(
      DateTime.fromMillisecondsSinceEpoch(anchorMs),
    );
    return elapsed >= _otpReauthDuration;
  }

  bool _shouldSuppressUnauthorizedLock() {
    if (_unlockInProgress) return true;
    final grace = _unlockGraceUntil;
    if (grace != null && DateTime.now().isBefore(grace)) return true;
    return false;
  }

  Future<void> _touchOtpAuthTime() async {
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    _lastOtpAuthMs = nowMs;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('last_otp_auth_time', nowMs);
  }

  Future<void> _recordActivity({bool forcePersist = false}) async {
    final now = DateTime.now();
    _lastActivityAt = now;

    // Avoid writing SharedPreferences on every pointer event.
    final nowMs = now.millisecondsSinceEpoch;
    if (!forcePersist && (nowMs - _lastActivityWriteMs) < 30000) {
      return;
    }

    _lastActivityWriteMs = nowMs;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('last_activity_at', nowMs);
  }

  Future<void> _lockSession({required bool requireOtp}) async {
    if (!_isAuthenticated) return;
    _isAuthenticated = false;
    _otpRequiredForUnlock = requireOtp;
    _stopInactivityTimer();
    notifyListeners();
    onSessionLocked?.call();
  }

  /// Token rejected after refresh failed — lock for biometric/OTP, do not wipe local account.
  Future<void> handleUnauthorized() async {
    if (_shouldSuppressUnauthorizedLock()) return;
    if (_hasLocalAccount) {
      final refresh = await _secureStorage.read(key: 'refresh_token');
      final access = await _secureStorage.read(key: 'access_token');
      if (refresh != null || access != null) {
        _lockSession(requireOtp: _isPeriodicOtpDue());
        return;
      }
    }
    await logout();
  }

  Future<void> _loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    // SECURITY FIX: read auth token only from secure storage.
    _token = await _secureStorage.read(key: 'access_token');
    final userJson = prefs.getString('user');
    _hasLocalAccount = prefs.getBool('hasLocalAccount') ?? false;

    if (_token != null && userJson != null) {
      _user = User.fromJson(jsonDecode(userJson));
      // Don't auto-authenticate on cold start — require MPIN re-entry
      // _isAuthenticated stays false so splash redirects to /lock
    }
    _loginMemberId = prefs.getString('login_member_id')?.trim();
    _loginMemberId ??= _user?.memberId;
    _sessionDevice = prefs.getString('session_device');
    final loginAtStr = prefs.getString('session_login_at');
    if (loginAtStr != null) _sessionLoginAt = DateTime.tryParse(loginAtStr);
    final lastActivityMs = prefs.getInt('last_activity_at');
    if (lastActivityMs != null && lastActivityMs > 0) {
      _lastActivityAt = DateTime.fromMillisecondsSinceEpoch(lastActivityMs);
    }
    _lastOtpAuthMs = prefs.getInt('last_otp_auth_time');
    _otpRequiredForUnlock = _isPeriodicOtpDue();
    notifyListeners();

    if (_token != null) {
      await _restoreSessionQuietly();
    }
    _bootstrapDone = true;
    notifyListeners();
  }

  Future<void> _restoreSessionQuietly() async {
    await ApiService.tryRefreshAccessToken();
    _token = await _secureStorage.read(key: 'access_token');
    await _syncPrimaryProfile();
  }

  Future<void> _syncPrimaryProfile() async {
    try {
      final response = await ApiService.getWithoutActiveMember('/users/profile');
      if (response['success'] == true) {
        _user = User.fromJson(response['data']);
        _loginMemberId = _user?.memberId?.trim();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(_user!.toJson()));
        if (_loginMemberId != null && _loginMemberId!.isNotEmpty) {
          await prefs.setString('login_member_id', _loginMemberId!);
        }
        notifyListeners();
      }
    } catch (_) {
      // Keep cached profile when offline.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Lock when app goes to background — fingerprint required on next open.
    if (state == AppLifecycleState.paused) {
      if (_isAuthenticated && !_unlockInProgress) {
        _lockSession(requireOtp: _isPeriodicOtpDue());
      }
      return;
    }

    // Don't lock on inactive (fingerprint dialog triggers this state).
    if (state == AppLifecycleState.inactive) {
      return;
    }

    if (!_isAuthenticated) return;

    if (state == AppLifecycleState.resumed) {
      final last = _lastActivityAt;
      final idle = last == null ? Duration.zero : DateTime.now().difference(last);

      if (idle >= (_inactivityDuration + _inactivityGraceDuration)) {
        _lockSession(requireOtp: _isPeriodicOtpDue());
        return;
      }

      _scheduleInactivityLock();
    }
  }

  // ─── OTP / Phone ───────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> sendPhoneOtp(String mobile) async {
    try {
      final res = await ApiService.post('/auth/resend-otp', {'mobile': mobile});
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> verifyPhoneOtp(String mobile, String otp) async {
    try {
      final res = await ApiService.post('/auth/verify-otp', {
        'mobile': mobile,
        'otp': otp,
        'type': 'mobile',
      });
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> sendEmailOtp(String email) async {
    try {
      final res = await ApiService.post('/auth/resend-otp', {'email': email, 'type': 'email'});
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> verifyEmailOtp(String email, String otp) async {
    try {
      final res = await ApiService.post('/auth/verify-otp', {
        'email': email,
        'otp': otp,
        'type': 'email',
      });
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // ─── Register (final step — set MPIN) ─────────────────────────────────────

  Future<Map<String, dynamic>> register({
    required String mobile,
    required String email,
    required String mpin,
    String? fullName,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await ApiService.post('/auth/register', {
        'mobile': mobile,
        'email': email,
        'mpin': mpin,
        if (fullName != null) 'full_name': fullName,
      });

      if (res['success'] == true) {
        await _persistSession(res);
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Login with Email + Password (testing flow) ─────────────────────────

  Future<Map<String, dynamic>> loginWithEmail({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await ApiService.post('/auth/login', {
        'email': email,
        'password': password,
        'device_name': SocketService.deviceName,
        'platform': SocketService.devicePlatform,
      });

      if (res['success'] == true) {
        await _persistSession(res);
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Login with MPIN (returning user — already verified on this device) ────

  Future<Map<String, dynamic>> loginWithMpin(String mpin) async {
    _isLoading = true;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final mobile = prefs.getString('mobile') ?? '';
      final res = await ApiService.post('/auth/login', {
        'mobile': mobile,
        'mpin': mpin,
        'device_name': SocketService.deviceName,
        'platform': SocketService.devicePlatform,
      });

      if (res['success'] == true) {
        await _persistSession(res);
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Login with OTP directly (no MPIN) ─────────────────────────────────────

  Future<Map<String, dynamic>> loginWithOtp({
    required String mobile,
    required String otp,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await ApiService.post('/auth/login-otp', {
        'mobile': mobile,
        'otp': otp,
        'device_name': SocketService.deviceName,
        'platform': SocketService.devicePlatform,
      });

      if (res['success'] == true) {
        await _persistSession(res);
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Login with Phone + OTP then MPIN (fresh install) ─────────────────────

  Future<Map<String, dynamic>> loginWithPhoneAndMpin({
    required String mobile,
    required String mpin,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await ApiService.post('/auth/login', {
        'mobile': mobile,
        'mpin': mpin,
        'device_name': SocketService.deviceName,
        'platform': SocketService.devicePlatform,
      });

      if (res['success'] == true) {
        await _persistSession(res);
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Persist session ───────────────────────────────────────────────────────

  Future<void> _persistSession(Map<String, dynamic> res) async {
    _token = res['data']?['token'];
    _user = User.fromJson(res['data']['user']);
    _isAuthenticated = true;
    _hasLocalAccount = true;

    final prefs = await SharedPreferences.getInstance();
    if (_token != null) {
      await _secureStorage.write(key: 'access_token', value: _token!);
    }
    final refreshToken = res['data']?['refreshToken']?.toString();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _secureStorage.write(key: 'refresh_token', value: refreshToken);
    }
    await prefs.setString('user', jsonEncode(_user!.toJson()));
    await prefs.setBool('hasLocalAccount', true);
    await prefs.setString('mobile', _user!.mobile);
    await _secureStorage.write(key: 'mpin_set', value: 'true');
    _sessionLoginAt = DateTime.now();
    _sessionDevice = SocketService.deviceName;
    await prefs.setString('session_login_at', _sessionLoginAt!.toIso8601String());
    await prefs.setString('session_device', _sessionDevice!);
    _loginMemberId = _user?.memberId?.trim();
    if (_loginMemberId != null && _loginMemberId!.isNotEmpty) {
      await prefs.setString('login_member_id', _loginMemberId!);
    } else {
      await prefs.remove('login_member_id');
    }
    await prefs.remove('active_member_id');

    // Register FCM token for push notifications
    FcmService().registerTokenWithBackend();

    // Connect user socket for multi-device alerts
    final userId = _user!.id;
    if (userId.isNotEmpty) {
      SocketService.instance.setOnForceLogout(() => logout());
      SocketService.instance.connect(userId);
    }

    _otpRequiredForUnlock = false;
    await _touchOtpAuthTime();
    await _recordActivity(forcePersist: true);
    _scheduleInactivityLock();
  }

  // ─── QR Login — confirm a web QR session from the mobile app ──────────────

  /// Unlock after biometric — refresh token if needed, keep cached profile (no OTP).
  Future<bool> unlockAfterBiometric() async {
    if (_otpRequiredForUnlock) {
      return false;
    }

    _unlockInProgress = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString('user');
      if (userJson != null) {
        _user = User.fromJson(jsonDecode(userJson));
      }
      _token = await _secureStorage.read(key: 'access_token');

      if (_user == null) return false;

      await ApiService.tryRefreshAccessToken();
      _token = await _secureStorage.read(key: 'access_token');
      if (_token == null) return false;

      authenticateFromBiometric();
      _unlockGraceUntil = DateTime.now().add(const Duration(seconds: 8));
      unawaited(refreshProfile());
      return true;
    } finally {
      _unlockInProgress = false;
    }
  }

  /// Called after successful biometric authentication with a valid stored token.
  void authenticateFromBiometric() {
    _isAuthenticated = true;
    _otpRequiredForUnlock = false;
    notifyListeners();
    FcmService().registerTokenWithBackend();
    _recordActivity(forcePersist: true);
    _scheduleInactivityLock();
    _unlockGraceUntil = DateTime.now().add(const Duration(seconds: 8));
    // Reconnect socket so force_logout events are received
    final userId = _user?.id ?? '';
    if (userId.isNotEmpty) {
      SocketService.instance.setOnForceLogout(() => logout());
      SocketService.instance.connect(userId);
    }
  }

  Future<Map<String, dynamic>> confirmQrLogin(String sessionId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final activeMemberId = prefs.getString('active_member_id')?.trim().toUpperCase();
      final payload = <String, dynamic>{'sessionId': sessionId};
      if (activeMemberId != null && activeMemberId.isNotEmpty) {
        payload['active_member_id'] = activeMemberId;
      }
      final res = await ApiService.post('/auth/qr-confirm', payload);
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    _user = null;
    _token = null;
    _isAuthenticated = false;
    _otpRequiredForUnlock = false;
    _lastActivityAt = null;
    _loginMemberId = null;
    _stopInactivityTimer();

    // Disconnect user socket
    SocketService.instance.disconnect();

    // Clear FCM token
    await FcmService().clearToken();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user');
    await prefs.remove('last_activity_at');
    await prefs.remove('last_otp_auth_time');
    await prefs.remove('login_member_id');
    await prefs.remove('active_member_id');
    await _secureStorage.delete(key: 'access_token');
    await _secureStorage.delete(key: 'refresh_token');

    notifyListeners();
  }

  /// Revokes all active sessions on the server, then clears local state.
  Future<void> logoutAllDevices() async {
    try {
      await ApiService.post('/auth/logout-all', {});
    } catch (_) {
      // Even if API fails, clear local session
    }
    await logout();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopInactivityTimer();
    super.dispose();
  }

  Future<void> refreshProfile() async {
    try {
      final response = await ApiService.getWithoutActiveMember('/users/profile');
      if (response['success'] == true) {
        _user = User.fromJson(response['data']);
        _loginMemberId = _user?.memberId?.trim();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(_user!.toJson()));
        if (_loginMemberId != null && _loginMemberId!.isNotEmpty) {
          await prefs.setString('login_member_id', _loginMemberId!);
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Refresh profile error: $e');
    }
  }

  Future<void> updateProfile(Map<String, dynamic> profileData) async {
    try {
      final response = await ApiService.put('/users/profile', profileData);
      if (response['success']) {
        _user = User.fromJson(response['data']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(_user!.toJson()));
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Update profile error: $e');
    }
  }
}
