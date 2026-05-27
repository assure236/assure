import 'dart:io';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../theme/app_theme.dart';
import 'api_service.dart';

/// Persistent socket connection for user-level events (multi-device alerts, etc.).
/// Call [setContext] from DashboardScreen to allow dialog display.
class SocketService {
  SocketService._();
  static final SocketService _instance = SocketService._();
  static SocketService get instance => _instance;

  io.Socket? _socket;
  String? _userId;
  BuildContext? _context;
  VoidCallback? _onForceLogout;

  bool get isConnected => _socket?.connected ?? false;

  /// Set the active BuildContext (call from DashboardScreen).
  void setContext(BuildContext ctx) => _context = ctx;

  /// Set callback for force logout from other device
  void setOnForceLogout(VoidCallback callback) => _onForceLogout = callback;

  /// Connect to socket server and join the user room.
  Future<void> connect(String userId) async {
    if (_socket != null && _socket!.connected && _userId == userId) return;

    _userId = userId;
    disconnect();

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    _socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'token': token ?? ''})
          .setExtraHeaders({'Authorization': 'Bearer ${token ?? ''}'})
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(3000)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('SocketService: connected, joining user room');
      _socket!.emit('join', userId);
    });

    _socket!.on('new_login_detected', (data) {
      final d = Map<String, dynamic>.from(data);
      _showNewLoginAlert(d);
    });

    _socket!.on('force_logout', (data) {
      debugPrint('SocketService: force_logout received');
      _handleForceLogout(data);
    });

    _socket!.onDisconnect((_) {
      debugPrint('SocketService: disconnected');
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _context = null;
  }

  void _handleForceLogout(dynamic data) {
    final ctx = _context;
    if (ctx != null && (ctx as Element).mounted) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(
          content: Text('You have been logged out from all devices.'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    _onForceLogout?.call();
  }

  void _showNewLoginAlert(Map<String, dynamic> data) {
    final ctx = _context;
    if (ctx == null || !(ctx as Element).mounted) return;

    final deviceName = data['device_name'] ?? 'Unknown device';
    final platform = data['platform'] ?? '';
    final loggedAt = data['logged_in_at'] ?? '';

    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.devices_other, color: AppTheme.warningColor, size: 28),
            const SizedBox(width: 10),
            const Expanded(
              child: Text('New Login Detected', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your account was just logged into from another device.',
              style: TextStyle(color: Colors.grey[700], fontSize: 14),
            ),
            const SizedBox(height: 16),
            _infoRow(Icons.phone_android, 'Device', deviceName),
            if (platform.isNotEmpty) _infoRow(Icons.computer, 'Platform', platform),
            if (loggedAt.isNotEmpty) _infoRow(Icons.schedule, 'Time', _formatTime(loggedAt)),
            const SizedBox(height: 12),
            Text(
              'If this wasn\'t you, secure your account immediately.',
              style: TextStyle(color: AppTheme.errorColor, fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('It\'s me', style: TextStyle(color: Colors.grey[600])),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.pop(context);
              _logoutAllDevices(ctx);
            },
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Logout All Devices'),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.primaryColor),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }

  String _formatTime(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final h = dt.hour > 12 ? dt.hour - 12 : dt.hour;
      final amPm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${dt.day}/${dt.month}/${dt.year} ${h == 0 ? 12 : h}:${dt.minute.toString().padLeft(2, '0')} $amPm';
    } catch (_) {
      return isoString;
    }
  }

  Future<void> _logoutAllDevices(BuildContext context) async {
    try {
      final result = await ApiService.post('/auth/logout-all-devices', {});
      if (result['success'] == true && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All devices logged out. Please login again.')),
        );
      }
    } catch (_) {}
  }

  static String get deviceName {
    try {
      return Platform.localHostname;
    } catch (_) {
      return 'Mobile device';
    }
  }

  static String get devicePlatform {
    try {
      return Platform.operatingSystem;
    } catch (_) {
      return 'unknown';
    }
  }
}
