import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class DigilockerStepScreen extends StatefulWidget {
  final String? digilockerStatus;
  const DigilockerStepScreen({super.key, this.digilockerStatus});

  @override
  State<DigilockerStepScreen> createState() => _DigilockerStepScreenState();
}

class _DigilockerStepScreenState extends State<DigilockerStepScreen> with WidgetsBindingObserver {
  bool _showManual = false;
  bool _busy = false;
  final _pan = TextEditingController();
  final _aadhaar = TextEditingController();
  File? _panFile, _aadhaarFront, _aadhaarBack;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.digilockerStatus == 'success') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('DigiLocker connected.')));
        context.go('/onboarding/face');
      });
    } else if (widget.digilockerStatus == 'error') {
      _showManual = true;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncStepFromBackend());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncStepFromBackend();
    }
  }

  Future<void> _syncStepFromBackend() async {
    try {
      final res = await OnboardingApi.getStatus();
      if (!mounted) return;
      final data = res['data'] as Map<String, dynamic>?;
      if (data == null) return;

      if (data['completed'] == true) {
        context.go('/onboarding/done');
        return;
      }

      final nextStep = data['next_step']?.toString();
      if (nextStep != null && nextStep != 'digilocker') {
        context.go(onboardingNextRoute(nextStep));
      }
    } catch (_) {
      // Ignore temporary failures; user can continue manually.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pan.dispose();
    _aadhaar.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.getDigilockerAuthUrl();
      final url = res['data']?['auth_url'] ?? res['data']?['authUrl'];
      if (url != null && await canLaunchUrl(Uri.parse(url))) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('DigiLocker unavailable. Use manual upload.')));
          setState(() => _showManual = true);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => _showManual = true);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pick(void Function(File) onPicked) async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (f != null) onPicked(File(f.path));
  }

  Future<void> _submitManual() async {
    if (_panFile == null || _aadhaarFront == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please attach PAN and Aadhaar front.')));
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await OnboardingApi.submitManualKyc(
        panNumber: _pan.text.toUpperCase().trim(),
        aadhaarNumber: _aadhaar.text.replaceAll(RegExp(r'\D'), ''),
        panFilePath: _panFile!.path,
        aadhaarFrontPath: _aadhaarFront!.path,
        aadhaarBackPath: _aadhaarBack?.path,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message']?.toString() ?? 'Submitted.')));
        if (res['success'] == true) context.go('/onboarding/face');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _filePicker(String label, File? file, void Function(File) onPicked) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid), borderRadius: BorderRadius.circular(8)),
      child: Row(children: [
        OutlinedButton.icon(
          icon: const Icon(Icons.upload_file),
          label: Text(file == null ? 'Choose' : 'Change'),
          onPressed: () => _pick(onPicked),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[700])),
            Text(file?.path.split(Platform.pathSeparator).last ?? 'No file', maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 0,
      title: 'Verify your identity',
      subtitle: 'Connect DigiLocker for instant KYC, or upload PAN + Aadhaar manually.',
      loading: _busy,
      child: _showManual ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Card(elevation: 0, color: Color(0xFFE0F2FE), child: Padding(
          padding: EdgeInsets.all(10),
          child: Text('Admin will approve within 24 hours. You can continue the remaining onboarding meanwhile.'),
        )),
        const SizedBox(height: 12),
        TextField(controller: _pan, decoration: const InputDecoration(labelText: 'PAN Number', hintText: 'ABCDE1234F'), textCapitalization: TextCapitalization.characters, maxLength: 10),
        TextField(controller: _aadhaar, decoration: const InputDecoration(labelText: 'Aadhaar (12 digits)'), keyboardType: TextInputType.number, maxLength: 12),
        _filePicker('PAN Card Photo', _panFile, (f) => setState(() => _panFile = f)),
        _filePicker('Aadhaar Front', _aadhaarFront, (f) => setState(() => _aadhaarFront = f)),
        _filePicker('Aadhaar Back (optional)', _aadhaarBack, (f) => setState(() => _aadhaarBack = f)),
        const SizedBox(height: 14),
        Row(children: [
          TextButton(onPressed: _busy ? null : () => setState(() => _showManual = false), child: const Text('Back')),
          const Spacer(),
          ElevatedButton(
            onPressed: _busy ? null : _submitManual,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
            child: const Padding(padding: EdgeInsets.symmetric(horizontal: 18, vertical: 12), child: Text('Submit & Continue')),
          ),
        ]),
      ]) : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ElevatedButton.icon(
          icon: const Icon(Icons.verified_user),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Connect DigiLocker', style: TextStyle(fontSize: 15))),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          onPressed: _busy ? null : _connect,
        ),
        const SizedBox(height: 12),
        const Row(children: [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('or')), Expanded(child: Divider())]),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _busy ? null : () => setState(() => _showManual = true),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text("I don't have DigiLocker — Upload manually")),
        ),
      ]),
    );
  }
}
