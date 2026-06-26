import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// A single step in the interactive dashboard tour.
class DashboardTourStep {
  final GlobalKey? targetKey;
  final String title;
  final String body;
  final String? linkLabel;
  final VoidCallback? onLinkTap;

  const DashboardTourStep({
    this.targetKey,
    required this.title,
    required this.body,
    this.linkLabel,
    this.onLinkTap,
  });
}

/// Spotlight-style product tour with Skip / Next controls.
class DashboardTourOverlay extends StatefulWidget {
  final List<DashboardTourStep> steps;
  final VoidCallback onDone;

  const DashboardTourOverlay({
    super.key,
    required this.steps,
    required this.onDone,
  });

  @override
  State<DashboardTourOverlay> createState() => _DashboardTourOverlayState();
}

class _DashboardTourOverlayState extends State<DashboardTourOverlay> {
  int _index = 0;
  Rect? _targetRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateTarget());
  }

  void _finish() {
    widget.onDone();
  }

  void _next() {
    if (_index + 1 >= widget.steps.length) {
      _finish();
      return;
    }
    setState(() => _index++);
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateTarget());
  }

  Future<void> _updateTarget() async {
    if (!mounted) return;
    final step = widget.steps[_index];
    final key = step.targetKey;
    if (key == null) {
      setState(() => _targetRect = null);
      return;
    }

    final ctx = key.currentContext;
    if (ctx == null) {
      await Future.delayed(const Duration(milliseconds: 200));
      if (!mounted) return;
      _next();
      return;
    }

    try {
      await Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        alignment: 0.3,
      );
    } catch (_) {}

    if (!mounted) return;
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) {
      setState(() => _targetRect = null);
      return;
    }
    final offset = box.localToGlobal(Offset.zero);
    setState(() {
      _targetRect = Rect.fromLTWH(
        offset.dx,
        offset.dy,
        box.size.width,
        box.size.height,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.steps.isEmpty) return const SizedBox.shrink();
    final step = widget.steps[_index];
    final progress = (_index + 1) / widget.steps.length;
    final media = MediaQuery.of(context);
    final tooltipTop = _tooltipTop(media.size.height);

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _SpotlightPainter(
                target: _targetRect?.inflate(8),
                screenSize: media.size,
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            top: tooltipTop,
            child: _TourCard(
              step: step,
              index: _index,
              total: widget.steps.length,
              progress: progress,
              onSkip: _finish,
              onNext: _next,
            ),
          ),
        ],
      ),
    );
  }

  double _tooltipTop(double screenH) {
    final rect = _targetRect;
    if (rect == null) return screenH * 0.28;
    const cardH = 220.0;
    final below = rect.bottom + 16;
    if (below + cardH < screenH - 24) return below;
    final above = rect.top - cardH - 16;
    if (above > 24) return above;
    return (screenH - cardH) / 2;
  }
}

class _TourCard extends StatelessWidget {
  final DashboardTourStep step;
  final int index;
  final int total;
  final double progress;
  final VoidCallback onSkip;
  final VoidCallback onNext;

  const _TourCard({
    required this.step,
    required this.index,
    required this.total,
    required this.progress,
    required this.onSkip,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.primaryColor.withAlpha(60)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(40),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            step.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppTheme.primaryColor,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            step.body,
            style: const TextStyle(fontSize: 14, color: Colors.black87, height: 1.4),
          ),
          if (step.linkLabel != null && step.onLinkTap != null) ...[
            const SizedBox(height: 10),
            InkWell(
              onTap: step.onLinkTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      step.linkLabel!,
                      style: const TextStyle(
                        color: AppTheme.accentBlue,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward_rounded,
                        size: 16, color: AppTheme.accentBlue),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 5,
              backgroundColor: AppTheme.lightBlueBg,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              TextButton(
                onPressed: onSkip,
                child: const Text('Skip tour'),
              ),
              const Spacer(),
              Text(
                '${index + 1} / $total',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: onNext,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                ),
                child: Text(index + 1 >= total ? 'Finish' : 'Next'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SpotlightPainter extends CustomPainter {
  final Rect? target;
  final Size screenSize;

  _SpotlightPainter({required this.target, required this.screenSize});

  @override
  void paint(Canvas canvas, Size size) {
    final overlay = Paint()..color = Colors.black.withAlpha(170);
    final full = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    if (target != null) {
      final hole = Path()
        ..addRRect(RRect.fromRectAndRadius(target!, const Radius.circular(12)));
      final combined = Path.combine(PathOperation.difference, full, hole);
      canvas.drawPath(combined, overlay);
      final border = Paint()
        ..color = Colors.white.withAlpha(220)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawRRect(
        RRect.fromRectAndRadius(target!, const Radius.circular(12)),
        border,
      );
    } else {
      canvas.drawPath(full, overlay);
    }
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter oldDelegate) =>
      oldDelegate.target != target;
}
