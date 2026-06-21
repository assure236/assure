// Legacy face confidence utils — MLKit removed. Kept as stub for compatibility.
class FaceAnalysis {
  final bool passed;
  final int confidencePercent;
  final String message;
  const FaceAnalysis({required this.passed, required this.confidencePercent, required this.message});
}

/// Always passes — real liveness is handled by backend (Cashfree).
Future<FaceAnalysis> evaluateFaceConfidence(String imagePath) async {
  return const FaceAnalysis(passed: true, confidencePercent: 100, message: 'Verified by server');
}
