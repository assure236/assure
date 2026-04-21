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

  /// Show a celebration overlay for group enrollment.
  static void showGroupJoined(BuildContext context, {String? groupName}) {
    _show(context,
      icon: Icons.group_add_rounded,
      iconColor: AppTheme.secondaryColor,
      title: 'Enrollment Submitted! 🎉',
      subtitle: groupName != null ? 'Your request to join $groupName has been submitted!' : 'Your enrollment request has been submitted!',
      bgGradient: const [AppTheme.primaryDark, AppTheme.primaryColor],
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
  late AnimationController _shimmerCtrl;
  late Animation<double> _shimmerAnim;
  late AnimationController _iconPulseCtrl;
  late Animation<double> _iconPulse;

  @override
  void initState() {
    super.initState();

    _scaleCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800));
    _scaleAnim = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);

    _fadeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);

    _confettiCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 3500))
      ..repeat();

    _shimmerCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2000))
      ..repeat();
    _shimmerAnim = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _shimmerCtrl, curve: Curves.linear),
    );

    _iconPulseCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _iconPulse = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _iconPulseCtrl, curve: Curves.easeInOut),
    );

    _fadeCtrl.forward().then((_) => _scaleCtrl.forward());

    // Auto-dismiss after 4 seconds
    Future.delayed(const Duration(seconds: 4), () {
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
    _shimmerCtrl.dispose();
    _iconPulseCtrl.dispose();
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
                  // Shimmer overlay
                  AnimatedBuilder(
                    animation: _shimmerAnim,
                    builder: (context, _) {
                      return Opacity(
                        opacity: 0.08,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment(_shimmerAnim.value - 1, 0),
                              end: Alignment(_shimmerAnim.value, 0),
                              colors: const [Colors.transparent, Colors.white, Colors.transparent],
                            ),
                          ),
                        ),
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
                          ScaleTransition(
                            scale: _iconPulse,
                            child: Container(
                              width: 110,
                              height: 110,
                              decoration: BoxDecoration(
                                color: widget.iconColor.withAlpha(40),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: widget.iconColor.withAlpha(80),
                                    blurRadius: 30,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: Icon(widget.icon,
                                  size: 60, color: widget.iconColor),
                            ),
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
      const Color(0xFF6C5CE7),
      const Color(0xFFFD79A8),
      Colors.white,
    ];

    final paint = Paint()..style = PaintingStyle.fill;
    final p = progress % 1.0; // loop-friendly

    // Layer 1: Large confetti pieces (falling)
    for (var i = 0; i < 60; i++) {
      final seed = i * 7.3 + 2.1;
      final x = (seed * 37.7 % size.width);
      final wobble = 20.0 * ((seed * 3.1 % 2) - 1) * (0.5 + 0.5 * p);
      final startY = -30.0 - (seed * 13.3 % 150);
      final y = startY + p * (size.height + 200);
      final rotation = p * 8.0 * (i.isEven ? 1 : -1) + seed;
      final colorIdx = i % colors.length;
      paint.color = colors[colorIdx].withAlpha((255 * (1 - p * 0.4)).toInt());

      canvas.save();
      canvas.translate(x + wobble, y);
      canvas.rotate(rotation);
      // Varied shapes: rectangles, circles, and diamonds
      if (i % 3 == 0) {
        canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: 10, height: 14), paint);
      } else if (i % 3 == 1) {
        canvas.drawCircle(Offset.zero, 5, paint);
      } else {
        final path = Path()
          ..moveTo(0, -6)
          ..lineTo(5, 0)
          ..lineTo(0, 6)
          ..lineTo(-5, 0)
          ..close();
        canvas.drawPath(path, paint);
      }
      canvas.restore();
    }

    // Layer 2: Tiny sparkle dots
    for (var i = 0; i < 30; i++) {
      final seed = i * 11.7 + 5.3;
      final x = (seed * 23.1 % size.width);
      final y = (seed * 41.3 % size.height);
      final twinkle = ((p * 4 + seed) % 1.0);
      final alpha = (twinkle < 0.5 ? twinkle * 2 : 2 - twinkle * 2) * 200;
      paint.color = Colors.white.withAlpha(alpha.toInt());
      canvas.drawCircle(Offset(x, y), 2.5, paint);
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.progress != progress;
}
