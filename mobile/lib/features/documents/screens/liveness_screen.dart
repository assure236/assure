import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/theme/app_theme.dart';

/// Liveness check: Face → capture → Smile → Blink → Verified.
/// Mirrors the proven Python MediaPipe approach.
/// Returns the captured image path on success, or null if cancelled.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

enum _Step { detectFace, smile, blink, done }

class _LivenessScreenState extends State<LivenessScreen> {
  CameraController? _camCtrl;
  late FaceDetector _faceDetector;
  bool _isProcessing = false;
  _Step _currentStep = _Step.detectFace;
  String _instruction = 'Position your face in the circle';
  double _progress = 0.0;
  String? _capturedPath;
  bool _disposed = false;

  // ── Stability tracking (mirrors Python script) ──
  int _smileCounter = 0;
  int _blinkCounter = 0;
  bool _blinkDone = false;
  bool _eyesWereOpen = true; // track open→close→open transition
  DateTime _lastFaceTime = DateTime.now();

  // Thresholds (tuned for google_mlkit)
  static const double _smileThreshold = 0.45;    // smilingProbability > this
  static const int _smileFramesRequired = 6;      // consecutive frames smiling
  static const double _eyeClosedThreshold = 0.3;  // eyeOpenProbability < this = closed
  static const double _eyeOpenThreshold = 0.6;    // eyeOpenProbability > this = open
  static const int _blinkFramesRequired = 2;       // consecutive closed frames
  static const Duration _faceLostTimeout = Duration(seconds: 2);

