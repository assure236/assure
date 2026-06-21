import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auction_provider.dart';
import '../../../core/theme/app_theme.dart';

class AuctionsScreen extends StatefulWidget {
  const AuctionsScreen({super.key});

  @override
  State<AuctionsScreen> createState() => _AuctionsScreenState();
}

class _AuctionsScreenState extends State<AuctionsScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<AuctionProvider>();
      provider.fetchAuctions();
      provider.connectSocket();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // App came back to foreground — refresh data & reconnect socket
      final provider = context.read<AuctionProvider>();
      provider.fetchAuctions();
      provider.connectSocket();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Auctions'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.secondaryColor,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'Live'),
            Tab(text: 'Upcoming'),
            Tab(text: 'Past'),
          ],
        ),
      ),
      body: Consumer<AuctionProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          return RefreshIndicator(
            onRefresh: provider.fetchAuctions,
            child: TabBarView(
              controller: _tabController,
              children: [
                _AuctionListTab(
                  auctions: provider.liveAuctions,
                  emptyTitle: 'No Live Auctions',
                  emptySubtitle: 'Live auctions will appear here when running.',
                  isLive: true,
                ),
                _AuctionListTab(
                  auctions: provider.upcomingAuctions,
                  emptyTitle: 'No Upcoming Auctions',
                  emptySubtitle: 'Scheduled auctions will appear here.',
                ),
                _AuctionListTab(
                  auctions: provider.pastAuctions,
                  emptyTitle: 'No Past Auctions',
                  emptySubtitle: 'Completed auction records will appear here.',
                  isPast: true,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AuctionListTab extends StatelessWidget {
  final List<Map<String, dynamic>> auctions;
  final String emptyTitle;
  final String emptySubtitle;
  final bool isLive;
  final bool isPast;

  const _AuctionListTab({
    required this.auctions,
    required this.emptyTitle,
    required this.emptySubtitle,
    this.isLive = false,
    this.isPast = false,
  });

  @override
  Widget build(BuildContext context) {
    if (auctions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(
              isLive ? Icons.gavel : Icons.event_busy,
              size: 72,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(emptyTitle,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(emptySubtitle,
                style: TextStyle(color: Colors.grey[500], fontSize: 14),
                textAlign: TextAlign.center),
          ]),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: auctions.length,
      itemBuilder: (context, i) => _AuctionCard(
        auction: auctions[i],
        isLive: isLive,
        isPast: isPast,
      ),
    );
  }
}

class _AuctionCard extends StatefulWidget {
  final Map<String, dynamic> auction;
  final bool isLive;
  final bool isPast;

  const _AuctionCard(
      {required this.auction, this.isLive = false, this.isPast = false});

  @override
  State<_AuctionCard> createState() => _AuctionCardState();
}

class _AuctionCardState extends State<_AuctionCard> {
  Timer? _timer;
  int _serverTimeRemaining = 0;

  @override
  void initState() {
    super.initState();
    if (widget.isLive) {
      // Use server_time_remaining from API, fallback to end_time calculation
      final serverRemaining = widget.auction['server_time_remaining'];
      if (serverRemaining != null) {
        _serverTimeRemaining = (serverRemaining as num).toInt();
      } else {
        final endTime = widget.auction['end_time'] != null
            ? DateTime.tryParse(widget.auction['end_time'])
            : null;
        if (endTime != null) {
          _serverTimeRemaining = endTime.difference(DateTime.now()).inSeconds;
          if (_serverTimeRemaining < 0) _serverTimeRemaining = 0;
        }
      }
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) {
          setState(() {
            _serverTimeRemaining = (_serverTimeRemaining - 1).clamp(0, 999999);
          });
        }
      });
    }
  }

  @override
  void didUpdateWidget(covariant _AuctionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Update timer when auction data refreshes from provider
    if (widget.isLive) {
      final serverRemaining = widget.auction['server_time_remaining'];
      if (serverRemaining != null) {
        _serverTimeRemaining = (serverRemaining as num).toInt();
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.auction;
    final chitGroupData = a['chitGroup'] ?? a['chit_group'] ?? a['chit_group_id'];
    final groupName = chitGroupData?['group_name'] ?? 'Chit Group';
    final groupNumber = chitGroupData?['group_number'] ?? '';
    final month = a['month_number'] ?? 0;
    final highestBid =
        double.tryParse((a['current_highest_bid'] ?? a['winning_bid_amount'])?.toString() ?? '0') ?? 0;
    final chitValue =
        double.tryParse(chitGroupData?['chit_value']?.toString() ?? '0') ?? 0;
    final totalMembers = int.tryParse(chitGroupData?['total_members']?.toString() ?? '1') ?? 1;
    final winnerName = a['winner']?['full_name'] ?? a['winner_id']?['full_name'];

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Column(children: [
        // Header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: widget.isLive && a['status'] == 'paused'
                  ? [const Color(0xFFFF8F00), const Color(0xFFE65100)]
                  : widget.isLive
                      ? [const Color(0xFFD32F2F), const Color(0xFFB71C1C)]
                      : widget.isPast
                          ? [Colors.grey[700]!, Colors.grey[900]!]
                          : [const Color(0xFF6A1B9A), const Color(0xFF4A148C)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Row(children: [
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      if (widget.isLive && a['status'] == 'paused') ...[
                        const Icon(Icons.pause_circle_filled, color: Colors.white, size: 12),
                        const SizedBox(width: 4),
                        const Text('PAUSED',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 10)),
                        const SizedBox(width: 8),
                      ] else if (widget.isLive) ...[
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                              color: AppTheme.errorColor,
                              shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 4),
                        const Text('LIVE',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 10)),
                        const SizedBox(width: 8),
                      ],
                      Text('Month $month Auction',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12)),
                    ]),
                    const SizedBox(height: 4),
                    Text(groupName,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    Text(groupNumber,
                        style: const TextStyle(
                            color: Colors.white60, fontSize: 11)),
                  ]),
            ),
            if (widget.isLive && a['status'] == 'paused')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.pause, color: Colors.white, size: 16),
                  SizedBox(width: 4),
                  Text('PAUSED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                ]),
              )
            else if (widget.isLive && _serverTimeRemaining > 0)
              _TimerWidget(remainingSeconds: _serverTimeRemaining),
          ]),
        ),
        // Body
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(
                  child: _AuctionStat(
                      label: 'Chit Value',
                      value: '₹${_fmt(chitValue)}',
                      icon: Icons.account_balance)),
              Expanded(
                  child: _AuctionStat(
                      label: widget.isPast ? 'Winning Bid' : 'Highest Bid',
                      value: highestBid > 0 ? '₹${_fmt(highestBid)}' : '—',
                      icon: Icons.trending_up,
                      highlight: !widget.isPast && highestBid > 0)),
              Expanded(
                  child: _AuctionStat(
                      label: 'Dividend/Member',
                      value: highestBid > 0
                          ? '₹${_fmt((highestBid / totalMembers).roundToDouble())}'
                          : '—',
                      icon: Icons.savings)),
            ]),
            if (widget.isPast && winnerName != null) ...[
              const Divider(height: 20),
              Row(children: [
                const Icon(Icons.emoji_events, color: Colors.amber, size: 18),
                const SizedBox(width: 8),
                Text('Winner: ',
                    style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                Text(winnerName,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 13)),
              ]),
            ],
            if (!widget.isPast) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: widget.isLive
                      ? () {
                          final id = (a['_id'] ?? a['id'])?.toString();
                          if (id != null) context.push('/auctions/$id');
                        }
                      : null,
                  icon: Icon(a['status'] == 'paused' ? Icons.pause_circle : Icons.gavel, size: 18),
                  label: Text(
                      a['status'] == 'paused' ? 'Auction Paused - View Room' : widget.isLive ? 'Enter Auction Room' : 'Starts ${_startTime(a)}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: a['status'] == 'paused'
                        ? const Color(0xFFFF8F00)
                        : widget.isLive
                            ? AppTheme.errorColor
                            : Colors.grey[300],
                    foregroundColor:
                        widget.isLive ? Colors.white : Colors.grey[600],
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
            if (widget.isPast) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    final id = (a['_id'] ?? a['id'])?.toString();
                    if (id != null) context.push('/auctions/$id');
                  },
                  icon: const Icon(Icons.visibility, size: 18),
                  label: const Text('View Auction Details'),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }

  String _startTime(Map<String, dynamic> a) {
    final t = a['start_time'];
    if (t == null) return 'soon';
    final dt = DateTime.tryParse(t);
    if (dt == null) return 'soon';
    return DateFormat('dd MMM, hh:mm a').format(dt);
  }
}

class _TimerWidget extends StatelessWidget {
  final int remainingSeconds;
  const _TimerWidget({required this.remainingSeconds});

  @override
  Widget build(BuildContext context) {
    final total = remainingSeconds < 0 ? 0 : remainingSeconds;
    final h = (total ~/ 3600).toString().padLeft(2, '0');
    final m = ((total % 3600) ~/ 60).toString().padLeft(2, '0');
    final s = (total % 60).toString().padLeft(2, '0');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
          color: Colors.white24, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Text('$h:$m:$s',
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
                fontFamily: 'monospace')),
        const Text('remaining',
            style: TextStyle(color: Colors.white60, fontSize: 10)),
      ]),
    );
  }
}

class _AuctionStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool highlight;

  const _AuctionStat({
    required this.label,
    required this.value,
    required this.icon,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Icon(icon,
          size: 20,
          color: highlight ? AppTheme.secondaryColor : Colors.grey[400]),
      const SizedBox(height: 4),
      Text(value,
          style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color:
                  highlight ? AppTheme.secondaryColor : Colors.black87)),
      Text(label,
          style: const TextStyle(fontSize: 10, color: Colors.black45)),
    ]);
  }
}
