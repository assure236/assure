import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/welcome_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../../features/auth/screens/mpin_screen.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/chit_groups/screens/chit_groups_screen.dart';
import '../../features/chit_groups/screens/chit_group_details_screen.dart';
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
import '../../features/auth/screens/qr_scan_screen.dart';

class AppRouter {
  static GoRouter router(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: '/splash',
      redirect: (context, state) {
        final isAuthenticated = authProvider.isAuthenticated;
        final hasLocalAccount = authProvider.hasLocalAccount;
        final loc = state.matchedLocation;

        const publicRoutes = ['/splash', '/welcome', '/login', '/register', '/mpin'];
        final isPublic = publicRoutes.contains(loc);

        // Only guard private routes — auth screens are always reachable
        if (!isPublic && !isAuthenticated) {
          return hasLocalAccount ? '/mpin' : '/welcome';
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
          path: '/mpin',
          builder: (context, state) => const MpinScreen(),
        ),
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardScreen(),
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
          builder: (context, state) => const KycScreen(),
        ),
        GoRoute(
          path: '/documents',
          builder: (context, state) => const DocumentsScreen(),
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
      ],
    );
  }
}
