import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class DoneStepScreen extends StatefulWidget {
  const DoneStepScreen({super.key});
  @override
  State<DoneStepScreen> createState() => _DoneStepScreenState();
}

class _DoneStepScreenState extends State<DoneStepScreen> {
  int _count = 8;

  @override
  void initState() {
    super.initState();
    _tick();
  }

  void _tick() async {
    while (_count > 0 && mounted) {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return;
      setState(() => _count--);
    }
    if (mounted) _goToDashboard();
  }

  void _goToDashboard() {
    OnboardingApi.tourComplete().catchError((_) => <String, dynamic>{});
    context.go('/dashboard?onboarding=just_completed');
  }

  Future<void> _share() async {
    const text = 'Hi! I’ve been using Assure ChitFunds — a transparent, secure way to save and grow your money with monthly chit auctions. Join me on the platform.\n\nhttps://assure.fund';
    await Share.share(text, subject: 'Try Assure ChitFunds');
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 5,
      title: 'Onboarding complete!',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Center(
          child: CircleAvatar(radius: 44, backgroundColor: Color(0xFF16A34A), child: Icon(Icons.check, size: 56, color: Colors.white)),
        ),
        const SizedBox(height: 18),
        const Text(
          'Thank you! Your details have been submitted.\nAdmin will approve your account within 24 hours.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 15),
        ),
        const SizedBox(height: 14),
        const Card(elevation: 0, color: Color(0xFFE0F2FE), child: Padding(padding: EdgeInsets.all(10), child: Text('You can explore the dashboard meanwhile. We will notify you on approval.'))),
        const SizedBox(height: 14),
        ElevatedButton.icon(
          icon: const Icon(Icons.share),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Share Assure with friends')),
          onPressed: _share,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
        ),
        const SizedBox(height: 10),
        ElevatedButton(
          onPressed: _goToDashboard,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text('Go to Dashboard ($_count)')),
        ),
      ]),
    );
  }
}
