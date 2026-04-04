import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = false;
  Map<String, dynamic>? _analytics;
  String? _error;
  int _touchedIndex = -1;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _fetchAnalytics();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAnalytics() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiService.get('/dashboard/analytics');
      if (res['success'] == true) {
        final data = Map<String, dynamic>.from(res['data'] ?? {});

        // Also fetch dividend analytics and merge
        try {
          final divRes = await ApiService.get('/dashboard/dividend-analytics');
          if (divRes['success'] == true) {
            final divData = divRes['data'] as Map<String, dynamic>? ?? {};
            final rawGroups = List<Map<String, dynamic>>.from(divData['groups'] ?? []);

            // Map backend fields to what the UI expects
            final mappedGroups = rawGroups.map((g) {
              final mapped = Map<String, dynamic>.from(g);
              mapped['dividend_earned'] = g['avg_dividend_per_member'] ?? 0;
              mapped['months_paid'] = g['current_month'] ?? 0;
              return mapped;
            }).toList();

            // Compute totals for summary cards
            double totalDiv = 0;
            double totalBidRatio = 0;
            for (final g in rawGroups) {
              totalDiv += ((g['avg_dividend_per_member'] ?? 0) * (g['current_month'] ?? 0)).toDouble();
              final cv = (g['chit_value'] ?? 1).toDouble();
              totalBidRatio += ((g['avg_winning_bid'] ?? 0) / cv);
            }
            data['chit_group_performance'] = mappedGroups;
            data['total_dividends_earned'] = totalDiv;
            data['avg_bid_ratio'] = rawGroups.isNotEmpty ? totalBidRatio / rawGroups.length : 0;
          }
        } catch (_) { /* dividend analytics optional */ }

        setState(() => _analytics = data);
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load analytics');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('My Analytics'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchAnalytics),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.secondaryColor,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Dividends'),
            Tab(text: 'Calculator'),
            Tab(text: 'Statement'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _PaymentOverviewTab(
                      analytics: _analytics,
                      onTouched: (i) => setState(() => _touchedIndex = i),
                      touchedIndex: _touchedIndex,
                    ),
                    _DividendAnalyticsTab(analytics: _analytics),
                    const _DividendCalculatorTab(),
                    const _AccountStatementTab(),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
          const SizedBox(height: 16),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _fetchAnalytics, child: const Text('Retry')),
        ]),
      ),
    );
  }
}

// TAB 1: PAYMENT OVERVIEW
class _PaymentOverviewTab extends StatelessWidget {
  final Map<String, dynamic>? analytics;
  final int touchedIndex;
  final void Function(int) onTouched;

  const _PaymentOverviewTab({required this.analytics, required this.touchedIndex, required this.onTouched});

