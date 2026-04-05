import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

/// Liveness verification using Luxand Cloud API.
/// Flow: Tap capture → Luxand liveness check → Verified → returns photo path.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

enum _Step { ready, checking, done }

class _LivenessScreenState extends State<LivenessScreen> {
  CameraController? _camCtrl;
  bool _disposed = false;
  _Step _currentStep = _Step.ready;
  String _instruction = 'Position your face in the circle\nand tap Capture';
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
      _camCtrl = CameraController(front, ResolutionPreset.high,
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
    if (_currentStep != _Step.ready) return;

    setState(() {
      _currentStep = _Step.checking;
      _instruction = 'Checking liveness...';
      _errorMsg = null;
    });

    try {
      final file = await _camCtrl!.takePicture();
      final path = file.path;

      final result = await ApiService.uploadFile(
        '/liveness/check', path, fieldName: 'photo');
      if (!mounted) return;

      debugPrint('Luxand result: $result');
      final isLive = result['live'] == true;

      if (!isLive) {
        final msg = result['message'] ?? 'Not a real face detected';
        setState(() {
          _currentStep = _Step.ready;
          _errorMsg = msg;
          _instruction = 'Position your face and tap Capture';
        });
        try { await File(path).delete(); } catch (_) {}
        return;
      }

      // Liveness passed → done
      setState(() {
        _currentStep = _Step.done;
        _instruction = 'Verified! ✅';
        _errorMsg = null;
      });
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) Navigator.pop(context, path);
    } catch (e) {
      debugPrint('Liveness check error: $e');
      if (mounted) {
        setState(() {
          _currentStep = _Step.ready;
          _errorMsg = 'Connection error. Please try again.';
          _instruction = 'Position your face and tap Capture';
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
      body: _camCtrl == null || !_camCtrl!.value.isInitialized
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : Column(
              children: [
                const SizedBox(height: 24),
                Text(_instruction,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center),
                if (_errorMsg != null) ...[
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(_errorMsg!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center),
                  ),
                ],
                const SizedBox(height: 20),
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
}
