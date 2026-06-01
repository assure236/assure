import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../../core/utils/face_confidence.dart';
import '../services/onboarding_api.dart';

// ─── Face-guide overlay painter ──────────────────────────────────────────────

class _FaceGuidePainter extends CustomPainter {
  final bool isAligned;
  final double progress; // 0.0 → 1.0

  const _FaceGuidePainter({required this.isAligned, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    // Circle sits in the upper-center of the screen
    final center = Offset(size.width / 2, size.height * 0.42);
    final radius = size.width * 0.40;

    // Dimmed overlay with circular cutout
    canvas.drawPath(
      Path()
        ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
        ..addOval(Rect.fromCircle(center: center, radius: radius))
        ..fillType = PathFillType.evenOdd,
      Paint()..color = Colors.black.withOpacity(0.54),
    );

    // Guide ring: red when not aligned, faint green when aligned
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = (isAligned ? Colors.green : Colors.red).withOpacity(0.75)
        ..strokeWidth = 3.5
        ..style = PaintingStyle.stroke,
    );

    // Progress arc (bright green, sweeps clockwise from top)
    if (progress > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius + 8),
        -math.pi / 2,
        2 * math.pi * progress,
        false,
        Paint()
          ..color = Colors.greenAccent
          ..strokeWidth = 7
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_FaceGuidePainter old) =>
      old.isAligned != isAligned || old.progress != progress;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

class FaceStepScreen extends StatefulWidget {
  const FaceStepScreen({super.key});