  @override
  void initState() {
    super.initState();
    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: true,   // needed for smile + eye probabilities
        enableLandmarks: false,
        enableTracking: true,
        performanceMode: FaceDetectorMode.fast,
        minFaceSize: 0.15,
      ),
    );
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
          enableAudio: false, imageFormatGroup: ImageFormatGroup.nv21);
      await _camCtrl!.initialize();
      if (!_disposed && mounted) {
        setState(() {});
        _startDetection();
      }
    } catch (e) {
      debugPrint('Camera init error: $e');
      if (mounted) Navigator.pop(context, null);
    }
  }

  void _startDetection() {
    _camCtrl?.startImageStream((image) {
      if (_isProcessing || _currentStep == _Step.done) return;
      _isProcessing = true;
      _processImage(image);
    });
  }

  Future<void> _processImage(CameraImage image) async {
    try {
      final inputImage = _convertToInputImage(image);
      if (inputImage == null) {
        _isProcessing = false;
        return;
      }

      final faces = await _faceDetector.processImage(inputImage);

      if (faces.isEmpty) {
        // No face — check if lost for > 2 seconds then reset
        if (DateTime.now().difference(_lastFaceTime) > _faceLostTimeout &&
            _currentStep != _Step.detectFace) {
          _resetToStart();
        }
        _isProcessing = false;
        return;
      }

      // Face present — update timestamp
      _lastFaceTime = DateTime.now();

      final face = faces.first;
      final smileProb = face.smilingProbability ?? -1;
      final leftEyeOpen = face.leftEyeOpenProbability ?? -1;
      final rightEyeOpen = face.rightEyeOpenProbability ?? -1;

      // Skip frame if classification data unavailable
      if (smileProb < 0 || leftEyeOpen < 0 || rightEyeOpen < 0) {
        _isProcessing = false;
        return;
      }

      final avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2.0;

      switch (_currentStep) {
        case _Step.detectFace:
          // Face detected! Capture photo immediately, then move to smile
          await _capturePhoto();
          _currentStep = _Step.smile;
          _smileCounter = 0;
          _updateInstruction('Great! Now smile 😊', 0.33);
          break;

        case _Step.smile:
          if (smileProb > _smileThreshold) {
            _smileCounter++;
          } else {
            _smileCounter = 0;
          }
          if (_smileCounter >= _smileFramesRequired) {
            _currentStep = _Step.blink;
            _blinkCounter = 0;
            _blinkDone = false;
            _eyesWereOpen = true;
            _updateInstruction('Now blink your eyes 👁️', 0.66);
          }
          break;

        case _Step.blink:
          // Detect blink as: eyes open → eyes close (N frames) → eyes open
          if (_eyesWereOpen && avgEyeOpen < _eyeClosedThreshold) {
            // Eyes just closed
            _blinkCounter++;
          } else if (avgEyeOpen < _eyeClosedThreshold) {
            // Eyes still closed
            _blinkCounter++;
          } else if (_blinkCounter >= _blinkFramesRequired &&
                     avgEyeOpen > _eyeOpenThreshold) {
            // Eyes opened after being closed = BLINK detected
            _blinkDone = true;
          } else if (avgEyeOpen > _eyeOpenThreshold) {
            // Eyes open, no blink yet — reset counter
            _blinkCounter = 0;
          }
          _eyesWereOpen = avgEyeOpen > _eyeOpenThreshold;

          if (_blinkDone) {
            _currentStep = _Step.done;
            _updateInstruction('Verified! ✅', 1.0);
            // Brief pause to show the verified state
            await Future.delayed(const Duration(milliseconds: 600));
            if (mounted) Navigator.pop(context, _capturedPath);
          }
          break;

        case _Step.done:
          break;
      }
    } catch (e) {
      debugPrint('Face process error: $e');
    }
    _isProcessing = false;
  }

  void _resetToStart() {
    _currentStep = _Step.detectFace;
    _smileCounter = 0;
    _blinkCounter = 0;
    _blinkDone = false;
    _eyesWereOpen = true;
    _capturedPath = null;
    _updateInstruction('Position your face in the circle', 0.0);
  }

  /// Capture a still photo (used at face-detection step).
  Future<void> _capturePhoto() async {
    try {
      await _camCtrl?.stopImageStream();
      await Future.delayed(const Duration(milliseconds: 200));
      final file = await _camCtrl?.takePicture();
      _capturedPath = file?.path;
      debugPrint('Captured selfie: $_capturedPath');
      // Restart stream for smile/blink detection
      _startDetection();
    } catch (e) {
      debugPrint('Capture error: $e');
      // If capture failed, restart stream anyway
      try { _startDetection(); } catch (_) {}
    }
  }

  InputImage? _convertToInputImage(CameraImage image) {
    final camera = _camCtrl!.description;
    final sensorOrientation = camera.sensorOrientation;

    // For front camera, mirror the rotation
    final int rotationDegrees;
    if (camera.lensDirection == CameraLensDirection.front) {
      rotationDegrees = (360 - sensorOrientation) % 360;
    } else {
      rotationDegrees = sensorOrientation;
    }
    final rotation = InputImageRotationValue.fromRawValue(rotationDegrees);
    if (rotation == null) return null;

    // Hard-code NV21 for Android since we request ImageFormatGroup.nv21
    final InputImageFormat format;
    if (Platform.isAndroid) {
      format = InputImageFormat.nv21;
    } else {
      final f = InputImageFormatValue.fromRawValue(image.format.raw);
      if (f == null) return null;
      format = f;
    }

    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  void _updateInstruction(String text, double progress) {
    if (mounted) {
      setState(() {
        _instruction = text;
        _progress = progress;
      });
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _camCtrl?.dispose();
    _faceDetector.close();
    super.dispose();
  }

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
                const SizedBox(height: 20),
                Text(_instruction,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center),
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
                    _stepDot('Face', _currentStep.index >= 1),
                    _stepLine(_currentStep.index >= 2),
                    _stepDot('Smile', _currentStep.index >= 2),
                    _stepLine(_currentStep.index >= 3),
                    _stepDot('Blink', _currentStep.index >= 3),
                  ],
                ),
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
                const SizedBox(height: 30),
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
