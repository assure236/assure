import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';

/// A lightweight "Take a Tour" onboarding overlay that shows on first launch.
/// Displays a series of informational cards highlighting key app features.
class OnboardingTour extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingTour({super.key, required this.onComplete});

  @override
  State<OnboardingTour> createState() => _OnboardingTourState();

  static Future<bool> shouldShow() async {
    final prefs = await SharedPreferences.getInstance();
    return !(prefs.getBool('onboarding_tour_complete') ?? false);
  }

  static Future<void> markComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_tour_complete', true);
  }

  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('onboarding_tour_complete');
  }
}

class _OnboardingTourState extends State<OnboardingTour> {
  int _currentStep = 0;
  final _controller = PageController();

  static const _steps = [
    _TourStep(
      icon: Icons.home_rounded,
      title: 'Your Dashboard',
      description:
          'View your active chits, upcoming auctions, and wallet balance at a glance. Pull down to refresh anytime.',
      color: AppTheme.primaryColor,
    ),
    _TourStep(
      icon: Icons.add_circle_rounded,
      title: 'Browse & Join Chits',
      description:
          'Explore available chit groups, check details like PSO number, and enroll with one tap.',
      color: AppTheme.accentBlue,
    ),
    _TourStep(
      icon: Icons.gavel_rounded,
      title: 'Live Auctions',
      description:
          'Participate in real-time auctions with live bidding. Get notified before each auction starts.',
      color: Color(0xFF7C3AED),
    ),
    _TourStep(
      icon: Icons.account_balance_wallet_rounded,
      title: 'Payments & Wallet',
      description:
          'Pay installments securely, track payment history, and manage your wallet balance.',
      color: AppTheme.successColor,
    ),
    _TourStep(
      icon: Icons.verified_user_rounded,
      title: 'KYC & DigiLocker',
      description:
          'Complete KYC verification using Aadhaar and PAN. Link DigiLocker for seamless document access.',
      color: AppTheme.secondaryColor,
    ),
    _TourStep(
      icon: Icons.smart_toy_rounded,
      title: 'AI Chatbot',
      description:
          'Got questions? Tap the floating chat button anytime for instant AI-powered assistance.',
      color: Color(0xFFEC4899),
    ),
  ];

  void _next() {
    if (_currentStep < _steps.length - 1) {
      _controller.nextPage(
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    } else {
      _finish();
    }
  }

  void _finish() {
    OnboardingTour.markComplete();
    widget.onComplete();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withAlpha(200),
      child: SafeArea(
        child: Column(
          children: [
            // Skip button
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: _finish,
                child: const Text('Skip',
                    style: TextStyle(color: Colors.white70, fontSize: 16)),
              ),
            ),
            // Pages
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (i) => setState(() => _currentStep = i),
                itemCount: _steps.length,
                itemBuilder: (context, index) {
                  final step = _steps[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            color: step.color.withAlpha(40),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(step.icon, size: 48, color: step.color),
                        ),
                        const SizedBox(height: 32),
                        Text(step.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        Text(step.description,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 15,
                              height: 1.5,
                            ),
                            textAlign: TextAlign.center),
                      ],
                    ),
                  );
                },
              ),
            ),
            // Dots + Next button
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_steps.length, (i) {
                      final active = i == _currentStep;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: active ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: active
                              ? AppTheme.secondaryColor
                              : Colors.white30,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _next,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondaryColor,
                        foregroundColor: AppTheme.primaryColor,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        _currentStep == _steps.length - 1
                            ? 'Get Started'
                            : 'Next',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
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

class _TourStep {
  final IconData icon;
  final String title;
  final String description;
  final Color color;

  const _TourStep({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
  });
}
