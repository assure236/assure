import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class ApiService {
  static String get baseUrl => AppConfig.apiBaseUrl;
  static String get socketUrl => AppConfig.socketUrl;
  static const _timeout = Duration(seconds: 30);
  static const _activeMemberPrefsKey = 'active_member_id';
  static const _secureStorage = FlutterSecureStorage();

  /// Callback set by AuthProvider to handle forced logout on 401
  static Future<void> Function()? onUnauthorized;

  static bool _isRefreshing = false;

  static Future<bool> tryRefreshAccessToken() async {
    if (_isRefreshing) return false;
    _isRefreshing = true;
    try {
      final refreshToken = await _secureStorage.read(key: 'refresh_token');
      if (refreshToken == null || refreshToken.isEmpty) return false;

      final response = await http
          .post(
            Uri.parse('$baseUrl/auth/refresh-token'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(_timeout);

      if (response.statusCode != 200) return false;
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (body['success'] != true) return false;

      final data = body['data'] as Map<String, dynamic>?;
      final accessToken = data?['token']?.toString();
      if (accessToken == null || accessToken.isEmpty) return false;

      await _secureStorage.write(key: 'access_token', value: accessToken);
      final rotatedRefresh = data?['refreshToken']?.toString();
      if (rotatedRefresh != null && rotatedRefresh.isNotEmpty) {
        await _secureStorage.write(key: 'refresh_token', value: rotatedRefresh);
      }
      return true;
    } catch (_) {
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  static Future<http.Response> _sendGet(Uri uri, Map<String, String> headers) {
    return http.get(uri, headers: headers).timeout(_timeout);
  }

  static Future<http.Response> _sendPost(
    Uri uri,
    Map<String, String> headers,
    Map<String, dynamic> data,
  ) {
    return http
        .post(uri, headers: headers, body: jsonEncode(data))
        .timeout(_timeout);
  }

  static Future<String?> _getToken() async {
    // SECURITY FIX: fetch auth token only from encrypted secure storage.
    return _secureStorage.read(key: 'access_token');
  }

  static Future<String?> _getActiveMemberId() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_activeMemberPrefsKey)?.trim();
    if (value == null || value.isEmpty) return null;
    return value.toUpperCase();
  }

  static bool _shouldAttachActiveMember(String endpoint) {
    final normalized = endpoint.toLowerCase();
    // QR web login should follow the selected family member on mobile.
    if (normalized == '/auth/qr-confirm') return true;
    if (normalized.startsWith('/auth/')) return false;
    if (normalized.startsWith('/users/family-members')) return false;
    return true;
  }

  static Future<Uri> _buildUri(String endpoint, {bool includeActiveMember = true}) async {
    final base = Uri.parse('$baseUrl$endpoint');
    if (!includeActiveMember || !_shouldAttachActiveMember(endpoint)) return base;

    final activeMemberId = await _getActiveMemberId();
    if (activeMemberId == null) return base;

    final qp = Map<String, String>.from(base.queryParameters);
    qp['active_member_id'] = activeMemberId;
    return base.replace(queryParameters: qp);
  }

  static Future<Map<String, String>> _buildHeaders(String endpoint, {bool includeActiveMember = true}) async {
    final token = await _getToken();
    final activeMemberId = await _getActiveMemberId();
    final attachActiveMember = includeActiveMember && _shouldAttachActiveMember(endpoint);
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (attachActiveMember && activeMemberId != null)
        'X-Active-Member-Id': activeMemberId,
    };
  }

  static Future<Map<String, dynamic>> _handleResponse(
      http.Response response,
      {String? retryEndpoint, Future<http.Response> Function()? retry}) async {
    if (response.statusCode == 401 &&
        retryEndpoint != null &&
        retryEndpoint != '/auth/refresh-token' &&
        retry != null) {
      final refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        final retryResponse = await retry();
        return _handleResponse(retryResponse);
      }
      if (onUnauthorized != null) {
        await onUnauthorized!();
      }
    } else if (response.statusCode == 401 && onUnauthorized != null) {
      await onUnauthorized!();
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body;
  }

  static Future<Map<String, dynamic>> get(String endpoint) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders(endpoint);
    var response = await _sendGet(uri, headers);

    return _handleResponse(
      response,
      retryEndpoint: endpoint,
      retry: () async {
        final retryHeaders = await _buildHeaders(endpoint);
        return _sendGet(uri, retryHeaders);
      },
    );
  }

  static Future<Map<String, dynamic>> getWithoutActiveMember(String endpoint) async {
    final uri = await _buildUri(endpoint, includeActiveMember: false);
    final headers = await _buildHeaders(endpoint, includeActiveMember: false);
    var response = await _sendGet(uri, headers);

    return _handleResponse(
      response,
      retryEndpoint: endpoint,
      retry: () async {
        final retryHeaders = await _buildHeaders(endpoint, includeActiveMember: false);
        return _sendGet(uri, retryHeaders);
      },
    );
  }

  static Future<Map<String, dynamic>> post(
      String endpoint, Map<String, dynamic> data) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders(endpoint);
    final response = await _sendPost(uri, headers, data);

    return _handleResponse(
      response,
      retryEndpoint: endpoint,
      retry: () async {
        final retryHeaders = await _buildHeaders(endpoint);
        return _sendPost(uri, retryHeaders, data);
      },
    );
  }

  /// Account-level auth calls must never carry the family-member switch header.
  static Future<Map<String, dynamic>> postWithoutActiveMember(
      String endpoint, Map<String, dynamic> data) async {
    final uri = await _buildUri(endpoint, includeActiveMember: false);
    final headers = await _buildHeaders(endpoint, includeActiveMember: false);
    final response = await http
        .post(
          uri,
          headers: headers,
          body: jsonEncode(data),
        )
        .timeout(_timeout);

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> put(
      String endpoint, Map<String, dynamic> data) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders(endpoint);
    final response = await http.put(
      uri,
      headers: headers,
      body: jsonEncode(data),
    );

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> delete(String endpoint) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders(endpoint);
    final response = await http.delete(
      uri,
      headers: headers,
    );

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadFile(
    String endpoint,
    String filePath, {
    String fieldName = 'file',
    Map<String, String>? extraFields,
  }) async {
    final token = await _getToken();
    final activeMemberId = await _getActiveMemberId();
    final attachActiveMember = _shouldAttachActiveMember(endpoint);
    final uri = await _buildUri(endpoint);
    final request = http.MultipartRequest(
      'POST',
      uri,
    );
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    if (attachActiveMember && activeMemberId != null) {
      request.headers['X-Active-Member-Id'] = activeMemberId;
    }
    // Determine MIME type from file extension (MultipartFile.fromPath often sends application/octet-stream)
    final ext = filePath.split('.').last.toLowerCase();
    final mimeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
    };
    final mimeType = mimeMap[ext] ?? 'application/octet-stream';
    final parts = mimeType.split('/');
    request.files.add(await http.MultipartFile.fromPath(
      fieldName,
      filePath,
      contentType: MediaType(parts[0], parts[1]),
    ));
    if (extraFields != null) {
      request.fields.addAll(extraFields);
    }
    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamed);
    return jsonDecode(response.body);
  }
}
