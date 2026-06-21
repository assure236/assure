import 'package:flutter/material.dart';

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
        if (res['success'] == true && res['requires_otp'] == true) {
          final otp = await _askOtp(result['member_id']?.toString() ?? '');
          if (otp == null) return;
          res = await ApiService.post('/users/family-members', {
            'member_id': result['member_id'],
            'otp': otp,
          });
        }
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

  Future<String?> _askOtp(String memberId) async {
    final otpCtrl = TextEditingController();
    String? error;
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, ss) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Enter OTP', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('OTP sent for Member ID $memberId', style: const TextStyle(color: Colors.black54, fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: otpCtrl,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: InputDecoration(
                  labelText: '6-digit OTP',
                  errorText: error,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (otpCtrl.text.trim().length != 6) {
                      ss(() => error = 'Enter a valid 6-digit OTP');
                      return;
                    }
                    Navigator.pop(ctx, otpCtrl.text.trim());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Verify & Link'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
                      onDelete: () => _deleteMember(_members[i]),
                    ),
                  ),
      ),
    );
  }
}

class _MemberCard extends StatelessWidget {
  final Map<String, dynamic> member;
  final VoidCallback onDelete;

  const _MemberCard({required this.member, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final name = member['full_name'] ?? '';
    final memberId = member['member_id']?.toString() ?? '';
    final mobile = member['mobile'] ?? '';
    final isNominee = member['is_nominee'] == true;
    final status = (member['status'] ?? 'pending').toString();
    final gender = member['gender'];

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'approved':
      case 'linked':
        statusColor = AppTheme.successColor;
        statusLabel = 'Linked';
        break;
      case 'rejected':
        statusColor = AppTheme.errorColor;
        statusLabel = 'Rejected';
        break;
      default:
        statusColor = AppTheme.warningColor;
        statusLabel = 'Pending';
    }

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
              backgroundColor: statusColor.withAlpha(26),
              child: Icon(genderIcon, color: statusColor, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text(
                        memberId.isNotEmpty ? memberId : name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha(30),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(statusLabel,
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
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
                    name.isNotEmpty ? '${name}${mobile.isNotEmpty ? ' • $mobile' : ''}' : mobile,
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'delete') onDelete();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete, size: 18, color: AppTheme.errorColor), SizedBox(width: 8), Text('Remove', style: TextStyle(color: AppTheme.errorColor))])),
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
  late TextEditingController _memberIdCtrl;

  @override
  void initState() {
    super.initState();
    final m = widget.member;
    _memberIdCtrl = TextEditingController(text: m?['member_id'] ?? m?['full_name'] ?? '');
  }

  @override
  void dispose() {
    _memberIdCtrl.dispose();
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
                      controller: _memberIdCtrl,
                      decoration: const InputDecoration(labelText: 'Member ID *', prefixIcon: Icon(Icons.badge_outlined)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Member ID is required' : null,
                    ),
                    const SizedBox(height: 12),
                    const Text('An OTP will be sent to the member\'s registered mobile number for verification. After verification, the request will be sent to Admin for approval.', style: TextStyle(fontSize: 12, color: Colors.grey)),
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
                        'member_id': _memberIdCtrl.text.trim(),
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
