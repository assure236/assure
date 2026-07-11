import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/payment_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/amount_format.dart';
import '../../payments/screens/cashfree_payment_screen.dart';

class ChitGroupDetailsScreen extends StatefulWidget {
  final String groupId;

  const ChitGroupDetailsScreen({super.key, required this.groupId});

  @override
  State<ChitGroupDetailsScreen> createState() => _ChitGroupDetailsScreenState();
}

class _ChitGroupDetailsScreenState extends State<ChitGroupDetailsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChitGroupProvider>().fetchChitGroupDetails(widget.groupId);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ChitGroupProvider>(
      builder: (context, provider, _) {
        final group = provider.selectedChitGroup;

        return Scaffold(
          backgroundColor: AppTheme.backgroundColor,
          appBar: AppBar(
            backgroundColor: AppTheme.primaryColor,
            foregroundColor: Colors.white,
            elevation: 0,
            title: Text(
              group?.groupName ?? 'Chit Group Details',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          body: provider.isLoading
              ? const Center(child: CircularProgressIndicator())
              : group == null
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 12),
                        const Text('Group not found'),
                        const SizedBox(height: 12),
                        TextButton(
                            onPressed: () => context.pop(),
                            child: const Text('Go Back')),
                      ]),
                    )
                  : Column(
                      children: [
                        _buildHeader(group),
                        _buildTabBar(),
                        Expanded(
                          child: TabBarView(
                            controller: _tabController,
                            children: [
                              _OverviewTab(group: group),
                              _PrizedTicketsTab(groupId: widget.groupId),
                              _PaymentHistoryTab(
                                groupId: widget.groupId,
                                isEnrolled: group.isEnrolled,
                                groupName: group.groupName,
                              ),
                            ],
                          ),
                        ),
                        if (!group.isEnrolled) _InvestNowBar(groupId: widget.groupId, groupName: group.groupName),
                      ],
                    ),
        );
      },
    );
  }

  Widget _buildHeader(dynamic group) {
    final progress = group.durationMonths > 0
        ? (group.currentMonth / group.durationMonths).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primaryColor, AppTheme.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(
              group.groupName,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
                color: Colors.white24, borderRadius: BorderRadius.circular(20)),
            child: const Text('Auction (Monthly)',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12)),
          ),
        ]),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _HeaderStat(
                  label: 'Chit Value',
                  value: '₹${_fmtAmount(group.chitValue)}'),
            ),
            Expanded(
              child: _HeaderStat(
                  label: 'Subscription',
                  value: '₹${_fmtAmount(group.monthlyInstallment)}'),
            ),
            Expanded(
              child: _HeaderStat(
                  label: 'Members', value: '${group.totalMembers}'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Months Completed: ${group.currentMonth}/${group.durationMonths}',
              style: const TextStyle(color: Colors.white70, fontSize: 12)),
          Text('${(progress * 100).toStringAsFixed(0)}%',
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: Colors.white24,
            valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
          ),
        ),
      ]),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: Colors.white,
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: AppTheme.primaryColor,
        unselectedLabelColor: Colors.grey,
        indicatorColor: AppTheme.primaryColor,
        tabs: const [
          Tab(text: 'Overview'),
          Tab(text: 'Prized Tickets'),
          Tab(text: 'Transactions'),
        ],
      ),
    );
  }

  String _fmtAmount(double v) => formatCompactInr(v);
}

