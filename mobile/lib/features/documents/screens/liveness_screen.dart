import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

/// Simple selfie capture for profile photo / document selfie.
/// No MLKit — backend handles liveness via Cashfree.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key});
  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

class _LivenessScreenState extends State<LivenessScreen> {
  bool _capturing = false;
  String? _errorMsg;

  Future<void> _capture() async {
    setState(() { _capturing = true; _errorMsg = null; });
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
        maxWidth: 1200,
        maxHeight: 1200,
      );
      if (photo == null) {
        setState(() => _capturing = false);
        return;
      }
      final result = await ApiService.uploadFile(
        '/liveness/verify-and-save',
        photo.path,
        fieldName: 'photo',
      );
      if (!mounted) return;
      if (result['success'] == true) {
        Navigator.pop(context, 'saved');
      } else {
        setState(() {
          _errorMsg = result['message']?.toString() ?? 'Verification failed. Please try again.';
          _capturing = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _errorMsg = 'Connection error. Please try again.'; _capturing = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Selfie Verification'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.face_retouching_natural, size: 100, color: Colors.white24),
              const SizedBox(height: 24),
              const Text('Take a clear front-face selfie',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center),
              const SizedBox(height: 8),
              const Text('Make sure your face is well-lit and clearly visible.',
                  style: TextStyle(color: Colors.white60, fontSize: 13),
                  textAlign: TextAlign.center),
              if (_errorMsg != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(30),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.errorColor.withAlpha(80)),
                  ),
                  child: Text(_errorMsg!, style: const TextStyle(color: Colors.redAccent, fontSize: 13), textAlign: TextAlign.center),
                ),
              ],
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _capturing ? null : _capture,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _capturing
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.camera_alt),
                  label: Text(_capturing ? 'Verifying...' : 'Take Selfie'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