  @override
  Widget build(BuildContext context) {
    final totalInvested = (analytics?['total_invested'] ?? 0.0).toDouble();
    final activeChits = analytics?['active_chits'] ?? 0;
    final paymentStatus = analytics?['payment_status'] as Map<String, dynamic>? ?? {};
    final monthly = List<Map<String, dynamic>>.from(analytics?['monthly_collections'] ?? []);

    return RefreshIndicator(
      onRefresh: () async {},
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _SummaryCard(label: 'Total Invested', value: '${_fmt(totalInvested)}', icon: Icons.account_balance_wallet, color: AppTheme.primaryColor)),
            const SizedBox(width: 12),
            Expanded(child: _SummaryCard(label: 'Active Chits', value: '$activeChits', icon: Icons.group, color: AppTheme.secondaryColor)),
          ]),
          const SizedBox(height: 20),
          if (monthly.isNotEmpty) ...[
            const Text('6-Month Collections', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildLineChart(monthly),
            const SizedBox(height: 20),
          ],
          if (paymentStatus.isNotEmpty) ...[
            const Text('Payment Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildPieSection(paymentStatus),
          ],
        ]),
      ),
    );
  }

  Widget _buildLineChart(List<Map<String, dynamic>> monthly) {
    final spots = <FlSpot>[];
    for (var i = 0; i < monthly.length; i++) {
      spots.add(FlSpot(i.toDouble(), (monthly[i]['amount'] ?? 0.0).toDouble()));
    }
    final maxY = spots.isEmpty ? 100.0 : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 220,
          child: LineChart(LineChartData(
            gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: maxY / 4,
              getDrawingHorizontalLine: (v) => FlLine(color: Colors.grey.shade200, strokeWidth: 1)),
            titlesData: FlTitlesData(
              leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 50,
                getTitlesWidget: (v, m) => Text('${_fmt(v)}', style: const TextStyle(fontSize: 9, color: Colors.grey)))),
              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true,
                getTitlesWidget: (v, m) {
                  final idx = v.toInt();
                  if (idx < 0 || idx >= monthly.length) return const SizedBox();
                  return Padding(padding: const EdgeInsets.only(top: 4),
                    child: Text(monthly[idx]['month'] ?? '', style: const TextStyle(fontSize: 9, color: Colors.grey)));
                })),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [LineChartBarData(
              spots: spots, isCurved: true, color: AppTheme.primaryColor, barWidth: 3,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(show: true, color: AppTheme.primaryColor.withAlpha(31)),
            )],
            minY: 0, maxY: maxY * 1.2,
          )),
        ),
      ),
    );
  }

  Widget _buildPieSection(Map<String, dynamic> paymentStatus) {
    final paid = (paymentStatus['paid'] ?? 0).toDouble();
    final pending = (paymentStatus['pending'] ?? 0).toDouble();
    final failed = (paymentStatus['failed'] ?? 0).toDouble();
    final total = paid + pending + failed;
    if (total == 0) return const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No payment data', style: TextStyle(color: Colors.grey)))));
    final sections = <PieChartSectionData>[
      if (paid > 0) PieChartSectionData(color: AppTheme.successColor, value: paid, title: '${(paid/total*100).toStringAsFixed(0)}%', radius: touchedIndex==0?65:55, titleStyle: const TextStyle(color:Colors.white,fontWeight:FontWeight.bold,fontSize:13)),
      if (pending > 0) PieChartSectionData(color: AppTheme.secondaryColor, value: pending, title: '${(pending/total*100).toStringAsFixed(0)}%', radius: touchedIndex==1?65:55, titleStyle: const TextStyle(color:Colors.white,fontWeight:FontWeight.bold,fontSize:13)),
      if (failed > 0) PieChartSectionData(color: AppTheme.errorColor, value: failed, title: '${(failed/total*100).toStringAsFixed(0)}%', radius: touchedIndex==2?65:55, titleStyle: const TextStyle(color:Colors.white,fontWeight:FontWeight.bold,fontSize:13)),
    ];
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      SizedBox(height: 200, child: PieChart(PieChartData(
        pieTouchData: PieTouchData(touchCallback: (ev, res) {
          if (!ev.isInterestedForInteractions || res==null || res.touchedSection==null) { onTouched(-1); return; }
          onTouched(res.touchedSection!.touchedSectionIndex);
        }),
        sections: sections, centerSpaceRadius: 40, sectionsSpace: 3,
      ))),
      const SizedBox(height: 16),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        _LegendDot(color: AppTheme.successColor, label: 'Paid', count: paid.toInt()),
        const SizedBox(width: 20),
        _LegendDot(color: AppTheme.secondaryColor, label: 'Pending', count: pending.toInt()),
        const SizedBox(width: 20),
        _LegendDot(color: AppTheme.errorColor, label: 'Failed', count: failed.toInt()),
      ]),
    ])));
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v/100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v/1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}

// TAB 2: DIVIDEND ANALYTICS
class _DividendAnalyticsTab extends StatelessWidget {
  final Map<String, dynamic>? analytics;
  const _DividendAnalyticsTab({required this.analytics});

