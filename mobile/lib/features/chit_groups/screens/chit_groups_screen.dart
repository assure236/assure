import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/celebration_overlay.dart';

class ChitGroupsScreen extends StatefulWidget {
  const ChitGroupsScreen({super.key});

  @override
  State<ChitGroupsScreen> createState() => _ChitGroupsScreenState();
}

class _ChitGroupsScreenState extends State<ChitGroupsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChitGroupProvider>().fetchMyChitGroups();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          SliverAppBar(
            floating: true,
            pinned: true,
            toolbarHeight: 48,
            backgroundColor: AppTheme.primaryColor,
            foregroundColor: Colors.white,
            elevation: 0,
            title: const Text('Chit Groups',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                )),
            centerTitle: true,
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: AppTheme.secondaryColor,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              tabs: const [
                Tab(text: 'New'),
                Tab(text: 'Vacant'),
              ],
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _AvailableGroupsTab(searchQuery: _searchQuery, filter: 'new'),
            _AvailableGroupsTab(searchQuery: _searchQuery, filter: 'vacant'),
          ],
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _SearchBar({required this.controller, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: 'Search chit groups...',
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: Colors.grey),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: Colors.grey[100],
          contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(25),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

class _StatusGroupsTab extends StatelessWidget {
  final String searchQuery;
  final String status;
  const _StatusGroupsTab({required this.searchQuery, required this.status});

  @override
  Widget build(BuildContext context) {
    return Consumer<ChitGroupProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final groups = provider.chitGroups
            .where((g) =>
                g.status == status &&
                (g.groupName.toLowerCase().contains(searchQuery.toLowerCase()) ||
                g.groupNumber.toLowerCase().contains(searchQuery.toLowerCase())))
            .toList();

        if (groups.isEmpty) {
          return _EmptyState(
            icon: status == 'completed' ? Icons.check_circle_outline : Icons.cancel_outlined,
            title: searchQuery.isNotEmpty
                ? 'No groups match "$searchQuery"'
                : 'No ${status[0].toUpperCase()}${status.substring(1)} Groups',
            subtitle: searchQuery.isNotEmpty
                ? 'Try a different search'
                : 'You have no ${status} chit groups.',
          );
        }

        return RefreshIndicator(
          onRefresh: () => context.read<ChitGroupProvider>().fetchMyChitGroups(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: groups.length,
            itemBuilder: (context, i) => _ChitGroupCard(
              group: groups[i],
              onTap: () => context.push('/chit-groups/${groups[i].id}'),
            ),
          ),
        );
      },
    );
  }
}

class _AvailableGroupsTab extends StatefulWidget {
  final String searchQuery;
  final String filter; // 'new' or 'vacant'
  const _AvailableGroupsTab({required this.searchQuery, required this.filter});

  @override
  State<_AvailableGroupsTab> createState() => _AvailableGroupsTabState();
}

class _AvailableGroupsTabState extends State<_AvailableGroupsTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _available = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchAvailable();
  }

  Future<void> _fetchAvailable() async {
    setState(() { _loading = true; _error = null; });
    try {
      final provider = context.read<ChitGroupProvider>();
      final res = await provider.fetchAvailableGroups();
      if (mounted) setState(() { _available = res; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load groups'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.cloud_off, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: Colors.grey[600])),
          const SizedBox(height: 12),
          TextButton(onPressed: _fetchAvailable, child: const Text('Retry')),
        ]),
      );
    }

    final filtered = _available
        .where((g) {
          final matchesSearch =
              (g['group_name'] ?? '').toLowerCase().contains(widget.searchQuery.toLowerCase()) ||
              (g['group_number'] ?? '').toLowerCase().contains(widget.searchQuery.toLowerCase());
          if (!matchesSearch) return false;
          if (widget.filter == 'vacant') {
            final total = (g['total_members'] ?? 0) as int;
            final enrolled = (g['member_count'] ?? g['enrolled_members'] ?? g['current_members'] ?? 0) as int;
            return enrolled < total;
          }
          // 'new' filter: show groups with current_month == 0 or 1
          final currentMonth = (g['current_month'] ?? 0) as int;
          return currentMonth <= 1;
        })
        .toList();

    if (filtered.isEmpty) {
      return _EmptyState(
        icon: Icons.search_off,
        title: 'No Groups Available',
        subtitle: 'Check back later for new chit group openings.',
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchAvailable,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: filtered.length,
        itemBuilder: (context, i) => _AvailableGroupCard(
          data: filtered[i],
          onEnroll: () async {
            final ok = await context
                .read<ChitGroupProvider>()
                .enrollInChitGroup((filtered[i]['_id'] ?? filtered[i]['id']).toString());
            if (ok && context.mounted) {
              CelebrationOverlay.showGroupJoined(context, groupName: filtered[i]['group_name'] ?? 'Chit Group');
            }
          },
        ),
      ),
    );
  }
}

class _ChitGroupCard extends StatelessWidget {
  final dynamic group;
  final VoidCallback onTap;

  const _ChitGroupCard({required this.group, required this.onTap});

