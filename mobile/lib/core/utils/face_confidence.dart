import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class FaceConfidenceResult {
  final bool passed;
  final int confidencePercent;
  final String message;
  final int faceCount;
  final double yaw;
  final double pitch;

  const FaceConfidenceResult({
    required this.passed,
    required this.confidencePercent,
    required this.message,
    required this.faceCount,
    required this.yaw,
    required this.pitch,
  });
}

Future<FaceConfidenceResult> evaluateFaceConfidence(
  String imagePath, {
  int minPassPercent = 55,
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
        message: 'Multiple faces detected. Keep only your face in frame.',
        faceCount: faces.length,
        yaw: 0,
        pitch: 0,
      );
    }

    final face = faces.first;
    final yaw = (face.headEulerAngleY ?? 0).abs();
    final pitch = (face.headEulerAngleX ?? 0).abs();
    final leftEye = face.leftEyeOpenProbability;
    final rightEye = face.rightEyeOpenProbability;

    var score = 30.0; // Single-face base score

    final yawScore = math.max(0, 25 - (yaw * 0.7));
    final pitchScore = math.max(0, 20 - (pitch * 0.6));
    score += yawScore + pitchScore;

    if (leftEye != null && rightEye != null) {
      final eyeAvg = ((leftEye + rightEye) / 2).clamp(0, 1);
      score += 15 * eyeAvg;
    } else {
      // Some devices may not provide eye probabilities reliably.
      score += 9;
    }

    final confidence = score.clamp(0, 100).round();

    if (yaw > 40 || pitch > 40) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
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
        message: 'Eyes are not clearly visible. Open your eyes and retake.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    if (confidence < minPassPercent) {
      return FaceConfidenceResult(
        passed: false,
        confidencePercent: confidence,
        message: 'Face quality is low. Improve lighting and keep the phone steady.',
        faceCount: 1,
        yaw: yaw,
        pitch: pitch,
      );
    }

    return FaceConfidenceResult(
      passed: true,
      confidencePercent: confidence,
      message: 'Face quality looks good.',
      faceCount: 1,
      yaw: yaw,
      pitch: pitch,
    );
  } catch (_) {
    return const FaceConfidenceResult(
      passed: false,
      confidencePercent: 0,
      message: 'Could not analyze face. Please retake your selfie.',
      faceCount: 0,
      yaw: 0,
      pitch: 0,
    );
  } finally {
    detector.close();
  }
}
