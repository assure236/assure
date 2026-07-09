import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/providers/payment_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import 'cashfree_payment_screen.dart';

Future<Uri> _buildReceiptUri(String paymentId) async {
  final prefs = await SharedPreferences.getInstance();
  final activeMemberId = prefs.getString('active_member_id')?.trim().toUpperCase();
  final base = Uri.parse('${ApiService.baseUrl}/payments/receipt/$paymentId');
  final qp = <String, String>{};
  if (activeMemberId != null && activeMemberId.isNotEmpty) {
    qp['active_member_id'] = activeMemberId;
  }
  return base.replace(queryParameters: qp);
}

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  /// Set to desired tab index before switching to Payments tab
  static int initialTabIndex = 0;

  @override
  State<PaymentsScreen> createState() => PaymentsScreenState();
}

class PaymentsScreenState extends State<PaymentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  Future<String?> _readAuthToken() async {
    const storage = FlutterSecureStorage();
    // SECURITY FIX: read token from secure storage only.
    return storage.read(key: 'access_token');
  }



  /// Switch to a specific tab programmatically
  void switchToTab(int index) {
    if (_tabController.index != index) {
      _tabController.animateTo(index);
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this, initialIndex: PaymentsScreen.initialTabIndex);
    PaymentsScreen.initialTabIndex = 0; // reset after use
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PaymentProvider>().fetchPayments();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Payments'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,

        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.secondaryColor,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'Upcoming'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: Consumer<PaymentProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          return TabBarView(
            controller: _tabController,
            children: [
              _UpcomingPaymentsTab(
                payments: provider.upcomingPayments,
                onPay: (p) => _showPayDialog(context, p),
                onRefresh: provider.fetchPayments,
              ),
              _PaymentHistoryTab(
                payments: provider.paidPayments,
                onRefresh: provider.fetchPayments,
              ),
            ],
          );
        },
      ),
    );
  }

  void _showPayDialog(BuildContext context, Map<String, dynamic> payment) {
    final baseAmount = double.tryParse(payment['amount']?.toString() ?? '0') ?? 0;
    final lateFee = double.tryParse(payment['late_fee']?.toString() ?? '0') ?? 0;
    final totalAmount = double.tryParse(payment['total_amount']?.toString() ?? '0') ?? (baseAmount + lateFee);
    final group = (payment['chit_group'] ?? payment['chitGroup'])?['group_name'] ?? 'Chit Group';
    final monthNum = payment['month_number'] ?? 1;
    final isOverdue = payment['payment_status'] == 'overdue';
    bool isCreatingOrder = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                  color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
            ),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(26), shape: BoxShape.circle),
              child: const Icon(Icons.payment, size: 40, color: AppTheme.primaryColor),
            ),
            const SizedBox(height: 12),
            Text('Pay Installment', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(group, style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 20),
            // Amount breakdown
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: AppTheme.backgroundColor, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('Month $monthNum', style: const TextStyle(fontWeight: FontWeight.w500)),
                  Text('₹${NumberFormat('#,##,###').format(baseAmount)}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                ]),
                if (lateFee > 0) ...[  
                  const SizedBox(height: 6),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Late Fee', style: TextStyle(color: AppTheme.errorColor, fontSize: 13)),
                    Text('+₹${NumberFormat('#,##,###').format(lateFee)}',
                        style: const TextStyle(color: AppTheme.errorColor, fontWeight: FontWeight.w600)),
                  ]),
                  const Divider(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Total', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('₹${NumberFormat('#,##,###').format(totalAmount)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.primaryColor)),
                  ]),
                ] else
                  const SizedBox.shrink(),
              ]),
            ),
            if (isOverdue) ...[  
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                    color: AppTheme.errorColor.withAlpha(13),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.errorColor.withAlpha(76))),
                child: Row(children: [
                  const Icon(Icons.warning_amber, color: AppTheme.errorColor, size: 16),
                  const SizedBox(width: 8),
                  Text('Overdue by ${payment['days_overdue'] ?? 0} days — late fee included',
                      style: const TextStyle(color: AppTheme.errorColor, fontSize: 12)),
                ]),
              ),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.blue.withAlpha(13), borderRadius: BorderRadius.circular(10)),
              child: const Row(children: [
                Icon(Icons.lock_outlined, color: AppTheme.accentBlue, size: 14),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Secure payment via Cashfree · UPI · Cards · Net Banking',
                    style: TextStyle(color: AppTheme.accentBlue, fontSize: 11),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: isCreatingOrder ? null : () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: isCreatingOrder
                        ? null
                        : () async {
                            setSheetState(() => isCreatingOrder = true);
                            final provider = context.read<PaymentProvider>();
                            // Extract chit group ID — backend populates 'chit_group_id' as an object, so extract _id or id from it
                            final cgField = payment['chit_group_id'] ?? payment['chit_group'] ?? payment['chitGroup'];
                            String extractedGroupId = '';
                            if (cgField is Map) {
                              extractedGroupId = cgField['_id']?.toString() ?? cgField['id']?.toString() ?? '';
                            } else if (cgField is String) {
                              extractedGroupId = cgField;
                            }
                            final res = await provider.createOrder(
                              chitGroupId: extractedGroupId,
                              monthNumber: payment['month_number'] ?? 1,
                              amount: baseAmount,
                              lateFee: lateFee,
                            );
                            if (!ctx.mounted) return;
                            Navigator.pop(ctx);
                            if (res['success'] == true) {
                              final data = res['data'] as Map<String, dynamic>;
                              final paymentSessionId = data['payment_session_id'] as String?;
                              final orderId = data['order_id'] as String?;
                              final paymentId = data['payment_id'] as String?;
                              if (paymentSessionId != null && paymentSessionId.isNotEmpty && orderId != null) {
                                final result = await Navigator.push<Map<String, dynamic>>(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => CashfreePaymentScreen(
                                      paymentSessionId: paymentSessionId,
                                      orderId: orderId,
                                      paymentId: paymentId ?? '',
                                    ),
                                  ),
                                );
                                if (result?['success'] == true && context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Payment successful! ✓'),
                                      backgroundColor: AppTheme.successColor,
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  provider.fetchPayments();
                                }
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(res['message'] ?? 'Cashfree not configured — set CASHFREE_APP_ID'),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['message'] ?? 'Could not create payment order'),
                                  backgroundColor: AppTheme.errorColor,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          },
                    icon: isCreatingOrder
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.lock, size: 18),
                    label: Text(isCreatingOrder ? 'Creating order...' : 'Pay with Cashfree'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ]),
        ),
      ),
    );
  }
}
// ─── PAYMENT HISTORY TAB ─────────────────────────────────────────────────────

