/// Compact INR display: 100000 → 1L (not 1.0L), 150000 → 1.5L
String formatCompactInr(double value) {
  if (value >= 100000) {
    final lakhs = value / 100000;
    final rounded = (lakhs * 10).round() / 10;
    if ((rounded - rounded.round()).abs() < 0.05) {
      return '${rounded.round()}L';
    }
    return '${rounded.toStringAsFixed(1)}L';
  }
  if (value >= 1000) {
    return '${(value / 1000).round()}K';
  }
  return value.toStringAsFixed(0);
}

String formatInvestedVsChit(double invested, double chitValue) {
  return '${formatCompactInr(invested)} / ${formatCompactInr(chitValue)}';
}
