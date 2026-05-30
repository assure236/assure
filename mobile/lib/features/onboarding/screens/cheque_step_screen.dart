import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class ChequeStepScreen extends StatefulWidget {
  const ChequeStepScreen({super.key});
  @override
  State<ChequeStepScreen> createState() => _ChequeStepScreenState();
}

class _ChequeStepScreenState extends State<ChequeStepScreen> {
  File? _file;
  bool _busy = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (f == null) {
      final fg = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (fg != null) setState(() => _file = File(fg.path));
    } else {
      setState(() => _file = File(f.path));
    }
  }

  Future<void> _upload() async {
    if (_file == null) return;
    setState(() => _busy = true);
    try {
      await OnboardingApi.uploadCheque(_file!.path);
      if (mounted) context.go('/onboarding/address');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _skip() async {
    setState(() => _busy = true);
    try {
      await OnboardingApi.skipCheque();
      if (mounted) context.go('/onboarding/address');
    } catch (_) {
      if (mounted) context.go('/onboarding/address');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 3,
      title: 'Cancelled cheque (optional)',
      subtitle: 'Photo of a cancelled cheque from your bank account. You can skip and add it later.',
      loading: _busy,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          height: 180,
          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10), color: Colors.grey.shade50),
          child: _file == null
            ? const Center(child: Icon(Icons.cloud_upload, size: 56, color: Colors.grey))
            : ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(_file!, fit: BoxFit.contain)),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(icon: const Icon(Icons.add_a_photo), label: Text(_file == null ? 'Choose Photo' : 'Change Photo'), onPressed: _busy ? null : _pick),
        const SizedBox(height: 10),
        const Card(color: Color(0xFFE0F2FE), elevation: 0, child: Padding(padding: EdgeInsets.all(10), child: Text('Admin will verify the cheque within 24 hours.'))),
        const SizedBox(height: 16),
        Row(children: [
          TextButton.icon(icon: const Icon(Icons.skip_next), label: const Text('Skip for now'), onPressed: _busy ? null : _skip),
          const Spacer(),
          ElevatedButton(
            onPressed: _busy || _file == null ? null : _upload,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
            child: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Upload & Continue')),
          ),
        ]),
      ]),
    );
  }
}
