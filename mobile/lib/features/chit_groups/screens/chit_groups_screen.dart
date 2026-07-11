import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/active_member_provider.dart';
import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/amount_format.dart';
import '../../../core/widgets/celebration_overlay.dart';

class ChitGroupsScreen extends StatefulWidget {
  const ChitGroupsScreen({super.key});

  @override
  State<ChitGroupsScreen> createState() => _ChitGroupsScreenState();
}

class _ChitGroupsScreenState extends State<ChitGroupsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChitGroupProvider>().fetchMyChitGroups();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: AppTheme.primaryColor,
            padding: EdgeInsets.fromLTRB(16, topPad + 8, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
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
                ),
                const SizedBox(height: 12),
                const Text(
                  'New Chits',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          _SearchBar(
            controller: _searchController,
            onChanged: (q) => setState(() => _searchQuery = q),
          ),
          Expanded(
            child: _AvailableGroupsTab(searchQuery: _searchQuery),
          ),
        ],
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
  const _AvailableGroupsTab({required this.searchQuery});

  @override
  State<_AvailableGroupsTab> createState() => _AvailableGroupsTabState();
}

class _AvailableGroupsTabState extends State<_AvailableGroupsTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _available = [];
  String? _error;
  String? _lastActiveMemberId;
  String? _selectedId;

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
          'Subscription: ₹${NumberFormat('#,##,###').format(monthly)}',
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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final activeMemberId = context.watch<ActiveMemberProvider>().activeMemberId;
    if (_lastActiveMemberId != activeMemberId) {
      _lastActiveMemberId = activeMemberId;
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _fetchAvailable();
        });
      }
    }
  }

  Future<void> _fetchAvailable() async {
    setState(() {
      _loading = true;
      _error = null;
      _selectedId = null;
    });
    try {
      final provider = context.read<ChitGroupProvider>();
      final data = await provider.fetchAllInvestGroups();
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
    final id = _selectedId;
    if (id == null || id.isEmpty) return;
    if (!context.mounted) return;

    final group = _available.firstWhere(
        (g) => (g['_id'] ?? g['id']).toString() == id,
        orElse: () => {});
    if (group.isEmpty) return;

    final shouldEnroll = await _confirmEnrollment(group);
    if (!context.mounted || !shouldEnroll) return;

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
      setState(() {
        _selectedId = null;
        _available.removeWhere(
          (groupRow) => (groupRow['_id'] ?? groupRow['id']).toString() == id,
        );
      });
      await context.read<DashboardProvider>().refresh();
      if (!context.mounted) return;
      CelebrationOverlay.showGroupJoined(context,
          groupName: group['group_name'] ?? 'Chit Group');
      await Future.delayed(const Duration(seconds: 2));
      if (!context.mounted) return;
      context.go('/dashboard');
      return;
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
                final isSelected = _selectedId == id;
                return _AvailableGroupCard(
                  data: filtered[i],
                  isSelected: isSelected,
                  onTap: () => context.push('/chit-groups/$id'),
                  onToggleSelect: () => setState(() {
                    _selectedId = isSelected ? null : id;
                  }),
                );
              },
            ),
          ),
        ),
        // Item 23: bottom Invest Now button
        if (_selectedId != null)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _investNow,
                  icon: const Icon(Icons.trending_up_rounded),
                  label: const Text('Invest Now'),
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
  final VoidCallback? onTap;
  final VoidCallback? onToggleSelect;
  const _AvailableGroupCard({
    required this.data,
    this.isSelected = false,
    this.onTap,
    this.onToggleSelect,
  });

  @override
  Widget build(BuildContext context) {
    final chitValue =
        double.tryParse(data['chit_value']?.toString() ?? '0') ?? 0;
    final monthly =
        double.tryParse(data['monthly_installment']?.toString() ?? '0') ?? 0;
    final members = data['total_members'] ?? 0;
    final duration = data['duration_months'] ?? 0;
    final groupName = data['group_name'] ?? '';
    final psoNumber = data['pso_number'] ?? data['registration_number'] ?? '';
    final int membersInt = members is int ? members : (members as num).toInt();
    final currentMonth = data['current_month'] ?? 0;
    final purchaseValue =
        double.tryParse(data['purchase_value']?.toString() ?? '0') ?? 0;

    final bool isVacant = (data['status'] ?? '') == 'vacant';
    final bool isNotStarted = (data['status'] ?? '') == 'not_started';
    final bool isActive = (data['status'] ?? '') == 'active';
    const Color accentColor = AppTheme.primaryColor;
    final Color cardTint = accentColor.withAlpha(18);
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
          color: isSelected ? accentColor.withAlpha(22) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: isSelected ? accentColor : accentColor.withAlpha(50),
              width: isSelected ? 2 : 1),
          boxShadow: [
            BoxShadow(
                color: accentColor.withAlpha(28),
                blurRadius: 10,
                offset: const Offset(0, 3)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 4,
                width: double.infinity,
                color: accentColor,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: onToggleSelect,
                      child: Container(
                        width: 22,
                        height: 22,
                        margin: const EdgeInsets.only(right: 10, top: 4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected ? accentColor : Colors.white,
                          border: Border.all(color: accentColor, width: 2),
                        ),
                        child: isSelected
                            ? const Icon(Icons.circle,
                                size: 10, color: Colors.white)
                            : null,
                      ),
                    ),
                    Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '₹ ${NumberFormat('#,##,###').format(chitValue)}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Colors.black,
                                letterSpacing: -0.5,
                              ),
                            ),
                            Text(
                              groupName,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.black87,
                                  fontWeight: FontWeight.w600),
                            ),
                          ]),
                    ),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: cardTint,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: accentColor.withAlpha(80)),
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
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                height: 1,
                color: const Color(0xFFF1F5F9),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _DetailItem(
                            label: 'Subscription',
                            value: '₹${_fmt(monthly)}')),
                    Expanded(
                        child: _DetailItem(
                            label: 'Duration',
                            value: '$duration months')),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: _DetailItem(
                            label: 'Members',
                            value: '$membersInt')),
                    Expanded(
                        child: _DetailItem(
                      label: 'Auction Type',
                      value: data['auction_type']?.toString().isNotEmpty == true
                          ? data['auction_type'].toString()
                          : 'Monthly',
                    )),
                  ]),
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
                                value: '₹${_fmt(purchaseValue)}')),
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
            ],
          ),
        ),
      ),
    );
  }

  String _fmt(double v) {
    if (v >= 1000) return formatCompactInr(v);
    return NumberFormat('#,##,###').format(v);
  }
}

class _DetailItem extends StatelessWidget {
  final String label;
  final String value;
  const _DetailItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
      const SizedBox(height: 2),
      Text(value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: Colors.black,
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
