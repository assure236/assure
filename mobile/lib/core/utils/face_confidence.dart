import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

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

/// Evaluates face quality and spoof risk from a captured image file.
///
/// [blinkCount] and [yawVariance] are optional liveness signals collected
/// from the live camera stream before capture. Pass 0 if unknown (single-shot).
Future<FaceConfidenceResult> evaluateFaceConfidence(
  String imagePath, {
  int minPassPercent = 60,
  int maxSpoofRiskPercent = 45,
  int blinkCount = 0,
  double yawVariance = 0.0,
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

    // ── Confidence score ─────────────────────────────────────────────────────
    var score = 30.0;
    score += math.max(0, 24 - absYaw * 0.65);
    score += math.max(0, 16 - absPitch * 0.55);
    if (leftEye != null && rightEye != null) {
      score += 20 * ((leftEye + rightEye) / 2).clamp(0.0, 1.0);
    } else {
      score += 10;
    }
    final confidence = score.clamp(0, 100).round();

    // ── Spoof risk from static-image + liveness signals ───────────────────────
    // Signals that indicate a printed / screen photo:
    double spoofRisk = 10;

    // 1. Perfect neutral angle — real selfies have slight natural tilt
    if (absYaw < 1.5 && absPitch < 1.5) spoofRisk += 12;

    // 2. Suspiciously identical eye openness — photos often have both eyes
    //    at exactly the same probability (MLKit interpolates from a flat texture)
    if (leftEye != null && rightEye != null) {
      if (leftEye < 0.08 && rightEye < 0.08) spoofRisk += 18; // eyes closed in photo
      if (leftEye > 0.90 &&
          rightEye > 0.90 &&
          (leftEye - rightEye).abs() < 0.015) {
        spoofRisk += 16; // unnaturally identical — studio photo
      }
    }

    // 3. Liveness signals from live camera stream (passed by caller)
    //    Zero blinks + zero head movement = definite static image
    if (blinkCount == 0 && yawVariance < 1.0) spoofRisk += 22;
    if (yawVariance < 0.4) spoofRisk += 10;

    final spoofRiskPercent = spoofRisk.clamp(0, 100).round();

    // ── Hard-reject checks ───────────────────────────────────────────────────
    if (absYaw > 40 || absPitch > 40) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Face angle too steep. Look directly at the camera.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    if (leftEye != null && rightEye != null && leftEye < 0.07 && rightEye < 0.07) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        spoofRiskPercent: spoofRiskPercent,
        message: 'Eyes not visible. Open your eyes and look at the camera.',
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
        message: 'Screen or photo detected. Please use a live face only.',
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
        message: 'Face quality low. Improve lighting and look at the camera.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    return FaceConfidenceResult(
      passed: true,
      confidencePercent: confidence,
      spoofRiskPercent: spoofRiskPercent,
      message: 'Face verified.',
      faceCount: 1,
      yaw: yaw,
      pitch: pitch,
    );
  } catch (_) {
    return const FaceConfidenceResult(
      passed: false,
      confidencePercent: 0,
      spoofRiskPercent: 100,
      message: 'Could not analyse face. Please retake.',
      faceCount: 0,
      yaw: 0,
      pitch: 0,
    );
  } finally {
    detector.close();
  }
}
