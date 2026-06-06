import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/onboarding_api.dart';

class FaceStepScreen extends StatefulWidget {
  const FaceStepScreen({super.key});

  @override
  State<FaceStepScreen> createState() => _FaceStepScreenState();
}

class _FaceStepScreenState extends State<FaceStepScreen> with WidgetsBindingObserver {
  CameraController? _controller;
  bool _cameraReady = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) {
      _controller?.dispose();
      _cameraReady = false;
    } else if (state == AppLifecycleState.resumed && !_cameraReady) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    setState(() {
      _cameraReady = false;
      _error = null;
    });
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final ctrl = CameraController(
        front,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.jpeg : ImageFormatGroup.bgra8888,
      );
      await ctrl.initialize();
      if (!mounted) return;
      setState(() {
        _controller = ctrl;
        _cameraReady = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Camera unavailable: $e');
    }
  }

  Future<void> _captureAndVerify() async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized || _submitting) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final photo = await ctrl.takePicture();
      final res = await OnboardingApi.verifyFace(photo.path);

      if (!mounted) return;
      if (res['success'] == true) {
        context.go('/onboarding/bank');
      } else {
        setState(() => _error = res['message']?.toString() ?? 'Cashfree liveness verification failed.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Capture failed: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && !_cameraReady) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.camera_alt_outlined, color: Colors.white70, size: 56),
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.white70), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _initCamera, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    if (!_cameraReady || _controller == null) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: CameraPreview(_controller!),
            ),
            Positioned(
              top: 14,
              left: 12,
              child: IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
              ),
            ),
            Positioned(
              top: 22,
              left: 0,
              right: 0,
              child: Text(
                'Face Verification - Step 2 of 5',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontWeight: FontWeight.w700),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 130,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Capture a clear front-face selfie. Liveness will be verified by Cashfree API.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),
            if (_error != null)
              Positioned(
                left: 20,
                right: 20,
                bottom: 84,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.red.shade800.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 20,
              child: Center(
                child: ElevatedButton.icon(
                  onPressed: _submitting ? null : _captureAndVerify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0B1F3B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  ),
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.camera_alt),
                  label: Text(_submitting ? 'Verifying...' : 'Capture and Verify'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
