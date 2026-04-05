import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/auction_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/notification_provider.dart';
import '../../../core/services/local_notification_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../chit_groups/screens/chit_groups_screen.dart';
import '../../auctions/screens/auctions_screen.dart';
import '../../payments/screens/payments_screen.dart';
import '../../profile/screens/profile_screen.dart';

// ─── Formatters ───────────────────────────────────────────────────────────────
final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _dtFmt = DateFormat('dd MMM yyyy');

// ─── Main Shell with Bottom Nav ───────────────────────────────────────────────
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  void _switchTab(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentIndex == 0,
      onPopInvoked: (didPop) {
        if (!didPop) setState(() => _currentIndex = 0);
      },
      child: Listener(
        onPointerDown: (_) => context.read<AuthProvider>().resetInactivityTimer(),
        onPointerMove: (_) => context.read<AuthProvider>().resetInactivityTimer(),
        child: Stack(
        children: [
        Scaffold(
        body: IndexedStack(
          index: _currentIndex,
          children: [
            _HomeTab(switchTab: _switchTab),
            const ChitGroupsScreen(),
            const AuctionsScreen(),
            const PaymentsScreen(),
            const ProfileScreen(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _switchTab,
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 8,
          shadowColor: Colors.black26,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.add_circle_outline),
              selectedIcon: Icon(Icons.add_circle_rounded),
              label: 'New Chits',
            ),
            NavigationDestination(
              icon: Icon(Icons.gavel_outlined),
              selectedIcon: Icon(Icons.gavel_rounded),
              label: 'Auctions',
            ),
            NavigationDestination(
              icon: Icon(Icons.account_balance_wallet_outlined),
              selectedIcon: Icon(Icons.account_balance_wallet_rounded),
              label: 'Payments',
            ),
            NavigationDestination(
              icon: Icon(Icons.menu_rounded),
              selectedIcon: Icon(Icons.menu_rounded),
              label: 'More',
            ),
          ],
        ),
        ),
        _DraggableFab(onTap: () => context.push('/chatbot')),
        ],
      ),
    );
  }
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
class _HomeTab extends StatefulWidget {
  final void Function(int) switchTab;
  const _HomeTab({required this.switchTab});

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<DashboardProvider>().fetchDashboard();
        context.read<NotificationProvider>().fetchNotifications();
        // Start background notification polling (every 30 seconds)
        LocalNotificationService().startPolling(intervalSeconds: 30);
        // Listen to AuctionProvider changes to refresh dashboard
        context.read<AuctionProvider>().addListener(_onAuctionsChanged);
      }
    });
  }

  void _onAuctionsChanged() {
    if (mounted) context.read<DashboardProvider>().fetchDashboard();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      context.read<DashboardProvider>().fetchDashboard();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    LocalNotificationService().stopPolling();
    // Remove listener safely — provider might already be disposed
    try {
      context.read<AuctionProvider>().removeListener(_onAuctionsChanged);
    } catch (_) {}
    super.dispose();
  }

  Future<void> _refresh() => context.read<DashboardProvider>().fetchDashboard();

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardProvider>(
      builder: (context, dash, _) {
        final user = context.read<AuthProvider>().user;

        if (dash.isLoading && dash.data == null) {
          return Scaffold(
            backgroundColor: const Color(0xFFF0F4F8),
            body: Column(
              children: [
                _HeaderSection(user: user, dash: dash, loading: true),
                const Expanded(child: Center(child: CircularProgressIndicator())),
              ],
            ),
          );
        }

        if (dash.error != null && dash.data == null) {
          return Scaffold(
            backgroundColor: const Color(0xFFF0F4F8),
            body: Column(
              children: [
                _HeaderSection(user: user, dash: dash, loading: false),
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off_rounded, size: 60, color: Colors.grey),
                        const SizedBox(height: 16),
                        const Text('Could not load dashboard',
                            style: TextStyle(fontSize: 16, color: Colors.grey)),
                        const SizedBox(height: 4),
                        Text(dash.error!,
                            style:
                                const TextStyle(fontSize: 12, color: Colors.grey),
                            textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          onPressed: _refresh,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        return Scaffold(
          backgroundColor: const Color(0xFFF0F4F8),
          body: RefreshIndicator(
            color: AppTheme.primaryColor,
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _HeaderSection(user: user, dash: dash, loading: false),
                ),
                if (dash.kycStatus != 'verified' || !dash.isProfileComplete)
                  SliverToBoxAdapter(child: _KycProfileBanner(dash: dash, switchTab: widget.switchTab)),
                SliverToBoxAdapter(child: _StatsRow(dash: dash, switchTab: widget.switchTab)),
                SliverToBoxAdapter(child: _ActiveChits(dash: dash, switchTab: widget.switchTab)),
                if (dash.upcomingAuctions.isNotEmpty)
                  SliverToBoxAdapter(child: _UpcomingAuctions(dash: dash, switchTab: widget.switchTab)),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────
class _HeaderSection extends StatelessWidget {
  final dynamic user;
  final DashboardProvider dash;
  final bool loading;

  const _HeaderSection(
      {required this.user, required this.dash, required this.loading});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    final firstName = (user?.fullName ?? 'Member').split(' ').first;
    final kycVerified = dash.kycStatus == 'verified';

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF071428), Color(0xFF1E3A8A), Color(0xFF0B1F3B)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: Colors.white24,
                        child: Text(
                          firstName.isNotEmpty
                              ? firstName[0].toUpperCase()
                              : 'M',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _greeting(),
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 13),
                          ),
                          Text(
                            firstName,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Consumer<NotificationProvider>(
                        builder: (context, notifProvider, _) {
                          final unread = notifProvider.unreadCount;
                          return Stack(
                            children: [
                              IconButton(
                                onPressed: () => context.push('/notifications'),
                                icon: const Icon(Icons.notifications_outlined,
                                    color: Colors.white, size: 28),
                              ),
                              if (unread > 0)
                                Positioned(
                                  top: 6,
                                  right: 6,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFD4AF37),
                                      shape: BoxShape.circle,
                                    ),
                                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                    child: Text(
                                      unread > 9 ? '9+' : '$unread',
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
                      IconButton(
                        onPressed: () => context.push('/support'),
                        icon: const Icon(Icons.support_agent_rounded,
                            color: Colors.white, size: 26),
                        tooltip: 'Support',
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // KYC badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: kycVerified
                      ? Colors.green.withAlpha(51)
                      : Colors.orange.withAlpha(51),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color:
                        kycVerified ? Colors.greenAccent : Colors.orangeAccent,
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      kycVerified
                          ? Icons.verified_rounded
                          : Icons.pending_rounded,
                      color: kycVerified
                          ? Colors.greenAccent
                          : Colors.orangeAccent,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      kycVerified ? 'KYC Verified' : 'KYC Pending',
                      style: TextStyle(
                        color: kycVerified
                            ? Colors.greenAccent
                            : Colors.orangeAccent,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // QR Scan button
              GestureDetector(
                onTap: () => context.push('/qr-scan'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white12,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.qr_code_scanner, color: Colors.white70, size: 14),
                      SizedBox(width: 4),
                      Text('Scan QR', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Combined KYC + Profile Banner ────────────────────────────────────────────
class _KycProfileBanner extends StatelessWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;
  const _KycProfileBanner({required this.dash, required this.switchTab});

  @override
  Widget build(BuildContext context) {
    final kycPending = dash.kycStatus != 'verified';
    final profileIncomplete = !dash.isProfileComplete;
    final pct = dash.profilePercentage;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD4AF37), width: 1),
        boxShadow: [
          BoxShadow(
              color: Colors.orange.withAlpha(26),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (kycPending)
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded,
                    color: Color(0xFFD4AF37), size: 22),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Complete Your KYC to unlock all features',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                TextButton(
                  onPressed: () => switchTab(4),
                  style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFD4AF37),
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                  child: const Text('Verify',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ],
            ),
          if (kycPending && profileIncomplete)
            const Divider(height: 16),
          if (profileIncomplete)
            InkWell(
              onTap: () => switchTab(4),
              child: Row(
                children: [
                  const Icon(Icons.person_outline_rounded,
                      color: Color(0xFF0B1F3B), size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Profile $pct% complete',
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: pct / 100,
                            minHeight: 6,
                            backgroundColor: const Color(0xFFE3F2FD),
                            valueColor: const AlwaysStoppedAnimation<Color>(
                                Color(0xFF0B1F3B)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right, color: Color(0xFF0B1F3B), size: 20),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Stats Row ────────────────────────────────────────────────────────────────
class _StatsRow extends StatelessWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;

  const _StatsRow({required this.dash, required this.switchTab});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => switchTab(1),
              child: _StatCard(
                label: 'Total Invested',
                value: _inr.format(dash.totalInvested),
                icon: Icons.savings_rounded,
                iconBg: const Color(0xFFE3F2FD),
                iconColor: const Color(0xFF1E3A8A),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: () => switchTab(1),
              child: _StatCard(
                label: 'Active Chits',
                value: '${dash.activeGroups}',
                icon: Icons.group_work_rounded,
                iconBg: const Color(0xFFE8F5E9),
                iconColor: const Color(0xFF2E7D32),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Loan feature coming soon!'),
                    behavior: SnackBarBehavior.floating,
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: _StatCard(
                label: 'Loan',
                value: 'Apply',
                icon: Icons.account_balance_rounded,
                iconBg: const Color(0xFFFFF3E0),
                iconColor: const Color(0xFFE65100),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconBg;
  final Color iconColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconBg,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(15),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
                fontWeight: FontWeight.bold, fontSize: 16, color: iconColor),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Active Chit Groups ───────────────────────────────────────────────────────
class _ActiveChits extends StatelessWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;

  const _ActiveChits({required this.dash, required this.switchTab});

  @override
  Widget build(BuildContext context) {
    final memberships = dash.memberships;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 0, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('My Active Chits',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                TextButton(
                  onPressed: () => switchTab(1),
                  child: const Text('View All'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          memberships.isEmpty
              ? Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: _EmptyCard(
                    icon: Icons.group_work_outlined,
                    message: 'No active chit groups yet',
                    actionLabel: 'Browse Groups',
                    onAction: () => switchTab(1),
                  ),
                )
              : SizedBox(
                  height: 168,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.only(right: 16),
                    itemCount: memberships.length,
                    itemBuilder: (context, i) {
                      final m = memberships[i];
                      final group = (m['chit_group_id'] as Map<String, dynamic>?) ??
                          (m['ChitGroup'] as Map<String, dynamic>?) ?? {};
                      final current =
                          (group['current_month'] ?? 0) as int;
                      final total =
                          (group['duration_months'] ?? 1) as int;
                      final progress =
                          total > 0 ? (current / total).clamp(0.0, 1.0) : 0.0;
                      final chitValue = double.tryParse(
                              group['chit_value']?.toString() ?? '0') ??
                          0;
                      final monthly = double.tryParse(
                              group['monthly_installment']
                                      ?.toString() ??
                                  '0') ??
                          0;
                      final groupId = (group['_id'] ?? group['id'] ?? '').toString();
                      return GestureDetector(
                        onTap: () {
                          if (groupId.isNotEmpty) context.push('/chit-groups/$groupId');
                        },
                        child: _ChitCard(
                          name: group['group_name']?.toString() ??
                              'Chit Group',
                          chitValue: chitValue,
                          monthly: monthly,
                          currentMonth: current,
                          totalMonths: total,
                          progress: progress,
                          index: i,
                        ),
                      );
                    },
                  ),
                ),
        ],
      ),
    );
  }
}

class _ChitCard extends StatelessWidget {
  final String name;
  final double chitValue;
  final double monthly;
  final int currentMonth;
  final int totalMonths;
  final double progress;
  final int index;

  const _ChitCard({
    required this.name,
    required this.chitValue,
    required this.monthly,
    required this.currentMonth,
    required this.totalMonths,
    required this.progress,
    required this.index,
  });

  static const _gradients = [
    [Color(0xFF071428), Color(0xFF0B1F3B)],
    [Color(0xFF1B5E20), Color(0xFF388E3C)],
    [Color(0xFF4A148C), Color(0xFF7B1FA2)],
    [Color(0xFFBF360C), Color(0xFFE64A19)],
  ];

  @override
  Widget build(BuildContext context) {
    final colors = _gradients[index % _gradients.length];

    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient:
            LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: colors[0].withAlpha(102),
              blurRadius: 12,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.group_work_rounded,
                  color: Colors.white54, size: 16),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            _inr.format(chitValue),
            style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold),
          ),
          Text(
            'Chit Value',
            style: const TextStyle(color: Colors.white54, fontSize: 11),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Monthly: ${_inr.format(monthly)}',
                style:
                    const TextStyle(color: Colors.white70, fontSize: 11),
              ),
              Text(
                '$currentMonth/$totalMonths',
                style:
                    const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.white24,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Colors.white),
              minHeight: 5,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Upcoming Auctions ────────────────────────────────────────────────────────
class _UpcomingAuctions extends StatelessWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;

  const _UpcomingAuctions({required this.dash, required this.switchTab});

  @override
  Widget build(BuildContext context) {
    final auctions = dash.upcomingAuctions;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Upcoming Auctions',
                  style:
                      TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              TextButton(
                onPressed: () => switchTab(2),
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...auctions.take(3).map((a) {
            final auction = a as Map<String, dynamic>;
            final isLive = auction['status'] == 'active' || auction['status'] == 'live';
            final group = (auction['chit_group_id'] as Map<String, dynamic>?) ??
                (auction['ChitGroup'] as Map<String, dynamic>?) ?? {};
            final scheduledRaw = auction['scheduled_date'];
            String dateStr = '';
            if (scheduledRaw != null) {
              try {
                dateStr = _dtFmt.format(DateTime.parse(scheduledRaw.toString()));
              } catch (_) {}
            }
            final chitValue = double.tryParse(
                    group['chit_value']?.toString() ?? '0') ??
                0;

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: isLive
                    ? Border.all(color: Colors.red.shade300, width: 1.5)
                    : null,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withAlpha(13),
                      blurRadius: 6,
                      offset: const Offset(0, 2)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isLive
                          ? Colors.red.shade50
                          : Colors.purple.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.gavel_rounded,
                        color: isLive ? Colors.red : Colors.purple,
                        size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          group['group_name']?.toString() ?? 'Auction',
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        if (dateStr.isNotEmpty)
                          Text(dateStr,
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isLive ? Colors.red : Colors.purple,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          isLive ? '● LIVE' : 'Scheduled',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      if (chitValue > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            _inr.format(chitValue),
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────
class _EmptyCard extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _EmptyCard({
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(13), blurRadius: 6),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, size: 42, color: Colors.grey.shade300),
          const SizedBox(height: 10),
          Text(message,
              style: const TextStyle(color: Colors.grey, fontSize: 13)),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            TextButton(
                onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

// ─── Draggable Chatbot FAB ────────────────────────────────────────────────────
class _DraggableFab extends StatefulWidget {
  final VoidCallback onTap;
  const _DraggableFab({required this.onTap});

  @override
  State<_DraggableFab> createState() => _DraggableFabState();
}

class _DraggableFabState extends State<_DraggableFab> {
  Offset? _offset;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;
    _offset ??= Offset(screen.width - 72, screen.height - 160);

    return Positioned(
      left: _offset!.dx,
      top: _offset!.dy,
      child: GestureDetector(
        onPanUpdate: (d) {
          setState(() {
            _offset = Offset(
              (_offset!.dx + d.delta.dx).clamp(0.0, screen.width - 56),
              (_offset!.dy + d.delta.dy).clamp(0.0, screen.height - 56),
            );
          });
        },
        onTap: widget.onTap,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: const Color(0xFF0B1F3B),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: Colors.black.withAlpha(60), blurRadius: 8, offset: const Offset(0, 3)),
            ],
          ),
          child: const Icon(Icons.smart_toy_rounded, color: Colors.white, size: 28),
        ),
      ),
    );
  }
}