  @override
  Widget build(BuildContext context) {
    final groups = List<Map<String, dynamic>>.from(analytics?['chit_group_performance'] ?? []);
    final totalDividends = (analytics?['total_dividends_earned'] ?? 0.0).toDouble();
    final avgBidRatio = (analytics?['avg_bid_ratio'] ?? 0.0).toDouble();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: _SummaryCard(label: 'Total Dividends', value: '${_fmt(totalDividends)}', icon: Icons.savings_outlined, color: AppTheme.successColor)),
          const SizedBox(width: 12),
          Expanded(child: _SummaryCard(label: 'Avg Bid Ratio', value: '${(avgBidRatio*100).toStringAsFixed(1)}%', icon: Icons.trending_up, color: AppTheme.secondaryColor)),
        ]),
        const SizedBox(height: 20),
        const Text('Per Group Performance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (groups.isEmpty)
          Card(child: Padding(padding: const EdgeInsets.all(32), child: Column(children: [
            Icon(Icons.bar_chart_rounded, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 12),
            const Text('No dividend data yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            const Text('Enroll in a chit group to see dividend analytics', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 13)),
          ])))
        else
          ...groups.map((g) => _GroupDividendCard(group: g)),
        const SizedBox(height: 20),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.tips_and_updates, color: AppTheme.secondaryColor, size: 20),
            SizedBox(width: 8),
            Text('Dividend Insights', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
          const SizedBox(height: 12),
          _InsightRow(icon: Icons.info_outline, color: AppTheme.primaryColor, text: 'Lower bids = higher dividends for all non-winning members.'),
          const SizedBox(height: 8),
          _InsightRow(icon: Icons.star_outline, color: AppTheme.successColor, text: 'A credit score above 750 increases prize-taking eligibility.'),
          const SizedBox(height: 8),
          _InsightRow(icon: Icons.schedule, color: AppTheme.secondaryColor, text: 'Taking the prize in later months yields higher accumulated dividends.'),
        ]))),
      ]),
    );
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v/100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v/1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}

class _GroupDividendCard extends StatelessWidget {
  final Map<String, dynamic> group;
  const _GroupDividendCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final name = group['group_name'] ?? 'Chit Group';
    final chitValue = (group['chit_value'] ?? 0.0).toDouble();
    final dividend = (group['dividend_earned'] ?? 0.0).toDouble();
    final monthsPaid = group['months_paid'] ?? 0;
    final totalMonths = group['duration_months'] ?? 1;
    final progress = (monthsPaid / totalMonths).clamp(0.0, 1.0);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: AppTheme.successColor.withAlpha(26), borderRadius: BorderRadius.circular(8)),
            child: Text('${_fmt(dividend)} earned', style: const TextStyle(color: AppTheme.successColor, fontSize: 11, fontWeight: FontWeight.bold)),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Text('Chit Value: ${_fmt(chitValue)}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(width: 16),
          Text('Month $monthsPaid/$totalMonths', style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ]),
        const SizedBox(height: 8),
        ClipRRect(borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: progress, backgroundColor: Colors.grey[200],
            valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor), minHeight: 6)),
      ])),
    );
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v/100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v/1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}

// TAB 3: DIVIDEND CALCULATOR
class _DividendCalculatorTab extends StatefulWidget {
  const _DividendCalculatorTab();
  @override
  State<_DividendCalculatorTab> createState() => _DividendCalculatorTabState();
}

class _DividendCalculatorTabState extends State<_DividendCalculatorTab> {
  final _chitValueCtrl = TextEditingController(text: '100000');
  final _membersCtrl = TextEditingController(text: '20');
  final _bidCtrl = TextEditingController(text: '80000');
  double? _dividend;
  double? _prizeAmount;
  double? _foremanCommission;
  double? _forfeiturePool;

  void _calculate() {
    final chitValue = double.tryParse(_chitValueCtrl.text) ?? 0;
    final members = double.tryParse(_membersCtrl.text) ?? 1;
    final bid = double.tryParse(_bidCtrl.text) ?? 0;
    final commission = chitValue * 0.05;
    final forfeiture = chitValue - bid;
    setState(() {
      _foremanCommission = commission;
      _forfeiturePool = forfeiture;
      _dividend = forfeiture / members;
      _prizeAmount = chitValue - commission;
    });
  }

