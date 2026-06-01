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

enum _FaceCaptureStage { neutral, challenge, ready }

class _FaceStepScreenState extends State<FaceStepScreen> {
  File? _neutralSelfie;
  File? _challengeSelfie;
  bool _busy = false;
  String? _error;
  _FaceCaptureStage _stage = _FaceCaptureStage.neutral;
  int? _confidencePercent;
  String? _confidenceMessage;
  double? _neutralYaw;
  double? _challengeYaw;

  static const int _localMinPassPercent = 45;
  static const int _sequenceMinPassPercent = 60;
  static const double _neutralMaxYaw = 12;
  static const double _neutralMaxPitch = 14;
  static const double _challengeMinAbsYaw = 16;
  static const double _challengeMinYawDelta = 14;

  File? get _displaySelfie => _challengeSelfie ?? _neutralSelfie;

  int _computeSequenceConfidence(FaceConfidenceResult neutral, FaceConfidenceResult challenge) {
    final base = ((neutral.confidencePercent + challenge.confidencePercent) / 2.0);
    final yawDelta = (challenge.yaw - neutral.yaw).abs();
    final movement = (yawDelta * 4).clamp(0, 100);
    final weighted = (base * 0.7) + (movement * 0.3);
    return weighted.round().clamp(0, 100);
  }

  String get _stageTitle {
    switch (_stage) {
      case _FaceCaptureStage.neutral:
        return 'Step 1/2: Capture a straight face selfie';
      case _FaceCaptureStage.challenge:
        return 'Step 2/2: Turn your head slightly and capture again';
      case _FaceCaptureStage.ready:
        return 'Challenge complete. Verify to continue';
    }
  }

  String get _captureButtonLabel {
    switch (_stage) {
      case _FaceCaptureStage.neutral:
        return 'Capture Straight Selfie';
      case _FaceCaptureStage.challenge:
        return 'Capture Turned Face';
      case _FaceCaptureStage.ready:
        return 'Retake Sequence';
    }
  }

  Future<void> _captureForCurrentStage() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, imageQuality: 80);
    if (f != null) {
      final file = File(f.path);
      setState(() => _error = null);

      final analysis = await evaluateFaceConfidence(file.path, minPassPercent: _localMinPassPercent);
      if (!mounted) return;

      if (!analysis.passed) {
        setState(() {
          _confidencePercent = analysis.confidencePercent;
          _confidenceMessage = analysis.message;
          _error = analysis.message;
        });
        return;
      }

      if (_stage == _FaceCaptureStage.neutral) {
        if (analysis.yaw.abs() > _neutralMaxYaw || analysis.pitch.abs() > _neutralMaxPitch) {
          setState(() {
            _confidencePercent = analysis.confidencePercent;
            _confidenceMessage = 'Keep your face straight for the first capture.';
            _error = 'First selfie must be straight (no side angle).';
          });
          return;
        }
        setState(() {
          _neutralSelfie = file;
          _neutralYaw = analysis.yaw;
          _stage = _FaceCaptureStage.challenge;
          _confidencePercent = analysis.confidencePercent;
          _confidenceMessage = 'Good. Now turn your head slightly and capture again.';
        });
        return;
      }

      if (_stage == _FaceCaptureStage.challenge) {
        final neutralYaw = _neutralYaw ?? 0;
        final yawDelta = (analysis.yaw - neutralYaw).abs();
        if (analysis.yaw.abs() < _challengeMinAbsYaw || yawDelta < _challengeMinYawDelta) {
          setState(() {
            _confidencePercent = analysis.confidencePercent;
            _confidenceMessage = 'Turn your head more clearly to one side for anti-spoof validation.';
            _error = 'Head movement too small. Please turn face left/right and capture again.';
          });
          return;
        }

        final neutral = await evaluateFaceConfidence(_neutralSelfie!.path, minPassPercent: _localMinPassPercent);
        final sequenceConfidence = _computeSequenceConfidence(neutral, analysis);
        if (sequenceConfidence < _sequenceMinPassPercent) {
          setState(() {
            _challengeSelfie = file;
            _challengeYaw = analysis.yaw;
            _confidencePercent = sequenceConfidence;
            _confidenceMessage = 'Sequence confidence is low. Improve lighting and retry.';
            _error = 'Live challenge confidence too low (${sequenceConfidence}%). Retake sequence.';
          });
          return;
        }

        setState(() {
          _challengeSelfie = file;
          _challengeYaw = analysis.yaw;
          _confidencePercent = sequenceConfidence;
          _confidenceMessage = 'Live challenge passed (${sequenceConfidence}%).';
          _stage = _FaceCaptureStage.ready;
          _error = null;
        });
      }
    }
  }

  void _retakeSequence() {
    setState(() {
      _neutralSelfie = null;
      _challengeSelfie = null;
      _neutralYaw = null;
      _challengeYaw = null;
      _confidencePercent = null;
      _confidenceMessage = null;
      _error = null;
      _stage = _FaceCaptureStage.neutral;
    });
  }

  Future<void> _submit() async {
    if (_stage != _FaceCaptureStage.ready || _challengeSelfie == null || _neutralYaw == null || _challengeYaw == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final finalConfidence = _confidencePercent ?? 0;
      if (finalConfidence < _sequenceMinPassPercent) {
        setState(() => _error = 'Live sequence confidence too low. Retake sequence.');
        return;
      }

      final yawDelta = (_challengeYaw! - _neutralYaw!).abs();

      final res = await OnboardingApi.verifyFace(
        _challengeSelfie!.path,
        confidencePercent: finalConfidence,
        extraFields: {
          'challenge_passed': 'true',
          'challenge_confidence_percent': finalConfidence.toString(),
          'challenge_yaw_delta': yawDelta.toStringAsFixed(2),
          'neutral_yaw': _neutralYaw!.toStringAsFixed(2),
          'challenge_yaw': _challengeYaw!.toStringAsFixed(2),
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
      subtitle: _stageTitle,
      loading: _busy,
      child: Column(children: [
        ClipOval(
          child: Container(
            width: 220, height: 220, color: Colors.black12,
            child: _displaySelfie == null
              ? const Center(child: Icon(Icons.face, size: 80, color: Colors.grey))
              : Image.file(_displaySelfie!, fit: BoxFit.cover),
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
        if (_stage == _FaceCaptureStage.ready)
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            OutlinedButton.icon(icon: const Icon(Icons.refresh), label: const Text('Retake Sequence'), onPressed: _busy ? null : _retakeSequence),
            const SizedBox(width: 12),
            ElevatedButton(
              onPressed: _busy ? null : _submit,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
              child: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Verify & Continue')),
            ),
          ])
        else
          ElevatedButton.icon(
            icon: const Icon(Icons.camera_alt),
            label: Padding(padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text(_captureButtonLabel)),
            onPressed: _busy ? null : _captureForCurrentStage,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          ),
        const SizedBox(height: 12),
        Text('Anti-spoof rule: first capture straight, second capture with clear head movement. Screens/photos usually fail this challenge.', style: TextStyle(fontSize: 12, color: Colors.grey[600]), textAlign: TextAlign.center),
      ]),
    );
  }
}
