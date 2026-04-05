import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class FamilyMembersScreen extends StatefulWidget {
  const FamilyMembersScreen({super.key});

  @override
  State<FamilyMembersScreen> createState() => _FamilyMembersScreenState();
}

class _FamilyMembersScreenState extends State<FamilyMembersScreen> {
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadMembers();
  }

  Future<void> _loadMembers() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.get('/users/family-members');
      if (res['success'] == true) {
        setState(() => _members = List<Map<String, dynamic>>.from(res['data'] ?? []));
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _addOrEdit({Map<String, dynamic>? member}) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _FamilyMemberForm(member: member),
    );
    if (result == null) return;

    try {
      Map<String, dynamic> res;
      if (member != null) {
        res = await ApiService.put('/users/family-members/${member['_id'] ?? member['id']}', result);
      } else {
        res = await ApiService.post('/users/family-members', result);
      }
      if (res['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(member != null ? 'Member updated' : 'Member added'),
            backgroundColor: AppTheme.successColor,
            behavior: SnackBarBehavior.floating,
          ));
        }
        _loadMembers();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? 'Operation failed'),
          backgroundColor: AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  Future<void> _deleteMember(Map<String, dynamic> member) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Remove Family Member'),
        content: Text('Remove ${member['full_name']} from your family list?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorColor, foregroundColor: Colors.white),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final res = await ApiService.delete('/users/family-members/${member['_id'] ?? member['id']}');
      if (res['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Family member removed'),
            backgroundColor: AppTheme.successColor,
            behavior: SnackBarBehavior.floating,
          ));
        }
        _loadMembers();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Family Members'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addOrEdit(),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add),
        label: const Text('Add Member'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadMembers,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _members.isEmpty
                ? ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                    Center(
                      child: Column(children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryColor.withAlpha(26),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.family_restroom, size: 64, color: AppTheme.primaryColor),
                        ),
                        const SizedBox(height: 16),
                        const Text('No Family Members', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Text('Tap + to add your first family member',
                            style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                      ]),
                    ),
                  ])
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _members.length,
                    itemBuilder: (ctx, i) => _MemberCard(
                      member: _members[i],
                      onEdit: () => _addOrEdit(member: _members[i]),
                      onDelete: () => _deleteMember(_members[i]),
                    ),
                  ),
      ),
    );
  }
}

class _MemberCard extends StatelessWidget {
  final Map<String, dynamic> member;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _MemberCard({required this.member, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final name = member['full_name'] ?? '';
    final relationship = member['relationship'] ?? '';
    final mobile = member['mobile'] ?? '';
    final isNominee = member['is_nominee'] == true;
    final gender = member['gender'];

    IconData genderIcon;
    switch (gender) {
      case 'female':
        genderIcon = Icons.woman;
        break;
      case 'male':
        genderIcon = Icons.man;
        break;
      default:
        genderIcon = Icons.person;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: AppTheme.primaryColor.withAlpha(26),
              child: Icon(genderIcon, color: AppTheme.primaryColor, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          overflow: TextOverflow.ellipsis),
                    ),
                    if (isNominee) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.secondaryColor.withAlpha(38),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('Nominee', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.secondaryColor)),
                      ),
                    ],
                  ]),
                  const SizedBox(height: 4),
                  Text(
                    '${relationship.isNotEmpty ? '${relationship[0].toUpperCase()}${relationship.substring(1)}' : ''}${mobile.isNotEmpty ? ' • $mobile' : ''}',
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'edit') onEdit();
                if (v == 'delete') onDelete();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit, size: 18), SizedBox(width: 8), Text('Edit')])),
                PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete, size: 18, color: Colors.red), SizedBox(width: 8), Text('Remove', style: TextStyle(color: Colors.red))])),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FamilyMemberForm extends StatefulWidget {
  final Map<String, dynamic>? member;
  const _FamilyMemberForm({this.member});

  @override
  State<_FamilyMemberForm> createState() => _FamilyMemberFormState();
}

class _FamilyMemberFormState extends State<_FamilyMemberForm> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _mobileCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _dobCtrl;
  late TextEditingController _aadhaarCtrl;
  late TextEditingController _panCtrl;
  String _relationship = 'spouse';
  String? _gender;
  bool _isNominee = false;

  static const _relationships = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'other'];

  @override
  void initState() {
    super.initState();
    final m = widget.member;
    _nameCtrl = TextEditingController(text: m?['full_name'] ?? '');
    _mobileCtrl = TextEditingController(text: m?['mobile'] ?? '');
    _emailCtrl = TextEditingController(text: m?['email'] ?? '');
    _dobCtrl = TextEditingController(text: m?['date_of_birth'] ?? '');
    _aadhaarCtrl = TextEditingController(text: m?['aadhaar_number'] ?? '');
    _panCtrl = TextEditingController(text: m?['pan_number'] ?? '');
    _relationship = m?['relationship'] ?? 'spouse';
    _gender = m?['gender'];
    _isNominee = m?['is_nominee'] == true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _dobCtrl.dispose();
    _aadhaarCtrl.dispose();
    _panCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  widget.member != null ? 'Edit Family Member' : 'Add Family Member',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(children: [
                    TextFormField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Full Name *', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _relationship,
                      decoration: const InputDecoration(labelText: 'Relationship *', prefixIcon: Icon(Icons.people_outline)),
                      items: _relationships.map((r) => DropdownMenuItem(value: r, child: Text('${r[0].toUpperCase()}${r.substring(1)}'))).toList(),
                      onChanged: (v) => setState(() => _relationship = v!),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _mobileCtrl,
                      decoration: const InputDecoration(labelText: 'Mobile', prefixIcon: Icon(Icons.phone_outlined)),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emailCtrl,
                      decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dobCtrl,
                      decoration: const InputDecoration(labelText: 'Date of Birth', prefixIcon: Icon(Icons.cake_outlined), hintText: 'DD/MM/YYYY'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _gender,
                      decoration: const InputDecoration(labelText: 'Gender', prefixIcon: Icon(Icons.wc)),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('Male')),
                        DropdownMenuItem(value: 'female', child: Text('Female')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _aadhaarCtrl,
                      decoration: const InputDecoration(labelText: 'Aadhaar Number', prefixIcon: Icon(Icons.fingerprint)),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _panCtrl,
                      decoration: const InputDecoration(labelText: 'PAN Number', prefixIcon: Icon(Icons.credit_card)),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      title: const Text('Mark as Nominee'),
                      subtitle: const Text('This person will be your chit nominee'),
                      value: _isNominee,
                      onChanged: (v) => setState(() => _isNominee = v),
                      activeColor: AppTheme.secondaryColor,
                      contentPadding: EdgeInsets.zero,
                    ),
                    const SizedBox(height: 16),
                  ]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      if (!_formKey.currentState!.validate()) return;
                      Navigator.pop(context, {
                        'full_name': _nameCtrl.text.trim(),
                        'relationship': _relationship,
                        'mobile': _mobileCtrl.text.trim(),
                        'email': _emailCtrl.text.trim(),
                        'date_of_birth': _dobCtrl.text.trim(),
                        'gender': _gender,
                        'aadhaar_number': _aadhaarCtrl.text.trim(),
                        'pan_number': _panCtrl.text.trim().toUpperCase(),
                        'is_nominee': _isNominee,
                      });
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(widget.member != null ? 'Update' : 'Add Member',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
