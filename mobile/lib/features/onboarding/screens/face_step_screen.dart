import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image_picker/image_picker.dart';

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

  Future<String?> _runLocalLivenessChecks(File image) async {
    final detector = FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.accurate,
        enableClassification: true,
        enableContours: false,
        enableLandmarks: false,
      ),
    );
    try {
      final input = InputImage.fromFilePath(image.path);
      final faces = await detector.processImage(input);
      if (faces.isEmpty) return 'No face detected. Please retake in good lighting.';
      if (faces.length > 1) return 'Multiple faces detected. Keep only your face in frame.';

      final face = faces.first;
      final yaw = (face.headEulerAngleY ?? 0).abs();
      final pitch = (face.headEulerAngleX ?? 0).abs();
      final leftOpen = face.leftEyeOpenProbability ?? 0;
      final rightOpen = face.rightEyeOpenProbability ?? 0;

      if (yaw > 22 || pitch > 22) return 'Keep your face straight and centered.';
      if (leftOpen < 0.2 && rightOpen < 0.2) return 'Please keep your eyes open and retake.';
      return null;
    } catch (_) {
      return 'Could not scan face on device. Please retake your selfie.';
    } finally {
      detector.close();
    }
  }

  Future<void> _capture() async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, imageQuality: 80);
    if (f != null) setState(() { _selfie = File(f.path); _error = null; });
  }

  Future<void> _submit() async {
    if (_selfie == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final localError = await _runLocalLivenessChecks(_selfie!);
      if (localError != null) {
        setState(() => _error = localError);
        return;
      }

      final res = await OnboardingApi.verifyFace(_selfie!.path);
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
      subtitle: 'Only your real face is allowed. We match it with your PAN/Aadhaar photo (90% minimum).',
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
        Text('No screens, printed photos, flash glare, or other objects. Keep only your face centered.', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ]),
    );
  }
}
