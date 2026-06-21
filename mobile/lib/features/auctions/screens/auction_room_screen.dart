import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/providers/auction_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/celebration_overlay.dart';
import '../widgets/bid_analytics_widget.dart';

class AuctionRoomScreen extends StatefulWidget {
  final String auctionId;

  const AuctionRoomScreen({super.key, required this.auctionId});

  @override
  State<AuctionRoomScreen> createState() => _AuctionRoomScreenState();
}

class _AuctionRoomScreenState extends State<AuctionRoomScreen> {
  bool _loading = true;
  Map<String, dynamic>? _auction;
  List<Map<String, dynamic>> _bids = [];
  String? _error;

  io.Socket? _socket;
  bool _socketConnected = false;
  Timer? _pollTimer;
  Timer? _localTimer;

  // ── Server-controlled timer ──
  int _serverTimeRemaining = 0;
  int _activeUsers = 0;
  double _walletBalance = 0;
  String? _antiSnipeAlert;
  String? _timeWarning;

  final _bidController = TextEditingController();
  bool _placing = false;
  String? _bidError;
  int _bidsTab = 0; // 0 = Bids, 1 = Participants
  String? _currentUserId;
  String? _currentUserRole;

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
    _fetchAuction();
    _initSocket();
  }

  @override
  void dispose() {
    _socket?.emit('leave_auction', {'auction_id': widget.auctionId});
    _socket?.dispose();
    _pollTimer?.cancel();
    _localTimer?.cancel();
    _bidController.dispose();
    super.dispose();
  }

  Map<String, dynamic>? _getChitGroup() {
    return _auction?['chitGroup'] ?? _auction?['chit_group'] ?? _auction?['chit_group_id'];
  }

  Future<void> _fetchAuction() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auctionRes = await ApiService.get('/auctions/${widget.auctionId}');
      final bidsRes = await ApiService.get('/auctions/${widget.auctionId}/bids');
      if (auctionRes['success'] == true) {
        final auction = auctionRes['data'] as Map<String, dynamic>;
        final bids = List<Map<String, dynamic>>.from(bidsRes['data'] ?? []);
        setState(() {
          _auction = auction;
          _bids = bids;
          if (auction['server_time_remaining'] != null) {
            _serverTimeRemaining = (auction['server_time_remaining'] as num).toInt();
          }
          if (auction['active_users'] != null) {
            _activeUsers = (auction['active_users'] as num).toInt();
          }
          if (auction['wallet_balance'] != null) {
            _walletBalance = (auction['wallet_balance'] as num).toDouble();
          }
          _startLocalCountdown();
        });
      } else {
        setState(() => _error = auctionRes['message'] ?? 'Failed to load auction');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('user');
    if (userJson != null) {
      final user = jsonDecode(userJson);
      setState(() {
        _currentUserId = user['_id'] ?? user['id'];
        _currentUserRole = user['role'];
      });
    }
  }

  void _showEditDialog() {
    if (_auction == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Auction data not loaded')),
      );
      return;
    }

    final isPaused = _auction!['status'] == 'paused';
    final auctionDateCtrl = TextEditingController(
      text: _auction!['auction_date'] != null 
        ? DateTime.parse(_auction!['auction_date']).toLocal().toString().substring(0, 16)
        : '',
    );
    final durationCtrl = TextEditingController(
      text: (_auction!['duration_minutes'] ?? 30).toString(),
    );
    final minBidCtrl = TextEditingController(
      text: (_auction!['min_bid_increment'] ?? 100).toString(),
    );
    final notesCtrl = TextEditingController(text: _auction!['notes'] ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Auction'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: auctionDateCtrl,
                decoration: InputDecoration(
                  labelText: 'Auction Date (YYYY-MM-DD HH:MM)',
                  hintText: '2026-04-20 10:00',
                  enabled: !isPaused,
                  helperText: isPaused ? 'Cannot change date for paused auction' : null,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: durationCtrl,
                decoration: InputDecoration(
                  labelText: 'Duration (minutes)',
                  helperText: isPaused ? 'Must be >= elapsed time' : null,
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: minBidCtrl,
                decoration: const InputDecoration(labelText: 'Min Bid Increment'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesCtrl,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _updateAuction(
                isPaused ? '' : auctionDateCtrl.text.trim(),
                durationCtrl.text.trim(),
                minBidCtrl.text.trim(),
                notesCtrl.text.trim(),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _updateAuction(String dateStr, String durationStr, String minBidStr, String notes) async {
    try {
      // Parse date to ISO8601
      DateTime? auctionDate;
      if (dateStr.isNotEmpty) {
        auctionDate = DateTime.parse(dateStr.replaceFirst(' ', 'T'));
      }

      final body = <String, dynamic>{};
      if (auctionDate != null) body['auction_date'] = auctionDate.toUtc().toIso8601String();
      if (durationStr.isNotEmpty) body['duration_minutes'] = int.parse(durationStr);
      if (minBidStr.isNotEmpty) body['min_bid_increment'] = int.parse(minBidStr);
      if (notes.isNotEmpty) body['notes'] = notes;

      if (body.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No changes to save')),
        );
        return;
      }

      final res = await ApiService.put('/auctions/${widget.auctionId}', body);
      if (!mounted) return;
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Auction updated successfully')),
        );
        await _fetchAuction(); // Refresh data
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Update failed')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  void _startLocalCountdown() {
    _localTimer?.cancel();
    if (_serverTimeRemaining <= 0) return;
    _localTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_serverTimeRemaining > 0) {
        setState(() => _serverTimeRemaining--);
      } else {
        _localTimer?.cancel();
      }
    });
  }

  Future<void> _initSocket() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    _connectSocket(token);
  }

  void _connectSocket(String? token) {
    try {
      // IMPORTANT: Use enableForceNew so this gets its own connection
      // separate from AuctionProvider's socket (same URL = shared by default)
      _socket = io.io(
        ApiService.socketUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .disableAutoConnect()
            .enableForceNew()
            .setAuth({'token': token ?? ''})
            .setExtraHeaders({'Authorization': 'Bearer ${token ?? ''}'})
            .enableReconnection()
            .setReconnectionAttempts(10)
            .setReconnectionDelay(2000)
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('AuctionRoom socket CONNECTED for auction ${widget.auctionId}');
        if (!mounted) return;
        setState(() => _socketConnected = true);
        _pollTimer?.cancel();
        _socket!.emit('join_auction', {'auction_id': widget.auctionId});
      });

      _socket!.onDisconnect((_) {
        debugPrint('AuctionRoom socket DISCONNECTED');
        if (!mounted) return;
        setState(() => _socketConnected = false);
      });

      // ── SERVER TIMER TICK (every 1 second from server) ──
      _socket!.on('timer_tick', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          final serverVal = (d['remaining_seconds'] as num?)?.toInt() ?? 0;
          setState(() {
            _serverTimeRemaining = serverVal;
            if (d['active_users'] != null) {
              _activeUsers = (d['active_users'] as num).toInt();
            }
          });
          // Restart local countdown synced to server value
          _localTimer?.cancel();
          if (serverVal > 0) {
            _localTimer = Timer.periodic(const Duration(seconds: 1), (_) {
              if (!mounted) return;
              if (_serverTimeRemaining > 0) {
                setState(() => _serverTimeRemaining--);
              } else {
                _localTimer?.cancel();
              }
            });
          }
        }
      });

      // ── AUCTION SYNC (sent when joining room) ──
      _socket!.on('auction_sync', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          setState(() {
            _serverTimeRemaining = (d['remaining_seconds'] as num?)?.toInt() ?? 0;
            _activeUsers = (d['active_users'] as num?)?.toInt() ?? 0;
          });
        }
      });

      // ── ANTI-SNIPE TIMER EXTENSION ──
      _socket!.on('timer_extended', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          final ext = d['extension_seconds'] ?? 30;
          setState(() {
            _antiSnipeAlert = 'Anti-snipe: Timer extended by ${ext}s!';
          });
          _showSnackBar('Anti-snipe: Timer extended by ${ext}s!', isError: false, isWarning: true);
          Future.delayed(const Duration(seconds: 8), () {
            if (mounted) setState(() => _antiSnipeAlert = null);
          });
        }
      });

      // ── ACTIVE USERS UPDATE ──
      _socket!.on('active_users_update', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          setState(() => _activeUsers = (d['count'] as num?)?.toInt() ?? _activeUsers);
        }
      });

      // ── TIME WARNING ──
      _socket!.on('time_warning', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          final urgency = d['urgency'] ?? 'medium';
          final message = d['message'] ?? 'Time is running out!';
          setState(() => _timeWarning = message);
          _showSnackBar(
            '⏰ $message',
            isError: urgency == 'critical',
            isWarning: urgency != 'critical',
          );
          Future.delayed(const Duration(seconds: 5), () {
            if (mounted) setState(() => _timeWarning = null);
          });
        }
      });

      // ── NEW BID ──
      _socket!.on('new_bid', (data) {
        debugPrint('AuctionRoom: new_bid received: $data');
        if (!mounted) return;
        final bid = Map<String, dynamic>.from(data);
        if (bid['auction_id'].toString() == widget.auctionId) {
          // Normalize user_id: socket sends string, API sends object
          final rawUserId = bid['user_id'];
          if (rawUserId is String) {
            bid['user_id'] = {'_id': rawUserId, 'full_name': bid['bidder_name'] ?? 'Member'};
            bid['bidder'] = bid['user_id'];
          }
          setState(() {
            _bids.insert(0, bid);
            if (_auction != null) {
              _auction!['current_highest_bid'] = bid['bid_amount'];
              _auction!['total_bid_count'] = bid['total_bids'];
            }
          });
          _showSnackBar(
            '₹${NumberFormat('#,##,###').format((bid['bid_amount'] as num).toInt())} by Ticket #${bid['ticket_number'] ?? '?'}',
            isError: false,
          );
          if (bid['anti_snipe_extended'] == true) {
            setState(() => _antiSnipeAlert = 'Anti-snipe activated! Timer extended.');
            Future.delayed(const Duration(seconds: 8), () {
              if (mounted) setState(() => _antiSnipeAlert = null);
            });
          }
        }
      });

      _socket!.on('auction_ended', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          setState(() {
            _auction?['status'] = 'completed';
            _serverTimeRemaining = 0;
          });
          _showSnackBar('Auction ended! Winner: Ticket #${d['winner_ticket_number'] ?? d['ticket_number'] ?? '?'}', isError: false);
          // Show celebration if current user won
          final winnerId = d['winner_id']?.toString();
          if (winnerId != null && winnerId == _currentUserId) {
            final groupName = _auction?['chit_group_id']?['group_name'] ?? _auction?['ChitGroup']?['group_name'];
            CelebrationOverlay.showAuctionWin(context, groupName: groupName?.toString());
          }
          _fetchAuction();
        }
      });

      _socket!.on('auction_started', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          _showSnackBar('Auction is now LIVE!', isError: false);
          _fetchAuction();
        }
      });

      _socket!.on('auction_status_changed', (data) {
        if (!mounted) return;
        _fetchAuction();
      });

      _socket!.on('auction_paused', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          setState(() {
            _auction?['status'] = 'paused';
            _serverTimeRemaining = (d['remaining_seconds'] as num?)?.toInt() ?? _serverTimeRemaining;
          });
          _localTimer?.cancel();
          _showSnackBar('Auction PAUSED by admin', isError: false, isWarning: true);
        }
      });

      _socket!.on('auction_resumed', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['auction_id'].toString() == widget.auctionId) {
          _showSnackBar('Auction RESUMED!', isError: false);
          _fetchAuction();
        }
      });

      _socket!.onConnectError((err) {
        debugPrint('AuctionRoom socket CONNECT ERROR: $err');
        if (!mounted) return;
        setState(() => _socketConnected = false);
        _startPolling();
      });

      _socket!.connect();
    } catch (e) {
      _startPolling();
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!mounted) return;
      try {
        final bidsRes = await ApiService.get('/auctions/${widget.auctionId}/bids');
        final auctionRes = await ApiService.get('/auctions/${widget.auctionId}');
        if (!mounted) return;
        setState(() {
          if (bidsRes['success'] == true) {
            _bids = List<Map<String, dynamic>>.from(bidsRes['data'] ?? []);
          }
          if (auctionRes['success'] == true) {
            _auction = auctionRes['data'];
            if (_auction?['server_time_remaining'] != null) {
              _serverTimeRemaining = (_auction!['server_time_remaining'] as num).toInt();
            }
          }
        });
      } catch (_) {}
    });
  }

  double get _currentHighest {
    return (_auction?['current_highest_bid'] ?? _auction?['winning_bid_amount'] ?? 0.0).toDouble();
  }

  int get _minIncrement {
    final v = _auction?['min_bid_increment'];
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 100;
    return 100;
  }
  int get _bidFee {
    final v = _auction?['bid_fee'];
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  Future<void> _placeBid() async {
    final amountStr = _bidController.text.trim();
    final amount = double.tryParse(amountStr);
    if (amount == null || amount <= 0) {
      setState(() => _bidError = 'Enter a valid bid amount');
      return;
    }

    final chitGroup = _getChitGroup();
    final chitValue = (chitGroup?['chit_value'] ?? 0.0).toDouble();
    final commissionPct = (chitGroup?['foreman_commission_percentage'] ?? 5.0).toDouble();
    final commission = (chitValue * (commissionPct / 100)).round();
    final auctionPool = chitValue - commission;
    final maxBidAmount = (auctionPool * 0.30).round(); // 30% of auction pool
    if (maxBidAmount > 0 && amount > maxBidAmount) {
      setState(() => _bidError = 'Max bid is 30% of pool = ₹${maxBidAmount.toStringAsFixed(0)}');
      return;
    }
    if (_currentHighest > 0 && amount <= _currentHighest) {
      setState(() => _bidError = 'Must be > ₹${_currentHighest.toStringAsFixed(0)} (highest wins)');
      return;
    }
    if (_minIncrement > 0 && _currentHighest > 0 && (amount - _currentHighest) < _minIncrement) {
      // Allow if bidding the max
      if (amount.toInt() != maxBidAmount) {
        setState(() => _bidError = 'Must be ₹$_minIncrement more than current highest');
        return;
      }
    }

    setState(() => _bidError = null);
    _showBidConfirmation(amount);
  }

  String _numberToWords(int num) {
    if (num <= 0) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num < 20) return ones[num];
    if (num < 100) return '${tens[num ~/ 10]}${num % 10 > 0 ? ' ${ones[num % 10]}' : ''}';
    if (num < 1000) return '${ones[num ~/ 100]} Hundred${num % 100 > 0 ? ' and ${_numberToWords(num % 100)}' : ''}';
    if (num < 100000) return '${_numberToWords(num ~/ 1000)} Thousand${num % 1000 > 0 ? ' ${_numberToWords(num % 1000)}' : ''}';
    if (num < 10000000) return '${_numberToWords(num ~/ 100000)} Lakh${num % 100000 > 0 ? ' ${_numberToWords(num % 100000)}' : ''}';
    return '${_numberToWords(num ~/ 10000000)} Crore${num % 10000000 > 0 ? ' ${_numberToWords(num % 10000000)}' : ''}';
  }

  void _showBidConfirmation(double amount) {
    int countdown = 5;
    Timer? countdownTimer;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setDialogState) {
          countdownTimer ??= Timer.periodic(const Duration(seconds: 1), (t) {
            if (countdown > 0) {
              countdown--;
              setDialogState(() {});
              if (countdown <= 0) {
                t.cancel();
                Navigator.pop(ctx);
                _submitBid(amount);
              }
            }
          });
          return AlertDialog(
            title: const Text('Confirm Your Bid', textAlign: TextAlign.center),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '₹${NumberFormat('#,##,###').format(amount.toInt())}',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppTheme.errorColor),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  '${_numberToWords(amount.toInt())} Rupees',
                  style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(
                  'This bid cannot be undone. You will sacrifice this amount from your payout if you win.',
                  style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () { countdownTimer?.cancel(); Navigator.pop(ctx); },
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  countdownTimer?.cancel();
                  Navigator.pop(ctx);
                  _submitBid(amount);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorColor, foregroundColor: Colors.white),
                child: Text(countdown > 0 ? 'Confirm (${countdown}s)' : 'CONFIRM BID'),
              ),
            ],
            actionsAlignment: MainAxisAlignment.center,
          );
        });
      },
    ).then((_) => countdownTimer?.cancel());
  }

  Future<void> _submitBid(double amount) async {
    setState(() {
      _placing = true;
    });

    try {
      final provider = context.read<AuctionProvider>();
      final res = await provider.placeBid(widget.auctionId, amount);
      if (res['success'] == true) {
        _bidController.clear();
        if (mounted) FocusScope.of(context).unfocus(); // Close numpad
        _showSnackBar('Bid of ₹${amount.toStringAsFixed(0)} placed!', isError: false);
        final data = res['data'];
        if (data != null && data['wallet_balance'] != null) {
          setState(() => _walletBalance = (data['wallet_balance'] as num).toDouble());
        }
        if (data != null && data['anti_snipe_extended'] == true) {
          _showSnackBar('Anti-snipe activated! Timer extended.', isError: false, isWarning: true);
        }
        if (!_socketConnected) await _fetchAuction();
      } else {
        final msg = res['message'] ?? 'Bid failed';
        final statusCode = res['statusCode'];
        if (statusCode == 429) {
          _showSnackBar(msg, isError: false, isWarning: true);
        } else {
          _showSnackBar(msg);
        }
      }
    } catch (e) {
      _showSnackBar('Could not place bid. Try again.');
    } finally {
      setState(() => _placing = false);
    }
  }

  void _showSnackBar(String message, {bool isError = true, bool isWarning = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isWarning ? AppTheme.warningColor : (isError ? AppTheme.errorColor : AppTheme.successColor),
      duration: const Duration(seconds: 3),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auctionStatus = _auction?['status'] ?? 'active';
    final isLive = auctionStatus == 'active' || auctionStatus == 'in_progress';
    final isPaused = auctionStatus == 'paused';

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(_getChitGroup()?['group_name'] ?? 'Auction Room'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          // Edit button (admin only, scheduled or paused auctions)
          if ((_currentUserRole == 'admin' || _currentUserRole == 'super_admin') && 
              (auctionStatus == 'scheduled' || auctionStatus == 'paused'))
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: _showEditDialog,
              tooltip: 'Edit Auction',
            ),
          if (_socketConnected)
            const Tooltip(
              message: 'Real-time connected',
              child: Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(Icons.circle, color: AppTheme.liveGreen, size: 12),
              ),
            ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchAuction),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _fetchAuction,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(child: _buildHeader(isLive)),
                      if (isPaused)
                        SliverToBoxAdapter(
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                            color: Colors.orange.shade100,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.pause_circle, color: Colors.orange.shade700, size: 20),
                                const SizedBox(width: 8),
                                Text('Auction is PAUSED',
                                    style: TextStyle(color: AppTheme.warningColor, fontWeight: FontWeight.bold, fontSize: 14)),
                              ],
                            ),
                          ),
                        ),
                      if (_antiSnipeAlert != null) SliverToBoxAdapter(child: _buildAntiSnipeBanner()),
                      if (_timeWarning != null) SliverToBoxAdapter(child: _buildTimeWarningBanner()),
                      // AI Bid Suggestion & Trend
                      if (isLive) SliverToBoxAdapter(child: BidAnalyticsWidget(auctionId: widget.auctionId)),
                      if (!isLive && !isPaused && (_auction?['status'] == 'completed'))
                        SliverToBoxAdapter(child: _buildSettlementBreakdown()),
                      if (isLive) SliverToBoxAdapter(child: _buildBidInput()),
                      SliverToBoxAdapter(child: _buildBidsParticipantsToggle()),
                      if (_bidsTab == 0) _buildBidsSliver(),
                      if (_bidsTab == 1) _buildParticipantsSliver(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildAntiSnipeBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      color: Colors.orange.shade100,
      child: Row(
        children: [
          const Icon(Icons.timer, color: AppTheme.warningColor, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _antiSnipeAlert!,
              style: TextStyle(color: AppTheme.warningColor, fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeWarningBanner() {
    final isCritical = _serverTimeRemaining <= 30;
    final bgColor = isCritical ? Colors.red.shade100 : Colors.amber.shade100;
    final fgColor = isCritical ? Colors.red.shade900 : Colors.amber.shade900;
    final iconColor = isCritical ? AppTheme.errorColor : AppTheme.warningColor;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      color: bgColor,
      child: Row(
        children: [
          Icon(Icons.alarm, color: iconColor, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _timeWarning!,
              style: TextStyle(color: fgColor, fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),
          if (isCritical)
            Icon(Icons.warning_amber_rounded, color: iconColor, size: 20),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _fetchAuction, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isLive) {
    final lowestBid = _currentHighest;
    final chitGroupData = _getChitGroup();
    final chitValue = (chitGroupData?['chit_value'] ?? 0.0).toDouble();
    final totalBids = (_auction?['total_bid_count'] ?? _bids.length) as int;
    final auctionStatus = _auction?['status'] ?? 'active';
    final isUrgent = _serverTimeRemaining > 0 && _serverTimeRemaining <= 60;

    final hours = (_serverTimeRemaining ~/ 3600);
    final minutes = ((_serverTimeRemaining % 3600) ~/ 60);
    final seconds = (_serverTimeRemaining % 60);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isLive
              ? (isUrgent ? [const Color(0xFFB71C1C), const Color(0xFFD32F2F)] : [AppTheme.primaryDark, AppTheme.primaryColor])
              : [const Color(0xFF616161), const Color(0xFF424242)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        children: [
          // Stats row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Chit Value',
                      style: TextStyle(color: Colors.white70, fontSize: 12)),
                  Text(
                    '₹${NumberFormat('#,##,###').format(chitValue.toInt())}',
                    style: const TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Highest Bid',
                      style: TextStyle(color: Colors.white70, fontSize: 12)),
                  Text(
                    lowestBid > 0 ? '₹${NumberFormat('#,##,###').format(lowestBid.toInt())}' : 'No bids',
                    style: const TextStyle(
                        color: AppTheme.secondaryColor,
                        fontSize: 20,
                        fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Info chips row
          if (isLive) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildInfoChip(Icons.people, '$_activeUsers online'),
                const SizedBox(width: 8),
                _buildInfoChip(Icons.gavel, '$totalBids bids'),
                const SizedBox(width: 8),
                _buildInfoChip(Icons.account_balance_wallet, 'Avail: ₹${_walletBalance.toStringAsFixed(0)}'),
              ],
            ),
          ],
          const SizedBox(height: 12),
          // Server-controlled timer
          if (isLive && _serverTimeRemaining > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.timer, color: Colors.white70, size: 16),
                const SizedBox(width: 4),
                const Text('Server Timer', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildTimeUnit(hours.toString().padLeft(2, '0'), 'HRS', isUrgent),
                Text(' : ', style: TextStyle(color: isUrgent ? AppTheme.countdownRed : Colors.white, fontWeight: FontWeight.bold, fontSize: 22)),
                _buildTimeUnit(minutes.toString().padLeft(2, '0'), 'MIN', isUrgent),
                Text(' : ', style: TextStyle(color: isUrgent ? AppTheme.countdownRed : Colors.white, fontWeight: FontWeight.bold, fontSize: 22)),
                _buildTimeUnit(seconds.toString().padLeft(2, '0'), 'SEC', isUrgent),
              ],
            ),
          ] else if (isLive && _serverTimeRemaining <= 0) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.orange.withAlpha(76),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Timer Expired — Finalizing...',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ] else ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: auctionStatus == 'completed'
                    ? AppTheme.successColor.withAlpha(76)
                    : Colors.orange.withAlpha(76),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                auctionStatus == 'completed' ? 'Auction Ended' : 'Scheduled',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
            if (auctionStatus == 'completed') ...[
              const SizedBox(height: 8),
              Text(
                'Winner: Ticket #${_auction?['winner_id']?['ticket_number'] ?? '?'}',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              if (_auction?['winning_bid_amount'] != null)
                Text(
                  'Winning Bid: ₹${NumberFormat('#,##,###').format((_auction!['winning_bid_amount'] as num).toInt())}',
                  style: const TextStyle(color: AppTheme.secondaryColor, fontSize: 16, fontWeight: FontWeight.bold),
                ),
            ],
          ],
        ],
      ),
    );
  }

  // Settlement breakdown for completed auctions
  Widget _buildSettlementBreakdown() {
    final chitGroup = _getChitGroup();
    final chitValue = (chitGroup?['chit_value'] ?? 0).toDouble();
    final totalMembers = (chitGroup?['total_members'] ?? 1).toInt();
    final winningBid = (_auction?['winning_bid_amount'] ?? 0).toDouble();
    final commission = (_auction?['commission_amount'] ?? (chitValue * 0.05)).toDouble();
    final dividendPerMember = (_auction?['dividend_per_member'] ?? (totalMembers > 0 ? (winningBid / totalMembers).round() : 0)).toDouble();
    final disbursement = (_auction?['disbursement_amount'] ?? (chitValue - commission - winningBid)).toDouble();
    final winnerTicket = _auction?['winner_id']?['ticket_number'] ?? '?';
    final winnerName = 'Ticket #$winnerTicket';

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(13), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.receipt_long, color: AppTheme.primaryColor, size: 20),
              SizedBox(width: 8),
              Text('Settlement Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const Divider(height: 20),
          _settleRow('Chit Value', chitValue, isBold: true),
          _settleRow('Commission (5%)', commission, isNegative: true),
          _settleRow('Winning Bid (sacrifice)', winningBid, isNegative: true),
          const Divider(height: 16),
          _settleRow('Winner Receives', disbursement, isBold: true, color: AppTheme.successColor),
          _settleRow('Dividend/Member', dividendPerMember, color: AppTheme.accentBlue),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.emoji_events, color: Colors.amber, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text('Winner: $winnerName', style: const TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _settleRow(String label, double amount, {bool isBold = false, bool isNegative = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[700])),
          Text(
            '${isNegative ? "- " : ""}₹${NumberFormat('#,##,###').format(amount.abs().toInt())}',
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              fontSize: isBold ? 15 : 13,
              color: color ?? (isNegative ? AppTheme.errorColor : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(38),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white70, size: 14),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildTimeUnit(String value, String unit, bool isUrgent) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isUrgent ? AppTheme.countdownRed.withAlpha(76) : Colors.white24,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(value,
              style: TextStyle(
                  color: isUrgent ? AppTheme.countdownRed : Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 4),
        Text(unit, style: const TextStyle(color: Colors.white60, fontSize: 9)),
      ],
    );
  }

  Widget _buildBidInput() {
    final chitGroup = _getChitGroup();
    final chitValue = (chitGroup?['chit_value'] ?? 0.0).toDouble();
    final commPct = (chitGroup?['foreman_commission_percentage'] ?? 5.0).toDouble();
    final commission = (chitValue * (commPct / 100)).round();
    final auctionPool = chitValue - commission;
    final maxBid = (auctionPool * 0.30).round();
    final rawMinBid = _currentHighest > 0 ? (_currentHighest + _minIncrement).toInt() : (_auction?['min_bid_amount'] ?? 1000).toInt();
    final minBid = maxBid > 0 && rawMinBid > maxBid ? maxBid : rawMinBid;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(20), blurRadius: 8, offset: const Offset(0, -2))],
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Min / Max bid limits bar ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [Colors.blue.shade50, Colors.orange.shade50]),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Min Bid', style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                    Text('₹${NumberFormat('#,##,###').format(minBid)}',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.blue.shade700)),
                  ],
                ),
                if (_bidFee > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text('Fee: ₹$_bidFee',
                        style: TextStyle(fontSize: 10, color: Colors.orange.shade800, fontWeight: FontWeight.w600)),
                  ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Max Bid', style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                    Text('₹${NumberFormat('#,##,###').format(maxBid)}',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.red.shade700)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          // ── Bid input row ──
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _bidController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: 'Enter Bidding Amount',
                    errorText: _bidError,
                    prefixText: '₹ ',
                    hintText: 'Enter amount',
                    helperText: (() {
                      final val = double.tryParse(_bidController.text.trim());
                      if (val != null && val > 0) {
                        return '₹${NumberFormat('#,##,###').format(val.toInt())} — ${_numberToWords(val.toInt())} Rupees';
                      }
                      return null;
                    })(),
                    helperMaxLines: 2,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: (_placing || _serverTimeRemaining <= 0) ? null : _placeBid,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.secondaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: _placing
                      ? const SizedBox(height: 18, width: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(_serverTimeRemaining <= 0 ? 'EXPIRED' : 'BID',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // ── Place Max Bid button ──
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: (_placing || _serverTimeRemaining <= 0)
                  ? null
                  : () {
                      _bidController.text = maxBid.toString();
                      setState(() {});
                    },
              icon: const Icon(Icons.flash_on, size: 18),
              label: Text('Place Max Bid — ₹${NumberFormat('#,##,###').format(maxBid)}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red.shade700,
                side: BorderSide(color: Colors.red.shade300),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBidsParticipantsToggle() {
    final participantCount = _getUniqueParticipants().length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _bidsTab = 0),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: _bidsTab == 0 ? AppTheme.primaryColor : Colors.grey.shade200,
                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(8)),
                ),
                child: Text('Bids (${_bids.length})',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 13,
                      color: _bidsTab == 0 ? Colors.white : Colors.black87,
                    )),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _bidsTab = 1),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: _bidsTab == 1 ? AppTheme.primaryColor : Colors.grey.shade200,
                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                ),
                child: Text('Participants ($participantCount)',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 13,
                      color: _bidsTab == 1 ? Colors.white : Colors.black87,
                    )),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _getUniqueParticipants() {
    final Map<String, Map<String, dynamic>> pMap = {};
    for (final bid in _bids) {
      final rawUserId = bid['user_id'];
      final uid = rawUserId is Map
          ? (rawUserId['_id']?.toString() ?? 'unknown')
          : rawUserId?.toString() ?? bid['bidder_name']?.toString() ?? 'unknown';
      final ticketNo = bid['ticket_number'] ?? bid['ticketNumber'];
      final name = 'Ticket #${ticketNo ?? '?'}';
      final amount = ((bid['bid_amount'] ?? 0) as num).toDouble();
      if (!pMap.containsKey(uid)) {
        pMap[uid] = {'name': name, 'bidCount': 0, 'highestBid': 0.0};
      }
      pMap[uid]!['bidCount'] = (pMap[uid]!['bidCount'] as int) + 1;
      if (amount > (pMap[uid]!['highestBid'] as double)) {
        pMap[uid]!['highestBid'] = amount;
      }
    }
    final list = pMap.entries.map((e) => {'uid': e.key, ...e.value}).toList();
    list.sort((a, b) => ((b['highestBid'] as double)).compareTo(a['highestBid'] as double));
    return list;
  }

  Widget _buildParticipantsSliver() {
    final participants = _getUniqueParticipants();
    if (participants.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(Icons.people_outline, size: 48, color: Colors.grey),
              SizedBox(height: 12),
              Text('No participants yet',
                  style: TextStyle(color: Colors.grey, fontSize: 16)),
            ],
          ),
        ),
      );
    }
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final p = participants[index];
          final isLeading = index == 0;
          return Column(
            children: [
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: isLeading
                      ? AppTheme.successColor
                      : AppTheme.primaryColor.withAlpha(26),
                  child: isLeading
                      ? const Icon(Icons.emoji_events, color: Colors.white, size: 20)
                      : const Text('T',
                          style: TextStyle(color: AppTheme.primaryColor,
                              fontWeight: FontWeight.bold, fontSize: 14)),
                ),
                title: Text(p['name'] as String,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: Text('${p['bidCount']} bid${(p['bidCount'] as int) > 1 ? 's' : ''}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${NumberFormat('#,##,###').format((p['highestBid'] as double).toInt())}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15,
                        color: isLeading ? AppTheme.successColor : Colors.black87,
                      ),
                    ),
                    const Text('highest bid', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  ],
                ),
              ),
              if (index < participants.length - 1) const Divider(height: 1),
            ],
          );
        },
        childCount: participants.length,
      ),
    );
  }

  Widget _buildBidsSliver() {
    // Chronological order — newest first (like chat)
    final chronoBids = List<Map<String, dynamic>>.from(_bids);
    // Find the highest bid amount
    double highestBidAmount = 0;
    for (final b in chronoBids) {
      final a = ((b['bid_amount'] ?? 0) as num).toDouble();
      if (a > highestBidAmount) highestBidAmount = a;
    }

    if (chronoBids.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(Icons.gavel, size: 48, color: Colors.grey),
              SizedBox(height: 12),
              Text('No bids yet. Be the first!',
                  style: TextStyle(color: Colors.grey, fontSize: 16)),
            ],
          ),
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Bids (${chronoBids.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            );
          }
          final bidIndex = index - 1;
          return _buildChatBidBubble(chronoBids[bidIndex], highestBidAmount);
        },
        childCount: chronoBids.length + 1,
      ),
    );
  }

  Widget _buildChatBidBubble(Map<String, dynamic> bid, double highestBidAmount) {
    final amount = ((bid['bid_amount'] ?? 0) as num).toDouble();
    final rawUserId = bid['user_id'];
    final bidUserId = rawUserId is Map
        ? (rawUserId['_id']?.toString() ?? '')
        : rawUserId?.toString() ?? '';
    final ticketNo = bid['ticket_number'] ?? bid['ticketNumber'];
    final timestamp = bid['created_at'] ?? bid['bid_time'] ?? bid['timestamp'];
    final bidTimeMs = bid['bid_time_ms'] as int?;
    final isMe = _currentUserId != null && bidUserId == _currentUserId;
    final isHighest = amount == highestBidAmount && highestBidAmount > 0;

    final bgColor = isMe
        ? AppTheme.primaryColor.withAlpha(31)
        : isHighest
            ? Colors.green.shade50
            : Colors.grey.shade100;
    final borderColor = isMe
        ? AppTheme.primaryColor.withAlpha(76)
        : isHighest
            ? Colors.green.shade300
            : Colors.grey.shade200;

    return Padding(
      padding: EdgeInsets.only(
        left: isMe ? 60 : 12,
        right: isMe ? 12 : 60,
        top: 4,
        bottom: 4,
      ),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border.all(color: borderColor, width: 1),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: Radius.circular(isMe ? 14 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 14),
            ),
          ),
          child: Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!isMe) ...[
                    Text('Ticket #${ticketNo ?? '?'}',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.black87)),
                    const SizedBox(width: 6),
                  ],
                  if (isMe) ...[
                    if (ticketNo != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withAlpha(38),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('T#$ticketNo',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                      ),
                    const SizedBox(width: 6),
                    Text('You',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppTheme.primaryColor)),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '₹${NumberFormat('#,##,###').format(amount.toInt())}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: isHighest ? Colors.green.shade700 : isMe ? AppTheme.primaryColor : Colors.black87,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isHighest) ...[
                    Icon(Icons.emoji_events, size: 12, color: AppTheme.successColor),
                    const SizedBox(width: 3),
                    Text('HIGHEST', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppTheme.successColor)),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    timestamp != null ? _formatTime(timestamp.toString(), bidTimeMs: bidTimeMs) : '',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(String iso, {int? bidTimeMs}) {
    try {
      final dt = bidTimeMs != null
          ? DateTime.fromMillisecondsSinceEpoch(bidTimeMs).toLocal()
          : DateTime.parse(iso).toLocal();
      final base = DateFormat('hh:mm:ss').format(dt);
      final ms = dt.millisecond.toString().padLeft(3, '0');
      final ampm = DateFormat('a').format(dt);
      return '$base.$ms $ampm';
    } catch (_) {
      return iso;
    }
  }
}
