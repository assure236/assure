/// App environment configuration.
/// Use --dart-define to switch environments and URLs at build time.
class AppConfig {
  static const _envName = String.fromEnvironment('APP_ENV', defaultValue: 'production');
  static const _backendOverride = String.fromEnvironment('BACKEND_URL', defaultValue: '');

  // ──── Development (local WiFi) ────
  static const _devBackend = String.fromEnvironment('DEV_BACKEND_URL', defaultValue: 'http://192.168.0.160:5000');

  // ──── Production (Hostinger) ────
  static const _prodBackend = String.fromEnvironment('PROD_BACKEND_URL', defaultValue: 'https://api.assure.fund');

  static Environment get _env => _envName.toLowerCase() == 'development'
      ? Environment.development
      : Environment.production;

  // ──── Derived URLs ────
  static String get backendUrl {
    if (_backendOverride.isNotEmpty) return _backendOverride;
    return _env == Environment.production ? _prodBackend : _devBackend;
  }

  static String get apiBaseUrl => '$backendUrl/api/v1';

  static String get socketUrl => backendUrl;

  static bool get isProduction => _env == Environment.production;
}

enum Environment { development, production }