class _PaymentHistoryTab extends StatelessWidget {
  final List<Map<String, dynamic>> payments;
  final Future<void> Function() onRefresh;

  const _PaymentHistoryTab(
      {required this.payments, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return const _EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No Payment History',
        subtitle: 'Your payment records will appear here.',
      );
    }

    // Group by month
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final p in payments) {
      final date = p['payment_date'] != null
          ? DateTime.tryParse(p['payment_date']) ?? DateTime.now()
          : DateTime.now();
      final key = DateFormat('MMMM yyyy').format(date);
      grouped[key] = [...(grouped[key] ?? []), p];
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary card
          _SummaryCard(payments: payments),
          const SizedBox(height: 16),
          ...grouped.entries.map((entry) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(entry.key,
                        style: TextStyle(
                            color: Colors.grey[600],
                            fontWeight: FontWeight.w600,
                            fontSize: 13)),
                  ),
                  ...entry.value.map((p) => _PaymentTile(payment: p)),
                ],
              )),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final List<Map<String, dynamic>> payments;
  const _SummaryCard({required this.payments});

  @override
  Widget build(BuildContext context) {
    double total = 0;
    for (final p in payments) {
      total += double.tryParse(p['amount']?.toString() ?? '0') ?? 0;
    }
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primaryColor, AppTheme.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.account_balance_wallet,
              color: Colors.white70, size: 36),
          const SizedBox(width: 16),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Total Paid',
                style: TextStyle(color: Colors.white70, fontSize: 12)),
            Text(
              '₹${NumberFormat('#,##,###').format(total)}',
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 22),
            ),
            Text('${payments.length} payments',
                style: const TextStyle(color: Colors.white60, fontSize: 11)),
          ]),
        ],
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Map<String, dynamic> payment;
  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    final status = payment['payment_status'] ?? payment['status'] ?? 'pending';
    final amount = double.tryParse(payment['amount']?.toString() ?? '0') ?? 0;
    final group =
        (payment['chitGroup'] ?? payment['chit_group'])?['group_name'] ?? 'Chit Group';
    final date = payment['payment_date'] != null
        ? DateTime.tryParse(payment['payment_date'])
        : null;

    Color statusColor;
    IconData statusIcon;
    switch (status) {
      case 'success':
      case 'paid':
        statusColor = AppTheme.successColor;
        statusIcon = Icons.check_circle;
        break;
      case 'refunded':
        statusColor = AppTheme.accentBlue;
        statusIcon = Icons.replay;
        break;
      case 'failed':
        statusColor = AppTheme.errorColor;
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = AppTheme.warningColor;
        statusIcon = Icons.schedule;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showReceiptBottomSheet(context, payment, group, amount, status, date, statusColor),
        child: ListTile(
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
                color: statusColor.withAlpha(26),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(statusIcon, color: statusColor),
          ),
          title: Text(group,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          subtitle: Text(
            date != null ? DateFormat('dd MMM yyyy, hh:mm a').format(date) : 'N/A',
            style: const TextStyle(fontSize: 11),
          ),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('₹${NumberFormat('#,##,###').format(amount)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15)),
              Text(status.toUpperCase(),
                  style: TextStyle(
                      color: statusColor,
                      fontSize: 9,
                      fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }

  void _showReceiptBottomSheet(
    BuildContext context,
    Map<String, dynamic> payment,
    String group,
    double amount,
    String status,
    DateTime? date,
    Color statusColor,
  ) {
    final txnId = payment['id']?.toString() ?? '—';
    final monthNum = payment['month_number']?.toString() ?? '—';
    final dateStr = date != null ? DateFormat('dd MMM yyyy, hh:mm a').format(date) : '—';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: statusColor.withAlpha(26), shape: BoxShape.circle),
            child: Icon(Icons.receipt_long, size: 40, color: statusColor),
          ),
          const SizedBox(height: 12),
          Text('Payment Receipt', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: statusColor.withAlpha(31), borderRadius: BorderRadius.circular(20)),
            child: Text(status.toUpperCase(), style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 20),
          _ReceiptRow(label: 'Chit Group', value: group),
          _ReceiptRow(label: 'Amount Paid', value: '₹${NumberFormat('#,##,###').format(amount)}'),
          _ReceiptRow(label: 'Month', value: 'Month $monthNum'),
          _ReceiptRow(label: 'Date & Time', value: dateStr),
          _ReceiptRow(label: 'Transaction ID', value: '#$txnId'),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  final paymentId = payment['_id'] ?? payment['id'] ?? '';
                  const storage = FlutterSecureStorage();
                  final token = await storage.read(key: 'access_token') ?? '';
                  final uri = await _buildReceiptUri(paymentId.toString());
                  try {
                    // SECURITY FIX: send auth token in Authorization header, never in URL.
                    final response = await http.get(uri, headers: {
                      if (token.isNotEmpty) 'Authorization': 'Bearer $token',
                    });
                    if (response.statusCode == 200) {
                      final dir = Directory.systemTemp;
                      final file = File('${dir.path}/receipt_$paymentId.pdf');
                      await file.writeAsBytes(response.bodyBytes);
                      await SharePlus.instance.share(
                        ShareParams(
                          files: [XFile(file.path, mimeType: 'application/pdf')],
                          subject: 'Payment Receipt - Assure Chit Funds',
                        ),
                      );
                    }
                  } catch (_) {
                    // Fallback to text share
                    await SharePlus.instance.share(
                      ShareParams(
                        text: 'Assure Chit Funds - Payment Receipt\n'
                            'Group: $group | Amount: ₹${NumberFormat('#,##,###').format(amount)}\n'
                            'Month: $monthNum | Status: ${status.toUpperCase()}\n'
                            'Date: $dateStr | Txn ID: #$txnId',
                        subject: 'Payment Receipt - Assure Chit Funds',
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.share, size: 18),
                label: const Text('Share'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  final paymentId = payment['_id'] ?? payment['id'] ?? '';
                  const storage = FlutterSecureStorage();
                  final token = await storage.read(key: 'access_token') ?? '';
                  final uri = await _buildReceiptUri(paymentId.toString());
                  // SECURITY FIX: avoid external open with token in URL; fetch via Authorization and share file.
                  final response = await http.get(uri, headers: {
                    if (token.isNotEmpty) 'Authorization': 'Bearer $token',
                  });
                  if (response.statusCode == 200) {
                    final dir = Directory.systemTemp;
                    final file = File('${dir.path}/receipt_$paymentId.pdf');
                    await file.writeAsBytes(response.bodyBytes);
                    await SharePlus.instance.share(
                      ShareParams(
                        files: [XFile(file.path, mimeType: 'application/pdf')],
                        subject: 'Payment Receipt - Assure Chit Funds',
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.download_rounded, size: 18),
                label: const Text('Download'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ─── RECEIPT ROW ─────────────────────────────────────────────────────────────

class _ReceiptRow extends StatelessWidget {
  final String label;
  final String value;
  const _ReceiptRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

// ─── UPCOMING PAYMENTS TAB ────────────────────────────────────────────────────

class _UpcomingPaymentsTab extends StatelessWidget {
  final List<Map<String, dynamic>> payments;
  final void Function(Map<String, dynamic>) onPay;
  final Future<void> Function() onRefresh;

  const _UpcomingPaymentsTab(
      {required this.payments, required this.onPay, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return const _EmptyState(
        icon: Icons.check_circle_outline,
        title: 'All Caught Up!',
        subtitle: 'No upcoming or overdue payments.',
      );
    }

    // Split into payable (overdue/pending) only — future installments hidden from Upcoming tab
    final payable = payments.where((p) =>
        p['payment_status'] == 'overdue' || p['payment_status'] == 'pending').toList();

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: payable.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                _EmptyState(
                  icon: Icons.check_circle_outline,
                  title: 'All Caught Up!',
                  subtitle: 'No upcoming or overdue payments.',
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('Due Now',
                      style: TextStyle(
                          color: Colors.grey[700],
                          fontWeight: FontWeight.bold,
                          fontSize: 14)),
                ),
                ...payable.map((p) => _buildPayableCard(context, p)),
              ],
            ),
    );
  }

  Widget _buildPayableCard(BuildContext context, Map<String, dynamic> p) {
    final isOverdue = p['payment_status'] == 'overdue';
    final amount =
        double.tryParse(p['total_amount']?.toString() ?? p['amount']?.toString() ?? '0') ?? 0;
    final lateFee = double.tryParse(p['late_fee']?.toString() ?? '0') ?? 0;
    final group = (p['chit_group'] ?? p['chitGroup'])?['group_name'] ?? 'Chit Group';
    final dueDate = p['due_date'] != null ? DateTime.tryParse(p['due_date']) : null;
    final dividend = double.tryParse(p['dividend_reduction']?.toString() ?? '0') ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: isOverdue
            ? const BorderSide(color: AppTheme.errorColor, width: 1)
            : BorderSide.none,
      ),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: isOverdue
                        ? AppTheme.errorColor.withAlpha(26)
                        : AppTheme.secondaryColor.withAlpha(26),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isOverdue ? Icons.warning_amber : Icons.calendar_today,
                    color: isOverdue ? AppTheme.errorColor : AppTheme.secondaryColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('$group — Month ${p['month_number'] ?? ''}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        Text(
                          dueDate != null
                              ? 'Due: ${DateFormat('dd MMM yyyy').format(dueDate)}'
                              : 'Due date TBD',
                          style: TextStyle(
                              color: isOverdue ? AppTheme.errorColor : Colors.grey[500],
                              fontSize: 12),
                        ),
                      ]),
                ),
                Text('₹${NumberFormat('#,##,###').format(amount)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.primaryColor)),
              ]),
              if (dividend > 0) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: AppTheme.successColor.withAlpha(20), borderRadius: BorderRadius.circular(8)),
                  child: Text(
                    'Dividend reduction: ₹${NumberFormat('#,##,###').format(dividend)}',
                    style: const TextStyle(color: AppTheme.successColor, fontSize: 11)),
                ),
              ],
              if (isOverdue) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                      color: AppTheme.errorColor.withAlpha(20),
                      borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    const Icon(Icons.warning, size: 14, color: AppTheme.errorColor),
                    const SizedBox(width: 6),
                    Text(
                      lateFee > 0
                          ? 'Overdue ${p['days_overdue'] ?? 0} days — late fee: ₹${NumberFormat('#,##,###').format(lateFee)}'
                          : 'Overdue — late fee may apply',
                      style: const TextStyle(color: AppTheme.errorColor, fontSize: 11)),
                  ]),
                ),
              ],
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => onPay(p),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOverdue ? AppTheme.errorColor : AppTheme.secondaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(isOverdue ? 'Pay Now (Overdue)' : 'Pay Installment'),
                ),
              ),
            ]),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _EmptyState(
      {required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 72, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(title,
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(subtitle,
              style: TextStyle(color: Colors.grey[500], fontSize: 14),
              textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}
