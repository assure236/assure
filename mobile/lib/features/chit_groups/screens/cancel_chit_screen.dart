import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class CancelChitScreen extends StatefulWidget {
  const CancelChitScreen({super.key});

  @override
  State<CancelChitScreen> createState() => _CancelChitScreenState();
}

class _CancelChitScreenState extends State<CancelChitScreen> {
  String? _selectedGroupId;
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;
  bool _confirmed = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedGroupId == null || _reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Please select a group and provide a reason'),
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }
    if (!_confirmed) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Please confirm you understand the cancellation terms'),
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    setState(() => _submitting = true);
    try {
      final res = await ApiService.post('/chit-groups/cancel-request', {
        'chit_group_id': _selectedGroupId,
        'reason': _reasonCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['success'] == true
              ? 'Cancellation request submitted!'
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
        title: const Text('Cancel Chit'),
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
                const Icon(Icons.cancel_presentation_outlined,
                    size: 48, color: AppTheme.errorColor),
                const SizedBox(height: 12),
                const Text('Cancel Chit Subscription',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(
                    'Request cancellation of your chit group subscription.',
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
                  controller: _reasonCtrl,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: 'Reason for Cancellation *',
                    hintText: 'Explain why you want to cancel',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.errorColor.withAlpha(60)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded,
                              color: AppTheme.errorColor, size: 18),
                          SizedBox(width: 8),
                          Text('Important Notice',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.errorColor,
                                  fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '• Cancellation is subject to company terms\n'
                        '• Forfeiture charges may apply\n'
                        '• Refund processing takes 15-30 business days',
                        style: TextStyle(
                            color: Colors.grey[700], fontSize: 12, height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  value: _confirmed,
                  onChanged: (val) =>
                      setState(() => _confirmed = val ?? false),
                  title: const Text(
                    'I understand the cancellation terms and agree to proceed',
                    style: TextStyle(fontSize: 13),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.primaryColor,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.send),
                    label: Text(_submitting
                        ? 'Submitting...'
                        : 'Submit Cancellation Request'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.errorColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
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
