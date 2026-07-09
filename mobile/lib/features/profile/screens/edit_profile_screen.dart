import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/active_member_provider.dart';
import '../../../core/models/user_model.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/widgets/otp_input_row.dart';

Future<Map<String, String>> _authHeaders() async {
  final prefs = await SharedPreferences.getInstance();
  // SECURITY FIX: read token from secure storage only.
  const storage = FlutterSecureStorage();
  final token = await storage.read(key: 'access_token');
  final activeMemberId = prefs.getString('active_member_id')?.trim();
  return {
    if (token != null) 'Authorization': 'Bearer $token',
    if (activeMemberId != null && activeMemberId.isNotEmpty)
      'X-Active-Member-Id': activeMemberId.toUpperCase(),
  };
}

Future<Uri> _activeAwareUri(String path) async {
  final prefs = await SharedPreferences.getInstance();
  final activeMemberId = prefs.getString('active_member_id')?.trim();
  final base = Uri.parse('${ApiService.baseUrl}$path');
  if (activeMemberId == null || activeMemberId.isEmpty) return base;
  final qp = Map<String, String>.from(base.queryParameters);
  qp['active_member_id'] = activeMemberId.toUpperCase();
  return base.replace(queryParameters: qp);
}

const _kStates = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands',
  'Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi',
  'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];
const _kRelations = [
  'Spouse',
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Legal Guardian',
  'Friend',
  'Business Partner',
  'Other',
];

String _nomineeField(String? value) => (value ?? '').trim();

