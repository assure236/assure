import 'dart:math' as math;
import 'dart:io';
import 'dart:typed_data';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

class FaceConfidenceResult {
  final bool passed;
  final int confidencePercent;
  final int spoofRiskPercent;
  final String message;
  final int faceCount;
  final double yaw;
  final double pitch;

  const FaceConfidenceResult({
    required this.passed,
    required this.confidencePercent,
    required this.spoofRiskPercent,
    required this.message,
    required this.faceCount,
    required this.yaw,
    required this.pitch,
  });
}

class _ImageMetrics {
  final double laplacianVariance;
  final double overExposureRatio;

  const _ImageMetrics({
    required this.laplacianVariance,
    required this.overExposureRatio,
  });
}

_ImageMetrics _computeImageMetrics(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    return const _ImageMetrics(laplacianVariance: 0, overExposureRatio: 0);
  }

  final resized = decoded.width > 320 ? img.copyResize(decoded, width: 320) : decoded;
  final gray = img.grayscale(resized);

  double sum = 0;
  double sumSq = 0;
  int count = 0;
  int brightPixels = 0;

  for (int y = 1; y < gray.height - 1; y++) {
    for (int x = 1; x < gray.width - 1; x++) {
      final c = gray.getPixel(x, y).r;
      final l = gray.getPixel(x - 1, y).r;
      final r = gray.getPixel(x + 1, y).r;
      final t = gray.getPixel(x, y - 1).r;
      final b = gray.getPixel(x, y + 1).r;

      final lap = (4 * c - l - r - t - b).toDouble();
      sum += lap;
      sumSq += lap * lap;
      count++;

      if (c >= 245) {
        brightPixels++;
      }
    }
  }

  if (count == 0) {
    return const _ImageMetrics(laplacianVariance: 0, overExposureRatio: 0);
  }

  final mean = sum / count;
  final variance = (sumSq / count) - (mean * mean);
  final overExposureRatio = brightPixels / count;

  return _ImageMetrics(
    laplacianVariance: variance.isFinite ? variance : 0,
    overExposureRatio: overExposureRatio.isFinite ? overExposureRatio : 0,
  );
}

Future<FaceConfidenceResult> evaluateFaceConfidence(
  String imagePath, {
  int minPassPercent = 60,
  int maxSpoofRiskPercent = 45,
}) async {
  final detector = FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.accurate,
      enableClassification: true,
      enableContours: false,
      enableLandmarks: false,
    ),
  );

  try {
    final fileBytes = await File(imagePath).readAsBytes();
    final imageMetrics = _computeImageMetrics(fileBytes);

    final input = InputImage.fromFilePath(imagePath);
    final faces = await detector.processImage(input);

    if (faces.isEmpty) {
      return const FaceConfidenceResult(
        passed: false,
        confidencePercent: 0,
        spoofRiskPercent: 100,
        message: 'No face detected. Keep your full face visible.',
        faceCount: 0,
        yaw: 0,
        pitch: 0,
      );
    }

    if (faces.length > 1) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: 15,
        spoofRiskPercent: 95,
        message: 'Multiple faces detected. Keep only your face in frame.',
        faceCount: faces.length,
        yaw: 0,
        pitch: 0,
      );
    }

    final face = faces.first;
    final yaw = face.headEulerAngleY ?? 0;
    final pitch = face.headEulerAngleX ?? 0;
    final absYaw = yaw.abs();
    final absPitch = pitch.abs();
    final leftEye = face.leftEyeOpenProbability;
    final rightEye = face.rightEyeOpenProbability;

    final frameArea = (face.boundingBox.width * face.boundingBox.height).toDouble();
    final decoded = img.decodeImage(Uint8List.fromList(fileBytes));
    final imageArea = decoded == null
      ? 1.0
      : math.max(1.0, (decoded.width * decoded.height).toDouble());
    final faceAreaRatio = frameArea / imageArea;

    var score = 30.0; // Single-face base score

    final yawScore = math.max(0, 25 - (absYaw * 0.7));
    final pitchScore = math.max(0, 20 - (absPitch * 0.6));
    score += yawScore + pitchScore;

    if (leftEye != null && rightEye != null) {
      final eyeAvg = ((leftEye + rightEye) / 2).clamp(0, 1);
      score += 15 * eyeAvg;
    } else {
      // Some devices may not provide eye probabilities reliably.
      score += 9;
    }

    final confidence = score.clamp(0, 100).round();

    double spoofRisk = 18;
    if (imageMetrics.laplacianVariance < 85) spoofRisk += 26;
    if (imageMetrics.overExposureRatio > 0.16) spoofRisk += 22;
    if (absYaw < 2.0 && absPitch < 2.0) spoofRisk += 8;
    if (faceAreaRatio < 0.1 || faceAreaRatio > 0.72) spoofRisk += 12;
    if (leftEye != null && rightEye != null && leftEye < 0.1 && rightEye < 0.1) spoofRisk += 10;
    final spoofRiskPercent = spoofRisk.clamp(0, 100).round();

    if (absYaw > 40 || absPitch > 40) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Face angle is too high. Keep your face straight and centered.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    if (leftEye != null && rightEye != null && leftEye < 0.08 && rightEye < 0.08) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Eyes are not clearly visible. Open your eyes and retake.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    if (spoofRiskPercent > maxSpoofRiskPercent) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Possible screen/photo detected. Use a real live face capture in good light.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    if (confidence < minPassPercent) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Face quality is low. Improve lighting and keep the phone steady.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    return FaceConfidenceResult(
      passed: true,
      confidencePercent: confidence,
      spoofRiskPercent: spoofRiskPercent,
      message: 'Face quality looks good.',
      faceCount: 1,
      yaw: yaw,
      pitch: pitch,
    );
  } catch (_) {
    return const FaceConfidenceResult(
      passed: false,
      confidencePercent: 0,
      spoofRiskPercent: 100,
      message: 'Could not analyze face. Please retake your selfie.',
      faceCount: 0,
      yaw: 0,
      pitch: 0,
    );
  } finally {
    detector.close();
  }
}
