import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/payment_provider.dart';
import '../../../core/theme/app_theme.dart';
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
          body: RefreshIndicator(
            onRefresh: () => provider.fetchChitGroupDetails(widget.groupId),
            child: provider.isLoading
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
                    : NestedScrollView(
                        headerSliverBuilder: (context, innerBoxIsScrolled) => [
                          _buildAppBar(group),
                          SliverToBoxAdapter(child: _buildHeader(group)),
                          SliverToBoxAdapter(child: _buildTabBar()),
                        ],
                        body: TabBarView(
                          controller: _tabController,
                          children: [
                            _OverviewTab(group: group),
                            _PrizedTicketsTab(groupId: widget.groupId),
                            _PaymentHistoryTab(groupId: widget.groupId),
                          ],
                        ),
                      ),
          ),
        );
      },
    );
  }

  Widget _buildAppBar(dynamic group) {
    return SliverAppBar(
      expandedHeight: 80,
      pinned: true,
      backgroundColor: AppTheme.primaryColor,
      foregroundColor: Colors.white,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          group?.groupName ?? 'Chit Group Details',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppTheme.primaryDark, AppTheme.primaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
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
            child: GestureDetector(
              onTap: () {
                final psoNo = group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber;
                final url = 'https://tchits.telangana.gov.in/CHITS_Display_Approval_Details.htm?PSO_NO=$psoNo';
                launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                    color: Colors.white24, borderRadius: BorderRadius.circular(20)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('PSO: ${group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            decoration: TextDecoration.underline,
                            decorationColor: Colors.white70)),
                    const SizedBox(width: 4),
                    const Icon(Icons.open_in_new, color: Colors.white70, size: 12),
                  ],
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
                color: Colors.white24, borderRadius: BorderRadius.circular(20)),
            child: Text('Auction (Monthly)',
                style: const TextStyle(
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
                  label: 'Monthly',
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
        labelColor: AppTheme.primaryColor,
        unselectedLabelColor: Colors.grey,
        indicatorColor: AppTheme.primaryColor,
        tabs: const [
          Tab(text: 'Overview'),
          Tab(text: 'Prized Tickets'),
          Tab(text: 'Payments'),
        ],
      ),
    );
  }

  String _fmtAmount(double v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
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
            _DetailRow('Monthly Installment', '₹${_fmt(group.monthlyInstallment)}'),
            _DetailRow('Total Members', '${group.totalMembers}'),
            _DetailRow('Months Completed', '${group.currentMonth}/${group.durationMonths}'),
            _DetailRow('Commenced in', commencedIn),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () {
              final psoNo = group.psoNumber.isNotEmpty ? group.psoNumber : group.groupNumber;
              final url = 'https://tchits.telangana.gov.in/CHITS_Display_Approval_Details.htm?PSO_NO=$psoNo';
              launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
            },
            icon: const Icon(Icons.info_outline, size: 18),
            label: const Text('More Info — PSO Certificate'),
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

// ─── PRIZED TICKETS TAB ───────────────────────────────────────────────────────

class _PrizedTicketsTab extends StatefulWidget {
  final String groupId;
  const _PrizedTicketsTab({required this.groupId});

  @override
  State<_PrizedTicketsTab> createState() => _PrizedTicketsTabState();
}

class _PrizedTicketsTabState extends State<_PrizedTicketsTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _members = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context
          .read<ChitGroupProvider>()
          .fetchGroupMembers(widget.groupId);
      if (mounted) setState(() { _members = res; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    final winners = _members.where((m) => m['is_prize_winner'] == true).toList();

    if (winners.isEmpty) {
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
      itemCount: winners.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final m = winners[i];
        final userObj = (m['user_id'] as Map<String, dynamic>?) ??
            (m['user'] as Map<String, dynamic>?);
        final ticketNo = m['ticket_number'] ?? (i + 1);
        final name = 'Ticket #$ticketNo';
        final auctionMonth = m['auction_month'] ?? m['prize_month'] ?? '';
        final prizeAmount = m['prize_amount'] ?? m['bid_amount'] ?? 0;
        final fmtAmt = NumberFormat('#,##,###').format(
            double.tryParse(prizeAmount.toString()) ?? 0);

        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(30),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text('$ticketNo',
                        style: const TextStyle(
                            color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1),
                      const SizedBox(height: 2),
                      Text('Month $auctionMonth',
                          style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('₹$fmtAmt',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.successColor,
                            fontSize: 14)),
                    const SizedBox(height: 2),
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.emoji_events, size: 12, color: Colors.amber),
                        SizedBox(width: 4),
                        Text('Winner', style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
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
}

// ─── PAYMENT HISTORY TAB ──────────────────────────────────────────────────────

class _PaymentHistoryTab extends StatefulWidget {
  final String groupId;
  const _PaymentHistoryTab({required this.groupId});

  @override
  State<_PaymentHistoryTab> createState() => _PaymentHistoryTabState();
}

class _PaymentHistoryTabState extends State<_PaymentHistoryTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _payments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context
          .read<ChitGroupProvider>()
          .fetchGroupPayments(widget.groupId);
      if (mounted) setState(() { _payments = res; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
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
            statusColor = Colors.orange;
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
                    if (p['can_pay'] == true)
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
                    const Text('Dividend Applied', style: TextStyle(color: Colors.green, fontSize: 13)),
                    Text('-\u20b9${NumberFormat('#,##,###').format(p['dividend_reduction'])}',
                        style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w600)),
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
                Icon(Icons.lock_outlined, color: Colors.blue, size: 14),
                SizedBox(width: 6),
                Expanded(
                  child: Text('Secure payment via Cashfree \u00b7 UPI \u00b7 Cards \u00b7 Net Banking',
                      style: TextStyle(color: Colors.blue, fontSize: 11)),
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
                                    backgroundColor: Colors.green,
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
                                  backgroundColor: Colors.red,
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
