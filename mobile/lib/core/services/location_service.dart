import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Service for recording GPS location during agreement signing and auction events.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  /// Request permission and get the current position.
  /// Returns null if permission denied or location unavailable.
  Future<Position?> getCurrentPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('LocationService: Location services disabled');
        return null;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('LocationService: Permission denied');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('LocationService: Permission permanently denied');
        return null;
      }

      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (e) {
      debugPrint('LocationService error: $e');
      return null;
    }
  }

  /// Get location as a simple map (for sending to API).
  Future<Map<String, dynamic>?> getLocationData() async {
    final pos = await getCurrentPosition();
    if (pos == null) return null;
    return {
      'latitude': pos.latitude,
      'longitude': pos.longitude,
      'accuracy': pos.accuracy,
      'timestamp': pos.timestamp.toIso8601String(),
    };
  }
}