class _HeaderStat extends StatelessWidget {
  final String label;
  final String value;
  const _HeaderStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value,
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
      Text(label,
          style: const TextStyle(color: Colors.white70, fontSize: 11)),
    ]);
  }
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final dynamic group;
  const _OverviewTab({required this.group});

  @override
  Widget build(BuildContext context) {
    final commencedIn = DateFormat('MMMM yyyy').format(group.commencementDate);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionCard(
          title: 'Group Details',
          children: [
            _DetailRow('Group Name', group.groupName),
            _DetailRow(
              'PSO No.',
              group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber,
              isLink: true,
              onTap: () {
                final psoNo = group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber;
                final url = 'https://tchits.telangana.gov.in/CHITS_Display_Approval_Details.htm?PSO_NO=$psoNo';
                launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              },
            ),
            _DetailRow('Auction', 'Monthly'),
            _DetailRow('Chit Value', '₹${_fmt(group.chitValue)}'),
            _DetailRow('Subscription', '₹${_fmt(group.monthlyInstallment)}'),
            _DetailRow('Total Members', '${group.totalMembers}'),
            _DetailRow('Months Completed', '${group.currentMonth}/${group.durationMonths}'),
            _DetailRow('Commenced from', commencedIn),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _showMoreInfoSheet(context, group),
            icon: const Icon(Icons.info_outline, size: 18),
            label: const Text('More Info'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.primaryColor,
              side: const BorderSide(color: AppTheme.primaryColor),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  String _fmt(double v) {
    final f = NumberFormat('#,##,###');
    return f.format(v);
  }
}

void _showMoreInfoSheet(BuildContext context, dynamic group) {
  final psoNo = group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber;
  final govtPsoUrl =
      'https://tchits.telangana.gov.in/CHITS_Display_Approval_Details.htm?PSO_NO=$psoNo';

  final docs = <Map<String, String>>[
    {
      'title': 'FDR Certificate',
      'url': group.fdrCertificateUrl?.toString() ?? '',
    },
    {
      'title': 'PSO Certificate',
      'url': (group.psoCertificateUrl?.toString() ?? '').isNotEmpty
          ? group.psoCertificateUrl.toString()
          : govtPsoUrl,
    },
    {
      'title': 'Draft Agreement',
      'url': group.draftAgreementUrl?.toString() ?? '',
    },
    {
      'title': 'Signed Agreement',
      'url': group.signedAgreementUrl?.toString() ?? '',
    },
  ];

  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(
              child: Text(
                'More Info',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),
            ...docs.map((doc) {
              final url = doc['url'] ?? '';
              final hasUrl = url.isNotEmpty;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  hasUrl ? Icons.description_outlined : Icons.info_outline,
                  color: hasUrl ? AppTheme.primaryColor : Colors.grey,
                ),
                title: Text(doc['title'] ?? ''),
                subtitle: hasUrl ? null : const Text('Not uploaded yet'),
                trailing: hasUrl
                    ? const Icon(Icons.open_in_new, size: 18, color: AppTheme.primaryColor)
                    : null,
                onTap: hasUrl
                    ? () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)
                    : null,
              );
            }),
          ],
        ),
      ),
    ),
  );
}

