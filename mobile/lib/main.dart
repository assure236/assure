import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';

import 'core/providers/auth_provider.dart';
import 'core/providers/active_member_provider.dart';
import 'core/providers/chit_group_provider.dart';
import 'core/providers/auction_provider.dart';
import 'core/providers/payment_provider.dart';
import 'core/providers/notification_provider.dart';
import 'core/providers/dashboard_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/services/local_notification_service.dart';
import 'core/services/fcm_service.dart';
import 'core/utils/app_prefs.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Set up background message handler
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  // Initialize FCM service
  await FcmService().init();

  // Initialize local notifications (for polling fallback)
  await LocalNotificationService().init();

  // Load reactive preferences (chatbot visibility, etc.)
  await AppPrefs.init();

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const AssureChitFundsApp());
}

class AssureChitFundsApp extends StatefulWidget {
  const AssureChitFundsApp({super.key});

  @override
  State<AssureChitFundsApp> createState() => _AssureChitFundsAppState();
}

class _AssureChitFundsAppState extends State<AssureChitFundsApp> {
  late final AuthProvider _authProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
    _router = AppRouter.router(_authProvider);
    _authProvider.onSessionLocked = () {
      final path = _router.routerDelegate.currentConfiguration.uri.path;
      const skip = ['/lock', '/splash', '/login', '/register', '/welcome'];
      if (!skip.contains(path)) {
        _router.go('/lock');
      }
    };
  }

  @override
  void dispose() {
    _authProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _authProvider),
        ChangeNotifierProvider(create: (_) => ActiveMemberProvider()),
        ChangeNotifierProvider(create: (_) => ChitGroupProvider()),
        ChangeNotifierProvider(create: (_) => AuctionProvider()),
        ChangeNotifierProvider(create: (_) => PaymentProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
      ],
      child: MaterialApp.router(
        title: 'Assure Chit Funds',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.light,
        builder: (context, child) {
          return Listener(
            onPointerDown: (_) => _authProvider.markUserInteraction(),
            child: child ?? const SizedBox.shrink(),
          );
        },
        routerConfig: _router, // Use the same router instance
      ),
    );
  }
}