  Color get _statusColor {
    switch (group.status) {
      case 'active': return AppTheme.successColor;
      case 'completed': return Colors.grey;
      case 'upcoming': return AppTheme.secondaryColor;
      default: return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = group.durationMonths > 0
        ? (group.currentMonth / group.durationMonths).clamp(0.0, 1.0)
        : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(26),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.account_balance, color: AppTheme.primaryColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(group.groupName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text(group.groupNumber,
                        style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                  ]),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor.withAlpha(31),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    group.status.toUpperCase(),
                    style: TextStyle(
                        color: _statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                _InfoChip(
                    icon: Icons.currency_rupee,
                    label: '${_fmt(group.chitValue)} Chit'),
                const SizedBox(width: 8),
                _InfoChip(
                    icon: Icons.calendar_month,
                    label: '${group.durationMonths} months'),
                const SizedBox(width: 8),
                _InfoChip(
                    icon: Icons.people_outline,
                    label: '${group.totalMembers} members'),
              ]),
              const SizedBox(height: 14),
              Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Month ${group.currentMonth} of ${group.durationMonths}',
                        style: const TextStyle(fontSize: 12, color: Colors.black54)),
                    Text('${(progress * 100).toStringAsFixed(0)}% complete',
                        style: const TextStyle(fontSize: 12, color: AppTheme.primaryColor)),
                  ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: Colors.grey[200],
                  valueColor:
                      const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Monthly Installment',
                        style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                    Text('₹${_fmt(group.monthlyInstallment)}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryColor,
                            fontSize: 16)),
                  ]),
                  TextButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.arrow_forward, size: 16),
                    label: const Text('View Details'),
                    style: TextButton.styleFrom(foregroundColor: AppTheme.primaryColor),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
          color: Colors.grey[100], borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[700])),
      ]),
    );
  }
}

class _AvailableGroupCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback onEnroll;
  const _AvailableGroupCard({required this.data, required this.onEnroll});

  @override
  Widget build(BuildContext context) {
    final chitValue = double.tryParse(data['chit_value']?.toString() ?? '0') ?? 0;
    final monthly =
        double.tryParse(data['monthly_installment']?.toString() ?? '0') ?? 0;
    final members = data['total_members'] ?? 0;
    final enrolledCount = data['member_count'] ?? data['enrolled_members'] ?? data['current_members'] ?? 0;
    final duration = data['duration_months'] ?? 0;
    final groupName = data['group_name'] ?? '';
    final psoNumber = data['pso_number'] ?? data['registration_number'] ?? '';
    final auctionType = data['auction_frequency'] ?? data['auction_type'] ?? 'Monthly';
    final commencementDate = data['commencement_date'];
    final dividendUpto = data['dividend_upto'] ?? data['max_dividend'] ?? 0;
    final minBid = data['min_bid'] ?? data['minimum_bid'] ?? 0;
    final maxBid = data['max_bid'] ?? data['maximum_bid'] ?? 0;
    final slotsLeft = (members is int ? members : 0) - (enrolledCount is int ? enrolledCount : 0);

    String dateStr = '';
    if (commencementDate != null) {
      try {
        dateStr = DateFormat('dd-MM-yyyy').format(DateTime.parse(commencementDate.toString()));
      } catch (_) {}
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 3,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header with chit value
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppTheme.primaryDark, AppTheme.primaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Column(children: [
            Text(
              '₹ ${NumberFormat('#,##,###').format(chitValue)}',
              style: const TextStyle(
                color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const Text('Chit Value',
                style: TextStyle(color: Colors.white70, fontSize: 13)),
          ]),
        ),

        // Details grid
        Container(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(child: _DetailItem(
                label: 'Subscription Value',
                value: '₹${_fmt(monthly)}/Month',
                valueColor: AppTheme.errorColor,
              )),
              Expanded(child: _DetailItem(
                label: 'First Auction Date',
                value: dateStr.isNotEmpty ? dateStr : 'TBD',
              )),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _DetailItem(
                label: 'Duration',
                value: '$duration Months',
              )),
              Expanded(child: _DetailItem(
                label: 'Auctions',
                value: auctionType.toString(),
              )),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _DetailItem(
                label: 'PSO No.',
                value: psoNumber.toString().isNotEmpty ? psoNumber.toString() : 'N/A',
                valueColor: AppTheme.primaryColor,
              )),
              Expanded(child: _DetailItem(
                label: 'Group Name',
                value: groupName,
              )),
            ]),
            if (dividendUpto != 0 || minBid != 0) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _DetailItem(
                  label: 'Dividend Upto',
                  value: '₹${_fmt(double.tryParse(dividendUpto.toString()) ?? 0)}',
                )),
                Expanded(child: _DetailItem(
                  label: 'Bid Range',
                  value: '₹${_fmt(double.tryParse(minBid.toString()) ?? 0)} - ₹${_fmt(double.tryParse(maxBid.toString()) ?? 0)}',
                )),
              ]),
            ],
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _DetailItem(
                label: 'Total Members',
                value: '$members',
              )),
              Expanded(child: _DetailItem(
                label: 'Slots Available',
                value: slotsLeft > 0 ? '$slotsLeft left' : 'Filling up',
                valueColor: slotsLeft > 0 ? AppTheme.successColor : AppTheme.errorColor,
              )),
            ]),
          ]),
        ),

        // Enroll button
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onEnroll,
              icon: const Icon(Icons.how_to_reg_rounded),
              label: const Text('Enroll Now'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12))),
            ),
          ),
        ),
      ]),
    );
  }

  String _fmt(double v) {
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return NumberFormat('#,##,###').format(v);
  }
}

class _DetailItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _DetailItem({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
      const SizedBox(height: 2),
      Text(value,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: valueColor ?? Colors.black87,
          )),
    ]);
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 72, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(subtitle,
              style: TextStyle(color: Colors.grey[500], fontSize: 14),
              textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}
