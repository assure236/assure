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

class _OnboardingTourState extends State<OnboardingTour> with TickerProviderStateMixin {
  int _currentStep = 0;
  final _controller = PageController();
  late AnimationController _iconAnimCtrl;
  late Animation<double> _iconBounce;
  late AnimationController _pulseCtrl;
  late Animation<double> _pulse;
  late AnimationController _slideCtrl;
  late Animation<Offset> _slideAnim;
  late AnimationController _textFadeCtrl;
  late Animation<double> _textFade;

  static const _steps = [
    _TourStep(
      icon: Icons.waving_hand_rounded,
      title: 'Welcome to Assure ChitFunds!',
      description:
          'India\'s most trusted digital chit fund platform. Save smartly, grow together, and achieve your financial goals with complete transparency.',
      color: Color(0xFF3B82F6),
      gradient: [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
      emoji: '👋',
    ),
    _TourStep(
      icon: Icons.home_rounded,
      title: 'Your Dashboard',
      description:
          'See everything at a glance — active chits, upcoming auctions, wallet balance, payment history, and credit score. Pull down to refresh anytime.',
      color: Color(0xFF1E40AF),
      gradient: [Color(0xFFE0E7FF), Color(0xFFC7D2FE)],
      emoji: '🏠',
    ),
    _TourStep(
      icon: Icons.add_circle_rounded,
      title: 'Browse & Join Chits',
      description:
          'Explore available chit groups with details like PSO number, chit value, duration, and monthly EMI. Enroll with one tap and start your savings journey!',
      color: Color(0xFF2563EB),
      gradient: [Color(0xFFDFEBFF), Color(0xFFBFDBFE)],
      emoji: '📋',
    ),
    _TourStep(
      icon: Icons.gavel_rounded,
      title: 'Live Auctions',
      description:
          'Participate in real-time auctions with live bidding. Get push notifications before each auction. Place your bid and win the pot — use it for your dreams!',
      color: Color(0xFF7C3AED),
      gradient: [Color(0xFFF3F0FF), Color(0xFFE9DDFF)],
      emoji: '🔨',
    ),
    _TourStep(
      icon: Icons.account_balance_wallet_rounded,
      title: 'Easy Payments',
      description:
          'Pay monthly installments securely via UPI, cards, or net banking powered by Cashfree. Auto-reminders ensure you never miss a due date!',
      color: Color(0xFF059669),
      gradient: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
      emoji: '💳',
    ),
    _TourStep(
      icon: Icons.receipt_long_rounded,
      title: 'Statements & Receipts',
      description:
          'Download payment receipts as PDF, view account statements, share receipts with anyone. Complete financial transparency at your fingertips.',
      color: Color(0xFF0891B2),
      gradient: [Color(0xFFECFEFF), Color(0xFFCFFAFE)],
      emoji: '📄',
    ),
    _TourStep(
      icon: Icons.analytics_rounded,
      title: 'Analytics & Insights',
      description:
          'Track your total investments, monthly trends, group-wise breakdown, and savings progress with beautiful charts. Know exactly where your money goes.',
      color: Color(0xFFDB2777),
      gradient: [Color(0xFFFDF2F8), Color(0xFFFCE7F3)],
      emoji: '📊',
    ),
    _TourStep(
      icon: Icons.verified_user_rounded,
      title: 'Quick KYC Verification',
      description:
          'Complete your KYC in minutes with Aadhaar & PAN via DigiLocker — no paper documents needed. Quick, secure, and 100% digital!',
      color: Color(0xFFB45309),
      gradient: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
      emoji: '✅',
    ),
    _TourStep(
      icon: Icons.notifications_active_rounded,
      title: 'Smart Notifications',
      description:
          'Get timely push notifications for payment due dates, auction schedules, results, group updates, and important announcements. Stay informed always!',
      color: Color(0xFFD97706),
      gradient: [Color(0xFFFFFBEB), Color(0xFFFEF9C3)],
      emoji: '🔔',
    ),
    _TourStep(
      icon: Icons.smart_toy_rounded,
      title: 'AI Assistant — ChitBot',
      description:
          'Got questions? Our AI chatbot ChitBot is available 24/7! Ask about payments, auctions, KYC, or anything else. Just tap the chat bubble on the dashboard.',
      color: Color(0xFFEC4899),
      gradient: [Color(0xFFFDF2F8), Color(0xFFFBCFE8)],
      emoji: '🤖',
    ),
    _TourStep(
      icon: Icons.shield_rounded,
      title: 'Secure & Transparent',
      description:
          'Bank-grade security with encrypted data, government-registered chit operations, real-time audit trails, and complete fund transparency. Your money is safe!',
      color: Color(0xFF059669),
      gradient: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
      emoji: '🔒',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _iconAnimCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
    _iconBounce = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _iconAnimCtrl, curve: Curves.easeOutCubic),
    );
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 2500))
      ..repeat(reverse: true);
    _pulse = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _slideCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
      CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic),
    );
    _textFadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _textFade = CurvedAnimation(parent: _textFadeCtrl, curve: Curves.easeIn);
    _iconAnimCtrl.forward();
    _slideCtrl.forward();
    _textFadeCtrl.forward();
  }

  void _next() {
    if (_currentStep < _steps.length - 1) {
      _controller.nextPage(
          duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
      _iconAnimCtrl.reset();
      _iconAnimCtrl.forward();
      _slideCtrl.reset();
      _slideCtrl.forward();
      _textFadeCtrl.reset();
      _textFadeCtrl.forward();
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
    _iconAnimCtrl.dispose();
    _pulseCtrl.dispose();
    _slideCtrl.dispose();
    _textFadeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: _currentStep < _steps.length
                ? _steps[_currentStep].gradient
                : [AppTheme.primaryColor, AppTheme.primaryDark],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Skip button
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 8, top: 4),
                  child: TextButton(
                    onPressed: _finish,
                    child: Text('Skip',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 16)),
                  ),
                ),
              ),
              // Pages
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  onPageChanged: (i) {
                    setState(() => _currentStep = i);
                    _iconAnimCtrl.reset();
                    _iconAnimCtrl.forward();
                    _slideCtrl.reset();
                    _slideCtrl.forward();
                    _textFadeCtrl.reset();
                    _textFadeCtrl.forward();
                  },
                  itemCount: _steps.length,
                  itemBuilder: (context, index) {
                    final step = _steps[index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Animated icon with pulse ring
                          ScaleTransition(
                            scale: _iconBounce,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                // Outer pulse ring
                                ScaleTransition(
                                  scale: _pulse,
                                  child: Container(
                                    width: 140,
                                    height: 140,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: step.color.withAlpha(25),
                                        width: 2,
                                      ),
                                    ),
                                  ),
                                ),
                                // Icon circle
                                Container(
                                  width: 110,
                                  height: 110,
                                  decoration: BoxDecoration(
                                    color: step.color.withAlpha(20),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: step.color.withAlpha(40),
                                      width: 2,
                                    ),
                                  ),
                                  child: Icon(step.icon, size: 52, color: step.color),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(step.emoji, style: const TextStyle(fontSize: 32)),
                          const SizedBox(height: 20),
                          SlideTransition(
                            position: _slideAnim,
                            child: FadeTransition(
                              opacity: _textFade,
                              child: Column(
                                children: [
                                  Text(step.title,
                                      style: TextStyle(
                                        color: Colors.grey.shade800,
                                        fontSize: 26,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                      textAlign: TextAlign.center),
                                  const SizedBox(height: 16),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                                    decoration: BoxDecoration(
                                      color: step.color.withAlpha(12),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Text(step.description,
                                        style: TextStyle(
                                          color: Colors.grey.shade600,
                                          fontSize: 15,
                                          height: 1.6,
                                        ),
                                        textAlign: TextAlign.center),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              // Progress bar + Dots + Next button
              Padding(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
                child: Column(
                  children: [
                    // Step counter
                    Text(
                      '${_currentStep + 1} of ${_steps.length}',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    // Progress bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (_currentStep + 1) / _steps.length,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _currentStep < _steps.length ? _steps[_currentStep].color : AppTheme.primaryColor,
                        ),
                        minHeight: 4,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_steps.length, (i) {
                        final active = i == _currentStep;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 400),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: active ? 24 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: active
                                ? (_currentStep < _steps.length ? _steps[_currentStep].color : AppTheme.primaryColor)
                                : Colors.grey.shade300,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: _next,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _currentStep < _steps.length ? _steps[_currentStep].color : AppTheme.primaryColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _currentStep == _steps.length - 1
                                  ? "Let's Go!"
                                  : 'Next',
                              style: const TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w700),
                            ),
                            if (_currentStep < _steps.length - 1) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded, size: 20),
                            ],
                            if (_currentStep == _steps.length - 1) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.rocket_launch_rounded, size: 20),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
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
  final List<Color> gradient;
  final String emoji;

  const _TourStep({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
    required this.gradient,
    required this.emoji,
  });
}