bool _nomineeIsConfigured(dynamic user) {
  if (user?.nomineeVerified != true) return false;
  final name = _nomineeField(user?.nomineeName);
  final rel = _nomineeField(user?.nomineeRelationship);
  bool meaningful(String v) =>
      v.isNotEmpty && v != '—' && v != '-' && v.toLowerCase() != 'null';
  return meaningful(name) && meaningful(rel);
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  bool _saving = false;
  User? _displayUser;
  User? _accountUser;
  String? _loadedMemberContext;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDisplayedProfile());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final activeMemberId = context.watch<ActiveMemberProvider>().activeMemberId;
    final nextContext = activeMemberId?.toUpperCase() ?? 'me';
    if (_loadedMemberContext != nextContext) {
      _loadedMemberContext = nextContext;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadDisplayedProfile());
    }
  }

  Future<void> _loadDisplayedProfile() async {
    try {
      final response = await ApiService.get('/users/profile');
      User? accountUser;
      try {
        final accountRes = await ApiService.getWithoutActiveMember('/users/profile');
        if (accountRes['success'] == true) {
          accountUser = User.fromJson(Map<String, dynamic>.from(accountRes['data']));
        }
      } catch (_) {}
      if (mounted) {
        setState(() {
          if (response['success'] == true) {
            _displayUser = User.fromJson(Map<String, dynamic>.from(response['data']));
          }
          _accountUser = accountUser ?? _displayUser;
        });
      }
    } catch (_) {}
  }

  Future<http.MultipartFile> _proofPart(String field, String path) {
    final ext = path.split('.').last.toLowerCase();
    final mimeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'pdf': 'application/pdf',
    };
    final mime = mimeMap[ext] ?? 'application/octet-stream';
    final parts = mime.split('/');
    return http.MultipartFile.fromPath(
      field,
      path,
      contentType: MediaType(parts[0], parts[1]),
    );
  }

  void _snack(String msg, {bool err = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: err ? AppTheme.errorColor : AppTheme.successColor,
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _refresh() => _loadDisplayedProfile();

  // ── EMAIL CHANGE ──────────────────────────────────────────────────────────
  Future<void> _showEmailSheet() async {
    final ec = TextEditingController();
    final oc = TextEditingController();
    bool sent = false, loading = false;
    String? err;
    await showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, ss) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 20, right: 20, top: 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _handle(), const SizedBox(height: 8),
          const Text('Change Email', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          if (!sent) ...[
            _tf(ec, 'New Email', Icons.email_outlined, type: TextInputType.emailAddress),
            const SizedBox(height: 8),
            if (err != null) _errText(err!),
            const SizedBox(height: 10),
            _btn(loading ? 'Sending OTP…' : 'Send OTP', loading: loading, onTap: () async {
              final email = ec.text.trim();
              if (!RegExp(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$').hasMatch(email)) {
                ss(() => err = 'Enter a valid email'); return;
              }
              ss(() { loading = true; err = null; });
              try {
                final r = await ApiService.post('/users/profile/change-email/send-otp', {'email': email});
                if (r['success'] == true) {
                  ss(() { sent = true; loading = false; });
                } else {
                  ss(() { err = r['message']?.toString() ?? 'Failed to send OTP'; loading = false; });
                }
              } catch (_) { ss(() { err = 'Network error'; loading = false; }); }
            }),
          ] else ...[
            Text('OTP sent to ${ec.text}', style: const TextStyle(color: Colors.black54, fontSize: 13)),
            const SizedBox(height: 12),
            _tf(oc, '6-digit OTP', Icons.lock_outline, type: TextInputType.number,
              formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)]),
            if (err != null) ...[const SizedBox(height: 6), _errText(err!)],
            Align(alignment: Alignment.centerRight,
              child: TextButton(onPressed: loading ? null : () => ss(() { sent = false; oc.clear(); err = null; }),
                child: const Text('Resend / change email'))),
            _btn(loading ? 'Verifying…' : 'Verify & Update', loading: loading, onTap: () async {
              if (oc.text.trim().length != 6) { ss(() => err = 'Enter 6-digit OTP'); return; }
              ss(() { loading = true; err = null; });
              try {
                final r = await ApiService.post('/users/profile/change-email/verify-otp',
                  {'email': ec.text.trim(), 'otp': oc.text.trim()});
                if (r['success'] == true) {
                  await _refresh();
                  if (ctx.mounted) Navigator.pop(ctx);
                  _snack('Email updated');
                } else ss(() { err = r['message']?.toString() ?? 'Invalid OTP'; loading = false; });
              } catch (_) { ss(() { err = 'Network error'; loading = false; }); }
            }),
          ],
          const SizedBox(height: 24),
        ]),
      )),
    );
  }

  // ── ADDRESS CHANGE ────────────────────────────────────────────────────────
  Future<void> _showAddressSheet(dynamic user) async {
    final ac = TextEditingController(text: user?.address ?? '');
    final cc = TextEditingController(text: user?.city ?? '');
    final pc = TextEditingController(text: user?.pincode ?? '');
    String? state = (user?.state ?? '').isEmpty ? null : user?.state as String?;
    // Current address controllers
    final cac = TextEditingController(text: user?.currentAddress ?? '');
    final ccc = TextEditingController(text: user?.currentCity ?? '');
    final cpc = TextEditingController(text: user?.currentPincode ?? '');
    String? currentState = (user?.currentState ?? '').isEmpty ? null : user?.currentState as String?;
    bool sameAsPermanent = (user?.currentAddress ?? '').isEmpty || (user?.currentAddress == user?.address);
    String? proofPath, proofName, err;
    bool loading = false;
    await showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, ss) {
        void syncCurrent() {
          if (sameAsPermanent) {
            cac.text = ac.text; ccc.text = cc.text; cpc.text = pc.text; currentState = state;
          }
        }
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(child: _handle()), const SizedBox(height: 8),
              const Center(child: Text('Change Address', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
              const SizedBox(height: 4),
              const Center(child: Text('Permanent Address', style: TextStyle(color: Colors.grey, fontSize: 12))),
              const SizedBox(height: 16),
              _tf(ac, 'Street / Area', Icons.home_outlined, onChange: (_) => ss(syncCurrent)),
              const SizedBox(height: 12),
              _tf(cc, 'City', Icons.location_city_outlined, onChange: (_) => ss(syncCurrent)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: state,
                decoration: InputDecoration(labelText: 'State', prefixIcon: const Icon(Icons.map_outlined, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                items: _kStates.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                onChanged: (v) => ss(() { state = v; if (sameAsPermanent) currentState = v; }),
              ),
              const SizedBox(height: 12),
              _tf(pc, 'Pincode', Icons.pin_drop_outlined, type: TextInputType.number,
                formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                onChange: (_) => ss(syncCurrent)),
              const SizedBox(height: 16),
              // Same-as-permanent checkbox
              InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => ss(() { sameAsPermanent = !sameAsPermanent; if (sameAsPermanent) syncCurrent(); }),
                child: Row(children: [
                  Checkbox(
                    value: sameAsPermanent,
                    activeColor: AppTheme.primaryColor,
                    onChanged: (v) => ss(() { sameAsPermanent = v ?? false; if (sameAsPermanent) syncCurrent(); }),
                  ),
                  const Text('Current address same as permanent', style: TextStyle(fontSize: 13)),
                ]),
              ),
              if (!sameAsPermanent) ...[
                const SizedBox(height: 12),
                const Align(alignment: Alignment.centerLeft, child: Text('Current Address', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w600))),
                const SizedBox(height: 8),
                _tf(cac, 'Street / Area', Icons.location_on_outlined),
                const SizedBox(height: 12),
                _tf(ccc, 'City', Icons.location_city_outlined),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: currentState,
                  decoration: InputDecoration(labelText: 'State', prefixIcon: const Icon(Icons.map_outlined, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: _kStates.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                  onChanged: (v) => ss(() => currentState = v),
                ),
                const SizedBox(height: 12),
                _tf(cpc, 'Pincode', Icons.pin_drop_outlined, type: TextInputType.number,
                  formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)]),
              ],
              const SizedBox(height: 16),
              _proofPicker(proofPath, proofName, 'Attach Address Proof (required)',
                'Aadhaar, Voter ID, Utility Bill, Rent Agreement',
                onPick: () async {
                  final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['jpg','jpeg','png','pdf']);
                  if (r?.files.single.path != null) ss(() { proofPath = r!.files.single.path; proofName = r.files.single.name; });
                }),
              if (err != null) ...[const SizedBox(height: 8), _errText(err!)],
              const SizedBox(height: 4),
              const Text('Address will be verified by admin within 24 hours.', style: TextStyle(fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 16),
              _btn(loading ? 'Saving…' : 'Submit for Admin Approval', loading: loading, onTap: () async {
                if (ac.text.trim().isEmpty || cc.text.trim().isEmpty || state == null || pc.text.trim().length != 6) {
                  ss(() => err = 'Fill all permanent address fields correctly'); return;
                }
                if (proofPath == null) { ss(() => err = 'Attach an address proof document'); return; }
                ss(() { loading = true; err = null; });
                try {
                  final req = http.MultipartRequest('PUT', await _activeAwareUri('/users/profile/change-address'));
                  req.headers.addAll(await _authHeaders());
                  req.fields['address'] = ac.text.trim();
                  req.fields['city'] = cc.text.trim();
                  req.fields['state'] = state!;
                  req.fields['pincode'] = pc.text.trim();
                  if (!sameAsPermanent) {
                    req.fields['current_address'] = cac.text.trim();
                    req.fields['current_city'] = ccc.text.trim();
                    req.fields['current_state'] = currentState ?? state!;
                    req.fields['current_pincode'] = cpc.text.trim();
                  } else {
                    req.fields['current_address'] = ac.text.trim();
                    req.fields['current_city'] = cc.text.trim();
                    req.fields['current_state'] = state!;
                    req.fields['current_pincode'] = pc.text.trim();
                  }
                  req.files.add(await _proofPart('address_proof', proofPath!));
                  final res = jsonDecode((await http.Response.fromStream(await req.send())).body);
                  if (res['success'] == true) {
                    await _refresh();
                    if (ctx.mounted) Navigator.pop(ctx);
                    _snack('Address submitted — pending admin approval');
                  } else ss(() { err = res['message']?.toString() ?? 'Failed'; loading = false; });
                } catch (_) { ss(() { err = 'Network error'; loading = false; }); }
              }),
            ]),
          ),
        );
      }),
    );
  }

  // ── NOMINEE ───────────────────────────────────────────────────────────────
  Future<void> _showNomineeSheet(dynamic user) async {
    dynamic nomineeUser = user;
    try {
      final profileRes = await ApiService.getWithoutActiveMember('/users/profile');
      if (profileRes['success'] == true) {
        nomineeUser = User.fromJson(Map<String, dynamic>.from(profileRes['data']));
      }
    } catch (_) {}

    final isNewNominee = !_nomineeIsConfigured(nomineeUser);
    final nc = TextEditingController(
      text: isNewNominee ? '' : _nomineeField(nomineeUser?.nomineeName),
    );
    final otherRelCtrl = TextEditingController();
    String? rel = isNewNominee
        ? null
        : (_nomineeField(nomineeUser?.nomineeRelationship).isEmpty
            ? null
            : nomineeUser?.nomineeRelationship as String?);
    if (rel != null && !_kRelations.contains(rel)) {
      otherRelCtrl.text = rel;
      rel = 'Other';
    }
    bool otpSent = false;
    bool sendingOtp = false;
    bool saving = false;
    String otpValue = '';
    String? err;
    final scrollCtrl = ScrollController();

    Future<void> submitNominee(
      void Function(void Function()) ss,
      BuildContext ctx, {
      required String relationship,
    }) async {
      if (otpValue.length != 6) {
        ss(() => err = 'Enter the 6-digit OTP');
        return;
      }
      ss(() { saving = true; err = null; });
      try {
        final r = await ApiService.putWithoutActiveMember('/users/profile', {
          'nominee_name': nc.text.trim(),
          'nominee_relationship': relationship,
          'otp': otpValue,
        });
        if (r['success'] == true) {
          await _refresh();
          if (ctx.mounted) Navigator.pop(ctx);
          _snack('Nominee saved');
        } else {
          ss(() {
            err = r['message']?.toString() ?? 'Update failed';
            saving = false;
          });
        }
      } catch (_) {
        ss(() { err = 'Network error'; saving = false; });
      }
    }

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, ss) {
          final busy = sendingOtp || saving;
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SingleChildScrollView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: _handle()),
                  const SizedBox(height: 8),
                  Text(
                    isNewNominee ? 'Enter Nominee Details' : 'Change Nominee',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  if (otpSent) ...[
                    const SizedBox(height: 6),
                    Text(
                      'OTP sent to your registered mobile. Enter it below to save.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.35),
                    ),
                  ],
                  const SizedBox(height: 16),
                  _tf(nc, 'Nominee Name', Icons.person_add_outlined),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    value: rel,
                    decoration: InputDecoration(
                      labelText: 'Relationship',
                      prefixIcon: const Icon(Icons.people_outline, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: _kRelations
                        .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                        .toList(),
                    onChanged: busy ? null : (v) => ss(() => rel = v),
                  ),
                  if (rel == 'Other') ...[
                    const SizedBox(height: 14),
                    _tf(otherRelCtrl, 'Specify relationship', Icons.edit_outlined),
                  ],
                  if (otpSent) ...[
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.lightBlueBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'OTP sent to your registered mobile. Enter all 6 digits below.',
                        style: TextStyle(fontSize: 12, color: Colors.black87, height: 1.35),
                      ),
                    ),
                    const SizedBox(height: 14),
                    OtpInputRow(
                      onCompleted: (v) => ss(() {
                        otpValue = v;
                        err = null;
                      }),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: busy
                            ? null
                            : () async {
                                ss(() { sendingOtp = true; err = null; });
                                try {
                                  final r = await ApiService.postWithoutActiveMember(
                                      '/users/profile/nominee-otp/send', {});
                                  if (r['success'] == true) {
                                    ss(() { sendingOtp = false; otpValue = ''; });
                                    _snack('OTP resent to registered mobile');
                                  } else {
                                    ss(() {
                                      err = r['message']?.toString() ?? 'Failed to resend OTP';
                                      sendingOtp = false;
                                    });
                                  }
                                } catch (_) {
                                  ss(() { err = 'Network error'; sendingOtp = false; });
                                }
                              },
                        child: const Text('Resend OTP'),
                      ),
                    ),
                  ],
                  if (err != null) ...[const SizedBox(height: 4), _errText(err!)],
                  const SizedBox(height: 16),
                  if (!otpSent)
                    _btn(
                      'Save Nominee',
                      loading: sendingOtp,
                      onTap: busy
                          ? null
                          : () async {
                              if (nc.text.trim().length < 2) {
                                ss(() => err = 'Enter nominee name');
                                return;
                              }
                              if (rel == null) {
                                ss(() => err = 'Select relationship');
                                return;
                              }
                              if (rel == 'Other' && otherRelCtrl.text.trim().length < 2) {
                                ss(() => err = 'Enter relationship type');
                                return;
                              }
                              ss(() { sendingOtp = true; err = null; });
                              try {
                                final r = await ApiService.postWithoutActiveMember(
                                    '/users/profile/nominee-otp/send', {});
                                if (r['success'] == true) {
                                  ss(() { otpSent = true; sendingOtp = false; otpValue = ''; });
                                  _snack('OTP sent to your registered mobile');
                                  await Future<void>.delayed(const Duration(milliseconds: 120));
                                  if (scrollCtrl.hasClients) {
                                    await scrollCtrl.animateTo(
                                      scrollCtrl.position.maxScrollExtent,
                                      duration: const Duration(milliseconds: 250),
                                      curve: Curves.easeOut,
                                    );
                                  }
                                } else {
                                  ss(() {
                                    err = r['message']?.toString() ?? 'Failed to send OTP';
                                    sendingOtp = false;
                                  });
                                }
                              } catch (_) {
                                ss(() { err = 'Network error'; sendingOtp = false; });
                              }
                            },
                    )
                  else
                    _btn(
                      'Verify & Save',
                      loading: saving,
                      onTap: busy
                          ? null
                          : () async {
                              if (nc.text.trim().length < 2) {
                                ss(() => err = 'Enter nominee name');
                                return;
                              }
                              if (rel == null) {
                                ss(() => err = 'Select relationship');
                                return;
                              }
                              if (rel == 'Other' && otherRelCtrl.text.trim().length < 2) {
                                ss(() => err = 'Enter relationship type');
                                return;
                              }
                              final relationship =
                                  rel == 'Other' ? otherRelCtrl.text.trim() : rel!;
                              await submitNominee(ss, ctx, relationship: relationship);
                            },
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
    scrollCtrl.dispose();
  }

  // ── BANK CHANGE ───────────────────────────────────────────────────────────
  Future<void> _showBankSheet() async {
    final ac = TextEditingController();
    final ic = TextEditingController();
    String bankName = '';
    String? proofPath, proofName, err, ifscErr;
    bool loading = false, looking = false;
    await showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, ss) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: _handle()), const SizedBox(height: 8),
            const Center(child: Text('Change Bank Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            const SizedBox(height: 20),
            _tf(ac, 'Account Number', Icons.account_balance_outlined, type: TextInputType.number,
              formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(20)]),
            const SizedBox(height: 12),
            TextField(
              controller: ic,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')), LengthLimitingTextInputFormatter(11)],
              decoration: InputDecoration(
                labelText: 'IFSC Code', prefixIcon: const Icon(Icons.code), errorText: ifscErr,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                suffixIcon: looking
                  ? const SizedBox(width: 20, height: 20, child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)))
                  : bankName.isNotEmpty ? const Icon(Icons.check_circle, color: AppTheme.successColor) : null,
              ),
              onChanged: (v) async {
                final ifsc = v.trim().toUpperCase();
                if (ifsc.length == 11) {
                  ss(() { looking = true; ifscErr = null; bankName = ''; });
                  try {
                    final r = await ApiService.get('/users/bank/ifsc/$ifsc');
                    if (r['success'] == true) {
                        ss(() { bankName = (r['data']?['bank'] ?? '').toString().trim(); looking = false; });
                      } else {
                        ss(() { ifscErr = 'Invalid IFSC'; looking = false; });
                      }
                  } catch (_) { ss(() { looking = false; }); }
                } else { ss(() { bankName = ''; ifscErr = null; looking = false; }); }
              },
            ),
            if (bankName.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Bank: $bankName', style: const TextStyle(fontSize: 12, color: AppTheme.successColor, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 16),
            _proofPicker(proofPath, proofName, 'Attach Bank Proof (required)',
              'Passbook, Cancelled Cheque, Bank Statement',
              onPick: () async {
                final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['jpg','jpeg','png','pdf']);
                if (r?.files.single.path != null) ss(() { proofPath = r!.files.single.path; proofName = r.files.single.name; });
              }),
            if (err != null) ...[const SizedBox(height: 8), _errText(err!)],
            const SizedBox(height: 20),
            _btn(loading ? 'Saving…' : 'Submit for Admin Approval', loading: loading, onTap: () async {
              final acc = ac.text.trim();
              final ifsc = ic.text.trim().toUpperCase();
              if (acc.length < 9) { ss(() => err = 'Enter valid account number'); return; }
              if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) { ss(() => err = 'Enter valid 11-char IFSC'); return; }
              if (proofPath == null) { ss(() => err = 'Attach bank proof document'); return; }
              ss(() { loading = true; err = null; });
              try {
                final req = http.MultipartRequest('PUT', await _activeAwareUri('/users/profile/change-bank'));
                req.headers.addAll(await _authHeaders());
                req.fields['bank_account_number'] = acc;
                req.fields['bank_ifsc_code'] = ifsc;
                if (bankName.isNotEmpty) req.fields['bank_name'] = bankName;
                req.files.add(await _proofPart('bank_proof', proofPath!));
                final res = jsonDecode((await http.Response.fromStream(await req.send())).body);
                if (res['success'] == true) {
                  await _refresh();
                  if (ctx.mounted) Navigator.pop(ctx);
                  _snack('Bank details submitted — pending admin approval');
                } else ss(() { err = res['message']?.toString() ?? 'Failed'; loading = false; });
              } catch (_) { ss(() { err = 'Network error'; loading = false; }); }
            }),
          ]),
        ),
      )),
    );
  }

  // ── shared widgets ────────────────────────────────────────────────────────
  Widget _handle() => Container(width: 40, height: 4,
    decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)));

  Widget _errText(String msg) => Text(msg, style: const TextStyle(color: AppTheme.errorColor, fontSize: 12));

  Widget _btn(String label, {required VoidCallback? onTap, bool loading = false}) =>
    SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: loading ? null : onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.primaryColor,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppTheme.primaryColor.withAlpha(180),
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: loading
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            )
          : Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
      ),
    );

  Widget _tf(TextEditingController ctrl, String label, IconData icon,
      {TextInputType type = TextInputType.text, List<TextInputFormatter>? formatters, ValueChanged<String>? onChange}) =>
    TextField(controller: ctrl, keyboardType: type, inputFormatters: formatters, onChanged: onChange,
      autocorrect: type != TextInputType.emailAddress,
      enableSuggestions: type != TextInputType.emailAddress,
      textCapitalization: type == TextInputType.emailAddress ? TextCapitalization.none : TextCapitalization.sentences,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon, size: 20),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))));

  Widget _proofPicker(String? path, String? name, String placeholder, String hint,
      {required VoidCallback onPick}) =>
    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      GestureDetector(
        onTap: onPick,
        child: Container(
          width: double.infinity, padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: path != null ? AppTheme.primaryColor.withAlpha(15) : Colors.grey.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: path != null ? AppTheme.primaryColor : Colors.grey.shade300, width: path != null ? 1.5 : 1),
          ),
          child: Row(children: [
            Icon(path != null ? Icons.check_circle_outline : Icons.upload_file_outlined,
              color: path != null ? AppTheme.primaryColor : Colors.grey),
            const SizedBox(width: 10),
            Expanded(child: Text(path != null ? name ?? 'File attached' : placeholder,
              style: TextStyle(color: path != null ? AppTheme.primaryColor : Colors.grey.shade600, fontSize: 13),
              overflow: TextOverflow.ellipsis)),
          ]),
        ),
      ),
      const SizedBox(height: 4),
      Text('Accepted: $hint', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
    ]);

  // ── BUILD ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final user = _displayUser ?? context.watch<AuthProvider>().user;
    final nomineeUser = _accountUser ?? user;
    final isProfilePending = (user?.profileEditStatus ?? '').toLowerCase() == 'pending';
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(slivers: [
          SliverAppBar(
            expandedHeight: 190, pinned: true,
            backgroundColor: AppTheme.primaryColor, foregroundColor: Colors.white,
            leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new), onPressed: () => context.pop()),
            title: const Text('My Profile'),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                color: AppTheme.primaryColor,
                child: SafeArea(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const SizedBox(height: 48),
                  CircleAvatar(
                    radius: 38, backgroundColor: Colors.white24,
                    backgroundImage: (user?.profileImageUrl?.isNotEmpty == true)
                      ? NetworkImage(user!.profileImageUrl!) : null,
                    child: (user?.profileImageUrl?.isNotEmpty != true)
                      ? Text(user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold))
                      : null,
                  ),
                  const SizedBox(height: 8),
                  Text(user?.fullName ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  if (user?.memberId != null)
                    Text('ID: ${user!.memberId}', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                ])),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                if (_saving) const LinearProgressIndicator(),

                // Identity — all locked
                _Card(title: 'Identity', children: [
                  _Row('Full Name', user?.fullName, locked: true),
                  _Row('Mobile', user?.mobile, locked: true),
                  _Row('PAN Number', user?.panNumber, locked: true),
                  _Row('Date of Birth', _fmtDob(user?.dateOfBirth), locked: true),
                  _Row('Gender', _cap(user?.gender), locked: true),
                ]),
                const SizedBox(height: 14),

                // Contact — email changeable
                _Card(title: 'Contact', children: [
                  _Row('Email', user?.email, actionLabel: 'Change', onAction: _showEmailSheet),
                ]),
                const SizedBox(height: 14),

                // Address
                _Card(
                  title: 'Address',
                  trailing: isProfilePending
                      ? const Chip(
                          label: Text('Pending review', style: TextStyle(fontSize: 11)),
                          visualDensity: VisualDensity.compact,
                        )
                      : TextButton.icon(
                          onPressed: () => _showAddressSheet(user),
                          icon: const Icon(Icons.edit_outlined, size: 16),
                          label: const Text('Change', style: TextStyle(fontSize: 12)),
                        ),
                  children: [
                    _Row('Street', user?.address),
                    _Row('City', user?.city),
                    _Row('State', user?.state),
                    _Row('Pincode', user?.pincode),
                    if ((user?.currentAddress ?? '').isNotEmpty) ...[
                      const Padding(padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: Divider()),
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 4),
                        child: Text('Current Address', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey)),
                      ),
                      _Row('Street', user?.currentAddress),
                      _Row('City', user?.currentCity),
                      _Row('State', user?.currentState),
                      _Row('Pincode', user?.currentPincode),
                    ],
                  ],
                ),
                const SizedBox(height: 14),

                // Nominee
                _Card(
                  title: 'Nominee',
                  trailing: TextButton.icon(
                    onPressed: () => _showNomineeSheet(nomineeUser),
                    icon: Icon(
                      _nomineeIsConfigured(nomineeUser)
                          ? Icons.edit_outlined
                          : Icons.person_add_outlined,
                      size: 16,
                    ),
                    label: Text(
                      _nomineeIsConfigured(nomineeUser)
                          ? 'Change Nominee'
                          : 'Enter Nominee Details',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  children: [
                    _Row(
                      'Nominee Name',
                      _nomineeIsConfigured(nomineeUser) ? nomineeUser?.nomineeName : null,
                    ),
                    _Row(
                      'Relationship',
                      _nomineeIsConfigured(nomineeUser) ? nomineeUser?.nomineeRelationship : null,
                    ),
                    if (!_nomineeIsConfigured(nomineeUser))
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: Text(
                          'Add your nominee details. OTP verification is required to save.',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),

                // Bank
                _Card(
                  title: 'Bank Details',
                  trailing: isProfilePending
                      ? const Chip(
                          label: Text('Pending review', style: TextStyle(fontSize: 11)),
                          visualDensity: VisualDensity.compact,
                        )
                      : TextButton.icon(
                          onPressed: _showBankSheet,
                          icon: const Icon(Icons.edit_outlined, size: 16),
                          label: const Text('Change', style: TextStyle(fontSize: 12)),
                        ),
                  children: [
                    _Row('Account Number', _mask(user?.bankAccountNumber), note: 'Requires admin approval'),
                    _Row('IFSC Code', user?.bankIfscCode),
                    _Row('Bank Name', user?.bankName),
                  ],
                ),
                const SizedBox(height: 16),

                // Support button — auto-open raise ticket with Profile category
                OutlinedButton.icon(
                  onPressed: () => context.push('/support', extra: {'autoOpenTicket': true, 'category': 'Profile / Account Issue'}),
                  icon: const Icon(Icons.headset_mic_outlined),
                  label: const Text('Issue in Profile? Raise a Ticket'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 48),
                    foregroundColor: AppTheme.primaryColor,
                    side: const BorderSide(color: AppTheme.primaryColor),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  String _fmtDob(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '—';
    final dt = DateTime.tryParse(raw.trim());
    if (dt == null) return raw;
    return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year}';
  }
  String _cap(String? v) => (v == null || v.isEmpty) ? '—' : '${v[0].toUpperCase()}${v.substring(1)}';
  String _mask(String? v) {
    if (v == null || v.length < 4) return v ?? '—';
    return '${'*' * (v.length - 4)}${v.substring(v.length - 4)}';
  }
}

// ─── Section Card ─────────────────────────────────────────────────────────────
class _Card extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final Widget? trailing;
  const _Card({required this.title, required this.children, this.trailing});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
      boxShadow: [BoxShadow(color: Colors.black.withAlpha(10), blurRadius: 8, offset: const Offset(0, 2))]),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 4),
        child: Row(children: [
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryColor))),
          if (trailing != null) trailing!,
        ]),
      ),
      const Divider(height: 1),
      ...children,
      const SizedBox(height: 8),
    ]),
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
class _Row extends StatelessWidget {
  final String label;
  final String? value;
  final bool locked;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? note;
  const _Row(this.label, this.value, {this.locked = false, this.actionLabel, this.onAction, this.note});

  @override
  Widget build(BuildContext context) {
    final display = (value == null || value!.trim().isEmpty) ? '—' : value!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
          const SizedBox(height: 2),
          Row(children: [
            Flexible(child: Text(display, style: const TextStyle(fontSize: 14, color: Colors.black87))),
            if (locked) ...[const SizedBox(width: 6), const Icon(Icons.lock_outline, size: 13, color: Colors.grey)],
          ]),
          if (note != null) Text(note!, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ])),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(foregroundColor: AppTheme.primaryColor,
              padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            child: Text(actionLabel!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          ),
      ]),
    );
  }
}
