import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../services/api_service.dart';
import '../services/location_service.dart';

class AuctionProvider with ChangeNotifier {
  List<Map<String, dynamic>> _auctions = [];
  bool _isLoading = false;
  String? _error;
  io.Socket? _socket;
  double _walletBalance = 0;
  Timer? _reconnectTimer;
  Timer? _pollTimer;

  bool get isLoading => _isLoading;
  String? get error => _error;
  double get walletBalance => _walletBalance;

  List<Map<String, dynamic>> get liveAuctions =>
      _auctions.where((a) => a['status'] == 'active' || a['status'] == 'in_progress' || a['status'] == 'paused').toList();

  List<Map<String, dynamic>> get upcomingAuctions =>
      _auctions.where((a) => a['status'] == 'scheduled').toList();

  List<Map<String, dynamic>> get pastAuctions =>
      _auctions.where((a) => a['status'] == 'completed' || a['status'] == 'cancelled').toList();

  bool get isSocketConnected => _socket?.connected ?? false;

  Future<void> connectSocket() async {
    // If already connected and working, skip
    if (_socket != null && _socket!.connected) return;

    // Dispose old socket if exists but not connected
    _socket?.dispose();
    _socket = null;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      _socket = io.io(
        ApiService.socketUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .disableAutoConnect()
            .setAuth({'token': token ?? ''})
            .setExtraHeaders({'Authorization': 'Bearer ${token ?? ''}'})
            .enableReconnection()
            .setReconnectionAttempts(10)
            .setReconnectionDelay(2000)
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('AuctionProvider socket connected');
        _reconnectTimer?.cancel();
        _pollTimer?.cancel();
        notifyListeners();
      });

      _socket!.onDisconnect((_) {
        debugPrint('AuctionProvider socket disconnected');
        _startPolling();
        notifyListeners();
      });

      _socket!.onConnectError((err) {
        debugPrint('AuctionProvider socket connect error: $err');
        _startPolling();
      });

      // Listen for auction status changes (global broadcast)
      _socket!.on('auction_status_changed', (_) {
        debugPrint('AuctionProvider: auction_status_changed received');
        fetchAuctions();
      });

      // Listen for auction created (global broadcast)
      _socket!.on('auction_created', (_) {
        debugPrint('AuctionProvider: auction_created received');
        fetchAuctions();
      });

      // Listen for auction started (global broadcast)
      _socket!.on('auction_started', (_) {
        debugPrint('AuctionProvider: auction_started received');
        fetchAuctions();
      });

      // Listen for auction ended (global broadcast)
      _socket!.on('auction_ended', (_) {
        debugPrint('AuctionProvider: auction_ended received');
        fetchAuctions();
      });

      _socket!.connect();
    } catch (e) {
      debugPrint('AuctionProvider socket error: $e');
      _startPolling();
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      fetchAuctions();
    });
  }

  void disconnectSocket() {
    _reconnectTimer?.cancel();
    _pollTimer?.cancel();
    _socket?.dispose();
    _socket = null;
  }

  Future<void> fetchAuctions() async {
    // Don't set loading=true on background refreshes if we already have data
    if (_auctions.isEmpty) {
      _isLoading = true;
    }
    _error = null;
    notifyListeners();
    try {
      final res = await ApiService.get('/auctions/my-auctions');
      if (res['success'] == true) {
        _auctions = List<Map<String, dynamic>>.from(res['data'] ?? []);
        if (res['wallet_balance'] != null) {
          _walletBalance = (res['wallet_balance'] as num).toDouble();
        }
      } else {
        _error = res['message'] ?? 'Failed to load auctions';
      }
    } catch (e) {
      _error = 'Could not connect to server';
      debugPrint('AuctionProvider error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> placeBid(
      String auctionId, double bidAmount) async {
    try {
      // Record location for audit trail
      final location = await LocationService.instance.getLocationData();

      final res = await ApiService.post('/auctions/$auctionId/bid', {
        'bid_amount': bidAmount,
        if (location != null) 'location': location,
      });
      if (res['success'] == true && res['data'] != null) {
        final data = res['data'];
        if (data['wallet_balance'] != null) {
          _walletBalance = (data['wallet_balance'] as num).toDouble();
          notifyListeners();
        }
      }
      return res;
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
