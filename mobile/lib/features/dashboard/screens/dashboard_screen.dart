import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/providers/active_member_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/auction_provider.dart';
import '../../../core/providers/chit_group_provider.dart';
import '../../../core/providers/dashboard_provider.dart';
import '../../../core/providers/notification_provider.dart';
import '../../../core/providers/payment_provider.dart';
import '../../../core/services/local_notification_service.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_prefs.dart';
import '../../../core/utils/amount_format.dart';
import '../../onboarding/services/onboarding_api.dart';
import '../../onboarding/widgets/dashboard_tour_overlay.dart';
import '../../chit_groups/screens/chit_groups_screen.dart';
import '../../auctions/screens/auctions_screen.dart';
import '../../payments/screens/payments_screen.dart';
import '../../profile/screens/profile_screen.dart';

// ─── Formatters ───────────────────────────────────────────────────────────────
final _inr =
    NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _dtFmt = DateFormat('dd MMM yyyy');

// ─── Main Shell with Bottom Nav ───────────────────────────────────────────────
class DashboardScreen extends StatefulWidget {
  final String? digilockerStatus;
  final bool onboardingJustCompleted;
  const DashboardScreen({
    super.key,
    this.digilockerStatus,
    this.onboardingJustCompleted = false,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  final _paymentsKey = GlobalKey<PaymentsScreenState>();
  bool _showTour = false;

  final _tourHeaderKey = GlobalKey();
  final _tourInvestedKey = GlobalKey();
  final _tourChitsKey = GlobalKey();
  final _tourActiveChitsKey = GlobalKey();
  final _tourNavChitsKey = GlobalKey();
  final _tourNavPaymentsKey = GlobalKey();
  final _tourNavMoreKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    // Set context for SocketService multi-device alerts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      SocketService.instance.setContext(context);
      _handleDigiLockerReturn();
      _maybeStartTour();
    });
  }

  void _handleDigiLockerReturn() {
      // Handle DigiLocker deep link return
      if (widget.digilockerStatus != null) {
        // Force refresh dashboard (bypass cache) to pick up new KYC status
        context.read<DashboardProvider>().refresh();
        if (widget.digilockerStatus == 'success') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('DigiLocker connected! KYC verified.'),
              backgroundColor: AppTheme.successColor,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content:
                  Text('DigiLocker verification failed. Please try again.'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
        }
      }
  }

  Future<void> _maybeStartTour() async {
    await OnboardingCache.refresh();
    if (!mounted) return;
    if (OnboardingCache.tourCompleted == true) return;

    final dismissed = await AppPrefs.isPostOnboardingDismissed();
    if (dismissed || !mounted) return;

    final pending = await AppPrefs.isPostOnboardingTourPending();
    if (!widget.onboardingJustCompleted && !pending) return;

    if (widget.onboardingJustCompleted && mounted) {
      context.go('/dashboard');
    }

    if (!mounted) return;
    setState(() => _showTour = true);
  }

  Future<void> _handleTourDone() async {
    if (!mounted) return;
    setState(() => _showTour = false);
    await AppPrefs.setPostOnboardingDismissed(true);
    OnboardingApi.tourComplete().catchError((_) => <String, dynamic>{});
    if (!mounted) return;
    _showSharePrompt();
  }

  Future<void> _showSharePrompt() async {
    final share = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.celebration_rounded, color: AppTheme.secondaryColor),
            SizedBox(width: 8),
            Expanded(child: Text('You\'re all set!')),
          ],
        ),
        content: const Text(
          'Share Assure ChitFunds with friends and family so they can save and grow with you.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Maybe later'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.share_rounded, size: 18),
            label: const Text('Share'),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
          ),
        ],
      ),
    );
    if (share == true && mounted) {
      const text =
          'Hi! I\'ve been using Assure ChitFunds — a transparent, secure way to save and grow your money with monthly chit auctions. Join me on the platform.\n\nhttps://assure.fund';
      await Share.share(text, subject: 'Try Assure ChitFunds');
    }
  }

  List<DashboardTourStep> _buildTourSteps() {
    return [
      DashboardTourStep(
        targetKey: _tourHeaderKey,
        title: 'Welcome to your dashboard',
        body:
            'This is your home screen. Here you can see your profile, notifications, and a quick overview of your chit activity.',
      ),
      DashboardTourStep(
        targetKey: _tourInvestedKey,
        title: 'Total Invested',
        body:
            'Track how much you have invested across all your chit groups in one place.',
        linkLabel: 'Open investment details',
        onLinkTap: () => context.push('/total-investment'),
      ),
      DashboardTourStep(
        targetKey: _tourChitsKey,
        title: 'Browse chit groups',
        body:
            'See new and vacant chit groups you can join. Tap to explore available options.',
        linkLabel: 'Go to Invest',
        onLinkTap: () => setState(() => _currentIndex = 1),
      ),
      DashboardTourStep(
        targetKey: _tourActiveChitsKey,
        title: 'My Active Chits',
        body:
            'Your enrolled chit groups appear here. Tap any card to view details, payments, and auction history.',
      ),
      DashboardTourStep(
        targetKey: _tourNavChitsKey,
        title: 'Invest tab',
        body:
            'Use the bottom navigation to switch between Home, Invest, Auctions, Transactions, and More anytime.',
      ),
      DashboardTourStep(
        targetKey: _tourNavPaymentsKey,
        title: 'Transactions',
        body:
            'Pay monthly installments, view receipts, and check due or overdue payments from the Transactions tab.',
        linkLabel: 'Open Transactions',
        onLinkTap: () => setState(() => _currentIndex = 3),
      ),
      DashboardTourStep(
        targetKey: _tourNavMoreKey,
        title: 'Profile & settings',
        body:
            'Access your profile, documents, help, support tickets, and account settings from the More tab.',
        linkLabel: 'Open More',
        onLinkTap: () => setState(() => _currentIndex = 4),
      ),
    ];
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
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _currentIndex = 0);
      },
      child: Listener(
        onPointerDown: (_) =>
            context.read<AuthProvider>().resetInactivityTimer(),
        onPointerMove: (_) =>
            context.read<AuthProvider>().resetInactivityTimer(),
        child: Stack(
          children: [
            Scaffold(
              body: IndexedStack(
                index: _currentIndex,
                children: [
                  _HomeTab(
                    switchTab: _switchTab,
                    tourHeaderKey: _tourHeaderKey,
                    tourInvestedKey: _tourInvestedKey,
                    tourChitsKey: _tourChitsKey,
                    tourActiveChitsKey: _tourActiveChitsKey,
                  ),
                  const ChitGroupsScreen(),
                  const AuctionsScreen(),
                  PaymentsScreen(key: _paymentsKey),
                  ProfileScreen(switchTab: _switchTab),
                ],
              ),
              bottomNavigationBar: Theme(
                data: Theme.of(context).copyWith(
                  navigationBarTheme: NavigationBarThemeData(
                    labelTextStyle: WidgetStateProperty.resolveWith((states) {
                      return const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        height: 1.1,
                        letterSpacing: -0.2,
                      );
                    }),
                  ),
                ),
                child: NavigationBar(
                key: _tourNavChitsKey,
                selectedIndex: _currentIndex,
                onDestinationSelected: _switchTab,
                backgroundColor: Colors.white,
                surfaceTintColor: Colors.transparent,
                elevation: 8,
                shadowColor: Colors.black26,
                destinations: [
                  const NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home_rounded),
                    label: 'Home',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.trending_up_outlined),
                    selectedIcon: Icon(Icons.trending_up_rounded),
                    label: 'Invest',
                  ),
                  const NavigationDestination(
                    icon: Icon(Icons.gavel_outlined),
                    selectedIcon: Icon(Icons.gavel_rounded),
                    label: 'Auctions',
                  ),
                  NavigationDestination(
                    key: _tourNavPaymentsKey,
                    icon: const Icon(Icons.account_balance_wallet_outlined),
                    selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
                    label: 'Transactions',
                  ),
                  NavigationDestination(
                    key: _tourNavMoreKey,
                    icon: const Icon(Icons.menu_rounded),
                    selectedIcon: const Icon(Icons.menu_rounded),
                    label: 'More',
                  ),
                ],
                ),
              ),
            ),
            if (_showTour)
              Positioned.fill(
                child: DashboardTourOverlay(
                  steps: _buildTourSteps(),
                  onDone: _handleTourDone,
                ),
              ),
            ValueListenableBuilder<bool>(
              valueListenable: AppPrefs.chatbotVisible,
              builder: (context, chatbotOn, _) {
                if (!chatbotOn) return const SizedBox.shrink();
                return _DraggableFab(onTap: () => context.push('/chatbot'));
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
class _HomeTab extends StatefulWidget {
  final void Function(int) switchTab;
  final GlobalKey tourHeaderKey;
  final GlobalKey tourInvestedKey;
  final GlobalKey tourChitsKey;
  final GlobalKey tourActiveChitsKey;
  const _HomeTab({
    required this.switchTab,
    required this.tourHeaderKey,
    required this.tourInvestedKey,
    required this.tourChitsKey,
    required this.tourActiveChitsKey,
  });

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
                _HeaderSection(
                    user: user,
                    dash: dash,
                    loading: true,
                    onProfileTap: () => context.push('/edit-profile')),
                const Expanded(
                    child: Center(child: CircularProgressIndicator())),
              ],
            ),
          );
        }

        if (dash.error != null && dash.data == null) {
          return Scaffold(
            backgroundColor: AppTheme.surfaceLight,
            body: Column(
              children: [
                _HeaderSection(
                    user: user,
                    dash: dash,
                    loading: false,
                    onProfileTap: () => context.push('/edit-profile')),
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off_rounded,
                            size: 60, color: Colors.grey),
                        const SizedBox(height: 16),
                        const Text('Could not load dashboard',
                            style: TextStyle(fontSize: 16, color: Colors.grey)),
                        const SizedBox(height: 4),
                        Text(dash.error!,
                            style: const TextStyle(
                                fontSize: 12, color: Colors.grey),
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
                  child: KeyedSubtree(
                    key: widget.tourHeaderKey,
                    child: _HeaderSection(
                        user: user,
                        dash: dash,
                        loading: false,
                        onProfileTap: () => context.push('/edit-profile')),
                  ),
                ),
                // Item 9: KYC banner removed — onboarding handles this
                SliverToBoxAdapter(
                    child: _DuePaymentsReminder(switchTab: widget.switchTab)),
                SliverToBoxAdapter(
                    child: _StatsRow(
                      dash: dash,
                      switchTab: widget.switchTab,
                      tourInvestedKey: widget.tourInvestedKey,
                      tourChitsKey: widget.tourChitsKey,
                    )),
                // Item 3: Set a Goal card
                const SliverToBoxAdapter(child: _SetGoalBanner()),
                SliverToBoxAdapter(
                    child: KeyedSubtree(
                      key: widget.tourActiveChitsKey,
                      child: _ActiveChits(
                          dash: dash, switchTab: widget.switchTab),
                    )),
                if (dash.upcomingAuctions.isNotEmpty)
                  SliverToBoxAdapter(
                      child: _UpcomingAuctions(
                          dash: dash, switchTab: widget.switchTab)),
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
class _HeaderSection extends StatefulWidget {
  final dynamic user;
  final DashboardProvider dash;
  final bool loading;
  final VoidCallback? onProfileTap;

  const _HeaderSection(
      {required this.user,
      required this.dash,
      required this.loading,
      this.onProfileTap});

  @override
  State<_HeaderSection> createState() => _HeaderSectionState();
}

class _HeaderSectionState extends State<_HeaderSection> {
  List<Map<String, dynamic>> _familyMembers = [];

  @override
  void initState() {
    super.initState();
    _loadFamilyMembers();
  }

  Future<void> _loadFamilyMembers() async {
    try {
      final res = await ApiService.get('/users/family-members');
      if (res['success'] == true && mounted) {
        final members = List<Map<String, dynamic>>.from(res['data'] ?? []);
        final linkedIds = members
            .where((m) =>
                (m['status'] ?? '') == 'approved' ||
                (m['status'] ?? '') == 'linked')
            .map((m) => (m['member_id'] ?? '').toString().toUpperCase())
            .where((v) => v.isNotEmpty)
            .toSet();
        final activeProvider = context.read<ActiveMemberProvider>();
        final active = activeProvider.activeMemberId?.toUpperCase();
        if (active != null && !linkedIds.contains(active)) {
          await activeProvider.setActiveMemberId(null);
        }
        setState(() {
          _familyMembers = members;
        });
      }
    } catch (_) {}
  }

  Future<void> _switchActiveMember(String selected) async {
    final provider = context.read<ActiveMemberProvider>();
    final target = selected == 'me' ? null : selected;
    await provider.setActiveMemberId(target);

    if (!mounted) return;

    await Future.wait([
      context.read<DashboardProvider>().refresh(),
      context.read<PaymentProvider>().fetchPayments(),
      context.read<ChitGroupProvider>().fetchMyChitGroups(),
      context.read<AuctionProvider>().fetchAuctions(),
      context.read<NotificationProvider>().refresh(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final dash = widget.dash;
    final auth = context.watch<AuthProvider>();
    final activeMemberId = context.watch<ActiveMemberProvider>().activeMemberId;
    final selfId = auth.loginMemberId ?? user?.memberId ?? 'ME';
    final profileApproved =
        dash.profileApprovalStatus.toLowerCase() == 'approved';
    final profilePct = dash.profilePercentage;
    final kycAdminVerified =
        ['verified', 'approved'].contains(dash.kycStatus.toLowerCase());
    final showKycVerified = profileApproved && kycAdminVerified;
    final showProfileProgress = !profileApproved;

    // When a family member is selected, show their name/avatar instead
    Map<String, dynamic>? activeFamilyMember;
    if (activeMemberId != null) {
      try {
        activeFamilyMember = _familyMembers.firstWhere(
          (m) => (m['member_id'] ?? '').toString().toUpperCase() == activeMemberId.toUpperCase(),
        );
      } catch (_) {}
    }

    final displayName = activeFamilyMember != null
      ? ((activeFamilyMember['full_name']?.toString().trim().isNotEmpty == true)
        ? activeFamilyMember['full_name'].toString().trim()
        : (activeFamilyMember['member_id']?.toString().trim().isNotEmpty == true)
          ? activeFamilyMember['member_id'].toString().trim()
          : (activeMemberId ?? 'Member'))
      : (user?.fullName ?? 'Member');
    final firstName = displayName.split(' ').first;
    final displayImageUrl = activeFamilyMember != null
        ? null  // family member linked profile image not available; show initials
        : user?.profileImageUrl;

    final approvedLinkedMembers = _familyMembers
        .where((m) =>
            (m['status'] ?? '') == 'approved' ||
            (m['status'] ?? '') == 'linked')
        .toList();

    final seenMemberIds = <String>{};
    final uniqueFamilyMembers = approvedLinkedMembers.where((m) {
      final key = (m['member_id'] ?? '').toString().toUpperCase();
      if (key.isEmpty || key == selfId.toUpperCase()) return false;
      if (seenMemberIds.contains(key)) return false;
      seenMemberIds.add(key);
      return true;
    }).toList();

    // Build dropdown items: self + distinct approved family members
    final dropdownItems = <DropdownMenuItem<String>>[
      DropdownMenuItem(
        value: 'me',
        child: Text(selfId,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      ),
        ...uniqueFamilyMembers
          .map((m) => DropdownMenuItem(
                value: m['member_id']?.toString() ?? m['_id']?.toString() ?? '',
                child: Text(
                  m['member_id']?.toString() ??
                      m['full_name']?.toString() ??
                      '',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600),
                ),
              )),
    ];

    final validValues =
        dropdownItems.map((e) => e.value).whereType<String>().toSet();
    final selectedValue =
        validValues.contains(activeMemberId) ? activeMemberId! : 'me';

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.primaryDark,
            AppTheme.accentBlue,
            AppTheme.primaryColor
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            IgnorePointer(
              child: Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(top: 14, right: 10),
                  child: Opacity(
                    opacity: 0.16,
                    child: Image.asset(
                      'assets/images/logo_header.png',
                      width: 126,
                      height: 126,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => widget.onProfileTap?.call(),
                        child: Row(
                          children: [
                            (displayImageUrl != null &&
                                    displayImageUrl.isNotEmpty)
                                ? CircleAvatar(
                                    radius: 24,
                                    backgroundColor: Colors.white24,
                                    backgroundImage:
                                        NetworkImage(displayImageUrl),
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
                            // Item 2: removed "Partners in Growth" subtitle
                            // Item 34: Family Member Dropdown below name
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
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Item 8: Support first, then Notifications
                      Row(
                        children: [
                          IconButton(
                            onPressed: () => context.push('/support'),
                            icon: SvgPicture.asset('assets/icons/support.svg',
                                width: 26,
                                height: 26,
                                colorFilter: const ColorFilter.mode(
                                    Colors.white, BlendMode.srcIn)),
                            tooltip: 'Support',
                          ),
                          Consumer<NotificationProvider>(
                            builder: (context, notifProvider, _) {
                              final unread = notifProvider.unreadCount;
                              return Stack(
                                children: [
                                  IconButton(
                                    onPressed: () =>
                                        context.push('/notifications'),
                                    icon: const Icon(
                                        Icons.notifications_outlined,
                                        color: Colors.white,
                                        size: 28),
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
                                        constraints: const BoxConstraints(
                                            minWidth: 18, minHeight: 18),
                                        child: Text(
                                          unread > 9 ? '9+' : '$unread',
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold),
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                    ),
                                ],
                              );
                            },
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
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: showKycVerified
                              ? Colors.green.withAlpha(51)
                              : showProfileProgress
                                  ? Colors.blue.withAlpha(51)
                                  : Colors.orange.withAlpha(51),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: showKycVerified
                                ? Colors.greenAccent
                                : showProfileProgress
                                    ? Colors.lightBlueAccent
                                    : Colors.orangeAccent,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              showKycVerified
                                  ? Icons.verified_rounded
                                  : showProfileProgress
                                      ? Icons.account_circle_outlined
                                      : Icons.pending_rounded,
                              color: showKycVerified
                                  ? Colors.greenAccent
                                  : showProfileProgress
                                      ? Colors.lightBlueAccent
                                      : Colors.orangeAccent,
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              showKycVerified
                                  ? 'KYC Verified'
                                  : showProfileProgress
                                      ? 'Profile $profilePct% complete'
                                      : 'KYC Not Verified',
                              style: TextStyle(
                                color: showKycVerified
                                    ? Colors.greenAccent
                                    : showProfileProgress
                                        ? Colors.lightBlueAccent
                                        : Colors.orangeAccent,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (dropdownItems.length > 1)
                        Container(
                          height: 28,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(40),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: selectedValue,
                              icon: const Icon(Icons.arrow_drop_down,
                                  color: Colors.white, size: 16),
                              isDense: true,
                              dropdownColor: AppTheme.primaryColor,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                              items: dropdownItems,
                              onChanged: (val) {
                                if (val != null) {
                                  _switchActiveMember(val);
                                }
                              },
                            ),
                          ),
                        ),
                      if (dropdownItems.length > 1) const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => context.push('/qr-scan'),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white12,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Icon(Icons.qr_code_scanner,
                              color: Colors.white70, size: 18),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Combined KYC + Profile Banner ────────────────────────────────────────────
class _KycProfileBanner extends StatelessWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;
  final dynamic user;
  const _KycProfileBanner(
      {required this.dash, required this.switchTab, this.user});

  @override
  Widget build(BuildContext context) {
    final profileIncomplete = !dash.isProfileComplete;
    final pct = dash.profilePercentage;

    final profileStatus =
        (user?.profileEditStatus ?? dash.profileApprovalStatus)
            .toString()
            .toLowerCase();
    final isFinalApproved = profileStatus == 'approved';
    final isUnderReview = profileStatus == 'pending';
    final isRejected = profileStatus == 'rejected';

    final hasDigilocker = dash.digilockerConnected;
    final hasSelfie = dash.selfieVerified;
    final hasCheque = dash.chequeUploaded;

    final bankIfsc =
        (user?.bankIfscCode ?? dash.data?['user']?['bank_ifsc_code'] ?? '')
            .toString()
            .trim();
    final bankAccount = (user?.bankAccountNumber ??
            dash.data?['user']?['bank_account_number'] ??
            '')
        .toString()
        .trim();
    final hasBankDetails = bankIfsc.isNotEmpty && bankAccount.isNotEmpty;

    String actionLabel = '';
    VoidCallback? action;

    if (!hasDigilocker) {
      actionLabel = 'Connect DigiLocker';
      action = () => context.push('/kyc');
    } else if (!hasSelfie) {
      actionLabel = 'Complete Face ID';
      action = () => context.push('/documents');
    } else if (!hasBankDetails) {
      actionLabel = 'Add Bank IFSC Details';
      action = () => context.push('/edit-profile');
    } else if (!isFinalApproved) {
      actionLabel = isUnderReview
          ? 'Waiting For Admin Approval'
          : 'Submit Profile For Approval';
      action = isUnderReview ? null : () => context.push('/edit-profile');
    }

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
          Row(
            children: [
              Icon(
                isFinalApproved
                    ? Icons.verified_rounded
                    : Icons.assignment_turned_in_outlined,
                color: isFinalApproved
                    ? AppTheme.successColor
                    : AppTheme.secondaryColor,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isFinalApproved
                      ? 'Onboarding completed. All features unlocked.'
                      : 'Complete onboarding to unlock full member access.',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _stepRow('1. DigiLocker verification', hasDigilocker),
          const SizedBox(height: 6),
          _stepRow('2. Face ID (live selfie)', hasSelfie),
          const SizedBox(height: 6),
          _stepRow('3. Cancelled cheque (optional)', hasCheque, optional: true),
          const SizedBox(height: 6),
          _stepRow('4. IFSC + bank details', hasBankDetails),
          const SizedBox(height: 6),
          _stepRow(
              '5. Submit profile details', isUnderReview || isFinalApproved),
          const SizedBox(height: 6),
          _stepRow('6. Admin final approval', isFinalApproved),
          if (isUnderReview) ...[
            const SizedBox(height: 10),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Your application is under review. Verification is usually completed within 24 hours and you will receive app notification.',
                style: TextStyle(fontSize: 12, color: Colors.black87),
              ),
            ),
          ],
          if (isRejected) ...[
            const SizedBox(height: 10),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Your previous submission was rejected. Update requested fields and resubmit profile.',
                style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.errorColor,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ],
          if (profileIncomplete) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Profile $pct% complete',
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: pct / 100,
                minHeight: 6,
                backgroundColor: AppTheme.lightBlueBg,
                valueColor:
                    const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
              ),
            ),
          ],
          if (!isFinalApproved && actionLabel.isNotEmpty) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: action,
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      action == null ? Colors.grey : AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                ),
                child: Text(actionLabel),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _stepRow(String label, bool done, {bool optional = false}) {
    return Row(
      children: [
        Icon(
          done
              ? Icons.check_circle
              : (optional
                  ? Icons.circle_outlined
                  : Icons.radio_button_unchecked),
          size: 16,
          color: done ? AppTheme.successColor : Colors.black54,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: done ? Colors.black87 : Colors.black54,
              fontWeight: done ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Due Payments Reminder (paged swipe per due) ─────────────────────────────
class _DuePaymentsReminder extends StatefulWidget {
  final void Function(int) switchTab;
  const _DuePaymentsReminder({required this.switchTab});

  @override
  State<_DuePaymentsReminder> createState() => _DuePaymentsReminderState();
}

class _DuePaymentsReminderState extends State<_DuePaymentsReminder> {
  static const double _cardGap = 8;
  static const double _viewportFraction = 0.86;
  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: _viewportFraction);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Widget _dueCard({
    required String groupName,
    required double amount,
    required bool isOverdue,
    required dynamic month,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(18),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            isOverdue ? Icons.warning_amber_rounded : Icons.schedule,
            color: isOverdue ? AppTheme.errorColor : AppTheme.secondaryColor,
            size: 22,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  groupName,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  isOverdue ? 'Overdue - Month $month' : 'Due - Month $month',
                  style: TextStyle(
                    color: isOverdue ? AppTheme.errorColor : Colors.grey[700],
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 38,
            child: ElevatedButton(
              onPressed: () {
                PaymentsScreen.initialTabIndex = 0;
                widget.switchTab(3);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                elevation: 2,
                shadowColor: AppTheme.primaryColor.withAlpha(80),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text('Pay ${_inr.format(amount)}'),
            ),
          ),
        ],
      ),
    );
  }

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

        final hasMultiple = due.length > 1;

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Container(
            clipBehavior: Clip.antiAlias,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
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
                        color: AppTheme.primaryColor, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'Due Payments (${due.length})',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (!hasMultiple)
                  _dueCard(
                    groupName: ((due.first['chit_group'] ?? due.first['chitGroup'])
                                as Map<String, dynamic>?)?['group_name']
                            ?.toString() ??
                        'Chit Group',
                    amount: double.tryParse(
                            due.first['total_amount']?.toString() ??
                                due.first['amount']?.toString() ??
                                '0') ??
                        0,
                    isOverdue: due.first['payment_status'] == 'overdue',
                    month: due.first['month_number'] ?? '',
                  )
                else
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      height: 80,
                      child: PageView.builder(
                        controller: _pageController,
                        physics: const BouncingScrollPhysics(
                          parent: PageScrollPhysics(),
                        ),
                        padEnds: false,
                        onPageChanged: (i) => setState(() => _currentPage = i),
                        itemCount: due.length,
                        itemBuilder: (context, i) {
                          final p = due[i];
                          final group = (p['chit_group'] ?? p['chitGroup'])
                                  as Map<String, dynamic>? ??
                              {};
                          final groupName =
                              group['group_name']?.toString() ?? 'Chit Group';
                          final amount = double.tryParse(
                                  p['total_amount']?.toString() ??
                                      p['amount']?.toString() ??
                                      '0') ??
                              0;
                          final isOverdue = p['payment_status'] == 'overdue';
                          final month = p['month_number'] ?? '';

                          return AnimatedBuilder(
                            animation: _pageController,
                            builder: (context, child) {
                              var scale = 1.0;
                              var opacity = 1.0;
                              if (_pageController.position.haveDimensions) {
                                final page =
                                    _pageController.page ?? i.toDouble();
                                final delta = (page - i).abs();
                                scale = (1 - delta * 0.08).clamp(0.92, 1.0);
                                opacity = (1 - delta * 0.4).clamp(0.55, 1.0);
                              }
                              return Padding(
                                padding: EdgeInsets.only(
                                  left: i == 0 ? 0 : _cardGap / 2,
                                  right: i == due.length - 1 ? 0 : _cardGap / 2,
                                ),
                                child: Opacity(
                                  opacity: opacity,
                                  child: Transform.scale(
                                    scale: scale,
                                    alignment: Alignment.center,
                                    child: child,
                                  ),
                                ),
                              );
                            },
                            child: _dueCard(
                              groupName: groupName,
                              amount: amount,
                              isOverdue: isOverdue,
                              month: month,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                if (hasMultiple) ...[
                  const SizedBox(height: 5),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < due.length; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: _currentPage == i ? 14 : 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _currentPage == i
                                ? AppTheme.primaryColor
                                : AppTheme.primaryColor.withAlpha(80),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                    ],
                  ),
                ],
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
  final GlobalKey tourInvestedKey;
  final GlobalKey tourChitsKey;

  const _StatsRow({
    required this.dash,
    required this.switchTab,
    required this.tourInvestedKey,
    required this.tourChitsKey,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => context.push('/total-investment'),
              child: KeyedSubtree(
                key: tourInvestedKey,
                child: _StatCard(
                  label: 'Total Invested',
                  value: _inr.format(dash.totalInvested),
                  icon: Icons.savings_rounded,
                  iconBg: AppTheme.lightBlueBg,
                  iconColor: AppTheme.accentBlue,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: () => switchTab(1),
              child: KeyedSubtree(
                key: tourChitsKey,
                child: _StatCard(
                  label: 'New/Vacant',
                  value: '${dash.availableChitsCount}',
                  icon: Icons.group_work_rounded,
                  iconBg: AppTheme.lightBlueBg,
                  iconColor: AppTheme.accentBlue,
                ),
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
class _ActiveChits extends StatefulWidget {
  final DashboardProvider dash;
  final void Function(int) switchTab;

  const _ActiveChits({required this.dash, required this.switchTab});

  @override
  State<_ActiveChits> createState() => _ActiveChitsState();
}

class _ActiveChitsState extends State<_ActiveChits> {
  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.88);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    DateTime parseMembershipDate(Map<String, dynamic> m) {
      final dynamic raw =
          m['enrollment_date'] ?? m['created_at'] ?? m['updated_at'];
      if (raw == null) return DateTime.fromMillisecondsSinceEpoch(0);
      return DateTime.tryParse(raw.toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0);
    }

    final memberships = widget.dash.memberships
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList()
      ..sort(
          (a, b) => parseMembershipDate(b).compareTo(parseMembershipDate(a)));

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 0, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: const Text('My Active Chits',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 10),
          memberships.isEmpty
              ? Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: _EmptyCard(
                    icon: Icons.group_work_outlined,
                    message: 'No active chit groups yet',
                    actionLabel: 'Browse Groups',
                    onAction: () => widget.switchTab(1),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 168,
                      child: memberships.length == 1
                          ? Padding(
                              padding: const EdgeInsets.only(right: 16),
                              child: _buildChitCard(context, memberships.first),
                            )
                          : PageView.builder(
                              controller: _pageController,
                              padEnds: false,
                              physics: const BouncingScrollPhysics(
                                parent: PageScrollPhysics(),
                              ),
                              onPageChanged: (i) => setState(() => _currentPage = i),
                              itemCount: memberships.length,
                              itemBuilder: (context, i) {
                                return Padding(
                                  padding: EdgeInsets.only(
                                    left: i == 0 ? 0 : 6,
                                    right: i == memberships.length - 1 ? 16 : 6,
                                  ),
                                  child: _buildChitCard(context, memberships[i]),
                                );
                              },
                            ),
                    ),
                    if (memberships.length > 1) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < memberships.length; i++)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: _currentPage == i ? 12 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: _currentPage == i
                                    ? AppTheme.primaryColor
                                    : AppTheme.primaryColor.withAlpha(80),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
        ],
      ),
    );
  }

  Widget _buildChitCard(BuildContext context, Map<String, dynamic> m) {
    final group =
        (m['chit_group_id'] as Map<String, dynamic>?) ??
            (m['ChitGroup'] as Map<String, dynamic>?) ??
            {};
    final current = (group['current_month'] ?? 0) as int;
    final total = (group['duration_months'] ?? 1) as int;
    final progress = total > 0 ? (current / total).clamp(0.0, 1.0) : 0.0;
    final chitValue =
        double.tryParse(group['chit_value']?.toString() ?? '0') ?? 0;
    final monthly =
        double.tryParse(group['monthly_installment']?.toString() ?? '0') ?? 0;
    final invested =
        double.tryParse(m['total_paid']?.toString() ?? '0') ?? 0;
    final groupId = (group['_id'] ?? group['id'] ?? '').toString();

    return GestureDetector(
      onTap: () {
        if (groupId.isNotEmpty) {
          context.push('/chit-groups/$groupId');
        }
      },
      child: _ChitCard(
        name: group['group_name']?.toString() ?? 'Chit Group',
        invested: invested,
        chitValue: chitValue,
        monthly: monthly,
        currentMonth: current,
        totalMonths: total,
        progress: progress,
      ),
    );
  }
}

class _ChitCard extends StatelessWidget {
  final String name;
  final double invested;
  final double chitValue;
  final double monthly;
  final int currentMonth;
  final int totalMonths;
  final double progress;

  const _ChitCard({
    required this.name,
    required this.invested,
    required this.chitValue,
    required this.monthly,
    required this.currentMonth,
    required this.totalMonths,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    const cardColor = AppTheme.primaryColor;

    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: cardColor.withAlpha(102),
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
            formatInvestedVsChit(invested, chitValue),
            style: const TextStyle(
                color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const Text(
            'Invested',
            style: TextStyle(color: Colors.white54, fontSize: 11),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Monthly: ${_inr.format(monthly)}',
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
              Text(
                '$currentMonth/$totalMonths',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
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
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              TextButton(
                onPressed: () => switchTab(2),
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...auctions.take(3).map((a) {
            final auction = a as Map<String, dynamic>;
            final isLive =
                auction['status'] == 'active' || auction['status'] == 'live';
            final group = (auction['chit_group_id'] as Map<String, dynamic>?) ??
                (auction['ChitGroup'] as Map<String, dynamic>?) ??
                {};
            final scheduledRaw = auction['scheduled_date'];
            String dateStr = '';
            if (scheduledRaw != null) {
              try {
                dateStr =
                    _dtFmt.format(DateTime.parse(scheduledRaw.toString()));
              } catch (_) {}
            }
            final chitValue =
                double.tryParse(group['chit_value']?.toString() ?? '0') ?? 0;

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
                      color:
                          isLive ? Colors.red.shade50 : Colors.purple.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.gavel_rounded,
                        color: isLive
                            ? AppTheme.errorColor
                            : AppTheme.purpleAccent,
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
                          color: isLive
                              ? AppTheme.errorColor
                              : AppTheme.purpleAccent,
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
          }),
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
          BoxShadow(color: Colors.black.withAlpha(13), blurRadius: 6),
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
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
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

    if (isPending) return const SizedBox.shrink();

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
                child:
                    const Icon(Icons.verified, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('You\'re an Assure Agent',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    SizedBox(height: 4),
                    Text('Earn commission by referring new members',
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
                color: (isPending
                        ? AppTheme.secondaryColor
                        : AppTheme.primaryColor)
                    .withAlpha(60),
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
                  isPending
                      ? Icons.hourglass_top_rounded
                      : Icons.handshake_outlined,
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
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isPending
                          ? 'Our team will contact you within 24 hours'
                          : 'Earn commission by referring new members',
                      style: TextStyle(
                          color: Colors.white.withAlpha(180), fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (!isPending)
                const Icon(Icons.chevron_right, color: Colors.white70),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showBecomeAgentSheet(BuildContext context) async {
    await _fetchAgentStatus();
    if (!context.mounted) return;

    final isPending = _agentStatus == 'pending';
    final isApproved = _agentStatus == 'approved';
    final isRejected = _agentStatus == 'rejected';

    if (isPending) {
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
              const Icon(Icons.hourglass_top_rounded,
                  color: AppTheme.secondaryColor, size: 48),
              const SizedBox(height: 16),
              const Text('Request Submitted',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text(
                'You have already submitted your agent application. Our team will contact you within 24 hours.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 14),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('OK'),
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }

    if (isApproved) {
      showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.verified, color: AppTheme.successColor, size: 48),
              SizedBox(height: 16),
              Text('You\'re an Assure Agent',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text(
                'Your application is approved. Share your referral code to earn commission on new members.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 14),
              ),
            ],
          ),
        ),
      );
      return;
    }

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
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.handshake_outlined,
                  color: AppTheme.primaryColor, size: 40),
            ),
            const SizedBox(height: 16),
            const Text('Become an Assure Agent',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Earn commission by referring new members to Assure ChitFunds. Our team will contact you within 24 hours.',
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
                    final res =
                        await ApiService.post('/users/agent-request', {});
                    if (!context.mounted) return;
                    setState(() => _agentStatus = 'pending');
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(
                              res['message'] ?? 'Agent request submitted!'),
                          backgroundColor: AppTheme.successColor),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content:
                              Text(e.toString().replaceAll('Exception: ', '')),
                          backgroundColor: AppTheme.errorColor),
                    );
                  }
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  isRejected
                      ? 'Submit Request Again'
                      : 'Submit Request',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600),
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

// ─── Set a Goal Banner (Item 3) ──────────────────────────────────────────────
class _SetGoalBanner extends StatelessWidget {
  const _SetGoalBanner();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: GestureDetector(
        onTap: () => context.push('/goals'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1A3A5C), Color(0xFF0D2137)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                  color: AppTheme.primaryColor.withAlpha(60),
                  blurRadius: 10,
                  offset: const Offset(0, 3)),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.secondaryColor.withAlpha(40),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.flag_rounded,
                    color: AppTheme.secondaryColor, size: 26),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Set a Goal',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 15)),
                    SizedBox(height: 4),
                    Text('Plan your savings and achieve targets faster',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white54),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Trust Badges ─────────────────────────────────────────────────────────────
class _TrustBadges extends StatelessWidget {
  const _TrustBadges();

  static const _badges = [
    (
      asset: 'assets/images/trusted_dpiit.png',
      label: 'DPIIT\nRegistered',
    ),
    (
      asset: 'assets/images/trusted_telangana.png',
      label: 'Telangana Govt.\nRegistered',
    ),
    (
      asset: 'assets/images/trusted_data_secured.png',
      label: 'Data\nSecured',
    ),
  ];

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
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < _badges.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(
                    child: _TrustLogoCard(
                      imagePath: _badges[i].asset,
                      label: _badges[i].label,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TrustLogoCard extends StatelessWidget {
  final String imagePath;
  final String label;

  const _TrustLogoCard({required this.imagePath, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 14, 8, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8ECF0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(13),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            height: 58,
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Image.asset(
                imagePath,
                fit: BoxFit.contain,
                alignment: Alignment.center,
                filterQuality: FilterQuality.high,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppTheme.primaryColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1.25,
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
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _SbiLogo()),
              const SizedBox(width: 10),
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
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(13),
              blurRadius: 6,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Image.asset(
            'assets/icons/sbi.png',
            height: 36,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 8),
          const Text('Banking Partner',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.accentBlue,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _CashfreeLogo extends StatelessWidget {
  const _CashfreeLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(13),
              blurRadius: 6,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Image.asset(
            'assets/icons/cashfree.png',
            height: 36,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 8),
          const Text('Payment Gateway',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Color(0xFF6C3EC1),
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
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
    final targetX = center < screen.width / 2 ? 8.0 : screen.width - 68.0;

    final startX = _offset!.dx;
    _snapAnimation = Tween<double>(begin: startX, end: targetX).animate(
        CurvedAnimation(parent: _snapController, curve: Curves.easeOut))
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
              BoxShadow(
                  color: AppTheme.primaryColor.withAlpha(60),
                  blurRadius: 12,
                  spreadRadius: 1,
                  offset: const Offset(0, 3)),
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
