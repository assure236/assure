import 'package:flutter/material.dart';

/// Shared full-screen container for every onboarding step on mobile.
/// One screen per step — never multiple forms on one page.
class OnboardingLayout extends StatelessWidget {
  final int stepIndex; // 0..5
  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? footer;
  final bool loading;

  const OnboardingLayout({
    super.key,
    required this.stepIndex,
    required this.title,
    this.subtitle,
    required this.child,
    this.footer,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    const total = 6;
    final progress = (stepIndex + 1) / total;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1F3B),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text('Step ${stepIndex + 1} of $total'),
        automaticallyImplyLeading: false,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: const Color(0xFF1E3A8A),
            valueColor: const AlwaysStoppedAnimation(Color(0xFFD4AF37)),
            minHeight: 4,
          ),
        ),
      ),
      body: SafeArea(
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Color(0xFF0B1F3B))),
                  if (subtitle != null) ...[
                    const SizedBox(height: 6),
                    Text(subtitle!, style: TextStyle(fontSize: 14, color: Colors.grey[700])),
                  ],
                  const SizedBox(height: 18),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    padding: const EdgeInsets.all(18),
                    child: child,
                  ),
                  if (footer != null) ...[
                    const SizedBox(height: 14),
                    footer!,
                  ],
                ],
              ),
            ),
            if (loading) const LinearProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
