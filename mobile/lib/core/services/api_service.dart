import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class ApiService {
  static String get baseUrl => AppConfig.apiBaseUrl;
  static String get socketUrl => AppConfig.socketUrl;
  static const _timeout = Duration(seconds: 30);
  static const _activeMemberPrefsKey = 'active_member_id';

  /// Callback set by AuthProvider to handle forced logout on 401
  static Future<void> Function()? onUnauthorized;

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<String?> _getActiveMemberId() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_activeMemberPrefsKey)?.trim();
    if (value == null || value.isEmpty) return null;
    return value.toUpperCase();
  }

  static bool _shouldAttachActiveMember(String endpoint) {
    final normalized = endpoint.toLowerCase();
    if (normalized.startsWith('/auth/')) return false;
    if (normalized.startsWith('/users/family-members')) return false;
    return true;
  }

  static Future<Uri> _buildUri(String endpoint) async {
    final base = Uri.parse('$baseUrl$endpoint');
    if (!_shouldAttachActiveMember(endpoint)) return base;

    final activeMemberId = await _getActiveMemberId();
    if (activeMemberId == null) return base;

    final qp = Map<String, String>.from(base.queryParameters);
    qp['active_member_id'] = activeMemberId;
    return base.replace(queryParameters: qp);
  }

  static Future<Map<String, String>> _buildHeaders() async {
    final token = await _getToken();
    final activeMemberId = await _getActiveMemberId();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (activeMemberId != null) 'X-Active-Member-Id': activeMemberId,
    };
  }

  static Future<Map<String, dynamic>> _handleResponse(
      http.Response response) async {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 401 && onUnauthorized != null) {
      await onUnauthorized!();
    }
    return body;
  }

  static Future<Map<String, dynamic>> get(String endpoint) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders();
    final response = await http
        .get(
          uri,
          headers: headers,
        )
        .timeout(_timeout);

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> post(
      String endpoint, Map<String, dynamic> data) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders();
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
    final headers = await _buildHeaders();
    final response = await http.put(
      uri,
      headers: headers,
      body: jsonEncode(data),
    );

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> delete(String endpoint) async {
    final uri = await _buildUri(endpoint);
    final headers = await _buildHeaders();
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
    final uri = await _buildUri(endpoint);
    final request = http.MultipartRequest(
      'POST',
      uri,
    );
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    if (activeMemberId != null) {
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
