import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import 'liveness_screen.dart';

class DocumentsScreen extends StatefulWidget {
  final String? digilockerStatus;
  const DocumentsScreen({super.key, this.digilockerStatus});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> with WidgetsBindingObserver {
  bool _loading = false;
  List<Map<String, dynamic>> _documents = [];
  String? _error;
  String? _uploadingType;
  Map<String, dynamic>? _kycStatus;
  bool _digilockerLoading = false;
  bool _awaitingDigilocker = false;

  static const List<Map<String, dynamic>> _docTypes = [
    {'key': 'aadhaar_card', 'label': 'Aadhaar Card (Front & Back)', 'icon': 'badge'},
    {'key': 'pan_card', 'label': 'PAN Card', 'icon': 'credit_card'},
    {'key': 'cancelled_cheque', 'label': 'Cancelled Cheque / Bank Proof', 'icon': 'account_balance'},
    {'key': 'selfie_photo', 'label': 'Live Selfie Photo', 'icon': 'camera_alt'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetchDocuments();
    _fetchKycStatus();
    // Handle deep link return from DigiLocker
    if (widget.digilockerStatus != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleDeepLinkDigilocker(widget.digilockerStatus!);
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingDigilocker) {
      _awaitingDigilocker = false;
      _handleDigilockerReturn();
    }
  }

  Future<void> _handleDigilockerReturn() async {
    _showSnackBar('Checking DigiLocker status...', isError: false);
    await Future.wait([_fetchDocuments(), _fetchKycStatus()]);
    if (!mounted) return;
    final connected = _kycStatus?['digilocker_connected'] == true ||
        _kycStatus?['digilocker_id'] != null;
    if (connected) {
      _showSnackBar('DigiLocker connected successfully!', isError: false);
    } else {
      _showSnackBar('DigiLocker connection was not completed. Please try again.');
    }
  }

  void _handleDeepLinkDigilocker(String status) {
    if (status == 'success') {
      _showSnackBar('DigiLocker connected successfully!', isError: false);
      // Refresh data to reflect DigiLocker verified docs
      _fetchDocuments();
      _fetchKycStatus();
    } else {
      _showSnackBar('DigiLocker connection failed. Please try again.');
    }
  }

  Future<void> _fetchKycStatus() async {
    try {
      final res = await ApiService.get('/kyc/status');
      if (res['success'] == true) {
        setState(() => _kycStatus = res['data']);
      }
    } catch (_) {}
  }

  Future<void> _initDigilocker() async {
    setState(() => _digilockerLoading = true);
    try {
      final res = await ApiService.get('/kyc/digilocker/init?platform=mobile');
      if (res['success'] == true) {
        final url = res['data']?['auth_url'] ?? res['auth_url'];
        if (url != null) {
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            _awaitingDigilocker = true;
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          } else {
            _showSnackBar('Could not open DigiLocker');
          }
        } else {
          _showSnackBar('DigiLocker URL not received');
        }
      } else {
        _showSnackBar(res['message'] ?? 'DigiLocker init failed');
      }
    } catch (e) {
      _showSnackBar('Could not connect to server');
    } finally {
      setState(() => _digilockerLoading = false);
    }
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

  /// Show picker: selfie_photo = liveness screen, others = camera + file upload
  void _showUploadOptions(String docType) {
    if (docType == 'selfie_photo') {
      // Selfie: open liveness verification screen
      _openLivenessScreen();
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

  Future<void> _openLivenessScreen() async {
    final result = await Navigator.push<String?>(
      context,
      MaterialPageRoute(builder: (_) => const LivenessScreen()),
    );
    if (result == null || result.isEmpty) return;
    // Liveness screen now handles upload + profile-photo set in a single backend call.
    // Just refresh the documents list and notify the user.
    _showSnackBar('Selfie verified & saved as your profile photo', isError: false);
    await _fetchDocuments();
    // Refresh user profile so new profile_image_url shows everywhere
    if (mounted) {
      try {
        // ignore: use_build_context_synchronously
        await Provider.of<AuthProvider>(context, listen: false).refreshProfile();
      } catch (_) {}
    }
  }

  Future<void> _captureFromCamera(String docType, {bool useFrontCamera = false}) async {
    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: useFrontCamera ? CameraDevice.front : CameraDevice.rear,
      imageQuality: 50,
      maxWidth: 1200,
      maxHeight: 1200,
    );
    if (photo == null) return;

    // Face detection for selfie
    if (docType == 'selfie_photo') {
      final hasFace = await _detectFace(photo.path);
      if (!hasFace) {
        _showSnackBar('No face detected. Please take a clear selfie with your face visible.');
        return;
      }
    }

    await _processAndUpload(docType, photo.path, File(photo.path).lengthSync());
  }

  Future<bool> _detectFace(String imagePath) async {
    // Basic validation — final selfie verification is done by backend
    try {
      final file = File(imagePath);
      if (!await file.exists()) return false;
      final bytes = await file.length();
      // Reject files smaller than 10KB (likely corrupt) or larger than 15MB
      return bytes > 10240 && bytes < 15 * 1024 * 1024;
    } catch (_) {
      return true;
    }
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAttachSheet,
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.attach_file),
        label: const Text('Attach Document'),
      ),
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

  // ── Attach document sheet (for admin review) ─────────────────────────────
  Future<void> _showAttachSheet() async {
    String? pickedPath, pickedName;
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    bool uploading = false;
    String? err;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, ss) => Padding(
        padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20, right: 20, top: 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 12),
          const Text('Attach Document for Admin Review',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Admin will review the document and update your records.',
              textAlign: TextAlign.center, style: TextStyle(color: Colors.black54, fontSize: 12)),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: () async {
              final r = await FilePicker.platform.pickFiles(
                  type: FileType.custom, allowedExtensions: ['jpg','jpeg','png','pdf']);
              if (r?.files.single.path != null) {
                ss(() { pickedPath = r!.files.single.path; pickedName = r.files.single.name; });
              }
            },
            child: Container(
              width: double.infinity, padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: pickedPath != null ? AppTheme.primaryColor.withAlpha(15) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: pickedPath != null ? AppTheme.primaryColor : Colors.grey.shade300,
                    width: pickedPath != null ? 1.5 : 1),
              ),
              child: Row(children: [
                Icon(pickedPath != null ? Icons.check_circle_outline : Icons.upload_file_outlined,
                    color: pickedPath != null ? AppTheme.primaryColor : Colors.grey),
                const SizedBox(width: 10),
                Expanded(child: Text(pickedPath != null ? pickedName ?? 'File selected' : 'Tap to select file (JPG, PNG, PDF)',
                    style: TextStyle(color: pickedPath != null ? AppTheme.primaryColor : Colors.grey.shade600, fontSize: 13),
                    overflow: TextOverflow.ellipsis)),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: nameCtrl,
            decoration: InputDecoration(
              labelText: 'Document Name *',
              hintText: 'e.g. Bank Passbook, Rent Agreement',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: descCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: 'Notes (optional)',
              hintText: 'e.g. Updated Aadhaar, Bank Statement...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          if (err != null) ...[const SizedBox(height: 6), Text(err!, style: const TextStyle(color: AppTheme.errorColor, fontSize: 12))],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 48,
            child: ElevatedButton.icon(
              onPressed: uploading ? null : () async {
                if (pickedPath == null) { ss(() => err = 'Please select a file'); return; }
                if (nameCtrl.text.trim().isEmpty) { ss(() => err = 'Please enter a document name'); return; }
                ss(() { uploading = true; err = null; });
                try {
                  final res = await ApiService.uploadFile('/documents/attach', pickedPath!,
                      fieldName: 'document',
                      extraFields: {
                        'document_name': nameCtrl.text.trim(),
                        'description': descCtrl.text.trim(),
                        'document_type': 'attachment',
                      });
                  if (res['success'] == true) {
                    await _fetchDocuments();
                    if (ctx.mounted) Navigator.pop(ctx);
                    _showSnackBar('Document attached for admin review', isError: false);
                  } else {
                    ss(() { err = res['message']?.toString() ?? 'Failed to attach'; uploading = false; });
                  }
                } catch (_) { ss(() { err = 'Network error'; uploading = false; }); }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor, foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              icon: uploading
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.send),
              label: Text(uploading ? 'Attaching…' : 'Submit'),
            ),
          ),
          const SizedBox(height: 24),
        ]),
      )),
    );
  }

  Widget _buildContent() {
    return RefreshIndicator(
      onRefresh: _fetchDocuments,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // KYC status card (go to KYC screen for verification)
          _buildKycCard(),
          const SizedBox(height: 20),

          // Documents list
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Your Documents', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text('${_documents.length} file(s)', style: const TextStyle(color: Colors.grey, fontSize: 13)),
          ]),
          const SizedBox(height: 12),

          if (_documents.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(color: Colors.black.withAlpha(8), blurRadius: 8)]),
              child: const Column(children: [
                Icon(Icons.folder_open_outlined, size: 52, color: Colors.grey),
                SizedBox(height: 12),
                Text('No documents yet', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                SizedBox(height: 4),
                Text('Tap "Attach Document" to add files for admin review.',
                    textAlign: TextAlign.center, style: TextStyle(color: Colors.black54, fontSize: 13)),
              ]),
            )
          else
            ...(_documents.map((doc) => _buildDocRow(doc)).toList()),
        ]),
      ),
    );
  }

  Widget _buildDocRow(Map<String, dynamic> doc) {
    final label = _labelForType(doc['document_type']?.toString() ?? 'Document');
    final docName = (doc['document_name']?.toString().trim().isNotEmpty ?? false)
        ? doc['document_name'].toString().trim()
        : label;
    final status = (doc['verification_status'] ?? doc['status'] ?? 'pending').toString();
    final fileUrl = doc['file_url']?.toString();
    final uploadedAt = doc['created_at']?.toString();

    Color statusColor = status == 'approved' || status == 'verified' ? AppTheme.successColor
        : status == 'rejected' ? AppTheme.errorColor
        : status == 'pending' ? AppTheme.secondaryColor
        : Colors.grey;
    String statusLabel = status == 'approved' || status == 'verified' ? 'Verified'
        : status == 'rejected' ? 'Rejected'
        : status == 'pending' ? 'Under Review'
        : 'Uploaded';

    String? dateStr;
    if (uploadedAt != null) {
      final dt = DateTime.tryParse(uploadedAt);
      if (dt != null) {
        dateStr = '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year}';
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(8), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: statusColor.withAlpha(20), borderRadius: BorderRadius.circular(10)),
          child: Icon(
            status == 'approved' || status == 'verified' ? Icons.verified : Icons.insert_drive_file_outlined,
            color: statusColor, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(docName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
          if (docName != label)
            Text(label, style: const TextStyle(color: Colors.black54, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: statusColor.withAlpha(20), borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w600)),
            ),
            if (dateStr != null) ...[
              const SizedBox(width: 6),
              Text(dateStr, style: const TextStyle(color: Colors.grey, fontSize: 10)),
            ],
          ]),
        ])),
        if (fileUrl != null && fileUrl.isNotEmpty)
          TextButton.icon(
            onPressed: () => _viewDocument(fileUrl),
            icon: const Icon(Icons.visibility_outlined, size: 16),
            label: const Text('View', style: TextStyle(fontSize: 12)),
            style: TextButton.styleFrom(foregroundColor: AppTheme.primaryColor,
                minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
          ),
      ]),
    );
  }

  Widget _buildKycCard() {
    final status = _kycStatus?['kyc_status'] ?? 'not_started';
    final panVerified = _kycStatus?['pan_verified'] == true;
    final aadhaarVerified = _kycStatus?['aadhaar_verified'] == true;
    final digilockerConnected = _kycStatus?['digilocker_connected'] == true;

    Color statusColor;
    String statusLabel;
    IconData statusIcon;

    switch (status) {
      case 'approved':
      case 'verified':
        statusColor = AppTheme.successColor;
        statusLabel = 'KYC Verified';
        statusIcon = Icons.verified_user;
        break;
      case 'pending':
        statusColor = AppTheme.secondaryColor;
        statusLabel = 'Under Review';
        statusIcon = Icons.hourglass_empty;
        break;
      case 'rejected':
        statusColor = AppTheme.errorColor;
        statusLabel = 'KYC Rejected';
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = AppTheme.warningColor;
        statusLabel = 'KYC Not Verified';
        statusIcon = Icons.person_outline;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(statusIcon, color: statusColor, size: 22),
                const SizedBox(width: 8),
                const Text('KYC Verification',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(26),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(statusLabel,
                      style: TextStyle(color: statusColor, fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _kycStep('PAN', panVerified),
                const SizedBox(width: 16),
                _kycStep('Aadhaar', aadhaarVerified),
                const SizedBox(width: 16),
                _kycStep('DigiLocker', digilockerConnected),
              ],
            ),
            const SizedBox(height: 12),
            if (status != 'approved' && status != 'verified') ...
              [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/kyc'),
                        icon: const Icon(Icons.edit, size: 16),
                        label: const Text('Complete KYC'),
                        style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.primaryColor),
                      ),
                    ),
                    if (!digilockerConnected) ...
                      [
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _digilockerLoading ? null : _initDigilocker,
                            icon: _digilockerLoading
                                ? const SizedBox(height: 14, width: 14,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.account_balance, size: 16),
                            label: const Text('DigiLocker'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryColor,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ),
                      ],
                  ],
                ),
              ],
            if (digilockerConnected) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.successColor.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.successColor.withAlpha(60)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified, color: AppTheme.successColor, size: 16),
                    SizedBox(width: 6),
                    Text('DigiLocker Connected',
                        style: TextStyle(color: AppTheme.successColor, fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kycStep(String label, bool done) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
            color: done ? AppTheme.successColor : Colors.grey, size: 16),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                color: done ? AppTheme.successColor : Colors.grey,
                fontSize: 12)),
      ],
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
    final doc = _docForType(key);
    final isUploading = _uploadingType == key;
    final status = doc?['verification_status'] ?? doc?['status'] ?? 'not_uploaded';

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
        statusLabel = 'Review';
        statusIcon = Icons.hourglass_empty;
        break;
      case 'rejected':
        statusColor = AppTheme.errorColor;
        statusLabel = 'Rejected';
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = Colors.grey;
        statusLabel = 'Upload';
        statusIcon = Icons.upload_file;
    }

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: doc?['file_url'] != null ? () => _viewDocument(doc!['file_url']) : null,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(26),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, color: statusColor, size: 12),
                    const SizedBox(width: 3),
                    Text(statusLabel,
                        style: TextStyle(color: statusColor, fontSize: 10,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              // Icon or thumbnail
              if (doc?['file_url'] != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    doc!['file_url'],
                    height: 60,
                    width: 60,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 60, width: 60,
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withAlpha(26),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(_iconForType(docType['icon'] as String? ?? 'badge'),
                          color: AppTheme.primaryColor, size: 28),
                    ),
                  ),
                )
              else
                Container(
                  height: 60,
                  width: 60,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(26),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(_iconForType(docType['icon'] as String? ?? 'badge'),
                      color: AppTheme.primaryColor, size: 28),
                ),
              const SizedBox(height: 8),
              // Label
              Text(label,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              // Action button — hide for approved/verified docs (no re-upload allowed)
              if (status == 'approved' || status == 'verified')
                SizedBox(
                  width: double.infinity,
                  height: 30,
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppTheme.successColor.withAlpha(26),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock, size: 12, color: AppTheme.successColor),
                        SizedBox(width: 4),
                        Text('Locked',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.successColor)),
                      ],
                    ),
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  height: 30,
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withAlpha(20),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status == 'pending' ? 'Pending Review' : 'Upload via KYC',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ),
                ),
            ],
          ),
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
