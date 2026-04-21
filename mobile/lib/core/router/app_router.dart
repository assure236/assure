import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/welcome_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../../features/auth/screens/lock_screen.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/chit_groups/screens/chit_groups_screen.dart';
import '../../features/chit_groups/screens/chit_group_details_screen.dart';
import '../../features/chit_groups/screens/chit_history_screen.dart';
import '../../features/chit_groups/screens/transfer_chit_screen.dart';
import '../../features/chit_groups/screens/cancel_chit_screen.dart';
import '../../features/auctions/screens/auctions_screen.dart';
import '../../features/auctions/screens/auction_room_screen.dart';
import '../../features/payments/screens/payments_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/kyc/screens/kyc_screen.dart';
import '../../features/documents/screens/documents_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/referrals/screens/referrals_screen.dart';
import '../../features/analytics/screens/analytics_screen.dart';
import '../../features/help/screens/help_screen.dart';
import '../../features/support/screens/support_screen.dart';
import '../../features/profile/screens/edit_profile_screen.dart';
import '../../features/profile/screens/change_password_screen.dart';
import '../../features/profile/screens/family_members_screen.dart';
import '../../features/auth/screens/qr_scan_screen.dart';
import '../../features/chatbot/screens/chatbot_screen.dart';
import '../../features/dashboard/screens/total_investment_screen.dart';
import '../../features/legal/screens/terms_screen.dart';
import '../../features/legal/screens/privacy_policy_screen.dart';
import '../../features/loans/screens/apply_loan_screen.dart';
import '../../features/goals/screens/goal_setting_screen.dart';

class AppRouter {
  static GoRouter router(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: '/splash',
      refreshListenable: authProvider, // Listen to auth changes without recreating router
      redirect: (context, state) {
        // Handle custom scheme deep links (e.g., assurechitfunds://kyc?digilocker=success)
        final uri = state.uri;
        if (uri.scheme == 'assurechitfunds') {
          final host = uri.host;
          final query = uri.query;
          return query.isNotEmpty ? '/$host?$query' : '/$host';
        }

        final isAuthenticated = authProvider.isAuthenticated;
        final hasLocalAccount = authProvider.hasLocalAccount;
        final loc = state.matchedLocation;

        const publicRoutes = ['/splash', '/welcome', '/login', '/register', '/lock'];
        final isPublic = publicRoutes.contains(loc);

        // Don't redirect while on auth screens — let user complete their flow
        if (isPublic) {
          // Only redirect authenticated users away from auth screens to dashboard
          if (isAuthenticated && loc != '/splash') {
            return '/dashboard';
          }
          return null;
        }

        // Guard private routes — redirect unauthenticated users
        if (!isAuthenticated) {
          return hasLocalAccount ? '/lock' : '/welcome';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/splash',
          builder: (context, state) => const SplashScreen(),
        ),
        GoRoute(
          path: '/welcome',
          builder: (context, state) => const WelcomeScreen(),
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterScreen(),
        ),
        GoRoute(
          path: '/lock',
          builder: (context, state) => const LockScreen(),
        ),
        GoRoute(
          path: '/dashboard',
          builder: (context, state) {
            final digilockerStatus = state.uri.queryParameters['digilocker'];
            return DashboardScreen(digilockerStatus: digilockerStatus);
          },
        ),
        GoRoute(
          path: '/chit-groups',
          builder: (context, state) => const ChitGroupsScreen(),
        ),
        GoRoute(
          path: '/chit-groups/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return ChitGroupDetailsScreen(groupId: id);
          },
        ),
        GoRoute(
          path: '/auctions',
          builder: (context, state) => const AuctionsScreen(),
        ),
        GoRoute(
          path: '/auctions/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return AuctionRoomScreen(auctionId: id);
          },
        ),
        GoRoute(
          path: '/payments',
          builder: (context, state) => const PaymentsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/kyc',
          builder: (context, state) {
            final digilockerStatus = state.uri.queryParameters['digilocker'];
            return KycScreen(digilockerStatus: digilockerStatus);
          },
        ),
        GoRoute(
          path: '/documents',
          builder: (context, state) {
            final digilockerStatus = state.uri.queryParameters['digilocker'];
            return DocumentsScreen(digilockerStatus: digilockerStatus);
          },
        ),
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/referrals',
          builder: (context, state) => const ReferralsScreen(),
        ),
        GoRoute(
          path: '/analytics',
          builder: (context, state) => const AnalyticsScreen(),
        ),
        GoRoute(
          path: '/help',
          builder: (context, state) => const HelpScreen(),
        ),
        GoRoute(
          path: '/support',
          builder: (context, state) => const SupportScreen(),
        ),
        GoRoute(
          path: '/edit-profile',
          builder: (context, state) => const EditProfileScreen(),
        ),
        GoRoute(
          path: '/change-password',
          builder: (context, state) => const ChangePasswordScreen(),
        ),
        GoRoute(
          path: '/qr-scan',
          builder: (context, state) => const QrScanScreen(),
        ),
        GoRoute(
          path: '/chatbot',
          builder: (context, state) => const ChatbotScreen(),
        ),
        GoRoute(
          path: '/family-members',
          builder: (context, state) => const FamilyMembersScreen(),
        ),
        GoRoute(
          path: '/terms',
          builder: (context, state) => const TermsScreen(),
        ),
        GoRoute(
          path: '/privacy-policy',
          builder: (context, state) => const PrivacyPolicyScreen(),
        ),
        GoRoute(
          path: '/apply-loan',
          builder: (context, state) => const ApplyLoanScreen(),
        ),
        GoRoute(
          path: '/chit-history/:status',
          builder: (context, state) {
            final status = state.pathParameters['status']!;
            return ChitHistoryScreen(status: status);
          },
        ),
        GoRoute(
          path: '/transfer-chit',
          builder: (context, state) => const TransferChitScreen(),
        ),
        GoRoute(
          path: '/cancel-chit',
          builder: (context, state) => const CancelChitScreen(),
        ),
        GoRoute(
          path: '/goals',
          builder: (context, state) => const GoalSettingScreen(),
        ),
        GoRoute(
          path: '/total-investment',
          builder: (context, state) => const TotalInvestmentScreen(),
        ),
      ],
    );
  }
}
