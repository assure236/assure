import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class ApiService {
  static String get baseUrl => AppConfig.apiBaseUrl;
  static String get socketUrl => AppConfig.socketUrl;
  static const _timeout = Duration(seconds: 30);

  /// Callback set by AuthProvider to handle forced logout on 401
  static Future<void> Function()? onUnauthorized;

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 401 && onUnauthorized != null) {
      await onUnauthorized!();
    }
    return body;
  }

  static Future<Map<String, dynamic>> get(String endpoint) async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    ).timeout(_timeout);

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> post(
      String endpoint, Map<String, dynamic> data) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode(data),
    ).timeout(_timeout);

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> put(
      String endpoint, Map<String, dynamic> data) async {
    final token = await _getToken();
    final response = await http.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode(data),
    );

    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> delete(String endpoint) async {
    final token = await _getToken();
    final response = await http.delete(
      Uri.parse('$baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
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
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl$endpoint'),
    );
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
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
