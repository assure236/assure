import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/theme/app_theme.dart';

/// Angel-Broking-style liveness check: asks user to smile, blink, turn head.
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

  @override
  void initState() {
    super.initState();
    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: true,
        enableLandmarks: true,
        enableTracking: true,
        performanceMode: FaceDetectorMode.accurate,
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
        _updateInstruction('Position your face in the circle', 0.0);
        if (_currentStep != _Step.detectFace) {
          _currentStep = _Step.detectFace;
        }
        _isProcessing = false;
        return;
      }

      final face = faces.first;
      final smileProb = face.smilingProbability ?? 0;
      final leftEyeOpen = face.leftEyeOpenProbability ?? 1;
      final rightEyeOpen = face.rightEyeOpenProbability ?? 1;

      switch (_currentStep) {
        case _Step.detectFace:
          // Face detected, move to smile step
          _currentStep = _Step.smile;
          _updateInstruction('Please smile 😊', 0.33);
          break;

        case _Step.smile:
          if (smileProb > 0.7) {
            _currentStep = _Step.blink;
            _updateInstruction('Now blink your eyes 👁️', 0.66);
          }
          break;

        case _Step.blink:
          if (leftEyeOpen < 0.3 && rightEyeOpen < 0.3) {
            _currentStep = _Step.done;
            _updateInstruction('Verified! ✅', 1.0);
            await _captureAndFinish();
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

  InputImage? _convertToInputImage(CameraImage image) {
    final camera = _camCtrl!.description;
    final sensorOrientation = camera.sensorOrientation;

    // For front camera, mirror the rotation compensation
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

    // For NV21, all data is in the first plane
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

  Future<void> _captureAndFinish() async {
    try {
      // Stop the image stream first, then wait for it to fully stop
      try {
        await _camCtrl?.stopImageStream();
      } catch (_) {}
      // Small delay to allow the camera to stabilize after stopping the stream
      await Future.delayed(const Duration(milliseconds: 300));
      final file = await _camCtrl?.takePicture();
      _capturedPath = file?.path;
      debugPrint('Captured selfie: $_capturedPath');
    } catch (e) {
      debugPrint('Capture error: $e');
      // Fallback: try capturing without stopping stream
      try {
        final file = await _camCtrl?.takePicture();
        _capturedPath = file?.path;
      } catch (_) {}
    }
    await Future.delayed(const Duration(milliseconds: 800));
    if (mounted) Navigator.pop(context, _capturedPath);
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
                // Instructions
                Text(_instruction,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center),
                const SizedBox(height: 8),
                // Progress bar
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
                // Step indicators
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
                // Camera preview in an oval (mirrored for front camera)
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