  @override
  void dispose() {
    _chitValueCtrl.dispose();
    _membersCtrl.dispose();
    _bidCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF071428), Color(0xFF0B1F3B)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(children: [
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.calculate_outlined, color: Colors.white, size: 24)),
            const SizedBox(width: 12),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Dividend Calculator', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              SizedBox(height: 2),
              Text('Estimate your monthly dividend income', style: TextStyle(color: Colors.white70, fontSize: 12)),
            ])),
          ]),
        ),
        const SizedBox(height: 20),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
          _CalcField(label: 'Chit Value (INR)', controller: _chitValueCtrl, hint: 'e.g. 100000', icon: Icons.account_balance_wallet_outlined),
          const SizedBox(height: 14),
          _CalcField(label: 'Number of Members', controller: _membersCtrl, hint: 'e.g. 20', icon: Icons.group_outlined),
          const SizedBox(height: 14),
          _CalcField(label: 'Winning Bid Amount (INR)', controller: _bidCtrl, hint: 'e.g. 80000', icon: Icons.gavel),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(
            onPressed: _calculate,
            icon: const Icon(Icons.calculate, size: 18),
            label: const Text('Calculate Dividend'),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          )),
        ]))),
        if (_dividend != null) ...[
          const SizedBox(height: 20),
          const Text('Results', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            _ResultRow(label: 'Your Monthly Dividend', value: 'INR ${NumberFormat('#,##,###').format(_dividend!)}', color: AppTheme.successColor, isHighlight: true),
            const Divider(height: 20),
            _ResultRow(label: 'Prize Amount (Winner)', value: 'INR ${NumberFormat('#,##,###').format(_prizeAmount!)}', color: AppTheme.primaryColor),
            const SizedBox(height: 8),
            _ResultRow(label: 'Foreman Commission (5%)', value: 'INR ${NumberFormat('#,##,###').format(_foremanCommission!)}', color: Colors.grey),
            const SizedBox(height: 8),
            _ResultRow(label: 'Forfeiture Pool', value: 'INR ${NumberFormat('#,##,###').format(_forfeiturePool!)}', color: Colors.orange),
          ]))),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppTheme.primaryColor.withAlpha(15), borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.primaryColor.withAlpha(51))),
            child: const Row(children: [
              Icon(Icons.info_outline, color: AppTheme.primaryColor, size: 16),
              SizedBox(width: 8),
              Expanded(child: Text('Dividend = (Chit Value - Winning Bid) / No.of Members. Actual values may vary.',
                style: TextStyle(color: AppTheme.primaryColor, fontSize: 12))),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _CalcField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  const _CalcField({required this.label, required this.controller, required this.hint, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
      const SizedBox(height: 6),
      TextField(controller: controller, keyboardType: TextInputType.number,
        decoration: InputDecoration(hintText: hint, prefixIcon: Icon(icon, size: 20),
          filled: true, fillColor: AppTheme.backgroundColor,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
    ]);
  }
}

class _ResultRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isHighlight;
  const _ResultRow({required this.label, required this.value, required this.color, this.isHighlight = false});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: TextStyle(color: Colors.grey[700], fontSize: isHighlight ? 15 : 13, fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal)),
      Text(value, style: TextStyle(color: color, fontSize: isHighlight ? 18 : 14, fontWeight: FontWeight.bold)),
    ]);
  }
}

// TAB 4: ACCOUNT STATEMENT
class _AccountStatementTab extends StatefulWidget {
  const _AccountStatementTab();
  @override
  State<_AccountStatementTab> createState() => _AccountStatementTabState();
}

