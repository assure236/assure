import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/config/app_config.dart';

/// API wrapper for onboarding endpoints.
class OnboardingApi {
  static String get _base => AppConfig.apiBaseUrl;

  static Future<Map<String, String>> _headers({bool json = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> getStatus() async {
    final r = await http.get(Uri.parse('$_base/onboarding/status'), headers: await _headers());
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  // ── Cashfree VRS KYC ──────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> verifyPanKyc(String panNumber) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/verify-pan'),
      headers: await _headers(),
      body: jsonEncode({'pan_number': panNumber.toUpperCase().trim()}),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> sendAadhaarOtp(String aadhaarNumber) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/aadhaar/send-otp'),
      headers: await _headers(),
      body: jsonEncode({'aadhaar_number': aadhaarNumber.replaceAll(RegExp(r'\D'), '')}),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> verifyAadhaarOtp({
    required String aadhaarNumber,
    required String refId,
    required String otp,
  }) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/aadhaar/verify-otp'),
      headers: await _headers(),
      body: jsonEncode({
        'aadhaar_number': aadhaarNumber.replaceAll(RegExp(r'\D'), ''),
        'ref_id': refId,
        'otp': otp.trim(),
      }),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> createCashfreeDigilockerUrl({String userFlow = 'signup'}) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/digilocker/create-url'),
      headers: await _headers(),
      body: jsonEncode({'user_flow': userFlow}),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> syncCashfreeDigilocker({
    String? verificationId,
    int? referenceId,
  }) async {
    final body = <String, dynamic>{
      if (verificationId != null && verificationId.trim().isNotEmpty) 'verification_id': verificationId.trim(),
      if (referenceId != null) 'reference_id': referenceId,
    };
    final r = await http.post(
      Uri.parse('$_base/onboarding/digilocker/sync'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> getDigilockerAuthUrl() async {
    final r = await http.get(Uri.parse('$_base/digilocker/auth-url?platform=mobile'), headers: await _headers());
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> submitManualKyc({
    required String panNumber,
    required String aadhaarNumber,
    required String panFilePath,
    required String aadhaarFrontPath,
    String? aadhaarBackPath,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$_base/onboarding/manual-kyc'));
    req.headers.addAll(await _headers(json: false));
    req.fields['pan_number'] = panNumber;
    req.fields['aadhaar_number'] = aadhaarNumber;
    req.files.add(await http.MultipartFile.fromPath('pan', panFilePath, contentType: _mime(panFilePath)));
    req.files.add(await http.MultipartFile.fromPath('aadhaar_front', aadhaarFrontPath, contentType: _mime(aadhaarFrontPath)));
    if (aadhaarBackPath != null) {
      req.files.add(await http.MultipartFile.fromPath('aadhaar_back', aadhaarBackPath, contentType: _mime(aadhaarBackPath)));
    }
    final s = await req.send();
    final r = await http.Response.fromStream(s);
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> verifyFace(
    String selfiePath, {
    int? confidencePercent,
    Map<String, String>? extraFields,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$_base/onboarding/face-verify'));
    req.headers.addAll(await _headers(json: false));
    if (confidencePercent != null) {
      req.fields['confidence_percent'] = confidencePercent.toString();
    }
    if (extraFields != null && extraFields.isNotEmpty) {
      req.fields.addAll(extraFields);
    }
    req.files.add(await http.MultipartFile.fromPath('photo', selfiePath, contentType: _mime(selfiePath)));
    try {
      final s = await req.send().timeout(const Duration(seconds: 35));
      final r = await http.Response.fromStream(s).timeout(const Duration(seconds: 35));
      if (r.body.isEmpty) {
        return {
          'success': false,
          'message': 'Face verification returned an empty response. Please retry.',
        };
      }
      return jsonDecode(r.body) as Map<String, dynamic>;
    } on TimeoutException {
      return {
        'success': false,
        'message': 'Face verification timed out. Please retry in good network.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Face verification failed. Please try again.',
      };
    }
  }

  static Future<Map<String, dynamic>> saveBank({required String accountNumber, required String ifsc}) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/bank'),
      headers: await _headers(),
      body: jsonEncode({'account_number': accountNumber, 'ifsc_code': ifsc}),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> uploadCheque(String filePath) async {
    final req = http.MultipartRequest('POST', Uri.parse('$_base/onboarding/cheque'));
    req.headers.addAll(await _headers(json: false));
    req.files.add(await http.MultipartFile.fromPath('cheque', filePath, contentType: _mime(filePath)));
    final s = await req.send();
    final r = await http.Response.fromStream(s);
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> skipCheque() async {
    final r = await http.post(Uri.parse('$_base/onboarding/cheque/skip'), headers: await _headers());
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> saveAddress(Map<String, dynamic> body) async {
    final r = await http.post(
      Uri.parse('$_base/onboarding/address'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> complete() async {
    final r = await http.post(Uri.parse('$_base/onboarding/complete'), headers: await _headers());
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> tourComplete() async {
    final r = await http.post(Uri.parse('$_base/onboarding/tour-complete'), headers: await _headers());
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  static MediaType _mime(String path) {
    final ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg': return MediaType('image', 'jpeg');
      case 'png': return MediaType('image', 'png');
      case 'pdf': return MediaType('application', 'pdf');
      default: return MediaType('application', 'octet-stream');
    }
  }
}

/// Maps backend's `next_step` to mobile route.
String onboardingNextRoute(String? nextStep) {
  switch (nextStep) {
    case 'digilocker': return '/onboarding/digilocker';
    case 'face_match': return '/onboarding/face';
    case 'bank': return '/onboarding/bank';
    case 'cheque': return '/onboarding/cheque';
    case 'address': return '/onboarding/address';
    case 'complete': return '/onboarding/done';
    default: return '/onboarding/digilocker';
  }
}
