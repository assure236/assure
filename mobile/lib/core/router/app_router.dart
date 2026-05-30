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
import '../../features/onboarding/screens/digilocker_step_screen.dart';
import '../../features/onboarding/screens/face_step_screen.dart';
import '../../features/onboarding/screens/bank_step_screen.dart';
import '../../features/onboarding/screens/cheque_step_screen.dart';
import '../../features/onboarding/screens/address_step_screen.dart';
import '../../features/onboarding/screens/done_step_screen.dart';
import '../../features/onboarding/services/onboarding_api.dart';

/// Cached so the redirect callback (which must be synchronous) can check
/// without re-firing the network call on every navigation tick.
class OnboardingCache {
  static String? nextStep;
  static bool? completed;
  static DateTime? fetchedAt;
  static bool fetching = false;

  static bool get isFresh =>
      fetchedAt != null && DateTime.now().difference(fetchedAt!) < const Duration(seconds: 30);

  static Future<void> refresh() async {
    if (fetching) return;
    fetching = true;
    try {
      final res = await OnboardingApi.getStatus();
      final data = res['data'] as Map<String, dynamic>?;
      if (data != null) {
        completed = data['completed'] == true;
        nextStep = data['next_step']?.toString();
        fetchedAt = DateTime.now();
      }
    } catch (_) {
      // Network fail: leave cache; allow the user to proceed.
    } finally {
      fetching = false;
    }
  }

  static void clear() {
    nextStep = null; completed = null; fetchedAt = null;
  }
}

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
          // Authenticated users on auth screens should leave them — but if
          // onboarding is incomplete (or status unknown), route to the wizard
          // instead of briefly flashing the dashboard.
          if (isAuthenticated && loc != '/splash') {
            if (!OnboardingCache.isFresh && !OnboardingCache.fetching) {
              OnboardingCache.refresh();
            }
            if (OnboardingCache.completed != true) {
              return onboardingNextRoute(OnboardingCache.nextStep);
            }
            return '/dashboard';
          }
          return null;
        }

        // Guard private routes — redirect unauthenticated users
        if (!isAuthenticated) {
          return hasLocalAccount ? '/lock' : '/welcome';
        }

        // Onboarding gate
        const onboardingPrefix = '/onboarding';
        final isOnboarding = loc.startsWith(onboardingPrefix);
        // Allow the dashboard "just completed" celebration through without re-check
        final isPostOnboardingDashboard = loc == '/dashboard' &&
            state.uri.queryParameters['onboarding'] == 'just_completed';

        if (!OnboardingCache.isFresh && !OnboardingCache.fetching) {
          OnboardingCache.refresh(); // fire-and-forget; next nav will use it
        }

        if (OnboardingCache.completed == false && !isOnboarding && !isPostOnboardingDashboard) {
          return onboardingNextRoute(OnboardingCache.nextStep);
        }
        if (OnboardingCache.completed == true && isOnboarding && loc != '/onboarding/done') {
          return '/dashboard';
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
        GoRoute(
          path: '/onboarding',
          redirect: (context, state) => '/onboarding/digilocker',
        ),
        GoRoute(
          path: '/onboarding/digilocker',
          builder: (context, state) => DigilockerStepScreen(
            digilockerStatus: state.uri.queryParameters['digilocker'],
          ),
        ),
        GoRoute(
          path: '/onboarding/face',
          builder: (context, state) => const FaceStepScreen(),
        ),
        GoRoute(
          path: '/onboarding/bank',
          builder: (context, state) => const BankStepScreen(),
        ),
        GoRoute(
          path: '/onboarding/cheque',
          builder: (context, state) => const ChequeStepScreen(),
        ),
        GoRoute(
          path: '/onboarding/address',
          builder: (context, state) => const AddressStepScreen(),
        ),
        GoRoute(
          path: '/onboarding/done',
          builder: (context, state) => const DoneStepScreen(),
        ),
      ],
    );
  }
}
