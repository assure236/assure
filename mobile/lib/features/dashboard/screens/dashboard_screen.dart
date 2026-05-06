import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/auction_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/notification_provider.dart';
import '../../../core/providers/payment_provider.dart';
import '../../../core/services/local_notification_service.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_prefs.dart';
import '../../../core/widgets/onboarding_tour.dart';
import '../../chit_groups/screens/chit_groups_screen.dart';
import '../../auctions/screens/auctions_screen.dart';
import '../../payments/screens/payments_screen.dart';
import '../../profile/screens/profile_screen.dart';

// ─── Formatters ───────────────────────────────────────────────────────────────
final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _dtFmt = DateFormat('dd MMM yyyy');

// ─── Main Shell with Bottom Nav ───────────────────────────────────────────────
class DashboardScreen extends StatefulWidget {
  final String? digilockerStatus;
  const DashboardScreen({Key? key, this.digilockerStatus}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  bool _showTour = false;
  final _paymentsKey = GlobalKey<PaymentsScreenState>();

  @override
  void initState() {
    super.initState();
    _checkTour();
    // Set context for SocketService multi-device alerts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      SocketService.instance.setContext(context);
      // Handle DigiLocker deep link return
      if (widget.digilockerStatus != null) {
        // Force refresh dashboard (bypass cache) to pick up new KYC status
        context.read<DashboardProvider>().refresh();
        if (widget.digilockerStatus == 'success') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('DigiLocker connected! KYC verified.'),
              backgroundColor: Colors.green,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('DigiLocker verification failed. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    });
  }

  Future<void> _checkTour() async {
    final show = await OnboardingTour.shouldShow();
    if (show && mounted) setState(() => _showTour = true);
  }

  void _switchTab(int index) {
    setState(() => _currentIndex = index);
    // If switching to Payments tab and a specific sub-tab was requested
    if (index == 3 && PaymentsScreen.initialTabIndex != 0) {
      final tabIdx = PaymentsScreen.initialTabIndex;
      PaymentsScreen.initialTabIndex = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _paymentsKey.currentState?.switchToTab(tabIdx);
      });
    }
    // Reload tour when switching back to home
    if (index == 0) {
      _checkTour();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
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
            PaymentsScreen(key: _paymentsKey),
            ProfileScreen(switchTab: _switchTab),
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
        ValueListenableBuilder<bool>(
          valueListenable: AppPrefs.chatbotVisible,
          builder: (context, chatbotOn, _) {
            if (!chatbotOn) return const SizedBox.shrink();
            return _DraggableFab(onTap: () => context.push('/chatbot'));
          },
        ),
        if (_showTour) OnboardingTour(onComplete: () => setState(() => _showTour = false)),
        ],
        ),
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
        context.read<PaymentProvider>().fetchPayments();
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
      context.read<DashboardProvider>().refresh();
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
        final user = context.watch<AuthProvider>().user;

        if (dash.isLoading && dash.data == null) {
          return Scaffold(
            backgroundColor: AppTheme.surfaceLight,
            body: Column(
              children: [
                _HeaderSection(user: user, dash: dash, loading: true, onProfileTap: () => context.push('/edit-profile')),
                const Expanded(child: Center(child: CircularProgressIndicator())),
              ],
            ),
          );
        }

        if (dash.error != null && dash.data == null) {
          return Scaffold(
            backgroundColor: AppTheme.surfaceLight,
            body: Column(
              children: [
                _HeaderSection(user: user, dash: dash, loading: false, onProfileTap: () => context.push('/edit-profile')),
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
          backgroundColor: AppTheme.surfaceLight,
          body: RefreshIndicator(
            color: AppTheme.primaryColor,
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _HeaderSection(user: user, dash: dash, loading: false, onProfileTap: () => context.push('/edit-profile')),
                ),
                if (dash.kycStatus != 'verified' || !dash.isProfileComplete)
                  SliverToBoxAdapter(child: _KycProfileBanner(dash: dash, switchTab: widget.switchTab)),
                SliverToBoxAdapter(child: _DuePaymentsReminder(switchTab: widget.switchTab)),
                SliverToBoxAdapter(child: _StatsRow(dash: dash, switchTab: widget.switchTab)),
                SliverToBoxAdapter(child: _ActiveChits(dash: dash, switchTab: widget.switchTab)),
                if (dash.upcomingAuctions.isNotEmpty)
                  SliverToBoxAdapter(child: _UpcomingAuctions(dash: dash, switchTab: widget.switchTab)),
                const SliverToBoxAdapter(child: _BecomeAgentCard()),
                const SliverToBoxAdapter(child: _TrustBadges()),
                const SliverToBoxAdapter(child: _PaymentPartners()),
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
  final VoidCallback? onProfileTap;

  const _HeaderSection(
      {required this.user, required this.dash, required this.loading, this.onProfileTap});

  @override
  Widget build(BuildContext context) {
    final firstName = (user?.fullName ?? 'Member').split(' ').first;
    final kycVerified = dash.kycStatus == 'verified';

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.primaryDark, AppTheme.accentBlue, AppTheme.primaryColor],
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
                  GestureDetector(
                    onTap: () => onProfileTap?.call(),
                    child: Row(
                    children: [
                      (user?.profileImageUrl != null && user!.profileImageUrl!.isNotEmpty)
                          ? CircleAvatar(
                              radius: 24,
                              backgroundColor: Colors.white24,
                              backgroundImage: NetworkImage(user.profileImageUrl!),
                            )
                          : CircleAvatar(
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
                            'Hi, $firstName',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold),
                          ),
                          const Text(
                            'Partners in Growth',
                            style: TextStyle(
                                color: Colors.white54, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                  ),
                  Row(
                    children: [
                      // App logo
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: ClipOval(
                          child: Image.asset('assets/images/logo.png', width: 30, height: 30, fit: BoxFit.cover),
                        ),
                      ),
                      const SizedBox(width: 4),
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
                                      color: AppTheme.secondaryColor,
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
                        icon: SvgPicture.asset('assets/icons/support.svg',
                            width: 26, height: 26,
                            colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                        tooltip: 'Support',
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // KYC badge + QR
              Row(
                children: [
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
                      kycVerified ? 'KYC Verified' : 'KYC Not Verified',
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
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white12,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.qr_code_scanner, color: Colors.white70, size: 18),
                ),
              ),
                ],
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
        color: AppTheme.lightYellowBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.secondaryColor, width: 1),
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
                    color: AppTheme.secondaryColor, size: 22),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Complete Your KYC to unlock all features',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                TextButton(
                  onPressed: () => context.push('/kyc'),
                  style: TextButton.styleFrom(
                      foregroundColor: AppTheme.secondaryColor,
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
              onTap: () => context.push('/edit-profile'),
              child: Row(
                children: [
                  const Icon(Icons.person_outline_rounded,
                      color: AppTheme.primaryColor, size: 22),
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
                            backgroundColor: AppTheme.lightBlueBg,
                            valueColor: const AlwaysStoppedAnimation<Color>(
                                AppTheme.primaryColor),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right, color: AppTheme.primaryColor, size: 20),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Due Payments Reminder (1-click pay) ──────────────────────────────────────
class _DuePaymentsReminder extends StatelessWidget {
  final void Function(int) switchTab;
  const _DuePaymentsReminder({required this.switchTab});

  @override
  Widget build(BuildContext context) {
    return Consumer<PaymentProvider>(
      builder: (context, payProv, _) {
        final due = payProv.upcomingPayments
            .where((p) =>
                p['payment_status'] == 'overdue' ||
                (p['payment_status'] == 'pending' && p['can_pay'] == true))
            .toList();
        if (due.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.secondaryColor.withAlpha(100)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.payment_rounded,
                        color: AppTheme.primaryColor, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Due Payments (${due.length})',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: AppTheme.primaryColor),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () {
                        PaymentsScreen.initialTabIndex = 1;
                        switchTab(3);
                      },
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('View All',
                          style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...due.take(1).map((p) {
                  final group = (p['chit_group'] ?? p['chitGroup']) as Map<String, dynamic>? ?? {};
                  final groupName = group['group_name']?.toString() ?? 'Chit Group';
                  final amount = double.tryParse(p['total_amount']?.toString() ?? p['amount']?.toString() ?? '0') ?? 0;
                  final isOverdue = p['payment_status'] == 'overdue';
                  final month = p['month_number'] ?? '';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isOverdue ? Icons.warning_amber_rounded : Icons.schedule,
                          color: isOverdue ? AppTheme.errorColor : AppTheme.secondaryColor,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(groupName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600, fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                              Text(
                                isOverdue ? 'Overdue — Month $month' : 'Due — Month $month',
                                style: TextStyle(
                                    color: isOverdue ? AppTheme.errorColor : Colors.grey,
                                    fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          height: 32,
                          child: ElevatedButton(
                            onPressed: () {
                              PaymentsScreen.initialTabIndex = 1;
                              switchTab(3); // Go to Payments → Upcoming tab
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            child: Text('Pay ${_inr.format(amount)}'),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
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
              onTap: () => context.push('/total-investment'),
              child: _StatCard(
                label: 'Total Invested',
                value: _inr.format(dash.totalInvested),
                icon: Icons.savings_rounded,
                iconBg: AppTheme.lightBlueBg,
                iconColor: AppTheme.accentBlue,
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
                iconBg: AppTheme.lightBlueBg,
                iconColor: AppTheme.accentBlue,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: () => context.push('/apply-loan'),
              child: _StatCard(
                label: 'Loan',
                value: 'Apply',
                icon: Icons.account_balance_rounded,
                iconBg: const Color(0xFFFAF0C8),
                iconColor: AppTheme.secondaryColor,
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
            child: const Text('My Active Chits',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
    [AppTheme.primaryDark, AppTheme.primaryColor],
    [Color(0xFF1E3A8A), Color(0xFF2563EB)],
    [Color(0xFF4A148C), Color(0xFF7B1FA2)],
    [Color(0xFF0F766E), Color(0xFF0D9488)],
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

// ─── Become an Agent Card ─────────────────────────────────────────────────────
class _BecomeAgentCard extends StatefulWidget {
  const _BecomeAgentCard();

  @override
  State<_BecomeAgentCard> createState() => _BecomeAgentCardState();
}

class _BecomeAgentCardState extends State<_BecomeAgentCard> {
  String? _agentStatus; // null, 'pending', 'approved', 'rejected'

  @override
  void initState() {
    super.initState();
    _fetchAgentStatus();
  }

  Future<void> _fetchAgentStatus() async {
    try {
      final res = await ApiService.get('/users/agent-request');
      if (res['success'] == true && res['data'] != null) {
        if (mounted) setState(() => _agentStatus = res['data']['status']);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isPending = _agentStatus == 'pending';
    final isApproved = _agentStatus == 'approved';

    if (isApproved) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryDark, AppTheme.primaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryColor.withAlpha(60),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.verified, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('You\'re an Assure Agent',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    SizedBox(height: 4),
                    Text('Earn commissions by referring new members',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: GestureDetector(
        onTap: isPending ? null : () => _showBecomeAgentSheet(context),
        child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isPending
                ? [const Color(0xFFB7952E), AppTheme.secondaryColor]
                : [AppTheme.primaryColor, AppTheme.accentBlue],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: (isPending ? AppTheme.secondaryColor : AppTheme.primaryColor).withAlpha(60),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(30),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isPending ? Icons.hourglass_top_rounded : Icons.handshake_outlined,
                color: isPending ? Colors.white : AppTheme.secondaryColor,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPending ? 'Application In Progress' : 'Become an Agent',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isPending
                        ? 'Our team will contact you within 24 hours'
                        : 'Earn commissions by referring new members',
                    style: TextStyle(color: Colors.white.withAlpha(180), fontSize: 12),
                  ),
                ],
              ),
            ),
            if (!isPending) const Icon(Icons.chevron_right, color: Colors.white70),
          ],
        ),
      ),
      ),
    );
  }

  void _showBecomeAgentSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.handshake_outlined, color: AppTheme.primaryColor, size: 40),
            ),
            const SizedBox(height: 16),
            const Text('Become an Assure Agent',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Earn commissions by referring new members to Assure ChitFunds. Our team will contact you within 24 hours.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 14),
            ),
            const SizedBox(height: 8),
            const Text(
              '• Earn up to 2% commission per referral\n• Track referrals in your dashboard\n• No investment required',
              style: TextStyle(fontSize: 13, color: Colors.black87),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  try {
                    final res = await ApiService.post('/users/agent-request', {});
                    if (mounted) {
                      setState(() => _agentStatus = 'pending');
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res['message'] ?? 'Agent request submitted!'), backgroundColor: Colors.green),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: Colors.red),
                      );
                    }
                  }
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  _agentStatus == 'rejected' ? 'Submit Request Again' : 'Submit Request',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

// ─── Trust Badges ─────────────────────────────────────────────────────────────
class _TrustBadges extends StatelessWidget {
  const _TrustBadges();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Trusted & Certified',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _BadgeCard(
                icon: Icons.verified_outlined,
                label: 'ISO Certified',
                color: AppTheme.accentBlue,
              )),
              const SizedBox(width: 10),
              Expanded(child: _BadgeCard(
                icon: Icons.account_balance_outlined,
                label: 'Telangana Govt.\nRegistered',
                color: AppTheme.primaryColor,
              )),
              const SizedBox(width: 10),
              Expanded(child: _BadgeCard(
                icon: Icons.shield_outlined,
                label: 'DPIIT\nRegistered',
                color: AppTheme.secondaryColor,
              )),
            ],
          ),
        ],
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _BadgeCard({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withAlpha(13), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withAlpha(26),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Payment Partners ─────────────────────────────────────────────────────────
class _PaymentPartners extends StatelessWidget {
  const _PaymentPartners();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Trusted Partners',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.black38,
                  letterSpacing: 0.8)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _SbiLogo()),
              Container(width: 1, height: 44, color: Colors.grey.shade200),
              Expanded(child: _CashfreeLogo()),
            ],
          ),
        ],
      ),
    );
  }
}

class _SbiLogo extends StatelessWidget {
  const _SbiLogo();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Text('SBI',
            style: TextStyle(
                color: Color(0xFF002B80),
                fontWeight: FontWeight.w900,
                fontSize: 24,
                letterSpacing: 3)),
        const SizedBox(height: 2),
        const Text('State Bank of India',
            style: TextStyle(color: Colors.black38, fontSize: 9)),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: AppTheme.lightBlueBg,
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Text('Banking Partner',
              style: TextStyle(
                  color: AppTheme.accentBlue,
                  fontSize: 9,
                  fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}

class _CashfreeLogo extends StatelessWidget {
  const _CashfreeLogo();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        RichText(
          text: const TextSpan(
            children: [
              TextSpan(
                  text: 'cash',
                  style: TextStyle(
                      color: Color(0xFF1A1A2E),
                      fontWeight: FontWeight.w900,
                      fontSize: 20)),
              TextSpan(
                  text: 'free',
                  style: TextStyle(
                      color: Color(0xFF6C3EC1),
                      fontWeight: FontWeight.w900,
                      fontSize: 20)),
            ],
          ),
        ),
        const SizedBox(height: 2),
        const Text('Payments Platform',
            style: TextStyle(color: Colors.black38, fontSize: 9)),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: Color(0xFFF0EAFF),
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Text('Payment Gateway',
              style: TextStyle(
                  color: Color(0xFF6C3EC1),
                  fontSize: 9,
                  fontWeight: FontWeight.w600)),
        ),
      ],
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

class _DraggableFabState extends State<_DraggableFab>
    with SingleTickerProviderStateMixin {
  Offset? _offset;
  late AnimationController _snapController;
  Animation<double>? _snapAnimation;

  @override
  void initState() {
    super.initState();
    _snapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  void dispose() {
    _snapController.dispose();
    super.dispose();
  }

  void _snapToEdge(Size screen) {
    final center = _offset!.dx + 30;
    final targetX =
        center < screen.width / 2 ? 8.0 : screen.width - 68.0;

    final startX = _offset!.dx;
    _snapAnimation = Tween<double>(begin: startX, end: targetX)
        .animate(CurvedAnimation(parent: _snapController, curve: Curves.easeOut))
      ..addListener(() {
        setState(() {
          _offset = Offset(_snapAnimation!.value, _offset!.dy);
        });
      });
    _snapController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;
    _offset ??= Offset(screen.width - 68, screen.height - 160);

    return Positioned(
      left: _offset!.dx,
      top: _offset!.dy,
      child: GestureDetector(
        onPanUpdate: (d) {
          setState(() {
            _offset = Offset(
              (_offset!.dx + d.delta.dx).clamp(0.0, screen.width - 60),
              (_offset!.dy + d.delta.dy).clamp(0.0, screen.height - 60),
            );
          });
        },
        onPanEnd: (_) => _snapToEdge(screen),
        onTap: widget.onTap,
        child: Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.primaryColor, width: 2.5),
            boxShadow: [
              BoxShadow(color: AppTheme.primaryColor.withAlpha(60), blurRadius: 12, spreadRadius: 1, offset: const Offset(0, 3)),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: SvgPicture.asset('assets/icons/chatbot.svg'),
          ),
        ),
      ),
    );
  }
}