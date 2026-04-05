import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

/// Liveness verification using Luxand Cloud API.
/// Flow: Capture face → API liveness check → Smile & capture → API check → Verified.
/// Returns the captured image path on success, or null if cancelled.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

enum _Step { ready, checking, smile, checkingSmile, done }

class _LivenessScreenState extends State<LivenessScreen> {
  CameraController? _camCtrl;
  bool _disposed = false;
  _Step _currentStep = _Step.ready;
  String _instruction = 'Position your face in the circle\nand tap Capture';
  double _progress = 0.0;
  String? _capturedPath;
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _camCtrl = CameraController(front, ResolutionPreset.medium,
          enableAudio: false);
      await _camCtrl!.initialize();
      if (!_disposed && mounted) setState(() {});
    } catch (e) {
      debugPrint('Camera init error: $e');
      if (mounted) Navigator.pop(context, null);
    }
  }

  Future<void> _onCapture() async {
    if (_camCtrl == null || !_camCtrl!.value.isInitialized) return;

    if (_currentStep == _Step.ready) {
      // Step 1: Capture face photo → check liveness
      setState(() {
        _currentStep = _Step.checking;
        _instruction = 'Checking liveness...';
        _errorMsg = null;
      });
      await _captureAndCheck(isSmileStep: false);
    } else if (_currentStep == _Step.smile) {
      // Step 2: Capture smile photo → check liveness again
      setState(() {
        _currentStep = _Step.checkingSmile;
        _instruction = 'Verifying smile...';
        _errorMsg = null;
      });
      await _captureAndCheck(isSmileStep: true);
    }
  }

  Future<void> _captureAndCheck({required bool isSmileStep}) async {
    try {
      final file = await _camCtrl!.takePicture();
      final path = file.path;

      // Send to backend → Luxand liveness API
      final result = await ApiService.uploadFile(
        '/liveness/check',
        path,
        fieldName: 'photo',
      );

      if (!mounted) return;

      final isLive = result['live'] == true;

      if (!isLive) {
        // Failed — show error, let user retry
        setState(() {
          _currentStep = isSmileStep ? _Step.smile : _Step.ready;
          _errorMsg = result['message'] ?? 'Not a real face detected';
          _instruction = isSmileStep
              ? 'Smile and tap Capture again'
              : 'Position your face and tap Capture';
        });
        // Clean up failed photo
        try { await File(path).delete(); } catch (_) {}
        return;
      }

      if (!isSmileStep) {
        // Face liveness passed → save path, move to smile step
        _capturedPath = path;
        setState(() {
          _currentStep = _Step.smile;
          _instruction = 'Great! Now smile 😊\nand tap Capture';
          _progress = 0.5;
          _errorMsg = null;
        });
      } else {
        // Smile liveness also passed → verified!
        // Use the smile photo as the final selfie
        // Delete the first capture, keep the smiling one
        if (_capturedPath != null && _capturedPath != path) {
          try { await File(_capturedPath!).delete(); } catch (_) {}
        }
        _capturedPath = path;
        setState(() {
          _currentStep = _Step.done;
          _instruction = 'Verified! ✅';
          _progress = 1.0;
          _errorMsg = null;
        });
        await Future.delayed(const Duration(milliseconds: 800));
        if (mounted) Navigator.pop(context, _capturedPath);
      }
    } catch (e) {
      debugPrint('Liveness check error: $e');
      if (mounted) {
        setState(() {
          _currentStep = isSmileStep ? _Step.smile : _Step.ready;
          _errorMsg = 'Connection error. Please try again.';
          _instruction = isSmileStep
              ? 'Smile and tap Capture again'
              : 'Position your face and tap Capture';
        });
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _camCtrl?.dispose();
    super.dispose();
  }

  bool get _canCapture =>
      _currentStep == _Step.ready || _currentStep == _Step.smile;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Liveness Verification'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: _camCtrl == null || !_camCtrl!.value.isInitialized
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : Column(
              children: [
                const SizedBox(height: 16),
                Text(_instruction,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center),
                if (_errorMsg != null) ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(_errorMsg!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center),
                  ),
                ],
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: _progress,
                      minHeight: 6,
                      backgroundColor: Colors.white24,
                      valueColor: AlwaysStoppedAnimation<Color>(
                          _progress >= 1.0 ? AppTheme.successColor : AppTheme.secondaryColor),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _stepDot('Face', _currentStep.index >= 2),
                    _stepLine(_currentStep.index >= 3),
                    _stepDot('Smile', _currentStep.index >= 4),
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: Center(
                    child: SizedBox(
                      width: 280,
                      height: 360,
                      child: ClipOval(
                        child: Transform.flip(
                          flipX: true,
                          child: OverflowBox(
                            alignment: Alignment.center,
                            child: FittedBox(
                              fit: BoxFit.cover,
                              child: SizedBox(
                                width: _camCtrl!.value.previewSize!.height,
                                height: _camCtrl!.value.previewSize!.width,
                                child: CameraPreview(_camCtrl!),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // Capture button or loading spinner
                if (_currentStep == _Step.checking || _currentStep == _Step.checkingSmile)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 30),
                    child: SizedBox(
                      width: 60, height: 60,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 3),
                    ),
                  )
                else if (_canCapture)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 30),
                    child: GestureDetector(
                      onTap: _onCapture,
                      child: Container(
                        width: 70, height: 70,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                        ),
                        child: Center(
                          child: Container(
                            width: 56, height: 56,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                else
                  const SizedBox(height: 100),
              ],
            ),
    );
  }

  Widget _stepDot(String label, bool active) {
    return Column(
      children: [
        Container(
          width: 24, height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? AppTheme.successColor : Colors.white24,
          ),
          child: active
              ? const Icon(Icons.check, color: Colors.white, size: 14)
              : null,
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(
            color: active ? Colors.white : Colors.white38, fontSize: 11)),
      ],
    );
  }

  Widget _stepLine(bool active) {
    return Container(
      width: 40, height: 2, margin: const EdgeInsets.only(bottom: 18),
      color: active ? AppTheme.successColor : Colors.white24,
    );
  }
}
