import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/active_member_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_prefs.dart';

class ProfileScreen extends StatefulWidget {
  final void Function(int)? switchTab;
  const ProfileScreen({super.key, this.switchTab});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Map<String, dynamic>> _familyMembers = [];
  List<Map<String, dynamic>> _activeSessions = [];
  bool _showCompletedChits = false;
  bool _showCancelledChits = false;

  @override
  void initState() {
    super.initState();
    _loadFamilyMembers();
    _loadChitHistoryFlags();
    _loadActiveSessions();
  }

  Future<void> _loadChitHistoryFlags() async {
    try {
      final res = await ApiService.get('/users/my-chit-groups');
      if (res['success'] == true && mounted) {
        final rows = List.from(res['data'] ?? []);
        var hasCompleted = false;
        var hasCancelled = false;
        for (final row in rows) {
          final g = row is Map ? row['chit_group_id'] : null;
          if (g is Map) {
            final st = g['status']?.toString();
            if (st == 'completed') hasCompleted = true;
            if (st == 'cancelled') hasCancelled = true;
          }
        }
        setState(() {
          _showCompletedChits = hasCompleted;
          _showCancelledChits = hasCancelled;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadActiveSessions() async {
    try {
      final res = await ApiService.get('/users/active-sessions');
      if (res['success'] == true && mounted) {
        setState(() {
          _activeSessions =
              List<Map<String, dynamic>>.from(res['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadFamilyMembers() async {
    try {
      final res = await ApiService.get('/users/family-members');
      if (res['success'] == true && mounted) {
        setState(() {
          _familyMembers = List<Map<String, dynamic>>.from(res['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final activeMemberId = context.watch<ActiveMemberProvider>().activeMemberId;

    Map<String, dynamic>? activeFamilyMember;
    if (activeMemberId != null) {
      try {
        activeFamilyMember = _familyMembers.firstWhere(
          (m) =>
              (m['member_id'] ?? '').toString().toUpperCase() ==
              activeMemberId.toUpperCase(),
        );
      } catch (_) {}
    }

    final displayName = activeFamilyMember != null
        ? ((activeFamilyMember['full_name']?.toString().trim().isNotEmpty ==
                true)
            ? activeFamilyMember['full_name'].toString().trim()
            : (activeFamilyMember['member_id']?.toString().trim().isNotEmpty ==
                    true)
                ? activeFamilyMember['member_id'].toString().trim()
                : (activeMemberId ?? 'Member'))
        : (user?.fullName ?? 'Member');
    final displayMemberId = activeFamilyMember != null
        ? (activeFamilyMember['member_id']?.toString() ?? activeMemberId)
        : user?.memberId;
    final displayImageUrl = activeFamilyMember != null ? null : user?.profileImageUrl;
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: RefreshIndicator(
        onRefresh: () async {
          await context.read<AuthProvider>().refreshProfile();
          await _loadFamilyMembers();
        },
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
              automaticallyImplyLeading: false,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryColor,
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 16),
                        // Keep profile avatar in header only; body remains field-free.
                        GestureDetector(
                          onTap: () => context.push('/edit-profile'),
                          child: Stack(
                            alignment: Alignment.bottomRight,
                            children: [
                                (displayImageUrl != null && displayImageUrl.isNotEmpty)
                                  ? CircleAvatar(
                                      radius: 44,
                                      backgroundColor: Colors.white24,
                                    backgroundImage: NetworkImage(displayImageUrl),
                                    )
                                  : CircleAvatar(
                                      radius: 44,
                                      backgroundColor: Colors.white24,
                                      child: Text(
                                    displayName.isNotEmpty
                                      ? displayName[0].toUpperCase()
                                            : '?',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 36,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                    color: AppTheme.secondaryColor,
                                    shape: BoxShape.circle),
                                child: const Icon(Icons.edit,
                                    size: 14, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          displayName,
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18),
                        ),
                        if (displayMemberId != null)
                          Text(
                            'ID: $displayMemberId',
                            style: const TextStyle(
                                color: Colors.white60, fontSize: 12),
                          )
                        else
                          const Text(
                            'Quick Actions & Settings',
                            style:
                                TextStyle(color: Colors.white60, fontSize: 12),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  // Account
                  _SectionCard(
                    title: 'Account',
                    children: [
                      _MenuItem(
                        icon: Icons.shield_outlined,
                        label: 'KYC & Documents',
                        subtitle: 'DigiLocker & Cashfree verification',
                        onTap: () => context.push('/kyc'),
                      ),
                      _MenuItem(
                        icon: Icons.bar_chart_rounded,
                        label: 'Analytics',
                        subtitle: 'Payment & chit insights',
                        onTap: () => context.push('/analytics'),
                      ),
                      _MenuItem(
                        icon: Icons.calculate_outlined,
                        label: 'Calculator',
                        subtitle: 'Dividend calculator',
                        onTap: () => context.push('/tools/calculator'),
                      ),
                      _MenuItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Statement',
                        subtitle: 'Account payment statement',
                        onTap: () => context.push('/tools/statement'),
                      ),
                      _MenuItem(
                        icon: Icons.handshake_outlined,
                        label: 'Become an Agent',
                        subtitle: 'Apply to earn referral commission',
                        onTap: () => _showBecomeAgentSheet(context),
                      ),
                      _MenuItem(
                        icon: Icons.card_giftcard,
                        label: 'Refer & Earn',
                        subtitle: 'Invite and earn rewards',
                        onTap: () => context.push('/referrals'),
                      ),
                      _MenuItem(
                        icon: Icons.family_restroom,
                        label: 'Family Members',
                        subtitle: 'Manage family accounts',
                        onTap: () => context.push('/family-members'),
                      ),
                      // Item 28: Apply for Loan removed from More
                    ],
                  ),
                  if (_showCompletedChits || _showCancelledChits) ...[
                    const SizedBox(height: 16),
                    _SectionCard(
                      title: 'Chit History',
                      children: [
                        if (_showCompletedChits)
                          _MenuItem(
                            icon: Icons.check_circle_outline,
                            label: 'Completed Chits',
                            subtitle: 'View your completed chit groups',
                            onTap: () => context.push('/chit-history/completed'),
                          ),
                        if (_showCancelledChits)
                          _MenuItem(
                            icon: Icons.cancel_outlined,
                            label: 'Cancelled Chits',
                            subtitle: 'View cancelled chit groups',
                            onTap: () => context.push('/chit-history/cancelled'),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Chit Actions
                  _SectionCard(
                    title: 'Chit Actions',
                    children: [
                      _MenuItem(
                        icon: Icons.swap_horiz,
                        label: 'Transfer Chit',
                        subtitle: 'Transfer your chit to another member',
                        onTap: () => context.push('/transfer-chit'),
                      ),
                      _MenuItem(
                        icon: Icons.cancel_presentation_outlined,
                        label: 'Cancel Chit',
                        subtitle: 'Request cancellation of a chit',
                        onTap: () => context.push('/cancel-chit'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Item 37: Goal Setting removed from Preferences
                  _SectionCard(
                    title: 'Preferences',
                    children: [
                      _ToggleMenuItem(
                        icon: Icons.smart_toy_outlined,
                        label: 'Show Chatbot',
                        subtitle: 'Display chatbot assistant on home',
                        prefKey: 'chatbot_visible',
                        defaultValue: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Support
                  _SectionCard(
                    title: 'Support',
                    children: [
                      _MenuItem(
                        icon: Icons.help_outline,
                        label: 'Help Center',
                        subtitle: 'FAQs and tutorials',
                        onTap: () => context.push('/help'),
                      ),
                      _MenuItem(
                        icon: Icons.chat_bubble_outline,
                        label: 'Contact Support',
                        subtitle: 'Chat with us',
                        onTap: () => context.push('/support'),
                      ),
                      _MenuItem(
                        icon: Icons.description_outlined,
                        label: 'Terms & Conditions',
                        onTap: () => context.push('/terms'),
                      ),
                      _MenuItem(
                        icon: Icons.privacy_tip_outlined,
                        label: 'Privacy Policy',
                        onTap: () => context.push('/privacy-policy'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Active Sessions
                  _buildActiveSessionsCard(auth),
                  const SizedBox(height: 16),

                  _SectionCard(
                    title: 'Account Actions',
                    children: [
                      _MenuItem(
                        icon: Icons.logout,
                        label: 'Logout',
                        isDestructive: true,
                        onTap: () => _showLogoutSheet(context, auth),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  Text('Assure Chit Funds v1.0.0',
                      style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                  const SizedBox(height: 8),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }


  void _showLogoutSheet(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 20),
            const Icon(Icons.logout, color: AppTheme.errorColor, size: 36),
            const SizedBox(height: 12),
            const Text('Logout',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            const Text('Choose how you want to logout',
                style: TextStyle(color: Colors.black54, fontSize: 13)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await auth.logout();
                  if (context.mounted) context.go('/welcome');
                },
                icon: const Icon(Icons.phone_android),
                label: const Text('Logout of this Device'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.errorColor,
                  side: BorderSide(color: AppTheme.errorColor),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await auth.logoutAllDevices();
                  if (context.mounted) context.go('/welcome');
                },
                icon: const Icon(Icons.devices),
                label: const Text('Logout of All Devices'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.errorColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
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
            const Text('Become an Assure Agent',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Earn commission by referring new members. Our team will contact you within 24 hours.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 14),
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
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(res['message'] ?? 'Agent request submitted!'),
                        backgroundColor: AppTheme.successColor,
                      ),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(e.toString().replaceAll('Exception: ', '')),
                        backgroundColor: AppTheme.errorColor,
                      ),
                    );
                  }
                },
                child: const Text('Submit Request'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveSessionsCard(AuthProvider auth) {
    final devices = _activeSessions.isNotEmpty
        ? _activeSessions
        : [
            {
              'device_name': auth.sessionDevice ?? 'This device',
              'platform': 'mobile',
              'last_active_at': auth.sessionLoginAt?.toIso8601String(),
              'is_current': true,
            },
          ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(10),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text('Active Sessions',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Colors.grey[600])),
          ),
          ...devices.map((d) {
            final name = d['device_name']?.toString() ?? 'Device';
            final platform = d['platform']?.toString() ?? '';
            final isCurrent = d['is_current'] == true;
            final lastAt = DateTime.tryParse(d['last_active_at']?.toString() ?? '');
            String timeStr = 'Recently';
            if (lastAt != null) {
              timeStr = '${lastAt.day}/${lastAt.month}/${lastAt.year}';
            }
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withAlpha(15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      platform.toLowerCase().contains('web')
                          ? Icons.laptop_mac
                          : Icons.phone_android,
                      color: AppTheme.primaryColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        Text('Last active: $timeStr',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                  if (isCurrent)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.successColor.withAlpha(20),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: AppTheme.successColor.withAlpha(60)),
                      ),
                      child: Text('Active',
                          style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.successColor,
                              fontWeight: FontWeight.w600)),
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

class _SectionCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SectionCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withAlpha(13),
                blurRadius: 8,
                offset: const Offset(0, 2))
          ]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Colors.black54)),
        ),
        ...children,
        const SizedBox(height: 8),
      ]),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  const _MenuItem({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDestructive ? AppTheme.errorColor : Colors.black87;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(children: [
          Icon(icon,
              size: 22,
              color:
                  isDestructive ? AppTheme.errorColor : AppTheme.primaryColor),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label,
                  style: TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 14, color: color)),
              if (subtitle != null)
                Text(subtitle!,
                    style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            ]),
          ),
          Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey[400]),
        ]),
      ),
    );
  }
}

class _ToggleMenuItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final String prefKey;
  final bool defaultValue;

  const _ToggleMenuItem({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.prefKey,
    this.defaultValue = true,
  });

  @override
  State<_ToggleMenuItem> createState() => _ToggleMenuItemState();
}

class _ToggleMenuItemState extends State<_ToggleMenuItem> {
  bool _value = true;

  @override
  void initState() {
    super.initState();
    _loadPref();
  }

  Future<void> _loadPref() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _value = prefs.getBool(widget.prefKey) ?? widget.defaultValue;
    });
  }

  Future<void> _toggle(bool val) async {
    setState(() => _value = val);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(widget.prefKey, val);
    // Notify reactive listeners immediately (e.g. chatbot FAB on dashboard)
    if (widget.prefKey == 'chatbot_visible') {
      AppPrefs.chatbotVisible.value = val;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        Icon(widget.icon, size: 22, color: AppTheme.primaryColor),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.label,
                style:
                    const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
            if (widget.subtitle != null)
              Text(widget.subtitle!,
                  style: TextStyle(fontSize: 11, color: Colors.grey[500])),
          ]),
        ),
        Switch(
          value: _value,
          onChanged: _toggle,
          activeColor: AppTheme.primaryColor,
        ),
      ]),
    );
  }
}
