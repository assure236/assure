import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/services/api_service.dart';
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
            title: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Chit Groups',
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
                Tab(text: 'New'),
                Tab(text: 'Vacant'),
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

  Future<bool> _ensureEnrollmentAllowed() async {
    try {
      final profileRes = await ApiService.get('/users/profile');
      if (profileRes['success'] != true) {
        return false;
      }

      final profile = Map<String, dynamic>.from(profileRes['data'] ?? const {});
      final kycStatus = (profile['kyc_status'] ?? '').toString().toLowerCase();
      final profileStatus =
          (profile['profile_edit_status'] ?? 'none').toString().toLowerCase();

      if (kycStatus != 'verified') {
        if (!mounted) return false;
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('KYC Required'),
            content: const Text(
                'Please complete KYC verification first. Group joining is enabled only after KYC is verified.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Close')),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  if (mounted) context.push('/kyc');
                },
                child: const Text('Go to KYC'),
              ),
            ],
          ),
        );
        return false;
      }

      if (profileStatus == 'pending') {
        if (!mounted) return false;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Your profile is under admin review. You can join chit groups after final approval.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return false;
      }

      if (profileStatus != 'approved') {
        if (!mounted) return false;
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Profile Approval Required'),
            content: const Text(
                'Submit your profile details first. Group joining is available after admin final approval.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Close')),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  if (mounted) context.push('/edit-profile');
                },
                child: const Text('Complete Profile'),
              ),
            ],
          ),
        );
        return false;
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _confirmEnrollment(Map<String, dynamic> group) async {
    final groupName = (group['group_name'] ?? 'this chit group').toString();
    final monthly =
        double.tryParse(group['monthly_installment']?.toString() ?? '0') ?? 0;

    final decision = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Enrollment'),
        content: Text(
          'Do you want to enroll in $groupName?\n\n'
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
            child: const Text('Enroll'),
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

    return RefreshIndicator(
      onRefresh: _fetchAvailable,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: filtered.length,
        itemBuilder: (context, i) => _AvailableGroupCard(
          data: filtered[i],
          onTap: () => context.push(
              '/chit-groups/${(filtered[i]['_id'] ?? filtered[i]['id']).toString()}'),
          onEnroll: () async {
            final group = filtered[i];
            final groupId = (group['_id'] ?? group['id']).toString();

            final allowed = await _ensureEnrollmentAllowed();
            if (!context.mounted || !allowed) return;

            final shouldEnroll = await _confirmEnrollment(group);
            if (!context.mounted || !shouldEnroll) return;

            final result = await context
                .read<ChitGroupProvider>()
                .enrollInChitGroup(groupId);
            final ok = result['success'] == true;

            if (!context.mounted) return;

            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text((result['message'] ??
                        (ok ? 'Enrolled successfully' : 'Enrollment failed'))
                    .toString()),
                backgroundColor:
                    ok ? AppTheme.successColor : AppTheme.errorColor,
                behavior: SnackBarBehavior.floating,
              ),
            );

            if (ok) {
              await _fetchAvailable();
              if (!context.mounted) return;

              await context.read<DashboardProvider>().refresh();
              if (!context.mounted) return;

              CelebrationOverlay.showGroupJoined(context,
                  groupName: group['group_name'] ?? 'Chit Group');
              await Future.delayed(const Duration(seconds: 2));
              if (!context.mounted) return;
              context.go('/dashboard');
            }
          },
        ),
      ),
    );
  }
}

class _AvailableGroupCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback onEnroll;
  final VoidCallback? onTap;
  const _AvailableGroupCard(
      {required this.data, required this.onEnroll, this.onTap});

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
    final commencementDate = data['commencement_date'];
    final int membersInt = members is int ? members : (members as num).toInt();
    final int enrolledInt =
        enrolledCount is int ? enrolledCount : (enrolledCount as num).toInt();
    final int slotsLeft = membersInt - enrolledInt;

    String dateStr = '';
    if (commencementDate != null) {
      try {
        dateStr = DateFormat('d MMM yyyy')
            .format(DateTime.parse(commencementDate.toString()));
      } catch (_) {}
    }

    final bool isVacant = (data['status'] ?? '') == 'vacant';
    final bool isNotStarted = (data['status'] ?? '') == 'not_started';
    final bool isActive = (data['status'] ?? '') == 'active';
    final Color accentColor = AppTheme.primaryColor;
    final String statusLabel = isVacant
        ? 'Seats Available'
        : isNotStarted
            ? 'Starting Soon'
            : isActive
                ? 'Active'
                : 'Upcoming';

    final bool enrollDisabled = slotsLeft <= 0 || isNotStarted;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withAlpha(8),
                blurRadius: 8,
                offset: const Offset(0, 2)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ── Header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 4,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
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

          // ── Details ──
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Row(children: [
                Expanded(
                    child: _DetailItem(
                        label: 'Monthly EMI', value: '₹${_fmt(monthly)}')),
                Expanded(
                    child: _DetailItem(label: 'Months', value: '$duration')),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _DetailItem(
                        label: 'Members', value: '$enrolledInt/$membersInt')),
                Expanded(
                    child: _DetailItem(
                  label: 'Auction',
                  value: data['auction_type']?.toString().isNotEmpty == true
                      ? data['auction_type'].toString()
                      : 'Monthly',
                  valueColor: AppTheme.primaryColor,
                )),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _DetailItem(
                  label: isVacant
                      ? 'Slots Available'
                      : isActive
                          ? 'Started'
                          : 'Starts',
                  value: isVacant
                      ? (slotsLeft > 0 ? '$slotsLeft open' : 'Almost full')
                      : (dateStr.isNotEmpty
                          ? dateStr
                          : (isActive ? 'In progress' : 'TBD')),
                  valueColor: isVacant
                      ? (slotsLeft > 0
                          ? const Color(0xFF0B6E4F)
                          : AppTheme.errorColor)
                      : AppTheme.primaryColor,
                )),
                if (psoNumber.toString().isNotEmpty)
                  Expanded(
                      child: _DetailItem(
                          label: 'PSO No.', value: psoNumber.toString())),
              ]),
            ]),
          ),

          // ── Enroll button ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: enrollDisabled ? null : onEnroll,
                icon: const Icon(Icons.how_to_reg_rounded, size: 18),
                label: Text(
                  isNotStarted
                      ? 'Enrollment Closed'
                      : enrollDisabled
                          ? 'Group Full'
                          : 'Enroll Now',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  textStyle: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ),
          ),
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
