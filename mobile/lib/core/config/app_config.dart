/// App environment configuration.
/// Change [_env] to switch between development (local) and production (Hostinger).
class AppConfig {
  // ──── Toggle this to switch environments ────
  static const _env = Environment.production;

  // ──── Development (local WiFi) ────
  static const _devBackend = 'http://192.168.0.160:5000';

  // ──── Production (Hostinger) ────
  static const _prodBackend = 'https://api.assure.fund';

  // ──── Derived URLs ────
  static String get backendUrl =>
      _env == Environment.production ? _prodBackend : _devBackend;

  static String get apiBaseUrl => '$backendUrl/api/v1';

  static String get socketUrl => backendUrl;

  static bool get isProduction => _env == Environment.production;
}

enum Environment { development, production }
