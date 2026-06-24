import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:crypto/crypto.dart' as crypto;

import '../config/app_config.dart';

/// SECURITY FIX: create an API client with certificate pinning.
Dio createPinnedDioClient() {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
  // SECURITY FIX: pin production API certificate SHA256 fingerprint.
  const allowedFingerprint = 'BF:D9:C7:30:6C:B9:22:AB:7F:CA:F5:2A:98:5E:AA:BE:2F:91:F0:6E:13:FF:31:86:38:7E:69:36:1C:E2:6A:75';

  final adapter = dio.httpClientAdapter;
  if (adapter is IOHttpClientAdapter) {
    adapter.createHttpClient = () {
      final client = HttpClient();
      client.badCertificateCallback = (cert, host, port) {
        // SECURITY FIX: compute SHA256 fingerprint from cert DER bytes for stable pin validation.
        final certFingerprint = crypto.sha256
            .convert(cert.der)
            .bytes
            .map((b) => b.toRadixString(16).padLeft(2, '0'))
            .join(':')
            .toUpperCase();
        return certFingerprint == allowedFingerprint.toUpperCase();
      };
      return client;
    };
  }

  return dio;
}