Future<void> _showBidHistory(BuildContext context, String auctionId, int month) async {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => Center(
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
              SizedBox(width: 16),
              Text('Loading bid history…', style: TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    ),
  );

  List<Map<String, dynamic>> bids = [];
  try {
    final res = await ApiService.get('/auctions/$auctionId/bids');
    if (res['success'] == true) {
      bids = List<Map<String, dynamic>>.from(res['data'] ?? []);
    }
  } catch (_) {}

  if (!context.mounted) return;
  Navigator.pop(context);

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.58,
      minChildSize: 0.38,
      maxChildSize: 0.88,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Color(0x1A000000),
              blurRadius: 20,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryColor, AppTheme.primaryDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(38),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.gavel_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bid History - Month $month',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          bids.isEmpty
                              ? 'No bids recorded'
                              : '${bids.length} bid${bids.length == 1 ? '' : 's'} placed',
                          style: TextStyle(
                            color: Colors.white.withAlpha(200),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: bids.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.history_toggle_off_rounded,
                                size: 48, color: Colors.grey[300]),
                            const SizedBox(height: 12),
                            Text(
                              'No bids recorded',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Bids will appear here after the auction.',
                              style: TextStyle(color: Colors.grey[500], fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: bids.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final bid = bids[i];
                        final bidder = bid['bidder'] is Map
                            ? (bid['bidder']['full_name'] ?? 'Member')
                            : 'Member';
                        final amount = double.tryParse(
                                bid['bid_amount']?.toString() ?? '0') ??
                            0;
                        final isWinner = i == 0;
                        return _BidHistoryRow(
                          rank: i + 1,
                          name: bidder.toString(),
                          amount: amount,
                          isWinner: isWinner,
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _BidHistoryRow extends StatelessWidget {
  final int rank;
  final String name;
  final double amount;
  final bool isWinner;

  const _BidHistoryRow({
    required this.rank,
    required this.name,
    required this.amount,
    required this.isWinner,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isWinner ? const Color(0xFFD4AF37) : AppTheme.primaryColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isWinner ? const Color(0xFFFFF8E7) : Colors.grey[50],
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isWinner ? accent.withAlpha(100) : const Color(0xFFE8ECF0),
        ),
        boxShadow: isWinner
            ? [
                BoxShadow(
                  color: accent.withAlpha(30),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accent.withAlpha(isWinner ? 45 : 25),
              shape: BoxShape.circle,
              border: Border.all(color: accent.withAlpha(80)),
            ),
            child: Center(
              child: isWinner
                  ? const Icon(Icons.emoji_events_rounded, color: Color(0xFFD4AF37), size: 18)
                  : Text(
                      '$rank',
                      style: TextStyle(
                        color: accent,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontWeight: isWinner ? FontWeight.bold : FontWeight.w600,
                    fontSize: 14,
                    color: AppTheme.primaryColor,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (isWinner)
                  const Text(
                    'Winning bid',
                    style: TextStyle(
                      color: Color(0xFFB8860B),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '₹${NumberFormat('#,##,###').format(amount)}',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: isWinner ? const Color(0xFF1B7A3E) : AppTheme.primaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _BidHistoryLink extends StatelessWidget {
  final String ticketNo;
  final VoidCallback onTap;

  const _BidHistoryLink({required this.ticketNo, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withAlpha(12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.primaryColor.withAlpha(40)),
          ),
          child: Row(
            children: [
              Icon(Icons.receipt_long_rounded,
                  size: 14, color: AppTheme.primaryColor.withAlpha(220)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Ticket #$ticketNo - View bid history',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTheme.primaryColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded,
                  size: 18, color: AppTheme.primaryColor.withAlpha(200)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── PRIZED TICKETS TAB ───────────────────────────────────────────────────────

String? _resolveWinnerTicket(Map<String, dynamic> auction) {
  final direct = auction['winner_ticket_number'];
  if (direct != null) {
    final text = direct.toString().trim();
    if (text.isNotEmpty && text != 'null' && text != '-') return text;
  }
  final winner = auction['winner_id'];
  if (winner is Map) {
    final fromWinner = winner['ticket_number']?.toString().trim();
    if (fromWinner != null && fromWinner.isNotEmpty) return fromWinner;
  }
  return null;
}

class _PrizedTicketsTab extends StatefulWidget {
  final String groupId;
  const _PrizedTicketsTab({required this.groupId});

  @override
  State<_PrizedTicketsTab> createState() => _PrizedTicketsTabState();
}

class _PrizedTicketsTabState extends State<_PrizedTicketsTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _auctions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context
          .read<ChitGroupProvider>()
          .fetchGroupAuctions(widget.groupId);
      if (mounted) setState(() { _auctions = res; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_auctions.isEmpty) {
      return const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.emoji_events_outlined, size: 48, color: Colors.grey),
              SizedBox(height: 12),
              Text('No prized tickets yet',
                  style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
              SizedBox(height: 4),
              Text('Winners will appear here after auctions',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _auctions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final a = _auctions[i];
        final monthNum = a['month_number'] ?? (i + 1);
        final month = monthNum is int ? monthNum : int.tryParse('$monthNum') ?? (i + 1);
        final ticketNo = _resolveWinnerTicket(a);
        final auctionId = (a['_id'] ?? a['id'] ?? '').toString();
        final canOpenHistory = auctionId.isNotEmpty;
        final winnerObj = a['winner_id'];
        final winnerName = (winnerObj is Map)
            ? (winnerObj['full_name'] ?? 'Winner')
            : 'Winner';
        final bidAmount = a['winning_bid_amount'] ?? 0;
        final fmtAmt = NumberFormat('#,##,###').format(
            double.tryParse(bidAmount.toString()) ?? 0);

        void openHistory() {
          if (!canOpenHistory) return;
          _showBidHistory(context, auctionId, month);
        }

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.amber.withAlpha(60)),
          ),
          color: Colors.white,
          shadowColor: Colors.black12,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: canOpenHistory ? openHistory : null,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [
                    Colors.amber.withAlpha(12),
                    Colors.white,
                  ],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFFD54F), Color(0xFFD4AF37)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: Text(
                            ticketNo ?? '-',
                            style: TextStyle(
                              color: ticketNo != null
                                  ? AppTheme.primaryColor
                                  : Colors.grey[600],
                              fontWeight: FontWeight.bold,
                              fontSize: ticketNo != null && ticketNo.length > 2 ? 13 : 17,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryColor.withAlpha(18),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'Month $month',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppTheme.primaryColor,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withAlpha(35),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                        color: Colors.amber.withAlpha(80)),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.emoji_events_rounded,
                                          size: 11, color: Color(0xFFB8860B)),
                                      SizedBox(width: 4),
                                      Text(
                                        'Winner',
                                        style: TextStyle(
                                          color: Color(0xFFB8860B),
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              winnerName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppTheme.primaryColor,
                                height: 1.25,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1B7A3E).withAlpha(18),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '₹$fmtAmt',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1B7A3E),
                                fontSize: 14,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Winning bid',
                            style: TextStyle(color: Colors.grey[500], fontSize: 10),
                          ),
                        ],
                      ),
                    ],
                  ),
                  if (ticketNo != null) ...[
                    const SizedBox(height: 12),
                    _BidHistoryLink(ticketNo: ticketNo, onTap: openHistory),
                  ] else ...[
                    const SizedBox(height: 8),
                    Text(
                      'Ticket number unavailable',
                      style: TextStyle(color: Colors.grey[500], fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─── PAYMENT HISTORY TAB ──────────────────────────────────────────────────────

class _PaymentHistoryTab extends StatefulWidget {
  final String groupId;
  final bool isEnrolled;
  final String groupName;
  const _PaymentHistoryTab({
    required this.groupId,
    required this.isEnrolled,
    required this.groupName,
  });

  @override
  State<_PaymentHistoryTab> createState() => _PaymentHistoryTabState();
}

class _PaymentHistoryTabState extends State<_PaymentHistoryTab> {
  bool _loading = true;
  bool _isEnrolled = false;
  List<Map<String, dynamic>> _payments = [];

  @override
  void initState() {
    super.initState();
    _isEnrolled = widget.isEnrolled;
    _load();
  }

  @override
  void didUpdateWidget(covariant _PaymentHistoryTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isEnrolled && widget.isEnrolled) {
      _isEnrolled = true;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final res = await context
          .read<ChitGroupProvider>()
          .fetchGroupPaymentSchedule(widget.groupId);
      if (mounted) {
        setState(() {
          _isEnrolled = res['is_enrolled'] == true;
          _payments = List<Map<String, dynamic>>.from(res['schedule'] ?? const []);
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (!_isEnrolled) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.trending_up_rounded, size: 64, color: Colors.grey[300]),
              const SizedBox(height: 16),
              const Text(
                'Not enrolled yet',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Invest in ${widget.groupName} to view your payment schedule and pay installments.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _InvestNowBar.enroll(context, widget.groupId, widget.groupName),
                  icon: const Icon(Icons.trending_up_rounded),
                  label: const Text('Invest Now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_payments.isEmpty) {
      return const Center(
          child: Text('No payment schedule available.',
              style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _payments.length,
      itemBuilder: (context, i) {
        final p = _payments[i];
        final status = p['status'] ?? 'pending';
        final month = p['month_number'] ?? (i + 1);
        Color statusColor;
        IconData statusIcon;
        switch (status) {
          case 'paid':
            statusColor = AppTheme.successColor;
            statusIcon = Icons.check_circle;
            break;
          case 'overdue':
            statusColor = AppTheme.errorColor;
            statusIcon = Icons.cancel;
            break;
          default:
            statusColor = AppTheme.warningColor;
            statusIcon = Icons.schedule;
        }

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: statusColor.withAlpha(26),
                  radius: 20,
                  child: Icon(statusIcon, color: statusColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Month $month',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(
                        p['due_date'] != null
                            ? DateFormat('dd MMM yyyy')
                                .format(DateTime.parse(p['due_date']))
                            : 'Pending',
                        style: TextStyle(color: Colors.grey[500], fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${p['amount'] ?? '-'}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    if ((p['dividend_reduction'] ?? 0) > 0)
                      Text(
                        '-₹${p['dividend_reduction']} dividend',
                        style: TextStyle(
                            color: AppTheme.successColor, fontSize: 10, fontWeight: FontWeight.w500),
                      ),
                    if (p['can_pay'] == true && _isEnrolled)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: SizedBox(
                          height: 28,
                          child: ElevatedButton(
                            onPressed: () => _showPayDialog(context, p),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: status == 'overdue'
                                  ? AppTheme.errorColor
                                  : AppTheme.primaryColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text('Pay Now'),
                          ),
                        ),
                      )
                    else
                      Text(
                        status.toUpperCase(),
                        style: TextStyle(
                            color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showPayDialog(BuildContext context, Map<String, dynamic> p) {
    final amount = double.tryParse(p['amount']?.toString() ?? '0') ?? 0;
    final month = p['month_number'] ?? 1;
    final status = p['status'] ?? 'pending';
    final isOverdue = status == 'overdue';
    bool isCreating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                  color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
            ),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(26), shape: BoxShape.circle),
              child: const Icon(Icons.payment, size: 40, color: AppTheme.primaryColor),
            ),
            const SizedBox(height: 12),
            Text('Pay Installment',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: AppTheme.backgroundColor, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('Month $month', style: const TextStyle(fontWeight: FontWeight.w500)),
                  Text('\u20b9${NumberFormat('#,##,###').format(amount)}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                ]),
                if ((p['dividend_reduction'] ?? 0) > 0) ...[
                  const SizedBox(height: 6),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Dividend Applied', style: TextStyle(color: AppTheme.successColor, fontSize: 13)),
                    Text('-\u20b9${NumberFormat('#,##,###').format(p['dividend_reduction'])}',
                        style: const TextStyle(color: AppTheme.successColor, fontWeight: FontWeight.w600)),
                  ]),
                ],
              ]),
            ),
            if (isOverdue) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(13),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.errorColor.withAlpha(76))),
                child: const Row(children: [
                  Icon(Icons.warning_amber, color: AppTheme.errorColor, size: 16),
                  SizedBox(width: 8),
                  Text('This payment is overdue. Late fee may apply.',
                      style: TextStyle(color: AppTheme.errorColor, fontSize: 12)),
                ]),
              ),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.blue.withAlpha(13), borderRadius: BorderRadius.circular(10)),
              child: const Row(children: [
                Icon(Icons.lock_outlined, color: AppTheme.accentBlue, size: 14),
                SizedBox(width: 6),
                Expanded(
                  child: Text('Secure payment via Cashfree \u00b7 UPI \u00b7 Cards \u00b7 Net Banking',
                      style: TextStyle(color: AppTheme.accentBlue, fontSize: 11)),
                ),
              ]),
            ),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: isCreating ? null : () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: isCreating
                      ? null
                      : () async {
                          setSheetState(() => isCreating = true);
                          final provider = context.read<PaymentProvider>();
                          final res = await provider.createOrder(
                            chitGroupId: widget.groupId,
                            monthNumber: month is int ? month : int.tryParse(month.toString()) ?? 1,
                            amount: amount,
                          );
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (res['success'] == true) {
                            final data = res['data'] as Map<String, dynamic>;
                            final paymentSessionId = data['payment_session_id'] as String?;
                            final orderId = data['order_id'] as String?;
                            final paymentId = data['payment_id'] as String?;
                            if (paymentSessionId != null && paymentSessionId.isNotEmpty && orderId != null) {
                              final result = await Navigator.push<Map<String, dynamic>>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CashfreePaymentScreen(
                                    paymentSessionId: paymentSessionId,
                                    orderId: orderId,
                                    paymentId: paymentId ?? '',
                                  ),
                                ),
                              );
                              if (result?['success'] == true && context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Payment successful! \u2713'),
                                    backgroundColor: AppTheme.successColor,
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                                _load();
                              }
                            } else {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(res['message'] ?? 'Cashfree not configured'),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            }
                          } else {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['message'] ?? 'Could not create payment order'),
                                  backgroundColor: AppTheme.errorColor,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          }
                        },
                  icon: isCreating
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.lock, size: 18),
                  label: Text(isCreating ? 'Creating order...' : 'Pay with Cashfree'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _InvestNowBar extends StatelessWidget {
  final String groupId;
  final String groupName;

  const _InvestNowBar({required this.groupId, required this.groupName});

  static Future<void> enroll(BuildContext context, String groupId, String groupName) async {
    final monthly = context.read<ChitGroupProvider>().selectedChitGroup?.monthlyInstallment ?? 0;
    final decision = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Investment'),
        content: Text(
          'Do you want to invest in $groupName?\n\n'
          'Subscription: ₹${NumberFormat('#,##,###').format(monthly)}',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor),
            child: const Text('Invest Now'),
          ),
        ],
      ),
    );
    if (decision != true || !context.mounted) return;

    final result = await context.read<ChitGroupProvider>().enrollInChitGroup(groupId);
    final ok = result['success'] == true;
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text((result['message'] ?? (ok ? 'Invested successfully' : 'Investment failed')).toString()),
        backgroundColor: ok ? AppTheme.successColor : AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
      ),
    );

    if (ok) {
      await context.read<ChitGroupProvider>().fetchChitGroupDetails(groupId);
      if (!context.mounted) return;
      await context.read<DashboardProvider>().refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => enroll(context, groupId, groupName),
            icon: const Icon(Icons.trending_up_rounded),
            label: const Text('Invest Now'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── SHARED WIDGETS ───────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SectionCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: AppTheme.primaryColor)),
          const Divider(height: 20),
          ...children,
        ]),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isLink;
  final VoidCallback? onTap;
  const _DetailRow(this.label, this.value, {this.isLink = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          isLink
              ? GestureDetector(
                  onTap: onTap,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(value,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: AppTheme.primaryColor,
                              decoration: TextDecoration.underline)),
                      const SizedBox(width: 4),
                      const Icon(Icons.open_in_new, size: 12, color: AppTheme.primaryColor),
                    ],
                  ),
                )
              : Text(value,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }
}
