import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

class ApplyLoanScreen extends StatefulWidget {
  const ApplyLoanScreen({super.key});

  @override
  State<ApplyLoanScreen> createState() => _ApplyLoanScreenState();
}

class _ApplyLoanScreenState extends State<ApplyLoanScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _loans = [];

  @override
  void initState() {
    super.initState();
    _fetchLoans();
  }

  Future<void> _fetchLoans() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.get('/loans/my-loans');
      if (res['success'] == true) {
        setState(() => _loans = List<Map<String, dynamic>>.from(res['data'] ?? []));
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  void _showApplyForm() {
    final amountCtrl = TextEditingController();
    final tenureCtrl = TextEditingController(text: '12');
    final purposeCtrl = TextEditingController();
    bool acceptedTerms = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.account_balance_wallet, color: AppTheme.primaryColor),
                    const SizedBox(width: 8),
                    const Text('Apply for Loan',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    const Spacer(),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Loan Amount *',
                    hintText: 'e.g. 50000',
                    prefixText: '₹ ',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.currency_rupee),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: tenureCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Tenure (months) *',
                    hintText: '1-60',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.calendar_month),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: purposeCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Purpose (optional)',
                    hintText: 'Why do you need this loan?',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.note),
                  ),
                ),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: acceptedTerms,
                  onChanged: (v) => setSheetState(() => acceptedTerms = v ?? false),
                  title: RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 13, color: Colors.black87, height: 1.35),
                      children: [
                        const TextSpan(text: 'I agree to the '),
                        TextSpan(
                          text: 'Terms & Conditions',
                          style: const TextStyle(
                            color: AppTheme.primaryColor,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () {
                              Navigator.pop(ctx);
                              context.push('/terms');
                            },
                        ),
                        const TextSpan(text: ' before submitting this loan application.'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: acceptedTerms
                        ? () async {
                            final amount = double.tryParse(amountCtrl.text.trim());
                            final tenure = int.tryParse(tenureCtrl.text.trim());
                            if (amount == null || amount < 1000) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                content: Text('Enter a valid amount (min ₹1,000)'),
                                behavior: SnackBarBehavior.floating,
                              ));
                              return;
                            }
                            if (tenure == null || tenure < 1 || tenure > 60) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                content: Text('Tenure must be 1-60 months'),
                                behavior: SnackBarBehavior.floating,
                              ));
                              return;
                            }
                            Navigator.pop(ctx);
                            try {
                              final res = await ApiService.post('/loans/apply', {
                                'loan_type': 'personal_loan',
                                'requested_amount': amount,
                                'tenure_months': tenure,
                                'purpose': purposeCtrl.text.trim(),
                              });
                              if (res['success'] == true && mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                  content: Text('Loan application submitted!'),
                                  backgroundColor: AppTheme.successColor,
                                  behavior: SnackBarBehavior.floating,
                                ));
                                _fetchLoans();
                              } else if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                  content: Text(res['message'] ?? 'Failed'),
                                  backgroundColor: AppTheme.errorColor,
                                  behavior: SnackBarBehavior.floating,
                                ));
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                  content: Text('Failed to submit application'),
                                  backgroundColor: AppTheme.errorColor,
                                  behavior: SnackBarBehavior.floating,
                                ));
                              }
                            }
                          }
                        : null,
                    icon: const Icon(Icons.send),
                    label: const Text('Submit Application'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey.shade300,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'approved':
      case 'disbursed':
      case 'active':
        return AppTheme.successColor;
      case 'closed':
        return Colors.grey;
      case 'rejected':
        return AppTheme.errorColor;
      case 'defaulted':
        return Colors.red.shade800;
      default:
        return AppTheme.warningColor;
    }
  }

  String _statusLabel(String s) {
    return s.replaceAll('_', ' ').split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '').join(' ');
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Loans'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showApplyForm,
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchLoans,
              child: _loans.isEmpty ? _buildEmpty() : _buildLoansList(),
            ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.2),
        Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.account_balance_wallet, size: 64, color: AppTheme.primaryColor),
            ),
            const SizedBox(height: 16),
            const Text('No Loan Applications',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 8),
            Text('Tap "Apply" to get started',
                style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      ],
    );
  }

  Widget _buildLoansList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _loans.length,
      itemBuilder: (_, i) => _buildLoanCard(_loans[i]),
    );
  }

  Widget _buildLoanCard(Map<String, dynamic> loan) {
    final status = loan['status'] ?? 'requested';
    final createdAt = DateTime.tryParse(loan['created_at'] ?? '');
    final amount = (loan['approved_amount'] ?? loan['requested_amount'] ?? 0).toDouble();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showLoanDetail(loan),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(status).withAlpha(26),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_statusLabel(status),
                        style: TextStyle(color: _statusColor(status),
                            fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                  const Spacer(),
                  Text(loan['loan_number'] ?? '',
                      style: const TextStyle(color: Colors.grey, fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 12),
              Text(_inr.format(amount),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22)),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text('${loan['tenure_months'] ?? 0} months',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  if (loan['interest_rate'] != null) ...[
                    const Text(' · '),
                    Text('${loan['interest_rate']}% p.a.',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  ],
                  if (loan['emi_amount'] != null) ...[
                    const Text(' · '),
                    Text('EMI ${_inr.format(loan['emi_amount'])}',
                        style: const TextStyle(color: AppTheme.primaryColor, fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ],
              ),
              if (createdAt != null) ...[
                const SizedBox(height: 6),
                Text(DateFormat('dd MMM yyyy').format(createdAt.toLocal()),
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 11)),
              ],
              if (loan['rejection_reason'] != null && loan['rejection_reason'].toString().isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: AppTheme.errorColor, size: 14),
                      const SizedBox(width: 6),
                      Expanded(child: Text(loan['rejection_reason'],
                          style: const TextStyle(fontSize: 12, color: AppTheme.errorColor))),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showLoanDetail(Map<String, dynamic> loan) {
    final status = loan['status'] ?? 'requested';
    final amount = (loan['approved_amount'] ?? loan['requested_amount'] ?? 0).toDouble();
    final createdAt = DateTime.tryParse(loan['created_at'] ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _statusColor(status).withAlpha(26),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_statusLabel(status),
                        style: TextStyle(color: _statusColor(status),
                            fontWeight: FontWeight.w600, fontSize: 12)),
                  ),
                  const Spacer(),
                  Text(loan['loan_number'] ?? '',
                      style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 16),
              Text(_inr.format(amount),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 28)),
              const SizedBox(height: 20),
              _detailRow('Requested Amount', _inr.format(loan['requested_amount'] ?? 0)),
              if (loan['approved_amount'] != null)
                _detailRow('Approved Amount', _inr.format(loan['approved_amount'])),
              _detailRow('Tenure', '${loan['tenure_months'] ?? 0} months'),
              _detailRow('Interest Rate', '${loan['interest_rate'] ?? 12}% p.a.'),
              if (loan['emi_amount'] != null)
                _detailRow('Monthly EMI', _inr.format(loan['emi_amount'])),
              if (loan['outstanding_amount'] != null)
                _detailRow('Outstanding', _inr.format(loan['outstanding_amount'])),
              if (loan['total_paid'] != null && (loan['total_paid'] as num) > 0)
                _detailRow('Total Paid', _inr.format(loan['total_paid'])),
              if (createdAt != null)
                _detailRow('Applied On', DateFormat('dd MMM yyyy, hh:mm a').format(createdAt.toLocal())),
              if (loan['purpose'] != null && loan['purpose'].toString().isNotEmpty)
                _detailRow('Purpose', loan['purpose']),
              if (loan['rejection_reason'] != null && loan['rejection_reason'].toString().isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Rejection Reason',
                          style: TextStyle(fontWeight: FontWeight.w600, color: AppTheme.errorColor)),
                      const SizedBox(height: 4),
                      Text(loan['rejection_reason'], style: const TextStyle(height: 1.4)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          Flexible(child: Text(value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}
