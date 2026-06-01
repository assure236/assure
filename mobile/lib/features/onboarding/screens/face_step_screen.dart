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
  int? _spoofRiskPercent;
  String? _confidenceMessage;

  static const int _localMinPassPercent = 60;

  Future<void> _captureSelfie() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, imageQuality: 80);
    if (f != null) {
      final file = File(f.path);
      setState(() => _error = null);

      final analysis = await evaluateFaceConfidence(file.path, minPassPercent: _localMinPassPercent);
      if (!mounted) return;
      setState(() {
        _selfie = file;
        _confidencePercent = analysis.confidencePercent;
        _spoofRiskPercent = analysis.spoofRiskPercent;
        _confidenceMessage = analysis.message;
        _error = analysis.passed ? null : analysis.message;
      });
    }
  }

  void _retakeSelfie() {
    setState(() {
      _selfie = null;
      _confidencePercent = null;
      _spoofRiskPercent = null;
      _confidenceMessage = null;
      _error = null;
    });
  }

  Future<void> _submit() async {
    if (_selfie == null || _confidencePercent == null || _spoofRiskPercent == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (_confidencePercent! < _localMinPassPercent) {
        setState(() => _error = 'Face quality is low. Please retake in good lighting.');
        return;
      }
      if (_spoofRiskPercent! > 60) {
        setState(() => _error = 'Possible screen/photo detected. Please take a real live selfie.');
        return;
      }

      final res = await OnboardingApi.verifyFace(
        _selfie!.path,
        confidencePercent: _confidencePercent,
        extraFields: {
          'spoof_risk_percent': _spoofRiskPercent.toString(),
          'anti_spoof_version': 'single-frame-v2',
        },
      );
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
      subtitle: 'Use one clear selfie. Screen/photo replays are blocked automatically.',
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
                  'Live confidence: $_confidencePercent%',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                if (_spoofRiskPercent != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Spoof risk: $_spoofRiskPercent% (lower is better)',
                    style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                  ),
                ],
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
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          OutlinedButton.icon(
            icon: const Icon(Icons.camera_alt),
            label: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Text(_selfie == null ? 'Capture Selfie' : 'Retake Selfie'),
            ),
            onPressed: _busy ? null : (_selfie == null ? _captureSelfie : _retakeSelfie),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: _busy ? null : _submit,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
            child: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Verify & Continue')),
          ),
        ]),
        const SizedBox(height: 12),
        Text('Anti-spoof checks include face quality, angle, glare and texture patterns to reject screen/photo uploads.', style: TextStyle(fontSize: 12, color: Colors.grey[600]), textAlign: TextAlign.center),
      ]),
    );
  }
}