  @override
  State<FaceStepScreen> createState() => _FaceStepScreenState();
}

class _FaceStepScreenState extends State<FaceStepScreen>
    with WidgetsBindingObserver, TickerProviderStateMixin {
  // ── Camera ────────────────────────────────────────────────────────────────
  CameraController? _ctrl;
  bool _cameraReady = false;
  String? _cameraError;

  // ── Face detector ─────────────────────────────────────────────────────────
  late final FaceDetector _detector;
  bool _processingFrame = false;

  // ── Alignment / progress state ────────────────────────────────────────────
  bool _isAligned = false;
  double _progress = 0.0;
  int _goodFrames = 0;
  static const int _requiredGoodFrames = 6; // ~3 s at ~2 fps
  String _guideText = 'Place your face inside the circle';

  // ── Liveness signals (collected during alignment window) ─────────────────
  int _blinkCount = 0;
  final List<double> _yawHistory = [];

  // ── Capture / submit ──────────────────────────────────────────────────────
  bool _capturing = false;
  String? _error;

  // ── Frame throttle ────────────────────────────────────────────────────────
  int _frameCounter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _detector = FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.fast,
        enableClassification: true,
      ),
    );
    _initCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ctrl?.dispose();
    _detector.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) {
      _ctrl?.dispose();
    } else if (state == AppLifecycleState.resumed && !_cameraReady) {
      _initCamera();
    }
  }

  // ── Camera init ───────────────────────────────────────────────────────────

  Future<void> _initCamera() async {
    setState(() {
      _cameraReady = false;
      _cameraError = null;
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
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.nv21
            : ImageFormatGroup.bgra8888,
      );

      await ctrl.initialize();
      if (!mounted) return;

      // Lock to portrait so the preview and coordinates stay consistent
      await ctrl.lockCaptureOrientation(DeviceOrientation.portraitUp);

      setState(() {
        _ctrl = ctrl;
        _cameraReady = true;
      });

      ctrl.startImageStream(_onFrame);
    } catch (e) {
      if (mounted) {
        setState(() {
          _cameraError = 'Camera unavailable: $e';
        });
      }
    }
  }

  // ── Frame stream processing ────────────────────────────────────────────────

  void _onFrame(CameraImage image) {
    // Process roughly every 12th frame (~2.5 fps at 30 fps)
    if (++_frameCounter % 12 != 0) return;
    if (_processingFrame || _capturing) return;
    _processFrame(image);
  }

  Future<void> _processFrame(CameraImage image) async {
    _processingFrame = true;
    try {
      final inputImage = _toInputImage(image);
      if (inputImage == null) return;

      final faces = await _detector.processImage(inputImage);
      if (!mounted) return;

      if (faces.length != 1) {
        _onBadFrame(
          faces.isEmpty
              ? 'Place your face inside the circle'
              : 'Only one face should be visible',
        );
        return;
      }

      final face = faces.first;

      // ── Normalise face position to [0,1] in portrait display space ─────────
      // MLKit returns bounding boxes in the rotated display space, whose
      // dimensions are (image.height × image.width) for 90°/270° sensors.
      final sensorOri = _ctrl?.description.sensorOrientation ?? 0;
      final bool swapAxes = sensorOri == 90 || sensorOri == 270;
      final displayW = (swapAxes ? image.height : image.width).toDouble();
      final displayH = (swapAxes ? image.width : image.height).toDouble();

      final boxCX = (face.boundingBox.left + face.boundingBox.width / 2) / displayW;
      final boxCY = (face.boundingBox.top + face.boundingBox.height / 2) / displayH;
      final faceRatio = (face.boundingBox.width * face.boundingBox.height) /
          (displayW * displayH);

      // ── Liveness tracking ─────────────────────────────────────────────────
      final yaw = face.headEulerAngleY ?? 0;
      _yawHistory.add(yaw);
      if (_yawHistory.length > 24) _yawHistory.removeAt(0);

      final lEye = face.leftEyeOpenProbability ?? 1.0;
      final rEye = face.rightEyeOpenProbability ?? 1.0;
      if (lEye < 0.30 && rEye < 0.30) _blinkCount++;

      // ── Alignment checks ──────────────────────────────────────────────────
      if (faceRatio < 0.06) {
        _onBadFrame('Move closer to the camera');
        return;
      }
      if (faceRatio > 0.65) {
        _onBadFrame('Too close — move the phone back');
        return;
      }
      if ((boxCX - 0.5).abs() > 0.26 || (boxCY - 0.5).abs() > 0.28) {
        _onBadFrame('Centre your face in the circle');
        return;
      }

      _onGoodFrame();
    } finally {
      _processingFrame = false;
    }
  }

  void _onBadFrame(String text) {
    if (!mounted) return;
    setState(() {
      _isAligned = false;
      _goodFrames = 0;
      _progress = 0;
      _guideText = text;
    });
  }

  void _onGoodFrame() {
    if (!mounted || _capturing) return;
    _goodFrames++;
    final p = (_goodFrames / _requiredGoodFrames).clamp(0.0, 1.0);
    setState(() {
      _isAligned = true;
      _progress = p;
      _guideText = p >= 1.0 ? 'Capturing…' : 'Hold still…';
    });
    if (_goodFrames >= _requiredGoodFrames) {
      _capture();
    }
  }

  // ── Auto-capture ──────────────────────────────────────────────────────────

  Future<void> _capture() async {
    if (_capturing) return;
    _capturing = true;

    try {
      await _ctrl?.stopImageStream();
    } catch (_) {}

    setState(() {
      _error = null;
      _guideText = 'Analysing…';
    });

    try {
      final xFile = await _ctrl!.takePicture();
      final yawVariance = _computeYawVariance();

      // Full spoof + quality check on the captured JPEG
      final result = await evaluateFaceConfidence(
        xFile.path,
        minPassPercent: 60,
        maxSpoofRiskPercent: 45,
        blinkCount: _blinkCount,
        yawVariance: yawVariance,
      );

      if (!mounted) return;

      if (!result.passed) {
        _resetForRetry(result.message);
        return;
      }

      // Submit to backend
      final res = await OnboardingApi.verifyFace(
        xFile.path,
        confidencePercent: result.confidencePercent,
        extraFields: {
          'spoof_risk_percent': result.spoofRiskPercent.toString(),
          'blink_count': _blinkCount.toString(),
          'yaw_variance': yawVariance.toStringAsFixed(2),
          'anti_spoof_version': 'live-camera-v1',
        },
      );

      if (res['success'] == true) {
        if (mounted) context.go('/onboarding/bank');
      } else {
        _resetForRetry(
            res['message']?.toString() ?? 'Verification failed. Please retry.');
      }
    } catch (e) {
      _resetForRetry('Capture error: $e');
    }
  }

  void _resetForRetry(String errorMsg) {
    if (!mounted) return;
    _blinkCount = 0;
    _yawHistory.clear();
    _goodFrames = 0;
    _capturing = false;
    setState(() {
      _error = errorMsg;
      _isAligned = false;
      _progress = 0;
      _guideText = 'Place your face inside the circle';
    });
    try {
      _ctrl?.startImageStream(_onFrame);
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  double _computeYawVariance() {
    if (_yawHistory.length < 2) return 0;
    final mean = _yawHistory.reduce((a, b) => a + b) / _yawHistory.length;
    return _yawHistory
            .map((y) => (y - mean) * (y - mean))
            .reduce((a, b) => a + b) /
        _yawHistory.length;
  }

  InputImage? _toInputImage(CameraImage image) {
    final description = _ctrl?.description;
    if (description == null) return null;

    final rotation =
        InputImageRotationValue.fromRawValue(description.sensorOrientation);
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null || image.planes.isEmpty) return null;

    // Concatenate all planes (needed for NV21 on Android)
    Uint8List bytes;
    if (image.planes.length == 1) {
      bytes = image.planes.first.bytes;
    } else {
      final buf = WriteBuffer();
      for (final plane in image.planes) {
        buf.putUint8List(plane.bytes);
      }
      bytes = buf.done().buffer.asUint8List();
    }

    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_cameraError != null) return _buildErrorScreen();
    if (!_cameraReady || _ctrl == null) return _buildLoadingScreen();

    final ctrl = _ctrl!;
    final previewSize = ctrl.value.previewSize; // width × height in landscape

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(children: [
          // ── Full-screen camera preview ──────────────────────────────────
          SizedBox.expand(
            child: previewSize == null
                ? const SizedBox.shrink()
                : FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      // previewSize is in landscape orientation; swap for portrait
                      width: previewSize.height,
                      height: previewSize.width,
                      child: CameraPreview(ctrl),
                    ),
                  ),
          ),

          // ── Guide overlay ───────────────────────────────────────────────
          CustomPaint(
            painter:
                _FaceGuidePainter(isAligned: _isAligned, progress: _progress),
            child: const SizedBox.expand(),
          ),

          // ── Guide text ──────────────────────────────────────────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 110,
            child: Text(
              _guideText,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
                shadows: [Shadow(color: Colors.black87, blurRadius: 14)],
              ),
            ),
          ),

          // ── Error pill ──────────────────────────────────────────────────
          if (_error != null)
            Positioned(
              left: 20,
              right: 20,
              bottom: 56,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.red.shade800.withOpacity(0.90),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),

          // ── Spinner while capturing / submitting ────────────────────────
          if (_capturing)
            Container(
              color: Colors.black38,
              child: const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ),

          // ── Back button ─────────────────────────────────────────────────
          Positioned(
            top: 10,
            left: 10,
            child: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new,
                  color: Colors.white, size: 22),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ),

          // ── Step label ──────────────────────────────────────────────────
          Positioned(
            top: 18,
            left: 0,
            right: 0,
            child: Text(
              'Face Verification — Step 2 of 5',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.72),
                fontSize: 12,
                shadows: const [Shadow(color: Colors.black87, blurRadius: 8)],
              ),
            ),
          ),

          // ── Hint at bottom ──────────────────────────────────────────────
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Text(
              'Keep your face in the circle for 3 seconds',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.55),
                fontSize: 12,
                shadows: const [Shadow(color: Colors.black87, blurRadius: 6)],
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildLoadingScreen() {
    return const Scaffold(
      backgroundColor: Colors.black,
      body: Center(child: CircularProgressIndicator(color: Colors.white)),
    );
  }

  Widget _buildErrorScreen() {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.camera_alt_outlined,
                  size: 64, color: Colors.white54),
              const SizedBox(height: 16),
              Text(
                _cameraError ?? 'Camera unavailable',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _initCamera,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
