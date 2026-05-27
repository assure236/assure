import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
    _dobCtrl = TextEditingController(text: user?.dateOfBirth ?? '');
    _nomineeNameCtrl = TextEditingController(text: user?.nomineeName ?? '');
    _nomineeRelCtrl = TextEditingController(text: user?.nomineeRelationship ?? '');
    _bankAccCtrl = TextEditingController(text: user?.bankAccountNumber ?? '');
    _bankIfscCtrl = TextEditingController(text: user?.bankIfscCode ?? '');
    _bankNameCtrl = TextEditingController(text: user?.bankName ?? '');
    _currentAddressCtrl = TextEditingController(text: user?.currentAddress ?? '');
    _currentCityCtrl = TextEditingController(text: user?.currentCity ?? '');
    _currentStateCtrl = TextEditingController(text: user?.currentState ?? '');
    _currentPincodeCtrl = TextEditingController(text: user?.currentPincode ?? '');
    _selectedGender = user?.gender;
    _fetchKycStatus();
  }

  Future<void> _fetchKycStatus() async {
    try {
      final res = await ApiService.get('/kyc/status');
      if (res['success'] == true && mounted) {
        setState(() => _digilockerConnected = res['data']?['digilocker_connected'] == true);
      }
    } catch (_) {}
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(_dobCtrl.text) ?? DateTime(now.year - 25, 1, 1);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1940, 1, 1),
      lastDate: now,
    );
    if (picked != null) {
      setState(() {
        _dobCtrl.text = picked.toIso8601String().split('T').first;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate() || _isSaving) return;

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
      'date_of_birth': _dobCtrl.text.trim(),
      'gender': _selectedGender,
      'pan_number': _panCtrl.text.trim().toUpperCase(),
      'nominee_name': _nomineeNameCtrl.text.trim(),
      'nominee_relationship': _nomineeRelCtrl.text.trim(),
      'bank_name': _bankNameCtrl.text.trim(),
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
            content: Text((response['message'] ?? 'Profile updated successfully').toString()),
            backgroundColor: AppTheme.successColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text((response['message'] ?? 'Unable to update profile').toString()),
            backgroundColor: AppTheme.errorColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to update profile right now. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  void dispose() {
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
    final sameAsPermanent =
        (_currentAddressCtrl.text.trim().isEmpty &&
            _currentCityCtrl.text.trim().isEmpty &&
            _currentStateCtrl.text.trim().isEmpty &&
            _currentPincodeCtrl.text.trim().isEmpty) ||
        (_currentAddressCtrl.text.trim().toLowerCase() == _addressCtrl.text.trim().toLowerCase() &&
            _currentCityCtrl.text.trim().toLowerCase() == _cityCtrl.text.trim().toLowerCase() &&
            _currentStateCtrl.text.trim().toLowerCase() == _stateCtrl.text.trim().toLowerCase() &&
            _currentPincodeCtrl.text.trim() == _pincodeCtrl.text.trim());

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('My Profile'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/support'),
            icon: const Icon(Icons.support_agent, color: Colors.white, size: 18),
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
                  Icon(Icons.hourglass_top, color: Colors.orange.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Changes Pending Approval',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.orange.shade900)),
                        const SizedBox(height: 2),
                        Text('Some field changes are awaiting admin review.',
                            style: TextStyle(fontSize: 11, color: Colors.orange.shade700)),
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
                  Icon(Icons.cancel_outlined, color: Colors.red.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Changes Rejected',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.red.shade900)),
                        const SizedBox(height: 2),
                        Text(user?.profileEditRejectionReason ?? 'Your profile changes were rejected by admin.',
                            style: TextStyle(fontSize: 11, color: Colors.red.shade700)),
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
                  (user?.profileImageUrl != null && user!.profileImageUrl!.isNotEmpty)
                      ? CircleAvatar(
                          radius: 52,
                          backgroundColor: AppTheme.primaryColor.withAlpha(38),
                          backgroundImage: NetworkImage(user.profileImageUrl!),
                        )
                      : CircleAvatar(
                          radius: 52,
                          backgroundColor: AppTheme.primaryColor.withAlpha(38),
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
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'PAN Number is required';
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
                onTap: _pickDateOfBirth,
                validator: (v) => _requiredValidator(v, 'Date of Birth'),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: DropdownButtonFormField<String>(
                  value: _selectedGender,
                  decoration: const InputDecoration(
                    labelText: 'Gender',
                    prefixIcon: Icon(Icons.wc, size: 20),
                    border: InputBorder.none,
                  ),
                  items: const [
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (value) => setState(() => _selectedGender = value),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Gender is required';
                    }
                    return null;
                  },
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
                validator: (v) => _requiredValidator(v, 'Address'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _cityCtrl,
                label: 'City',
                icon: Icons.location_city_outlined,
                validator: (v) => _requiredValidator(v, 'City'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _stateCtrl,
                label: 'State',
                icon: Icons.map_outlined,
                validator: (v) => _requiredValidator(v, 'State'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _pincodeCtrl,
                label: 'Pincode',
                icon: Icons.pin_drop_outlined,
                keyboardType: TextInputType.number,
                hint: '500001',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Pincode is required';
                  if (!RegExp(r'^\d{6}$').hasMatch(v.trim())) return 'Enter 6-digit pincode';
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
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  Icon(
                    sameAsPermanent ? Icons.check_box : Icons.check_box_outline_blank,
                    size: 18,
                    color: sameAsPermanent ? AppTheme.primaryColor : Colors.grey,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Same as Permanent Address',
                    style: TextStyle(
                      fontSize: 12,
                      color: sameAsPermanent ? AppTheme.primaryColor : Colors.grey[700],
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            _buildFormCard([
              _FormField(
                controller: _currentAddressCtrl,
                label: 'Current Address',
                icon: Icons.location_on_outlined,
                hint: 'Street / Area / Locality',
                validator: (v) => _requiredValidator(v, 'Current Address'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentCityCtrl,
                label: 'City',
                icon: Icons.location_city_outlined,
                validator: (v) => _requiredValidator(v, 'Current City'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentStateCtrl,
                label: 'State',
                icon: Icons.map_outlined,
                validator: (v) => _requiredValidator(v, 'Current State'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentPincodeCtrl,
                label: 'Pincode',
                icon: Icons.pin_drop_outlined,
                keyboardType: TextInputType.number,
                hint: '500001',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Current pincode is required';
                  if (!RegExp(r'^\d{6}$').hasMatch(v.trim())) return 'Enter 6-digit pincode';
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
                validator: (v) => _requiredValidator(v, 'Nominee Name'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _nomineeRelCtrl,
                label: 'Relationship',
                icon: Icons.people_outline,
                hint: 'e.g. Spouse, Parent, Sibling',
                validator: (v) => _requiredValidator(v, 'Nominee Relationship'),
              ),
            ]),
            const SizedBox(height: 16),

            // Bank Details
            _buildSectionLabel('Bank Details'),
            _buildFormCard([
              _FormField(
                controller: _bankNameCtrl,
                label: 'Bank Name',
                icon: Icons.account_balance_outlined,
                validator: (v) => _requiredValidator(v, 'Bank Name'),
              ),
              const Divider(height: 1),
              _FormField(
                controller: _bankAccCtrl,
                label: 'Account Number',
                icon: Icons.numbers_outlined,
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Account Number is required';
                  if (!RegExp(r'^\d{9,18}$').hasMatch(v.trim())) {
                    return 'Enter a valid account number';
                  }
                  return null;
                },
              ),
              const Divider(height: 1),
              _FormField(
                controller: _bankIfscCtrl,
                label: 'IFSC Code',
                icon: Icons.code_outlined,
                textCapitalization: TextCapitalization.characters,
                hint: 'SBIN0001234',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'IFSC Code is required';
                  if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$')
                      .hasMatch(v.trim().toUpperCase())) {
                    return 'Invalid IFSC format';
                  }
                  return null;
                },
              ),
            ]),
            const SizedBox(height: 16),

            // Info note
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: Colors.blue.withAlpha(15),
                  borderRadius: BorderRadius.circular(12),
                  border:
                      Border.all(color: Colors.blue.withAlpha(51))),
              child: const Row(children: [
                Icon(Icons.info_outline, color: Colors.blue, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Profile changes are saved instantly. Keep details accurate for smoother KYC and payouts.',
                    style: TextStyle(color: Colors.blue, fontSize: 12),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSaving ? null : _saveProfile,
                icon: _isSaving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(_isSaving ? 'Saving...' : 'Save Profile'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
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
  final bool readOnly;
  final VoidCallback? onTap;

  const _FormField({
    required this.controller,
    required this.label,
    required this.icon,
    this.validator,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.words,
    this.hint,
    this.readOnly = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextFormField(
        controller: controller,
        readOnly: readOnly,
        onTap: onTap,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
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
          Text(label,
              style: const TextStyle(color: Colors.grey, fontSize: 12)),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.w500, fontSize: 14)),
          if (note != null)
            Text(note!,
                style:
                    const TextStyle(color: Colors.grey, fontSize: 11)),
        ]),
      ]),
    );
  }
}