class _AccountStatementTabState extends State<_AccountStatementTab> {
  List<Map<String, dynamic>> _payments = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchStatement();
  }

  Future<void> _fetchStatement() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiService.get('/payments/my');
      if (res['success'] == true) {
        setState(() => _payments = List<Map<String, dynamic>>.from(res['data'] ?? []));
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load statement');
      }
    } catch (e) {
      setState(() => _error = 'Could not load statement');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppTheme.errorColor),
          const SizedBox(height: 12),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _fetchStatement, child: const Text('Retry')),
        ],
      )));
    }

    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '\u20B9', decimalDigits: 0);
    final totalAmount = _payments.fold<double>(0, (s, p) => s + ((p['total_amount'] ?? p['amount'] ?? 0).toDouble()));
    final successful = _payments.where((p) => p['payment_status'] == 'completed').length;
    final pending = _payments.where((p) => p['payment_status'] == 'pending' || p['payment_status'] == 'overdue').length;

    return RefreshIndicator(
      onRefresh: _fetchStatement,
      child: _payments.isEmpty
          ? ListView(children: [
              const SizedBox(height: 100),
              Center(child: Column(children: [
                Icon(Icons.receipt_long, size: 64, color: Colors.grey[300]),
                const SizedBox(height: 12),
                const Text('No transactions yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 4),
                const Text('Your payment history will appear here', style: TextStyle(color: Colors.grey, fontSize: 13)),
              ])),
            ])
          : ListView(padding: const EdgeInsets.all(16), children: [
              // Summary cards
              Row(children: [
                Expanded(child: _SummaryCard(label: 'Transactions', value: '${_payments.length}', icon: Icons.receipt_long, color: AppTheme.primaryColor)),
                const SizedBox(width: 12),
                Expanded(child: _SummaryCard(label: 'Total Amount', value: fmt.format(totalAmount), icon: Icons.account_balance_wallet, color: AppTheme.secondaryColor)),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _SummaryCard(label: 'Successful', value: '$successful', icon: Icons.check_circle_outline, color: AppTheme.successColor)),
                const SizedBox(width: 12),
                Expanded(child: _SummaryCard(label: 'Pending', value: '$pending', icon: Icons.pending_outlined, color: Colors.orange)),
              ]),
              const SizedBox(height: 20),
              const Text('Transaction History', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              ..._payments.map((p) => _PaymentTile(payment: p, fmt: fmt)),
            ]),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Map<String, dynamic> payment;
  final NumberFormat fmt;
  const _PaymentTile({required this.payment, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final status = payment['payment_status'] ?? 'pending';
    final amount = (payment['total_amount'] ?? payment['amount'] ?? 0).toDouble();
    final date = payment['payment_date'] ?? payment['created_at'] ?? '';
    final groupName = payment['chit_group_name'] ?? payment['group_name'] ?? 'Chit Group';
    final month = payment['month_number'] ?? '-';
    final type = (payment['payment_type'] ?? 'monthly').toString().replaceAll('_', ' ');

    Color statusColor;
    IconData statusIcon;
    switch (status) {
      case 'completed':
        statusColor = AppTheme.successColor;
        statusIcon = Icons.check_circle;
        break;
      case 'failed':
        statusColor = AppTheme.errorColor;
        statusIcon = Icons.cancel;
        break;
      case 'overdue':
        statusColor = Colors.red;
        statusIcon = Icons.warning;
        break;
      default:
        statusColor = Colors.orange;
        statusIcon = Icons.pending;
    }

    String formattedDate = '';
    if (date.isNotEmpty) {
      try {
        final dt = DateTime.parse(date);
        formattedDate = DateFormat('dd MMM yyyy').format(dt);
      } catch (_) {
        formattedDate = date.toString();
      }
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: statusColor.withAlpha(25), borderRadius: BorderRadius.circular(10)),
          child: Icon(statusIcon, color: statusColor, size: 22),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(child: Text(groupName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14), overflow: TextOverflow.ellipsis)),
            Text(fmt.format(amount), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: statusColor)),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(children: [
            Text('Month $month', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(width: 8),
            Container(width: 4, height: 4, decoration: BoxDecoration(color: Colors.grey[400], shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(type, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const Spacer(),
            Text(formattedDate, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
        ),
      ),
    );
  }
}

// SHARED WIDGETS
class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _SummaryCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 28),
      const SizedBox(height: 8),
      Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
    ])));
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  final int count;
  const _LegendDot({required this.color, required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text('$label ($count)', style: const TextStyle(fontSize: 12)),
    ]);
  }
}

class _InsightRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  const _InsightRow({required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 18),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 13, height: 1.4))),
    ]);
  }
}
