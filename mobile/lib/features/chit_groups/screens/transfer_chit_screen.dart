import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class TransferChitScreen extends StatefulWidget {
  const TransferChitScreen({super.key});

  @override
  State<TransferChitScreen> createState() => _TransferChitScreenState();
}

class _TransferChitScreenState extends State<TransferChitScreen> {
  String? _selectedGroupId;
  final _recipientCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _recipientCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedGroupId == null ||
        _recipientCtrl.text.trim().isEmpty ||
        _reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Please fill all fields'),
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    setState(() => _submitting = true);
    try {
      final res = await ApiService.post('/chit-groups/transfer-request', {
        'chit_group_id': _selectedGroupId,
        'recipient_member_id': _recipientCtrl.text.trim(),
        'reason': _reasonCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['success'] == true
              ? 'Transfer request submitted!'
              : res['message'] ?? 'Failed to submit'),
          backgroundColor:
              res['success'] == true ? AppTheme.successColor : AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ));
        if (res['success'] == true) Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to submit request'),
          backgroundColor: AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
    if (mounted) setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Transfer Chit'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Consumer<ChitGroupProvider>(
        builder: (context, provider, _) {
          final activeGroups =
              provider.chitGroups.where((g) => g.status == 'active').toList();

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.swap_horiz, size: 48, color: AppTheme.primaryColor),
                const SizedBox(height: 12),
                const Text('Transfer Your Chit',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Submit a request to transfer your chit to another member.',
                    style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                const SizedBox(height: 24),
                DropdownButtonFormField<String>(
                  value: _selectedGroupId,
                  decoration: InputDecoration(
                    labelText: 'Select Chit Group *',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.groups_outlined),
                  ),
                  items: activeGroups
                      .map((g) => DropdownMenuItem(
                            value: g.id,
                            child: Text('${g.groupName} (${g.groupNumber})'),
                          ))
                      .toList(),
                  onChanged: (val) => setState(() => _selectedGroupId = val),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _recipientCtrl,
                  decoration: InputDecoration(
                    labelText: 'Recipient Member ID *',
                    hintText: 'Enter the member ID to transfer to',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _reasonCtrl,
                  maxLines: 3,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: 'Reason for Transfer *',
                    hintText: 'Explain why you want to transfer',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.send),
                    label: Text(_submitting ? 'Submitting...' : 'Submit Request'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.withAlpha(80)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.amber, size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Transfer requests are subject to approval by Assure Chit Funds management.',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
