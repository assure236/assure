import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  bool _loading = false;
  List<Map<String, dynamic>> _documents = [];
  String? _error;
  String? _uploadingType;

  static const List<Map<String, dynamic>> _docTypes = [
    {'key': 'aadhaar_card', 'label': 'Aadhaar Card (Front & Back)', 'icon': 'badge', 'maxSizeKB': 500},
    {'key': 'pan_card', 'label': 'PAN Card', 'icon': 'credit_card', 'maxSizeKB': 200},
    {'key': 'cancelled_cheque', 'label': 'Cancelled Cheque / Bank Proof', 'icon': 'account_balance', 'maxSizeKB': 400},
    {'key': 'selfie_photo', 'label': 'Live Selfie Photo', 'icon': 'camera_alt', 'maxSizeKB': 150},
  ];

  @override
  void initState() {
    super.initState();
    _fetchDocuments();
  }

  Future<void> _fetchDocuments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.get('/documents');
      if (res['success'] == true) {
        setState(() => _documents = List<Map<String, dynamic>>.from(res['data'] ?? []));
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load documents');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() => _loading = false);
    }
  }

  Map<String, dynamic>? _docForType(String key) {
    try {
      return _documents.firstWhere((d) => d['document_type'] == key);
    } catch (_) {
      return null;
    }
  }

  /// Show picker: selfie_photo = camera only, others = camera + file upload
  void _showUploadOptions(String docType) {
    if (docType == 'selfie_photo') {
      // Selfie: camera only, no choice needed
      _captureFromCamera(docType, useFrontCamera: true);
      return;
    }
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Choose Upload Method',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppTheme.primaryColor),
                title: const Text('Take Photo'),
                subtitle: const Text('Use your camera to capture'),
                onTap: () {
                  Navigator.pop(ctx);
                  _captureFromCamera(docType);
                },
              ),
              ListTile(
                leading: const Icon(Icons.upload_file, color: AppTheme.primaryColor),
                title: const Text('Upload from Gallery'),
                subtitle: const Text('Choose an existing image'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickFromGallery(docType);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _captureFromCamera(String docType, {bool useFrontCamera = false}) async {
    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: useFrontCamera ? CameraDevice.front : CameraDevice.rear,
      imageQuality: 85,
    );
    if (photo == null) return;
    await _processAndUpload(docType, photo.path, File(photo.path).lengthSync());
  }

  Future<void> _pickFromGallery(String docType) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png'],
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.path == null) {
      _showSnackBar('Could not read file path. Please try again.');
      return;
    }
    await _processAndUpload(docType, file.path!, file.size);
  }

  Future<void> _processAndUpload(String docType, String filePath, int fileSize) async {
    // Per-type size validation
    final docConfig = _docTypes.firstWhere((t) => t['key'] == docType, orElse: () => {});
    final maxSizeKB = (docConfig['maxSizeKB'] as int?) ?? 500;
    if (fileSize > maxSizeKB * 1024) {
      _showSnackBar('File too large. Max size for ${docConfig['label'] ?? docType}: $maxSizeKB KB');
      return;
    }

    setState(() => _uploadingType = docType);
    try {
      final res = await ApiService.uploadFile(
        '/documents/upload',
        filePath,
        fieldName: 'document',
        extraFields: {'document_type': docType},
      );
      if (res['success'] == true) {
        _showSnackBar('${_labelForType(docType)} uploaded successfully', isError: false);
        await _fetchDocuments();
      } else {
        _showSnackBar(res['message'] ?? 'Upload failed');
      }
    } catch (e) {
      _showSnackBar('Upload failed. Please try again.');
    } finally {
      setState(() => _uploadingType = null);
    }
  }

  String _labelForType(String key) {
    return (_docTypes.firstWhere(
        (t) => t['key'] == key, orElse: () => {'label': key})['label'] as String?) ?? key;
  }

  void _showSnackBar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? AppTheme.errorColor : AppTheme.successColor,
    ));
  }

  Future<void> _viewDocument(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _showSnackBar('Cannot open document');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Documents Vault'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchDocuments),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _buildContent(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _fetchDocuments, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final uploaded = _documents.length;
    final total = _docTypes.length;

    return RefreshIndicator(
      onRefresh: _fetchDocuments,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildProgressCard(uploaded, total),
            const SizedBox(height: 20),
            const Text('Required Documents (JPEG/PNG only)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...(_docTypes.map((dt) => _buildDocCard(dt)).toList()),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressCard(int uploaded, int total) {
    final progress = total > 0 ? uploaded / total : 0.0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Upload Progress',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                Text('$uploaded/$total',
                    style: const TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(
                    progress == 1.0 ? AppTheme.successColor : AppTheme.primaryColor),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              progress == 1.0
                  ? 'All documents uploaded!'
                  : '${total - uploaded} document(s) remaining',
              style: TextStyle(
                  color: progress == 1.0 ? AppTheme.successColor : Colors.grey,
                  fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDocCard(Map<String, dynamic> docType) {
    final key = docType['key'] as String;
    final label = docType['label'] as String;
    final maxSizeKB = docType['maxSizeKB'] as int? ?? 500;
    final doc = _docForType(key);
    final isUploading = _uploadingType == key;
    final status = doc?['verification_status'] ?? doc?['status'] ?? 'not_uploaded';
    final uploadedAt = doc?['created_at'];

    Color statusColor;
    String statusLabel;
    IconData statusIcon;

    switch (status) {
      case 'approved':
      case 'verified':
        statusColor = AppTheme.successColor;
        statusLabel = 'Approved';
        statusIcon = Icons.check_circle;
        break;
      case 'pending':
        statusColor = AppTheme.secondaryColor;
        statusLabel = 'Under Review';
        statusIcon = Icons.hourglass_empty;
        break;
      case 'rejected':
        statusColor = AppTheme.errorColor;
        statusLabel = 'Rejected';
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = Colors.grey;
        statusLabel = 'Not Uploaded';
        statusIcon = Icons.upload_file;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(_iconForType(docType['icon'] as String? ?? 'badge'),
                      color: AppTheme.primaryColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      Text('Max: $maxSizeKB KB · JPEG/PNG only',
                          style: const TextStyle(color: Colors.grey, fontSize: 11)),
                      if (uploadedAt != null)
                        Text(
                          'Uploaded ${DateFormat('dd MMM yyyy').format(DateTime.parse(uploadedAt))}',
                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, color: statusColor, size: 14),
                      const SizedBox(width: 4),
                      Text(statusLabel,
                          style: TextStyle(color: statusColor, fontSize: 11,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ],
            ),
            if (doc != null || status == 'rejected') ...[
              if (doc?['file_url'] != null) ...[
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => _viewDocument(doc!['file_url']),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      doc!['file_url'],
                      height: 120,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        height: 60,
                        color: Colors.grey.shade100,
                        child: const Center(child: Icon(Icons.broken_image, color: Colors.grey)),
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  if (doc?['file_url'] != null)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _viewDocument(doc!['file_url']),
                        icon: const Icon(Icons.visibility, size: 16),
                        label: const Text('View'),
                        style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.primaryColor),
                      ),
                    ),
                  if (doc?['file_url'] != null) const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: isUploading ? null : () => _showUploadOptions(key),
                      icon: isUploading
                          ? const SizedBox(height: 14, width: 14,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.upload, size: 16),
                      label: Text(status == 'not_uploaded' ? 'Upload' : 'Re-upload'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: status == 'rejected'
                            ? AppTheme.errorColor
                            : AppTheme.primaryColor,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: isUploading ? null : () => _showUploadOptions(key),
                  icon: isUploading
                      ? const SizedBox(height: 14, width: 14,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.upload, size: 16),
                  label: const Text('Upload Document'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData _iconForType(String iconName) {
    switch (iconName) {
      case 'credit_card': return Icons.credit_card;
      case 'account_balance': return Icons.account_balance;
      case 'camera_alt': return Icons.camera_alt;
      default: return Icons.badge;
    }
  }
}
