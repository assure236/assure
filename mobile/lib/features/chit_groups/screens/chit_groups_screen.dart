import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
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
            backgroundColor: AppTheme.primaryColor,
            foregroundColor: Colors.white,
            elevation: 0,
            title: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Invest',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
            centerTitle: true,
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: AppTheme.secondaryColor,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              tabs: const [
                Tab(text: 'New Chits'),   // Item 17: renamed
                Tab(text: 'Vacant Chits'), // Item 17: renamed
              ],
            ),
          ),
        ],
      body: Column(children: [
          _SearchBar(
            controller: _searchController,
            onChanged: (q) => setState(() => _searchQuery = q),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _AvailableGroupsTab(searchQuery: _searchQuery, filter: 'new'),
                _AvailableGroupsTab(
                    searchQuery: _searchQuery, filter: 'vacant'),
              ],
            ),
          ),
        ]),
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
          contentPadding:
              const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(25),
            borderSide: BorderSide.none,
          ),
        ),
      ),
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
  // Item 23: checkbox selection for bottom Invest Now button
  final Set<String> _selectedIds = {};

  Future<bool> _confirmEnrollment(Map<String, dynamic> group) async {
    final groupName = (group['group_name'] ?? 'this chit group').toString();
    final monthly =
        double.tryParse(group['monthly_installment']?.toString() ?? '0') ?? 0;

    final decision = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Investment'),
        content: Text(
          'Do you want to invest in $groupName?\n\n'
          'Monthly installment: ₹${NumberFormat('#,##,###').format(monthly)}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor),
            child: const Text('Invest Now'),
          ),
        ],
      ),
    );

    return decision ?? false;
  }

  @override
  void initState() {
    super.initState();
    _fetchAvailable();
  }

  Future<void> _fetchAvailable() async {
    setState(() {
      _loading = true;
      _error = null;
      _selectedIds.clear();
    });
    try {
      final provider = context.read<ChitGroupProvider>();
      final List<Map<String, dynamic>> data;
      if (widget.filter == 'vacant') {
        data = await provider.fetchVacantGroups();
      } else {
        data = await provider.fetchNewGroups();
      }
      if (mounted) {
        setState(() {
          _available = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load. Please try again.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _investNow() async {
    if (_selectedIds.isEmpty) return;
    if (!context.mounted) return;

    for (final id in _selectedIds.toList()) {
      final group = _available.firstWhere(
          (g) => (g['_id'] ?? g['id']).toString() == id,
          orElse: () => {});
      if (group.isEmpty) continue;

      final shouldEnroll = await _confirmEnrollment(group);
      if (!context.mounted || !shouldEnroll) continue;

      final result =
          await context.read<ChitGroupProvider>().enrollInChitGroup(id);
      final ok = result['success'] == true;

      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text((result['message'] ??
                  (ok ? 'Invested successfully' : 'Investment failed'))
              .toString()),
          backgroundColor: ok ? AppTheme.successColor : AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ),
      );

      if (ok) {
        setState(() => _selectedIds.remove(id));
        await context.read<DashboardProvider>().refresh();
        if (!context.mounted) return;
        CelebrationOverlay.showGroupJoined(context,
            groupName: group['group_name'] ?? 'Chit Group');
        await Future.delayed(const Duration(seconds: 2));
        if (!context.mounted) return;
        context.go('/dashboard');
        return;
      }
    }
    await _fetchAvailable();
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

    final filtered = _available.where((g) {
      return (g['group_name'] ?? '')
              .toLowerCase()
              .contains(widget.searchQuery.toLowerCase()) ||
          (g['group_number'] ?? '')
              .toLowerCase()
              .contains(widget.searchQuery.toLowerCase());
    }).toList();

    if (filtered.isEmpty) {
      return _EmptyState(
        icon: Icons.search_off,
        title: 'No Groups Available',
        subtitle: 'Check back later for new chit group openings.',
      );
    }

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _fetchAvailable,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              itemCount: filtered.length,
              itemBuilder: (context, i) {
                final id = (filtered[i]['_id'] ?? filtered[i]['id']).toString();
                final isSelected = _selectedIds.contains(id);
                return _AvailableGroupCard(
                  data: filtered[i],
                  isSelected: isSelected,
                  filter: widget.filter,
                  onTap: () => context.push('/chit-groups/$id'),
                  onToggleSelect: () => setState(() {
                    if (isSelected) {
                      _selectedIds.remove(id);
                    } else {
                      _selectedIds.add(id);
                    }
                  }),
                );
              },
            ),
          ),
        ),
        // Item 23: bottom Invest Now button
        if (_selectedIds.isNotEmpty)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _investNow,
                  icon: const Icon(Icons.trending_up_rounded),
                  label: Text('Invest Now (${_selectedIds.length} selected)'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    textStyle: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _AvailableGroupCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final bool isSelected;
  final String filter;
  final VoidCallback? onTap;
  final VoidCallback? onToggleSelect;
  const _AvailableGroupCard(
      {required this.data,
      this.isSelected = false,
      this.filter = 'new',
      this.onTap,
      this.onToggleSelect});

  @override
  Widget build(BuildContext context) {
    final chitValue =
        double.tryParse(data['chit_value']?.toString() ?? '0') ?? 0;
    final monthly =
        double.tryParse(data['monthly_installment']?.toString() ?? '0') ?? 0;
    final members = data['total_members'] ?? 0;
    final enrolledCount = data['member_count'] ??
        data['enrolled_members'] ??
        data['current_members'] ??
        0;
    final duration = data['duration_months'] ?? 0;
    final groupName = data['group_name'] ?? '';
    final psoNumber = data['pso_number'] ?? data['registration_number'] ?? '';
    // Item 21: removed first auction date; items 18, 19
    final int membersInt = members is int ? members : (members as num).toInt();
    final int enrolledInt =
        enrolledCount is int ? enrolledCount : (enrolledCount as num).toInt();
    // Vacant chit specific fields (item 20, 22)
    final currentMonth = data['current_month'] ?? 0;
    final purchaseValue =
        double.tryParse(data['purchase_value']?.toString() ?? '0') ?? 0;

    final bool isVacant = filter == 'vacant';
    final bool isNotStarted = (data['status'] ?? '') == 'not_started';
    final bool isActive = (data['status'] ?? '') == 'active';
    final Color accentColor = AppTheme.primaryColor;
    final String statusLabel = isVacant
        ? 'Vacant'
        : isNotStarted
            ? 'Starting Soon'
            : isActive
                ? 'Active'
                : 'Upcoming';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryColor.withAlpha(15) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isSelected
                  ? AppTheme.primaryColor
                  : const Color(0xFFE2E8F0),
              width: isSelected ? 2 : 1),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withAlpha(8),
                blurRadius: 8,
                offset: const Offset(0, 2)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Item 23: checkbox for selection
                GestureDetector(
                  onTap: onToggleSelect,
                  child: Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsets.only(right: 10, top: 2),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primaryColor : Colors.transparent,
                      border: Border.all(
                          color: isSelected
                              ? AppTheme.primaryColor
                              : Colors.grey.shade400,
                          width: 2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: isSelected
                        ? const Icon(Icons.check,
                            color: Colors.white, size: 16)
                        : null,
                  ),
                ),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Item 19: chit value in primary color, not red
                        Text(
                          '₹ ${NumberFormat('#,##,###').format(chitValue)}',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: accentColor,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          groupName,
                          style: const TextStyle(
                              fontSize: 13,
                              color: Colors.black54,
                              fontWeight: FontWeight.w500),
                        ),
                      ]),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: accentColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: accentColor.withAlpha(60)),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: accentColor),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),

          // Details
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Row(children: [
                Expanded(
                    child: _DetailItem(
                        label: 'Monthly EMI', value: '₹${_fmt(monthly)}')),
                Expanded(
                    child: _DetailItem(label: 'Duration', value: '$duration months')),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _DetailItem(
                        label: 'Members', value: '$enrolledInt / $membersInt')),
                // Item 18: no Slots Available — show auction type
                Expanded(
                    child: _DetailItem(
                  label: 'Auction Type',
                  value: data['auction_type']?.toString().isNotEmpty == true
                      ? data['auction_type'].toString()
                      : 'Monthly',
                  valueColor: AppTheme.primaryColor,
                )),
              ]),
              // Item 20: show completed duration for vacant; Item 22: purchase value
              if (isVacant) ...[
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                      child: _DetailItem(
                          label: 'Completed',
                          value: '$currentMonth / $duration months')),
                  if (purchaseValue > 0)
                    Expanded(
                        child: _DetailItem(
                            label: 'Purchase Value',
                            value: '₹${_fmt(purchaseValue)}',
                            valueColor: AppTheme.primaryColor)),
                ]),
              ],
              if (psoNumber.toString().isNotEmpty) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: _DetailItem(
                      label: 'PSO No.', value: psoNumber.toString()),
                ),
              ],
            ]),
          ),
          // Item 23: NO per-card enroll button — selection only
        ]),
      ),
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
  const _DetailItem(
      {required this.label, required this.value, this.valueColor});

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
