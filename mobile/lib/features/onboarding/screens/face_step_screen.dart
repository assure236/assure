import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

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
  static const int _maxApiAttempts = 2;
  CameraController? _controller;
  bool _cameraReady = false;
  bool _submitting = false;
  String? _error;
  int _apiAttempts = 0;

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
    if (_apiAttempts >= _maxApiAttempts) {
      setState(() => _error = 'Attempt limit reached for this session. Please try again later.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final photo = await ctrl.takePicture();
      final localValidationError = await _validateCapturedImage(photo.path);
      if (localValidationError != null) {
        if (!mounted) return;
        setState(() => _error = localValidationError);
        return;
      }

      setState(() => _apiAttempts += 1);
      final res = await OnboardingApi.verifyFace(photo.path);

      if (!mounted) return;
      if (res['success'] == true) {
        context.go('/onboarding/bank');
      } else {
        final msg = res['message']?.toString() ?? 'Cashfree liveness verification failed.';
        setState(() {
          _error = _apiAttempts >= _maxApiAttempts
              ? '$msg Attempt limit reached for this session. Please try again later.'
              : msg;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Capture failed: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<String?> _validateCapturedImage(String photoPath) async {
    try {
      final bytes = await File(photoPath).readAsBytes();
      if (bytes.length < 28000) {
        return 'Selfie quality is too low. Hold the phone steady and bring your face closer.';
      }

      final image = await _decodeImageFromBytes(bytes);
      final width = image.width;
      final height = image.height;
      final rgba = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      image.dispose();
      if (rgba == null) return 'Unable to validate selfie. Please capture again.';

      final data = rgba.buffer.asUint8List();
      final sampleStep = 12;
      double sumLum = 0;
      double sumSqLum = 0;
      int count = 0;

      final cx0 = (width * 0.25).floor();
      final cx1 = (width * 0.75).floor();
      final cy0 = (height * 0.22).floor();
      final cy1 = (height * 0.78).floor();
      double centerLum = 0;
      int centerCount = 0;

      for (int y = 0; y < height; y += sampleStep) {
        for (int x = 0; x < width; x += sampleStep) {
          final idx = (y * width + x) * 4;
          final r = data[idx];
          final g = data[idx + 1];
          final b = data[idx + 2];
          final lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          sumLum += lum;
          sumSqLum += lum * lum;
          count += 1;
          if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) {
            centerLum += lum;
            centerCount += 1;
          }
        }
      }

      if (count == 0 || centerCount == 0) return 'Unable to validate selfie. Please try again.';
      final avgLum = sumLum / count;
      final stdDev = math.sqrt(math.max(0, (sumSqLum / count) - (avgLum * avgLum)));
      final avgCenter = centerLum / centerCount;

      if (avgLum < 55) {
        return 'Image is too dark. Move to a brighter place.';
      }
      if (stdDev < 22) {
        return 'Image looks unclear. Keep the phone steady and avoid blur.';
      }
      if (avgCenter < avgLum * 0.9) {
        return 'Keep your face centered and fully visible before verifying.';
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<ui.Image> _decodeImageFromBytes(Uint8List bytes) {
    final c = Completer<ui.Image>();
    ui.decodeImageFromList(bytes, (img) => c.complete(img));
    return c.future;
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
                  'Use bright lighting, look straight at camera, and remove hat/glasses. We validate image quality before API verification.',
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
                  onPressed: (_submitting || _apiAttempts >= _maxApiAttempts) ? null : _captureAndVerify,
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
                  label: Text(
                    _submitting
                        ? 'Verifying...'
                        : _apiAttempts >= _maxApiAttempts
                            ? 'Try Again Later'
                            : 'Capture and Verify',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
