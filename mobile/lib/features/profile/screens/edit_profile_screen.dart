import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _panCtrl;
  late TextEditingController _addressCtrl;
  late TextEditingController _cityCtrl;
  late TextEditingController _stateCtrl;
  late TextEditingController _pincodeCtrl;
  late TextEditingController _dobCtrl;
  late TextEditingController _nomineeNameCtrl;
  late TextEditingController _nomineeRelCtrl;
  late TextEditingController _bankAccCtrl;
  late TextEditingController _bankIfscCtrl;
  late TextEditingController _bankNameCtrl;
  late TextEditingController _currentAddressCtrl;
  late TextEditingController _currentCityCtrl;
  late TextEditingController _currentStateCtrl;
  late TextEditingController _currentPincodeCtrl;
  String? _selectedGender;
  bool _digilockerConnected = false;
  bool _isSaving = false;
  bool _isIfscLoading = false;
  String? _ifscBankName;
  String? _ifscBranch;
  String? _ifscLookupError;
  String? _accountHolderName;
  String? _accountLookupError;
  String? _accountLookupInfo;
  bool _isAccountLookupLoading = false;
  bool _sameAsPermanent = false;
  String? _verifiedDobIso;
  String? _verifiedGender;
  int _ifscLookupRequestId = 0;
  int _accountLookupRequestId = 0;
  Timer? _accountLookupDebounce;
  String _lastVerifiedAccountKey = '';
  String _lastRequestedAccountKey = '';
  String _lastRequestedIfsc = '';

  bool get _isIfscResolved =>
      (_ifscBankName?.trim().isNotEmpty == true) ||
      (_ifscBranch?.trim().isNotEmpty == true);

  void _resetAccountLookupState({bool resetKeys = true}) {
    _isAccountLookupLoading = false;
    _accountHolderName = null;
    _accountLookupError = null;
    _accountLookupInfo = null;
    if (resetKeys) {
      _lastRequestedAccountKey = '';
      _lastVerifiedAccountKey = '';
    }
  }

  void _scheduleAccountVerification() {
    _accountLookupDebounce?.cancel();
    _accountLookupDebounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      _verifyBankAccountHolder();
    });
  }

  String? _normalizeGender(String? raw) {
    final value = (raw ?? '').trim().toLowerCase();
    if (value.isEmpty) return null;
    if (value == 'm' || value == 'male') return 'male';
    if (value == 'f' || value == 'female') return 'female';
    if (value == 'o' || value == 'other') return 'other';
    return null;
  }

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameCtrl = TextEditingController(text: user?.fullName ?? '');
    _emailCtrl = TextEditingController(text: user?.email ?? '');
    _panCtrl = TextEditingController(text: user?.panNumber ?? '');
    _addressCtrl = TextEditingController(text: user?.address ?? '');
    _cityCtrl = TextEditingController(text: user?.city ?? '');
    _stateCtrl = TextEditingController(text: user?.state ?? '');
    _pincodeCtrl = TextEditingController(text: user?.pincode ?? '');
    _dobCtrl =
        TextEditingController(text: _formatDobForDisplay(user?.dateOfBirth));
    _nomineeNameCtrl = TextEditingController(text: user?.nomineeName ?? '');
    _nomineeRelCtrl =
        TextEditingController(text: user?.nomineeRelationship ?? '');
    _bankAccCtrl = TextEditingController(text: user?.bankAccountNumber ?? '');
    _bankIfscCtrl = TextEditingController(text: user?.bankIfscCode ?? '');
    _bankNameCtrl = TextEditingController(text: user?.bankName ?? '');
    _currentAddressCtrl =
        TextEditingController(text: user?.currentAddress ?? '');
    _currentCityCtrl = TextEditingController(text: user?.currentCity ?? '');
    _currentStateCtrl = TextEditingController(text: user?.currentState ?? '');
    _currentPincodeCtrl =
        TextEditingController(text: user?.currentPincode ?? '');
    _selectedGender = _normalizeGender(user?.gender);
    _verifiedDobIso = _normalizeDate(user?.dateOfBirth);
    _verifiedGender = _normalizeGender(user?.gender);
    _sameAsPermanent = _isCurrentSameAsPermanent();
    if (_sameAsPermanent) {
      _copyPermanentToCurrent();
    }
    _fetchKycStatus();
    final existingIfsc = (user?.bankIfscCode ?? '').trim().toUpperCase();
    if (RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(existingIfsc)) {
      _lookupIfsc(existingIfsc);
    }
    _verifyBankAccountHolder();
  }

  String? _normalizeDate(String? raw) {
    final text = (raw ?? '').trim();
    if (text.isEmpty) return null;
    final slash = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(text);
    if (slash != null) {
      final dd = int.parse(slash.group(1)!);
      final mm = int.parse(slash.group(2)!);
      final yyyy = int.parse(slash.group(3)!);
      final dt = DateTime.tryParse(
          '${yyyy.toString().padLeft(4, '0')}-${mm.toString().padLeft(2, '0')}-${dd.toString().padLeft(2, '0')}');
      if (dt == null) return null;
      return dt.toIso8601String().split('T').first;
    }
    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text)) return text;
    final parsed = DateTime.tryParse(text);
    if (parsed == null) return null;
    return parsed.toIso8601String().split('T').first;
  }

  String _formatDobForDisplay(String? isoDate) {
    final normalized = _normalizeDate(isoDate);
    if (normalized == null) return '';
    final parts = normalized.split('-');
    if (parts.length != 3) return normalized;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }

  bool _isCurrentSameAsPermanent() {
    final currentAddress = _currentAddressCtrl.text.trim();
    final currentCity = _currentCityCtrl.text.trim();
    final currentState = _currentStateCtrl.text.trim();
    final currentPincode = _currentPincodeCtrl.text.trim();
    final allCurrentEmpty = currentAddress.isEmpty &&
        currentCity.isEmpty &&
        currentState.isEmpty &&
        currentPincode.isEmpty;

    if (allCurrentEmpty) return true;

    return currentAddress.toLowerCase() ==
            _addressCtrl.text.trim().toLowerCase() &&
        currentCity.toLowerCase() == _cityCtrl.text.trim().toLowerCase() &&
        currentState.toLowerCase() == _stateCtrl.text.trim().toLowerCase() &&
        currentPincode == _pincodeCtrl.text.trim();
  }

  void _copyPermanentToCurrent() {
    _currentAddressCtrl.text = _addressCtrl.text;
    _currentCityCtrl.text = _cityCtrl.text;
    _currentStateCtrl.text = _stateCtrl.text;
    _currentPincodeCtrl.text = _pincodeCtrl.text;
  }

  void _toggleSameAsPermanent(bool value) {
    if (value) {
      setState(() {
        _sameAsPermanent = true;
        _copyPermanentToCurrent();
      });
      return;
    }

    setState(() {
      _sameAsPermanent = false;
      if (_isCurrentSameAsPermanent()) {
        _currentAddressCtrl.clear();
        _currentCityCtrl.clear();
        _currentStateCtrl.clear();
        _currentPincodeCtrl.clear();
      }
    });
  }

  Future<void> _fetchKycStatus() async {
    try {
      final auth = context.read<AuthProvider>();
      final res = await ApiService.get('/kyc/status');
      if (res['success'] == true && mounted) {
        final connected = res['data']?['digilocker_connected'] == true;

        String? verifiedDob = _verifiedDobIso;
        String? verifiedGender = _verifiedGender;
        String? verifiedPan;
        if (connected) {
          await auth.refreshProfile();
          final refreshedUser = auth.user;
          verifiedDob = _normalizeDate(refreshedUser?.dateOfBirth);
          verifiedGender = _normalizeGender(refreshedUser?.gender);
          verifiedPan = (refreshedUser?.panNumber ?? '').trim().toUpperCase();
        }

        if (!mounted) return;
        setState(() {
          _digilockerConnected = connected;
          _verifiedDobIso = verifiedDob;
          _verifiedGender = verifiedGender;
          if (verifiedDob != null) {
            _dobCtrl.text = _formatDobForDisplay(verifiedDob);
          }
          if (verifiedGender != null) {
            _selectedGender = verifiedGender;
          }
          if (verifiedPan != null && verifiedPan.isNotEmpty) {
            _panCtrl.text = verifiedPan;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final initialIso = _normalizeDate(_dobCtrl.text);
    final initial =
        (initialIso != null ? DateTime.tryParse(initialIso) : null) ??
            DateTime(now.year - 25, 1, 1);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1940, 1, 1),
      lastDate: now,
    );
    if (picked != null) {
      setState(() {
        _dobCtrl.text =
            _formatDobForDisplay(picked.toIso8601String().split('T').first);
      });
    }
  }

  Future<void> _lookupIfsc(String rawValue) async {
    final requestId = ++_ifscLookupRequestId;
    final ifsc = rawValue.trim().toUpperCase();
    if (ifsc.length < 11) {
      if (mounted) {
        setState(() {
          _lastRequestedIfsc = '';
          _bankNameCtrl.clear();
          _ifscBankName = null;
          _ifscBranch = null;
          _ifscLookupError = null;
          _resetAccountLookupState();
          _isIfscLoading = false;
        });
      }
      return;
    }

    if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) {
      if (mounted) {
        setState(() {
          _lastRequestedIfsc = '';
          _bankNameCtrl.clear();
          _ifscBankName = null;
          _ifscBranch = null;
          _resetAccountLookupState();
          _ifscLookupError = 'Invalid IFSC format';
          _isIfscLoading = false;
        });
      }
      return;
    }

    if ((ifsc == _lastRequestedIfsc && _ifscBankName != null) ||
        (ifsc == _lastRequestedIfsc && _isIfscLoading)) {
      return;
    }
    _lastRequestedIfsc = ifsc;

    if (mounted) {
      setState(() {
        _isIfscLoading = true;
        _resetAccountLookupState();
        _ifscLookupError = null;
      });
    }

    try {
      final response = await ApiService.get('/users/bank/ifsc/$ifsc');
      if (!mounted || requestId != _ifscLookupRequestId) return;

      if (response['success'] == true) {
        final data = Map<String, dynamic>.from(response['data'] ?? const {});
        final bank = (data['bank'] ?? '').toString().trim();
        final branch = (data['branch'] ?? '').toString().trim();

        setState(() {
          _ifscBankName = bank.isNotEmpty ? bank : null;
          _ifscBranch = branch.isNotEmpty ? branch : null;
          _ifscLookupError = null;
          _bankNameCtrl.text = bank;
        });
        _scheduleAccountVerification();
      } else {
        final fallback = await _lookupIfscFromPublicApi(ifsc);
        if (!mounted || requestId != _ifscLookupRequestId) return;
        if (fallback != null) {
          setState(() {
            _ifscBankName =
                fallback['bank']!.isNotEmpty ? fallback['bank'] : null;
            _ifscBranch =
                fallback['branch']!.isNotEmpty ? fallback['branch'] : null;
            _ifscLookupError = null;
            _bankNameCtrl.text = fallback['bank']!;
          });
          _scheduleAccountVerification();
        } else {
          setState(() {
            _lastRequestedIfsc = '';
            _bankNameCtrl.clear();
            _ifscBankName = null;
            _ifscBranch = null;
            _resetAccountLookupState();
            _ifscLookupError =
                (response['message'] ?? 'Unable to validate IFSC').toString();
          });
        }
      }
    } catch (_) {
      final fallback = await _lookupIfscFromPublicApi(ifsc);
      if (!mounted || requestId != _ifscLookupRequestId) return;
      if (fallback != null) {
        setState(() {
          _ifscBankName =
              fallback['bank']!.isNotEmpty ? fallback['bank'] : null;
          _ifscBranch =
              fallback['branch']!.isNotEmpty ? fallback['branch'] : null;
          _ifscLookupError = null;
          _bankNameCtrl.text = fallback['bank']!;
        });
        _scheduleAccountVerification();
      } else {
        setState(() {
          _lastRequestedIfsc = '';
          _bankNameCtrl.clear();
          _ifscBankName = null;
          _ifscBranch = null;
          _resetAccountLookupState();
          _ifscLookupError = 'Unable to validate IFSC right now';
        });
      }
    } finally {
      if (mounted && requestId == _ifscLookupRequestId) {
        setState(() => _isIfscLoading = false);
      }
    }
  }

  Future<Map<String, String>?> _lookupIfscFromPublicApi(String ifsc) async {
    try {
      final response = await http
          .get(Uri.parse('https://ifsc.razorpay.com/$ifsc'))
          .timeout(const Duration(seconds: 8));
      if (response.statusCode != 200 || response.body.trim().isEmpty) {
        return null;
      }

      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) return null;
      final bank = (body['BANK'] ?? '').toString().trim();
      final branch = (body['BRANCH'] ?? '').toString().trim();
      if (bank.isEmpty && branch.isEmpty) return null;

      return {
        'bank': bank,
        'branch': branch,
      };
    } catch (_) {
      return null;
    }
  }

  Future<void> _verifyBankAccountHolder() async {
    final accountNumber = _bankAccCtrl.text.trim();
    final ifsc = _bankIfscCtrl.text.trim().toUpperCase();
    final accountValid = RegExp(r'^\d{9,20}$').hasMatch(accountNumber);
    final ifscValid = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc);

    if (!accountValid) {
      if (mounted) {
        setState(() {
          _lastRequestedAccountKey = '';
          _isAccountLookupLoading = false;
          _accountHolderName = null;
          _accountLookupError = null;
          _accountLookupInfo = null;
          _lastVerifiedAccountKey = '';
        });
      }
      return;
    }

    if (!ifscValid) {
      if (mounted) {
        setState(() {
          _lastRequestedAccountKey = '';
          _isAccountLookupLoading = false;
          _accountHolderName = null;
          _accountLookupError = null;
          _accountLookupInfo = null;
          _lastVerifiedAccountKey = '';
        });
      }
      return;
    }

    if (_isIfscLoading) {
      if (mounted) {
        setState(() {
          _isAccountLookupLoading = false;
          _accountLookupError = null;
          _accountLookupInfo = null;
        });
      }
      return;
    }

    final ifscValidated = _isIfscResolved;
    if (!ifscValidated) {
      if (mounted) {
        setState(() {
          _resetAccountLookupState();
        });
      }
      return;
    }

    final currentKey = '$accountNumber|$ifsc';
    if ((currentKey == _lastRequestedAccountKey && _isAccountLookupLoading) ||
        (currentKey == _lastRequestedAccountKey &&
            _accountHolderName != null &&
            _accountLookupError == null)) {
      return;
    }
    if (currentKey == _lastVerifiedAccountKey && _accountHolderName != null) {
      return;
    }
    _lastRequestedAccountKey = currentKey;

    final requestId = ++_accountLookupRequestId;
    if (mounted) {
      setState(() {
        _isAccountLookupLoading = true;
        _accountLookupError = null;
        _accountLookupInfo = null;
      });
    }

    try {
      final response = await ApiService.post('/users/bank/verify-account', {
        'account_number': accountNumber,
        'ifsc': ifsc,
      });

      if (!mounted || requestId != _accountLookupRequestId) return;

      if (response['success'] == true) {
        final data = Map<String, dynamic>.from(response['data'] ?? const {});
        final holder = (data['account_holder_name'] ?? '').toString().trim();
        final bankFromVerify = (data['bank_name'] ?? '').toString().trim();
        final branchFromVerify = (data['branch'] ?? '').toString().trim();

        setState(() {
          _accountHolderName = holder.isNotEmpty ? holder : null;
          _accountLookupError = null;
          _accountLookupInfo = holder.isNotEmpty
              ? null
              : 'Account holder not found for entered details.';
          _lastVerifiedAccountKey = currentKey;

          if (bankFromVerify.isNotEmpty && _bankNameCtrl.text.trim().isEmpty) {
            _bankNameCtrl.text = bankFromVerify;
          }
          if (bankFromVerify.isNotEmpty) {
            _bankNameCtrl.text = bankFromVerify;
          }
          if (bankFromVerify.isNotEmpty) {
            _ifscBankName = bankFromVerify;
          }
          if (branchFromVerify.isNotEmpty) {
            _ifscBranch = branchFromVerify;
          }
        });
      } else {
        final backendMessage = (response['message'] ??
                'Unable to verify account holder right now.')
            .toString();
        final normalized = backendMessage.toLowerCase();
        final userFriendly = normalized.contains('something went wrong') ||
                normalized.contains('try after some time') ||
                normalized.contains('unable to verify') ||
                normalized.contains('failed') ||
                normalized.contains('right now')
            ? 'Could not verify this account right now. Please check number/IFSC and try again.'
            : backendMessage;
        setState(() {
          _accountHolderName = null;
          _accountLookupError = null;
          _accountLookupInfo = userFriendly;
          _lastRequestedAccountKey = '';
          _lastVerifiedAccountKey = '';
        });
      }
    } catch (_) {
      if (!mounted || requestId != _accountLookupRequestId) return;
      setState(() {
        _accountHolderName = null;
        _accountLookupError = null;
        _accountLookupInfo = 'Could not verify account details right now.';
        _lastRequestedAccountKey = '';
        _lastVerifiedAccountKey = '';
      });
    } finally {
      if (mounted && requestId == _accountLookupRequestId) {
        setState(() => _isAccountLookupLoading = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate() || _isSaving) return;

    final enteredDobIso = _normalizeDate(_dobCtrl.text);

    if (_digilockerConnected) {
      final enteredDob = enteredDobIso;
      final enteredGender = _normalizeGender(_selectedGender);
      if (_verifiedDobIso != null &&
          enteredDob != null &&
          enteredDob != _verifiedDobIso) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Date of birth must match your DigiLocker/PAN verified details.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      if (_verifiedGender != null &&
          enteredGender != null &&
          enteredGender != _verifiedGender) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Gender must match your DigiLocker/PAN verified details.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
    }

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Confirm Details'),
            content: const Text(
              'Please confirm all profile details are correct. Submitted details will be saved to your account.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Review Again'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Submit'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed) return;

    final payload = {
      'address': _addressCtrl.text.trim(),
      'city': _cityCtrl.text.trim(),
      'state': _stateCtrl.text.trim(),
      'pincode': _pincodeCtrl.text.trim(),
      'date_of_birth': enteredDobIso,
      'gender': _selectedGender,
      'pan_number': _panCtrl.text.trim().toUpperCase(),
      'nominee_name': _nomineeNameCtrl.text.trim(),
      'nominee_relationship': _nomineeRelCtrl.text.trim(),
      'bank_name': (_ifscBankName ?? _bankNameCtrl.text).trim(),
      'bank_account_number': _bankAccCtrl.text.trim(),
      'bank_ifsc_code': _bankIfscCtrl.text.trim().toUpperCase(),
      'current_address': _currentAddressCtrl.text.trim(),
      'current_city': _currentCityCtrl.text.trim(),
      'current_state': _currentStateCtrl.text.trim(),
      'current_pincode': _currentPincodeCtrl.text.trim(),
    };

    payload.removeWhere((key, value) => value == null);

    setState(() => _isSaving = true);
    try {
      final response = await ApiService.put('/users/profile', payload);
      if (!mounted) return;

      final ok = response['success'] == true;
      if (ok) {
        await context.read<AuthProvider>().refreshProfile();
        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                (response['message'] ?? 'Profile submitted for admin approval')
                    .toString()),
            backgroundColor: AppTheme.successColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                (response['message'] ?? 'Unable to update profile').toString()),
            backgroundColor: AppTheme.errorColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Unable to update profile right now. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  void dispose() {
    _accountLookupDebounce?.cancel();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _panCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    _dobCtrl.dispose();
    _nomineeNameCtrl.dispose();
    _nomineeRelCtrl.dispose();
    _bankAccCtrl.dispose();
    _bankIfscCtrl.dispose();
    _bankNameCtrl.dispose();
    _currentAddressCtrl.dispose();
    _currentCityCtrl.dispose();
    _currentStateCtrl.dispose();
    _currentPincodeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final profileStatus = (user?.profileEditStatus ?? 'none').toString();
    final isProfileLocked =
        profileStatus == 'pending' || profileStatus == 'approved';
    final isDobLocked = isProfileLocked ||
        (_digilockerConnected && (_verifiedDobIso?.trim().isNotEmpty ?? false));
    final isGenderLocked = isProfileLocked ||
        (_digilockerConnected && (_verifiedGender?.trim().isNotEmpty ?? false));
    final rejectionFields = (user?.profileEditRejectionFields ??
                user?.raw?['profile_edit_rejection_fields'] as List?)
            ?.map((e) => e.toString())
            .where((e) => e.trim().isNotEmpty)
            .toList() ??
        const [];
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('My Profile'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/support'),
            icon:
                const Icon(Icons.support_agent, color: Colors.white, size: 18),
            label: const Text('Support',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16)),
          ),
        ],
      ),
      body: AbsorbPointer(
        absorbing: false,
        child: Theme(
          data: Theme.of(context).copyWith(
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFFF5F5F5),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              errorBorder: InputBorder.none,
              disabledBorder: InputBorder.none,
              labelStyle: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(children: [
                // Pending approval banner
                if (user?.profileEditStatus == 'pending')
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.hourglass_top,
                          color: Colors.orange.shade700, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Changes Pending Approval',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Colors.orange.shade900)),
                            const SizedBox(height: 2),
                            Text(
                                'Some field changes are awaiting admin review.',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.orange.shade700)),
                          ],
                        ),
                      ),
                    ]),
                  ),
                if (user?.profileEditStatus == 'approved')
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.verified_rounded,
                          color: Colors.green.shade700, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Profile Approved',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Colors.green.shade900)),
                            const SizedBox(height: 2),
                            Text(
                                'Your submitted profile details were approved by admin and are now locked.',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green.shade700)),
                          ],
                        ),
                      ),
                    ]),
                  ),
                if (user?.profileEditStatus == 'rejected')
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(children: [
                      Icon(Icons.cancel_outlined,
                          color: Colors.red.shade700, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Changes Rejected',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Colors.red.shade900)),
                            const SizedBox(height: 2),
                            Text(
                                user?.profileEditRejectionReason ??
                                    'Profile submission rejected. Contact support for help.',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.red.shade700)),
                            if (rejectionFields.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Please update: ${rejectionFields.map((f) => f.replaceAll('_', ' ')).join(', ')}',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.red.shade800,
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                            const SizedBox(height: 4),
                            Text('You can edit and submit again.',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.red.shade700,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ]),
                  ),
                // Avatar — read-only. Photo comes from the live selfie uploaded in Documents.
                Center(
                  child: Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      (user?.profileImageUrl != null &&
                              user!.profileImageUrl!.isNotEmpty)
                          ? CircleAvatar(
                              radius: 52,
                              backgroundColor:
                                  AppTheme.primaryColor.withAlpha(38),
                              backgroundImage:
                                  NetworkImage(user.profileImageUrl!),
                            )
                          : CircleAvatar(
                              radius: 52,
                              backgroundColor:
                                  AppTheme.primaryColor.withAlpha(38),
                              child: Text(
                                user?.fullName.isNotEmpty == true
                                    ? user!.fullName[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                    fontSize: 40,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.primaryColor),
                              ),
                            ),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                            color: AppTheme.secondaryColor,
                            shape: BoxShape.circle),
                        child: const Icon(Icons.verified_user,
                            size: 16, color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Center(
                  child: Text(
                    'Profile photo is set from your live selfie in Documents',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 8),
                if (user?.memberId != null)
                  Text('Member ID: ${user!.memberId}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                const SizedBox(height: 24),

                // Editable fields
                _buildFormCard([
                  _ReadOnlyField(
                    label: 'Full Name',
                    value: _nameCtrl.text.isNotEmpty ? _nameCtrl.text : '—',
                    icon: Icons.person_outline,
                    note: 'Synced from PAN/Aadhaar/DigiLocker',
                  ),
                  const Divider(height: 1),
                  _ReadOnlyField(
                    label: 'Email Address',
                    value: _emailCtrl.text.isNotEmpty ? _emailCtrl.text : '—',
                    icon: Icons.email_outlined,
                    note: 'Cannot be changed',
                  ),
                ]),
                const SizedBox(height: 16),

                // Read-only + PAN
                _buildFormCard([
                  _ReadOnlyField(
                    label: 'Mobile Number',
                    value: user?.mobile ?? '—',
                    icon: Icons.phone_outlined,
                    note: 'Cannot be changed',
                  ),
                  const Divider(height: 1),
                  if (_digilockerConnected)
                    _ReadOnlyField(
                      label: 'PAN Number',
                      value: _panCtrl.text.isNotEmpty ? _panCtrl.text : '—',
                      icon: Icons.credit_card,
                      note: 'DigiLocker Verified — cannot be edited',
                    )
                  else
                    _FormField(
                      controller: _panCtrl,
                      label: 'PAN Number',
                      icon: Icons.credit_card,
                      textCapitalization: TextCapitalization.characters,
                      hint: 'ABCDE1234F',
                      enabled: !isProfileLocked,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty)
                          return 'PAN Number is required';
                        if (!RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$')
                            .hasMatch(v.trim().toUpperCase())) {
                          return 'Invalid PAN format';
                        }
                        return null;
                      },
                    ),
                ]),
                const SizedBox(height: 16),

                // Personal Details
                _buildSectionLabel('Personal Details'),
                _buildFormCard([
                  _FormField(
                    controller: _dobCtrl,
                    label: 'Date of Birth',
                    icon: Icons.cake_outlined,
                    hint: 'DD/MM/YYYY',
                    keyboardType: TextInputType.datetime,
                    readOnly: true,
                    enabled: !isDobLocked,
                    onTap: isDobLocked ? null : _pickDateOfBirth,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Date of Birth is required';
                      }
                      if (_normalizeDate(v) == null) {
                        return 'Enter DOB in DD/MM/YYYY format';
                      }
                      return null;
                    },
                  ),
                  const Divider(height: 1),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: DropdownButtonFormField<String>(
                      value: _selectedGender,
                      decoration: const InputDecoration(
                        labelText: 'Gender',
                        prefixIcon: Icon(Icons.wc, size: 20),
                        border: InputBorder.none,
                      ),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('Male')),
                        DropdownMenuItem(
                            value: 'female', child: Text('Female')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: isGenderLocked
                          ? null
                          : (value) => setState(() => _selectedGender = value),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Gender is required';
                        }
                        return null;
                      },
                    ),
                  ),
                  if (_digilockerConnected && (isDobLocked || isGenderLocked))
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Text(
                        'Date of birth and gender are locked to DigiLocker/PAN verified data.',
                        style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                      ),
                    ),
                ]),
                const SizedBox(height: 16),

                // Address
                _buildSectionLabel('Address'),
                _buildFormCard([
                  _FormField(
                    controller: _addressCtrl,
                    label: 'Address',
                    icon: Icons.home_outlined,
                    hint: 'Street / Area / Locality',
                    enabled: !isProfileLocked,
                    onChanged: isProfileLocked
                        ? null
                        : (_) {
                            if (_sameAsPermanent) {
                              setState(_copyPermanentToCurrent);
                            }
                          },
                    validator: (v) => _requiredValidator(v, 'Address'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _cityCtrl,
                    label: 'City',
                    icon: Icons.location_city_outlined,
                    enabled: !isProfileLocked,
                    onChanged: isProfileLocked
                        ? null
                        : (_) {
                            if (_sameAsPermanent) {
                              setState(_copyPermanentToCurrent);
                            }
                          },
                    validator: (v) => _requiredValidator(v, 'City'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _stateCtrl,
                    label: 'State',
                    icon: Icons.map_outlined,
                    enabled: !isProfileLocked,
                    onChanged: isProfileLocked
                        ? null
                        : (_) {
                            if (_sameAsPermanent) {
                              setState(_copyPermanentToCurrent);
                            }
                          },
                    validator: (v) => _requiredValidator(v, 'State'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _pincodeCtrl,
                    label: 'Pincode',
                    icon: Icons.pin_drop_outlined,
                    keyboardType: TextInputType.number,
                    hint: '500001',
                    enabled: !isProfileLocked,
                    onChanged: isProfileLocked
                        ? null
                        : (_) {
                            if (_sameAsPermanent) {
                              setState(_copyPermanentToCurrent);
                            }
                          },
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    validator: (v) {
                      if (v == null || v.trim().isEmpty)
                        return 'Pincode is required';
                      if (!RegExp(r'^\d{6}$').hasMatch(v.trim()))
                        return 'Enter 6-digit pincode';
                      return null;
                    },
                  ),
                ]),
                const SizedBox(height: 16),

                // Current Address
                _buildSectionLabel('Current Address'),
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: isProfileLocked
                        ? null
                        : () => _toggleSameAsPermanent(!_sameAsPermanent),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Icon(
                            _sameAsPermanent
                                ? Icons.check_box
                                : Icons.check_box_outline_blank,
                            size: 18,
                            color: _sameAsPermanent
                                ? AppTheme.primaryColor
                                : Colors.grey,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Same as Permanent Address',
                              style: TextStyle(
                                fontSize: 12,
                                color: _sameAsPermanent
                                    ? AppTheme.primaryColor
                                    : Colors.grey[700],
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                _buildFormCard([
                  _FormField(
                    controller: _currentAddressCtrl,
                    label: 'Current Address',
                    icon: Icons.location_on_outlined,
                    hint: 'Street / Area / Locality',
                    enabled: !isProfileLocked && !_sameAsPermanent,
                    validator: (v) => _requiredValidator(v, 'Current Address'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _currentCityCtrl,
                    label: 'City',
                    icon: Icons.location_city_outlined,
                    enabled: !isProfileLocked && !_sameAsPermanent,
                    validator: (v) => _requiredValidator(v, 'Current City'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _currentStateCtrl,
                    label: 'State',
                    icon: Icons.map_outlined,
                    enabled: !isProfileLocked && !_sameAsPermanent,
                    validator: (v) => _requiredValidator(v, 'Current State'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _currentPincodeCtrl,
                    label: 'Pincode',
                    icon: Icons.pin_drop_outlined,
                    keyboardType: TextInputType.number,
                    hint: '500001',
                    enabled: !isProfileLocked && !_sameAsPermanent,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    validator: (v) {
                      if (v == null || v.trim().isEmpty)
                        return 'Current pincode is required';
                      if (!RegExp(r'^\d{6}$').hasMatch(v.trim()))
                        return 'Enter 6-digit pincode';
                      return null;
                    },
                  ),
                ]),
                const SizedBox(height: 16),

                // Nominee Details
                _buildSectionLabel('Nominee Details'),
                _buildFormCard([
                  _FormField(
                    controller: _nomineeNameCtrl,
                    label: 'Nominee Name',
                    icon: Icons.person_add_outlined,
                    enabled: !isProfileLocked,
                    validator: (v) => _requiredValidator(v, 'Nominee Name'),
                  ),
                  const Divider(height: 1),
                  _FormField(
                    controller: _nomineeRelCtrl,
                    label: 'Relationship',
                    icon: Icons.people_outline,
                    hint: 'e.g. Spouse, Parent, Sibling',
                    enabled: !isProfileLocked,
                    validator: (v) =>
                        _requiredValidator(v, 'Nominee Relationship'),
                  ),
                ]),
                const SizedBox(height: 16),

                // Bank Details
                _buildSectionLabel('Bank Details'),
                _buildFormCard([
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.blue.withAlpha(12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.blue.withAlpha(45)),
                      ),
                      child: Text(
                        _isIfscResolved
                            ? 'Bank: ${_ifscBankName ?? '-'}\nBranch: ${_ifscBranch ?? '-'}'
                            : 'Bank name and branch are fetched automatically from IFSC code.',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                  _FormField(
                    controller: _bankIfscCtrl,
                    label: 'IFSC Code',
                    icon: Icons.code_outlined,
                    textCapitalization: TextCapitalization.characters,
                    hint: 'SBIN0001234',
                    enabled: !isProfileLocked,
                    onChanged: isProfileLocked
                        ? null
                        : (value) {
                            _lookupIfsc(value);
                          },
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
                      LengthLimitingTextInputFormatter(11),
                      UpperCaseTextFormatter(),
                    ],
                    validator: (v) {
                      if (v == null || v.trim().isEmpty)
                        return 'IFSC Code is required';
                      if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$')
                          .hasMatch(v.trim().toUpperCase())) {
                        return 'Invalid IFSC format';
                      }
                      return null;
                    },
                  ),
                  if (_isIfscLoading)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('Validating IFSC...'),
                        ],
                      ),
                    )
                  else if (_isIfscResolved)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.green.withAlpha(14),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.green.withAlpha(60)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_ifscBankName != null)
                              Text('Bank: $_ifscBankName',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            if (_ifscBranch != null)
                              Text('Branch: $_ifscBranch',
                                  style: const TextStyle(fontSize: 12)),
                          ],
                        ),
                      ),
                    )
                  else if (_ifscLookupError != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Text(_ifscLookupError!,
                          style:
                              const TextStyle(color: Colors.red, fontSize: 11)),
                    ),
                  const Divider(height: 1),
                  if (_isIfscResolved) ...[
                    _FormField(
                      controller: _bankAccCtrl,
                      label: 'Account Number',
                      icon: Icons.numbers_outlined,
                      keyboardType: TextInputType.number,
                      enabled: !isProfileLocked,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(20),
                      ],
                      onChanged: (_) {
                        setState(() => _resetAccountLookupState());
                        _scheduleAccountVerification();
                      },
                      validator: (v) {
                        if (v == null || v.trim().isEmpty)
                          return 'Account Number is required';
                        if (!RegExp(r'^\d{9,20}$').hasMatch(v.trim())) {
                          return 'Enter a valid account number';
                        }
                        return null;
                      },
                    ),
                    if (_accountLookupInfo != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Text(
                          _accountLookupInfo!,
                          style: const TextStyle(
                              color: Colors.black54, fontSize: 11),
                        ),
                      ),
                    if (_isAccountLookupLoading)
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 8),
                            Text('Verifying account holder...'),
                          ],
                        ),
                      )
                    else if (_accountHolderName != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.green.withAlpha(14),
                            borderRadius: BorderRadius.circular(10),
                            border:
                                Border.all(color: Colors.green.withAlpha(45)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Verified account holder',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.black54),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _accountHolderName!,
                                style: const TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                      )
                    else if (_accountLookupError != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Text(
                          _accountLookupError!,
                          style:
                              const TextStyle(color: Colors.red, fontSize: 11),
                        ),
                      ),
                  ] else
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 10, 16, 12),
                      child: Text(
                        'Enter a valid IFSC first to unlock account verification.',
                        style: TextStyle(color: Colors.black54, fontSize: 11),
                      ),
                    ),
                ]),
                const SizedBox(height: 16),

                // Info note
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      color: Colors.blue.withAlpha(15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.blue.withAlpha(51))),
                  child: const Row(children: [
                    Icon(Icons.info_outline, color: Colors.blue, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Profile is verified by admin. If rejected, update requested fields and submit again.',
                        style: TextStyle(color: Colors.blue, fontSize: 12),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),

                if (!isProfileLocked)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSaving ? null : _saveProfile,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(_isSaving ? 'Saving...' : 'Save Profile'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  )
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Text(
                      profileStatus == 'pending'
                          ? 'Profile is locked while approval is pending.'
                          : 'Profile is in read-only mode.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: Colors.grey.shade700,
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFormCard(List<Widget> children) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 1,
      child: Column(children: children),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Colors.black54)),
    );
  }
}

String? _requiredValidator(String? value, String fieldLabel) {
  if (value == null || value.trim().isEmpty) {
    return '$fieldLabel is required';
  }
  return null;
}

class _FormField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? hint;
  final bool enabled;
  final bool readOnly;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;

  const _FormField({
    required this.controller,
    required this.label,
    required this.icon,
    this.validator,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.words,
    this.hint,
    this.enabled = true,
    this.readOnly = false,
    this.onTap,
    this.onChanged,
    this.inputFormatters,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        readOnly: readOnly,
        onTap: onTap,
        onChanged: onChanged,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        inputFormatters: inputFormatters,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: Icon(icon, size: 20),
          border: InputBorder.none,
          errorStyle: const TextStyle(fontSize: 11),
        ),
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final String? note;

  const _ReadOnlyField({
    required this.label,
    required this.value,
    required this.icon,
    this.note,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        Icon(icon, size: 20, color: Colors.grey),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
          if (note != null)
            Text(note!,
                style: const TextStyle(color: Colors.grey, fontSize: 11)),
        ]),
      ]),
    );
  }
}

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final upperText = newValue.text.toUpperCase();
    return TextEditingValue(
      text: upperText,
      selection: newValue.selection,
      composing: TextRange.empty,
    );
  }
}
