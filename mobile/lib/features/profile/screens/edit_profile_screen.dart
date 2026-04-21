import 'package:flutter/material.dart';
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
  bool _saving = false;
  bool _digilockerConnected = false;

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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final res = await ApiService.put('/users/profile', {
        'full_name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        if (_panCtrl.text.trim().isNotEmpty) 'pan_number': _panCtrl.text.trim().toUpperCase(),
        'address': _addressCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
        'state': _stateCtrl.text.trim(),
        'pincode': _pincodeCtrl.text.trim(),
        if (_dobCtrl.text.trim().isNotEmpty) 'date_of_birth': _dobCtrl.text.trim(),
        if (_selectedGender != null) 'gender': _selectedGender,
        'nominee_name': _nomineeNameCtrl.text.trim(),
        'nominee_relationship': _nomineeRelCtrl.text.trim(),
        'bank_account_number': _bankAccCtrl.text.trim(),
        'bank_ifsc_code': _bankIfscCtrl.text.trim().toUpperCase(),
        'bank_name': _bankNameCtrl.text.trim(),
        if (_currentAddressCtrl.text.trim().isNotEmpty) 'current_address': _currentAddressCtrl.text.trim(),
        if (_currentCityCtrl.text.trim().isNotEmpty) 'current_city': _currentCityCtrl.text.trim(),
        if (_currentStateCtrl.text.trim().isNotEmpty) 'current_state': _currentStateCtrl.text.trim(),
        if (_currentPincodeCtrl.text.trim().isNotEmpty) 'current_pincode': _currentPincodeCtrl.text.trim(),
      });
      if (mounted) {
        await context.read<AuthProvider>().refreshProfile();
        final pendingApproval = res['pending_approval'] == true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(pendingApproval
                ? 'Saved! Some changes need admin approval.'
                : 'Profile updated successfully'),
            backgroundColor: pendingApproval ? Colors.orange : AppTheme.successColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Update failed: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Edit Profile'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : const Text('Save',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16)),
          ),
        ],
      ),
      body: SingleChildScrollView(
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
              _FormField(
                controller: _nameCtrl,
                label: 'Full Name',
                icon: Icons.person_outline,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Name is required';
                  if (v.trim().length < 3) return 'Name too short';
                  return null;
                },
              ),
              const Divider(height: 1),
              _FormField(
                controller: _emailCtrl,
                label: 'Email Address',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email is required';
                  if (!RegExp(r'^[\w.-]+@[\w.-]+\.\w+$').hasMatch(v.trim())) {
                    return 'Enter a valid email';
                  }
                  return null;
                },
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
                    if (v == null || v.trim().isEmpty) return null;
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
                  onChanged: (v) => setState(() => _selectedGender = v),
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
              ),
              const Divider(height: 1),
              _FormField(
                controller: _cityCtrl,
                label: 'City',
                icon: Icons.location_city_outlined,
              ),
              const Divider(height: 1),
              _FormField(
                controller: _stateCtrl,
                label: 'State',
                icon: Icons.map_outlined,
              ),
              const Divider(height: 1),
              _FormField(
                controller: _pincodeCtrl,
                label: 'Pincode',
                icon: Icons.pin_drop_outlined,
                keyboardType: TextInputType.number,
                hint: '500001',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  if (!RegExp(r'^\d{6}$').hasMatch(v.trim())) return 'Enter 6-digit pincode';
                  return null;
                },
              ),
            ]),
            const SizedBox(height: 16),

            // Current Address
            _buildSectionLabel('Current Address'),
            _buildFormCard([
              _FormField(
                controller: _currentAddressCtrl,
                label: 'Current Address',
                icon: Icons.location_on_outlined,
                hint: 'Street / Area / Locality',
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentCityCtrl,
                label: 'City',
                icon: Icons.location_city_outlined,
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentStateCtrl,
                label: 'State',
                icon: Icons.map_outlined,
              ),
              const Divider(height: 1),
              _FormField(
                controller: _currentPincodeCtrl,
                label: 'Pincode',
                icon: Icons.pin_drop_outlined,
                keyboardType: TextInputType.number,
                hint: '500001',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
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
              ),
              const Divider(height: 1),
              _FormField(
                controller: _nomineeRelCtrl,
                label: 'Relationship',
                icon: Icons.people_outline,
                hint: 'e.g. Spouse, Parent, Sibling',
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
              ),
              const Divider(height: 1),
              _FormField(
                controller: _bankAccCtrl,
                label: 'Account Number',
                icon: Icons.numbers_outlined,
                keyboardType: TextInputType.number,
              ),
              const Divider(height: 1),
              _FormField(
                controller: _bankIfscCtrl,
                label: 'IFSC Code',
                icon: Icons.code_outlined,
                textCapitalization: TextCapitalization.characters,
                hint: 'SBIN0001234',
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
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
                    'Changes to Name, Email, PAN and Bank details require admin approval for security.',
                    style: TextStyle(color: Colors.blue, fontSize: 12),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 32),
          ]),
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

class _FormField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? hint;

  const _FormField({
    required this.controller,
    required this.label,
    required this.icon,
    this.validator,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.words,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextFormField(
        controller: controller,
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
