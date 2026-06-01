import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/utils/face_confidence.dart';
import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class FaceStepScreen extends StatefulWidget {
  const FaceStepScreen({super.key});
  @override
  State<FaceStepScreen> createState() => _FaceStepScreenState();
}

class _FaceStepScreenState extends State<FaceStepScreen> {
  File? _selfie;
  bool _busy = false;
  String? _error;
  int? _confidencePercent;
  String? _confidenceMessage;

  Future<void> _evaluateCapturedSelfie(File image) async {
    final analysis = await evaluateFaceConfidence(image.path);
    if (!mounted) return;
    setState(() {
      _confidencePercent = analysis.confidencePercent;
      _confidenceMessage = analysis.message;
    });
  }

  Future<void> _capture() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, imageQuality: 80);
    if (f != null) {
      final file = File(f.path);
      setState(() {
        _selfie = file;
        _error = null;
        _confidencePercent = null;
        _confidenceMessage = null;
      });
      await _evaluateCapturedSelfie(file);
    }
  }

  Future<void> _submit() async {
    if (_selfie == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final analysis = await evaluateFaceConfidence(_selfie!.path);
      setState(() {
        _confidencePercent = analysis.confidencePercent;
        _confidenceMessage = analysis.message;
      });
      if (!analysis.passed) {
        setState(() => _error = analysis.message);
        return;
      }

      final res = await OnboardingApi.verifyFace(_selfie!.path, confidencePercent: analysis.confidencePercent);
      if (res['success'] == true) {
        if (mounted) context.go('/onboarding/bank');
      } else {
        setState(() => _error = res['message']?.toString() ?? 'Face did not match. Please retry.');
      }
    } catch (e) {
      setState(() => _error = 'Verification failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 1,
      title: 'Take a live selfie',
      subtitle: 'Only your real face is allowed. We run live detection first, then PAN/Aadhaar match when available.',
      loading: _busy,
      child: Column(children: [
        ClipOval(
          child: Container(
            width: 220, height: 220, color: Colors.black12,
            child: _selfie == null
              ? const Center(child: Icon(Icons.face, size: 80, color: Colors.grey))
              : Image.file(_selfie!, fit: BoxFit.cover),
          ),
        ),
        const SizedBox(height: 16),
        if (_confidencePercent != null) ...[
          Container(
            width: 240,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.blueGrey.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                Text(
                  'Local live confidence: $_confidencePercent%',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                LinearProgressIndicator(
                  value: (_confidencePercent! / 100).clamp(0, 1),
                  minHeight: 7,
                  borderRadius: BorderRadius.circular(5),
                ),
                if (_confidenceMessage != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    _confidenceMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        if (_selfie == null)
          ElevatedButton.icon(
            icon: const Icon(Icons.camera_alt),
            label: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Capture Selfie')),
            onPressed: _busy ? null : _capture,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          )
        else Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          OutlinedButton.icon(icon: const Icon(Icons.refresh), label: const Text('Retake'), onPressed: _busy ? null : _capture),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: _busy ? null : _submit,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
            child: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Verify & Continue')),
          ),
        ]),
        const SizedBox(height: 12),
        Text('No screens, printed photos, or photo frames. Keep only your face centered in good light.', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ]),
    );
  }
}
