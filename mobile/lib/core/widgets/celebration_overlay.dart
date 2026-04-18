import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// Full-screen celebration overlay for auction wins and payment success.
/// Displays animated confetti effect with a centered message.
class CelebrationOverlay {
  static OverlayEntry? _entry;

  /// Show a celebration overlay for auction win.
  static void showAuctionWin(BuildContext context, {String? groupName, String? amount}) {
    _show(context,
      icon: Icons.emoji_events_rounded,
      iconColor: AppTheme.secondaryColor,
      title: 'Congratulations! 🎉',
      subtitle: groupName != null ? 'You won the auction for $groupName!' : 'You won the auction!',
      detail: amount != null ? 'Prize Amount: $amount' : null,
      bgGradient: const [AppTheme.primaryDark, AppTheme.accentBlue],
    );
  }

  /// Show a celebration overlay for payment success.
  static void showPaymentSuccess(BuildContext context, {String? amount, String? groupName}) {
    _show(context,
      icon: Icons.check_circle_rounded,
      iconColor: AppTheme.successColor,
      title: 'Payment Successful!',
      subtitle: groupName != null ? 'Payment for $groupName completed' : 'Your payment was processed successfully',
      detail: amount != null ? 'Amount: $amount' : null,
      bgGradient: const [Color(0xFF064E3B), AppTheme.successColor],
    );
  }

  static void _show(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    String? detail,
    required List<Color> bgGradient,
  }) {
    // Haptic feedback
    HapticFeedback.heavyImpact();

    _entry?.remove();
    _entry = OverlayEntry(
      builder: (_) => _CelebrationWidget(
        icon: icon,
        iconColor: iconColor,
        title: title,
        subtitle: subtitle,
        detail: detail,
        bgGradient: bgGradient,
        onDismiss: () {
          _entry?.remove();
          _entry = null;
        },
      ),
    );
    Overlay.of(context).insert(_entry!);
  }
}

class _CelebrationWidget extends StatefulWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String? detail;
  final List<Color> bgGradient;
  final VoidCallback onDismiss;

  const _CelebrationWidget({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.detail,
    required this.bgGradient,
    required this.onDismiss,
  });

  @override
  State<_CelebrationWidget> createState() => _CelebrationWidgetState();
}

class _CelebrationWidgetState extends State<_CelebrationWidget>
    with TickerProviderStateMixin {
  late AnimationController _scaleCtrl;
  late AnimationController _fadeCtrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  late AnimationController _confettiCtrl;

  @override
  void initState() {
    super.initState();

    _scaleCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _scaleAnim = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);

    _fadeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);

    _confettiCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2000));

    _fadeCtrl.forward().then((_) => _scaleCtrl.forward());
    _confettiCtrl.forward();

    // Auto-dismiss after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) _dismiss();
    });
  }

  void _dismiss() {
    _fadeCtrl.reverse().then((_) {
      if (mounted) widget.onDismiss();
    });
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    _fadeCtrl.dispose();
    _confettiCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: GestureDetector(
        onTap: _dismiss,
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  widget.bgGradient[0].withAlpha(240),
                  widget.bgGradient[1].withAlpha(240),
                ],
              ),
            ),
            child: SafeArea(
              child: Stack(
                children: [
                  // Confetti particles
                  AnimatedBuilder(
                    animation: _confettiCtrl,
                    builder: (context, _) {
                      return CustomPaint(
                        size: MediaQuery.of(context).size,
                        painter: _ConfettiPainter(
                            progress: _confettiCtrl.value),
                      );
                    },
                  ),
                  // Content
                  Center(
                    child: ScaleTransition(
                      scale: _scaleAnim,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              color: widget.iconColor.withAlpha(40),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(widget.icon,
                                size: 56, color: widget.iconColor),
                          ),
                          const SizedBox(height: 28),
                          Text(widget.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 40),
                            child: Text(widget.subtitle,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 16,
                                  height: 1.4,
                                ),
                                textAlign: TextAlign.center),
                          ),
                          if (widget.detail != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 20, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(30),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(widget.detail!,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                  )),
                            ),
                          ],
                          const SizedBox(height: 32),
                          Text('Tap anywhere to dismiss',
                              style: TextStyle(
                                  color: Colors.white.withAlpha(120),
                                  fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final double progress;
  _ConfettiPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final colors = [
      AppTheme.secondaryColor,
      const Color(0xFFFF6B6B),
      const Color(0xFF4ECDC4),
      const Color(0xFFFFE66D),
      const Color(0xFF95E1D3),
      const Color(0xFFF38181),
      Colors.white,
    ];

    final paint = Paint()..style = PaintingStyle.fill;

    // Seed-based positions for consistent particles
    for (var i = 0; i < 40; i++) {
      final seed = i * 7.3 + 2.1;
      final x = (seed * 37.7 % size.width);
      final startY = -20.0 - (seed * 13.3 % 100);
      final y = startY + progress * (size.height + 120);
      final rotation = progress * 6.28 * (i.isEven ? 1 : -1);
      final colorIdx = i % colors.length;
      paint.color = colors[colorIdx].withAlpha((255 * (1 - progress * 0.3)).toInt());

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(rotation);
      // Draw small rectangles as confetti
      canvas.drawRect(
        Rect.fromCenter(center: Offset.zero, width: 8, height: 12),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.progress != progress;
}
