import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

/// Liveness verification using Luxand Cloud API + ML Kit smile auto-detection.
/// Flow: Tap capture → Luxand liveness → auto-detect smile → auto-capture → Luxand verify → done.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

enum _Step { ready, checking, smile, checkingSmile, done }

class _LivenessScreenState extends State<LivenessScreen> {
  CameraController? _camCtrl;
  CameraDescription? _frontCamera;
  bool _disposed = false;
  _Step _currentStep = _Step.ready;
  String _instruction = 'Position your face in the circle\nand tap Capture';
  double _progress = 0.0;
  String? _capturedPath;
  String? _errorMsg;

  // Smile auto-detection
  FaceDetector? _faceDetector;
  bool _isProcessingFrame = false;
  bool _isStreaming = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      _frontCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _camCtrl = CameraController(_frontCamera!, ResolutionPreset.high,
          enableAudio: false);
      await _camCtrl!.initialize();
      if (!_disposed && mounted) setState(() {});
    } catch (e) {
      debugPrint('Camera init error: $e');
      if (mounted) Navigator.pop(context, null);
    }
  }

  // --- Step 1: User taps Capture for face liveness ---
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

      debugPrint('Luxand face result: $result');
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

      // Face is real → save path, start smile detection
      _capturedPath = path;
      setState(() {
        _currentStep = _Step.smile;
        _instruction = 'Now smile! 😊';
        _progress = 0.5;
        _errorMsg = null;
      });
      _startSmileDetection();
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

  // --- Step 2: Auto-detect smile via ML Kit image stream ---
  void _startSmileDetection() {
    if (_disposed || _camCtrl == null || !_camCtrl!.value.isInitialized) return;

    _faceDetector ??= FaceDetector(options: FaceDetectorOptions(
      enableClassification: true,
      performanceMode: FaceDetectorMode.fast,
    ));

    _isProcessingFrame = false;
    _isStreaming = true;

    _camCtrl!.startImageStream((CameraImage image) {
      if (_isProcessingFrame || _currentStep != _Step.smile || _disposed) return;
      _isProcessingFrame = true;
      _processSmileFrame(image);
    });
  }

  Future<void> _stopStream() async {
    if (_isStreaming && _camCtrl != null) {
      try { await _camCtrl!.stopImageStream(); } catch (_) {}
      _isStreaming = false;
    }
  }

  Future<void> _processSmileFrame(CameraImage image) async {
    try {
      final inputImage = _buildInputImage(image);
      if (inputImage == null) { _isProcessingFrame = false; return; }

      final faces = await _faceDetector!.processImage(inputImage);
      if (_disposed || _currentStep != _Step.smile) {
        _isProcessingFrame = false;
        return;
      }

      if (faces.isNotEmpty && (faces.first.smilingProbability ?? 0) > 0.5) {
        // Smile detected → stop stream, capture, verify
        await _stopStream();
        if (!mounted) return;

        setState(() {
          _currentStep = _Step.checkingSmile;
          _instruction = 'Smile detected! Verifying...';
          _errorMsg = null;
        });

        // Brief delay so camera settles after stopping stream
        await Future.delayed(const Duration(milliseconds: 300));
        await _captureSmileAndVerify();
        return; // don't reset _isProcessingFrame
      }
    } catch (e) {
      debugPrint('Smile frame error: $e');
    }
    _isProcessingFrame = false;
  }

  InputImage? _buildInputImage(CameraImage image) {
    if (_frontCamera == null) return null;
    final rotation = InputImageRotationValue.fromRawValue(
        _frontCamera!.sensorOrientation);
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;

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

  // --- Smile capture + Luxand verification ---
  Future<void> _captureSmileAndVerify() async {
    try {
      final file = await _camCtrl!.takePicture();
      final path = file.path;

      final result = await ApiService.uploadFile(
        '/liveness/check', path, fieldName: 'photo');
      if (!mounted) return;

      debugPrint('Luxand smile result: $result');
      final isLive = result['live'] == true;

      if (!isLive) {
        // Rare: face was real before but not now. Restart smile detection.
        setState(() {
          _currentStep = _Step.smile;
          _errorMsg = result['message'] ?? 'Verification failed, keep smiling';
          _instruction = 'Smile again! 😊';
        });
        try { await File(path).delete(); } catch (_) {}
        _startSmileDetection();
        return;
      }

      // Success! Delete first capture, keep smiling selfie
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
    } catch (e) {
      debugPrint('Smile verify error: $e');
      if (mounted) {
        setState(() {
          _currentStep = _Step.smile;
          _errorMsg = 'Connection error. Keep smiling!';
          _instruction = 'Smile again! 😊';
        });
        _startSmileDetection();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _stopStream();
    _faceDetector?.close();
    _camCtrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool showCapture = _currentStep == _Step.ready;
    final bool showSpinner = _currentStep == _Step.checking ||
        _currentStep == _Step.checkingSmile;
    // Smile step: no button needed — auto-detection in progress

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
                else if (_currentStep == _Step.smile)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 38),
                    child: Text('Detecting smile...',
                        style: TextStyle(color: Colors.white54, fontSize: 13)),
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
