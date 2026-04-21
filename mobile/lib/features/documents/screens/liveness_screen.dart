import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/services/api_service.dart';

/// Liveness verification using Luxand Cloud API.
/// Flow: Capture selfie via image_picker → Luxand liveness check → returns photo path.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

enum _Step { ready, checking, done }

class _LivenessScreenState extends State<LivenessScreen> {
  _Step _currentStep = _Step.ready;
  String _instruction = 'Take a clear selfie for\nliveness verification';
  String? _errorMsg;
  String? _capturedPath;

  Future<void> _onCapture() async {
    if (_currentStep != _Step.ready) return;

    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
      maxWidth: 1200,
      maxHeight: 1200,
    );
    if (photo == null) return;

    setState(() {
      _currentStep = _Step.checking;
      _instruction = 'Checking liveness...';
      _errorMsg = null;
      _capturedPath = photo.path;
    });

    try {
      // Single backend call: liveness check + save selfie doc + set profile photo
      final result = await ApiService.uploadFile(
        '/liveness/verify-and-save', photo.path, fieldName: 'photo');
      if (!mounted) return;

      debugPrint('Luxand result: $result');
      final isLive = result['live'] == true && result['success'] == true;

      if (!isLive) {
        final msg = result['message'] ?? 'Not a real face detected';
        setState(() {
          _currentStep = _Step.ready;
          _errorMsg = msg;
          _instruction = 'Take a clear selfie for\nliveness verification';
        });
        try { await File(photo.path).delete(); } catch (_) {}
        return;
      }

      setState(() {
        _currentStep = _Step.done;
        _instruction = 'Verified! ✅';
        _errorMsg = null;
      });
      await Future.delayed(const Duration(milliseconds: 800));
      // Pop with a sentinel so caller knows the document is already saved server-side
      if (mounted) Navigator.pop(context, 'saved');
    } catch (e) {
      debugPrint('Liveness check error: $e');
      if (mounted) {
        setState(() {
          _currentStep = _Step.ready;
          _errorMsg = 'Connection error. Please try again.';
          _instruction = 'Take a clear selfie for\nliveness verification';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool showCapture = _currentStep == _Step.ready;
    final bool showSpinner = _currentStep == _Step.checking;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Liveness Verification'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          const SizedBox(height: 40),
          Text(_instruction,
              style: const TextStyle(
                  color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center),
          if (_errorMsg != null) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(_errorMsg!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                  textAlign: TextAlign.center),
            ),
          ],
          const SizedBox(height: 40),
          Expanded(
            child: Center(
              child: _capturedPath != null && _currentStep != _Step.ready
                  ? ClipOval(
                      child: Image.file(
                        File(_capturedPath!),
                        width: 280,
                        height: 360,
                        fit: BoxFit.cover,
                      ),
                    )
                  : Container(
                      width: 280,
                      height: 360,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24, width: 3),
                      ),
                      child: const Icon(Icons.person, size: 120, color: Colors.white24),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          if (showSpinner)
            const Padding(
              padding: EdgeInsets.only(bottom: 30),
              child: SizedBox(
                width: 60, height: 60,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 3),
              ),
            )
          else if (showCapture)
            Padding(
              padding: const EdgeInsets.only(bottom: 30),
              child: GestureDetector(
                onTap: _onCapture,
                child: Column(
                  children: [
                    Container(
                      width: 70, height: 70,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 4),
                      ),
                      child: const Center(
                        child: Icon(Icons.camera_alt, color: Colors.white, size: 32),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text('Tap to capture selfie',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),
            )
          else
            const SizedBox(height: 100),
        ],
      ),
    );
  }
}
