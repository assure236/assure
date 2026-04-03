import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/fcm_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _token;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  bool _hasLocalAccount = false; // true if user has previously logged in on this device

  final _secureStorage = const FlutterSecureStorage();

  User? get user => _user;
  String? get token => _token;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  bool get hasLocalAccount => _hasLocalAccount;

  AuthProvider() {
    _loadFromStorage();
    // Auto-logout when API returns 401 (token expired)
    ApiService.onUnauthorized = () async {
      await logout();
    };
  }

  Future<void> _loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    _hasLocalAccount = prefs.getBool('hasLocalAccount') ?? false;

    if (_token != null && userJson != null) {
      _user = User.fromJson(jsonDecode(userJson));
      // Don't auto-authenticate on cold start — require MPIN re-entry
      // _isAuthenticated stays false so splash redirects to /mpin
    }
    notifyListeners();
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
    if (_token != null) await prefs.setString('token', _token!);
    await prefs.setString('user', jsonEncode(_user!.toJson()));
    await prefs.setBool('hasLocalAccount', true);
    await prefs.setString('mobile', _user!.mobile);
    await _secureStorage.write(key: 'mpin_set', value: 'true');

    // Register FCM token for push notifications
    FcmService().registerTokenWithBackend();
  }

  // ─── QR Login — confirm a web QR session from the mobile app ──────────────

  /// Called after successful biometric authentication with a valid stored token.
  void authenticateFromBiometric() {
    _isAuthenticated = true;
    notifyListeners();
    // Register FCM token on biometric login too
    FcmService().registerTokenWithBackend();
  }

  Future<Map<String, dynamic>> confirmQrLogin(String sessionId) async {
    try {
      final res = await ApiService.post('/auth/qr-confirm', {'sessionId': sessionId});
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
    // Keep hasLocalAccount true so returning user sees MPIN screen

    // Clear FCM token
    await FcmService().clearToken();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');

    notifyListeners();
  }

  Future<void> refreshProfile() async {
    try {
      final response = await ApiService.get('/users/profile');
      if (response['success'] == true) {
        _user = User.fromJson(response['data']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(_user!.toJson()));
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
