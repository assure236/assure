import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_prefs.dart';
import '../../../core/widgets/onboarding_tour.dart';

class ProfileScreen extends StatefulWidget {
  final void Function(int)? switchTab;
  const ProfileScreen({super.key, this.switchTab});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: RefreshIndicator(
        onRefresh: () => context.read<AuthProvider>().refreshProfile(),
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
                        // Avatar
                        GestureDetector(
                          onTap: () => context.push('/edit-profile'),
                          child: Stack(
                          alignment: Alignment.bottomRight,
                          children: [
                            (user?.profileImageUrl != null && user!.profileImageUrl!.isNotEmpty)
                                    ? CircleAvatar(
                                        radius: 44,
                                        backgroundColor: Colors.white24,
                                        backgroundImage: NetworkImage(user.profileImageUrl!),
                                      )
                                    : CircleAvatar(
                                        radius: 44,
                                        backgroundColor: Colors.white24,
                                        child: Text(
                                          user != null && user.fullName.isNotEmpty
                                              ? user.fullName[0].toUpperCase()
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
                          user?.fullName ?? 'Member',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18),
                        ),
                        if (user?.memberId != null)
                          Text(
                            'ID: ${user!.memberId}',
                            style: const TextStyle(
                                color: Colors.white60, fontSize: 12),
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
                  if (user?.bankAccountNumber != null && user!.bankAccountNumber!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _SectionCard(
                      title: 'Bank Details',
                      children: [
                        if (user.bankName != null)
                          _ProfileRow(
                              icon: Icons.account_balance_outlined,
                              label: 'Bank',
                              value: user.bankName!),
                        _ProfileRow(
                            icon: Icons.numbers_outlined,
                            label: 'Account',
                            value: 'XXXX${user.bankAccountNumber!.substring(user.bankAccountNumber!.length > 4 ? user.bankAccountNumber!.length - 4 : 0)}'),
                        if (user.bankIfscCode != null)
                          _ProfileRow(
                              icon: Icons.code_outlined,
                              label: 'IFSC',
                              value: user.bankIfscCode!),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Account
                  _SectionCard(
                    title: 'Account',
                    children: [
                      _MenuItem(
                        icon: Icons.shield_outlined,
                        label: 'KYC & Documents',
                        subtitle: _kycLabel(user?.kycStatus),
                        onTap: () => context.push('/kyc'),
                      ),
                      _MenuItem(
                        icon: Icons.folder_copy_outlined,
                        label: 'Document Vault',
                        subtitle: 'View uploaded documents',
                        onTap: () => context.push('/documents'),
                      ),
                      _MenuItem(
                        icon: Icons.notifications_outlined,
                        label: 'Notifications',
                        subtitle: 'Alerts & updates',
                        onTap: () => context.push('/notifications'),
                      ),
                      _MenuItem(
                        icon: Icons.bar_chart_rounded,
                        label: 'Analytics',
                        subtitle: 'Payment & chit insights',
                        onTap: () => context.push('/analytics'),
                      ),
                      _MenuItem(
                        icon: Icons.card_giftcard,
                        label: 'Refer & Earn',
                        subtitle: user?.referralCode != null
                            ? 'Code: ${user!.referralCode}'
                            : 'Earn rewards',
                        onTap: () => context.push('/referrals'),
                      ),
                      _MenuItem(
                        icon: Icons.family_restroom,
                        label: 'Family Members',
                        subtitle: 'Manage family accounts',
                        onTap: () => context.push('/family-members'),
                      ),
                      _MenuItem(
                        icon: Icons.account_balance_wallet,
                        label: 'Apply for Loan',
                        subtitle: 'Loan against chit holdings',
                        onTap: () => context.push('/apply-loan'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Chit History
                  _SectionCard(
                    title: 'Chit History',
                    children: [
                      _MenuItem(
                        icon: Icons.check_circle_outline,
                        label: 'Completed Chits',
                        subtitle: 'View your completed chit groups',
                        onTap: () => context.push('/chit-history/completed'),
                      ),
                      _MenuItem(
                        icon: Icons.cancel_outlined,
                        label: 'Cancelled Chits',
                        subtitle: 'View cancelled chit groups',
                        onTap: () => context.push('/chit-history/cancelled'),
                      ),
                    ],
                  ),
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

                  // Nominee Details (before Preferences)
                  if (user?.nomineeName != null && user!.nomineeName!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _SectionCard(
                      title: 'Nominee Details',
                      children: [
                        _ProfileRow(
                            icon: Icons.person_add_outlined,
                            label: 'Nominee',
                            value: user.nomineeName!),
                        if (user.nomineeRelationship != null)
                          _ProfileRow(
                              icon: Icons.people_outline,
                              label: 'Relationship',
                              value: user.nomineeRelationship!),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Preferences
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
                      _MenuItem(
                        icon: Icons.flag_outlined,
                        label: 'Goal Setting',
                        subtitle: 'Set investment targets & goals',
                        onTap: () => context.push('/goals'),
                      ),
                      _MenuItem(
                        icon: Icons.tour_outlined,
                        label: 'Take a Tour',
                        subtitle: 'Replay the app walkthrough',
                        onTap: () async {
                          await OnboardingTour.reset();
                          if (context.mounted) {
                            widget.switchTab?.call(0);
                          }
                        },
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

                  // Current Session
                  _buildCurrentSessionCard(auth),
                  const SizedBox(height: 16),

                  // Account Actions
                  _SectionCard(
                    title: 'Account Actions',
                    children: [
                      _MenuItem(
                        icon: Icons.devices,
                        label: 'Logout All Devices',
                        subtitle: 'Sign out from all logged in devices',
                        isDestructive: true,
                        onTap: () => _confirmLogoutAll(context, auth),
                      ),
                      _MenuItem(
                        icon: Icons.logout,
                        label: 'Logout',
                        isDestructive: true,
                        onTap: () => _confirmLogout(context, auth),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  Text('Assure Chit Funds v1.0.0',
                      style:
                          TextStyle(color: Colors.grey[400], fontSize: 12)),
                  const SizedBox(height: 8),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    _doLogout(context, auth, logoutAll: false);
  }

  Widget _buildCurrentSessionCard(AuthProvider auth) {
    final device = auth.sessionDevice ?? 'This device';
    final loginAt = auth.sessionLoginAt;
    String timeStr = 'Unknown';
    if (loginAt != null) {
      final local = loginAt.toLocal();
      final h = local.hour > 12 ? local.hour - 12 : local.hour;
      final amPm = local.hour >= 12 ? 'PM' : 'AM';
      final hStr = (h == 0 ? 12 : h).toString();
      final minStr = local.minute.toString().padLeft(2, '0');
      timeStr = '${local.day}/${local.month}/${local.year}  $hStr:$minStr $amPm';
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(10), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text('Current Session',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey[600])),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.phone_android, color: AppTheme.primaryColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(device,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text('Signed in: $timeStr',
                          style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Text('Active', style: TextStyle(fontSize: 11, color: Colors.green.shade700, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _confirmLogoutAll(BuildContext context, AuthProvider auth) {
    _doLogout(context, auth, logoutAll: true);
  }

  Future<void> _doLogout(
    BuildContext context,
    AuthProvider auth, {
    required bool logoutAll,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(logoutAll ? 'Logout All Devices' : 'Logout'),
        content: Text(
          logoutAll
              ? 'This will sign you out from ALL devices (mobile, web & other phones).'
              : 'You will be signed out of this device.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
              foregroundColor: Colors.white,
            ),
            child: Text(logoutAll ? 'Logout All' : 'Logout'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    if (logoutAll) {
      // Backend bumps token_version (invalidating ALL tokens incl. web) and emits
      // force_logout to every connected socket for this user.
      try {
        await ApiService.post('/auth/logout-all-devices', {});
      } catch (_) {
        // Even if server fails, log out locally so user isn't stuck.
      }
    }
    await auth.logout();
    if (context.mounted) context.go('/welcome');
  }

  String _kycLabel(String? status) {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Under Review';
      case 'rejected': return 'Rejected';
      case 'not_verified': return 'Not Verified';
      default: return 'Not Verified';
    }
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

class _ProfileRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _ProfileRow(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(children: [
        Icon(icon, size: 20, color: AppTheme.primaryColor),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            Text(value,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14)),
          ]),
        ),
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
          Icon(icon, size: 22, color: isDestructive ? AppTheme.errorColor : AppTheme.primaryColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label,
                  style: TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 14,
                      color: color)),
              if (subtitle != null)
                Text(subtitle!,
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey[500])),
            ]),
          ),
          Icon(Icons.arrow_forward_ios,
              size: 14, color: Colors.grey[400]),
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.label,
                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
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

