import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class SupportScreen extends StatefulWidget {
  final bool autoOpenTicket;
  final String? initialCategory;
  const SupportScreen({super.key, this.autoOpenTicket = false, this.initialCategory});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _tickets = [];
  String? _agentRequestStatus; // null, 'pending', 'approved', 'rejected'

  String _toBackendPriority(String uiPriority) {
    switch (uiPriority) {
      case 'high':
        return 'high';
      case 'normal':
      default:
        return 'medium';
    }
  }

  String _toBackendCategory(String uiCategory) {
    if (uiCategory == 'Profile / Account Issue') return 'Account Issue';
    return uiCategory;
  }

  @override
  void initState() {
    super.initState();
    _fetchTickets();
    _fetchAgentStatus();
    // Auto-open raise ticket if directed from profile
    if (widget.autoOpenTicket) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _showCreateTicket(initialCategory: widget.initialCategory));
    }
  }

  Future<void> _fetchAgentStatus() async {
    try {
      final res = await ApiService.get('/users/agent-request');
      if (res['success'] == true && res['data'] != null) {
        if (mounted) setState(() => _agentRequestStatus = res['data']['status']);
      }
    } catch (_) {}
  }

  Future<void> _fetchTickets() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.get('/users/support/tickets');
      if (res['success'] == true) {
        setState(() => _tickets = List<Map<String, dynamic>>.from(res['data'] ?? []));
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  void _showCreateTicket({String? initialCategory}) {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String priority = 'normal';
    final categories = [
      'General',
      'Payment Issue',
      'Auction Related',
      'KYC / Documents',
      'Account Issue',
      'Profile / Account Issue',
      'Technical Bug',
      'Chit Transfer/Cancel',
      'Loan Related',
      'Other',
    ];
    // Pre-select category if passed from profile
    String category = (initialCategory != null && categories.contains(initialCategory))
        ? initialCategory
        : 'General';

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
                    const Icon(Icons.add_circle, color: AppTheme.primaryColor),
                    const SizedBox(width: 8),
                    const Text('Raise a Ticket',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: category,
                  decoration: InputDecoration(
                    labelText: 'Category *',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.category_outlined),
                  ),
                  items: categories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setSheetState(() => category = val);
                  },
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: subjectCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: 'Subject *',
                    hintText: 'e.g. Payment not reflecting',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.subject),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: descCtrl,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: 'Description *',
                    hintText: 'Describe your issue in detail...',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    alignLabelWithHint: true,
                    prefixIcon: const Padding(
                      padding: EdgeInsets.only(bottom: 60),
                      child: Icon(Icons.description),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Priority', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                // Item 5: Priority = Normal and High only — full-width equal buttons, equal text size
                Row(
                  children: ['normal', 'high'].map((p) {
                    final selected = priority == p;
                    final color = _priorityColor(p);
                    final label = p[0].toUpperCase() + p.substring(1);
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: selected
                            ? ElevatedButton(
                                onPressed: () => setSheetState(() => priority = p),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: color,
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(double.infinity, 48),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10)),
                                  elevation: 0,
                                ),
                                child: Text(
                                  label,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      height: 1.2),
                                ),
                              )
                            : OutlinedButton(
                                onPressed: () => setSheetState(() => priority = p),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: color,
                                  minimumSize: const Size(double.infinity, 48),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  side: BorderSide(color: color, width: 1.5),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10)),
                                ),
                                child: Text(
                                  label,
                                  style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      height: 1.2,
                                      color: color),
                                ),
                              ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      if (subjectCtrl.text.trim().isEmpty ||
                          descCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Subject and description are required'),
                          behavior: SnackBarBehavior.floating,
                        ));
                        return;
                      }
                      Navigator.pop(ctx);
                      try {
                        final res = await ApiService.post('/users/support', {
                          'subject': subjectCtrl.text.trim(),
                          'description': descCtrl.text.trim(),
                          'priority': _toBackendPriority(priority),
                          'category': _toBackendCategory(category),
                        });
                        if (res['success'] == true) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                              content: Text('Ticket raised successfully!'),
                              backgroundColor: AppTheme.successColor,
                              behavior: SnackBarBehavior.floating,
                            ));
                          }
                          _fetchTickets();
                        } else {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(res['message'] ?? 'Failed to create ticket'),
                              backgroundColor: AppTheme.errorColor,
                              behavior: SnackBarBehavior.floating,
                            ));
                          }
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                            content: Text('Failed to create ticket'),
                            backgroundColor: AppTheme.errorColor,
                            behavior: SnackBarBehavior.floating,
                          ));
                        }
                      }
                    },
                    icon: const Icon(Icons.send),
                    label: const Text('Submit Ticket'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
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

  Color _priorityColor(String p) {
    switch (p) {
      case 'high':
        return AppTheme.warningColor;
      case 'normal':
        return AppTheme.primaryColor;
      default:
        return Colors.grey;
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'resolved':
      case 'closed':
        return AppTheme.successColor;
      case 'in_progress':
        return AppTheme.secondaryColor;
      default:
        return AppTheme.warningColor;
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'open':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return s;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Support'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchTickets),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateTicket,
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Raise Ticket'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchTickets,
              // Item 7: Removed Become Agent card from Support section
              child: _tickets.isEmpty
                  ? _buildEmpty()
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        ...List.generate(_tickets.length, (i) => _buildTicketCard(_tickets[i])),
                      ],
                    ),
            ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        // Item 7: Become Agent removed from support — not shown here
        SizedBox(height: MediaQuery.of(context).size.height * 0.12),
        Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.accentBlue.withAlpha(20),
                shape: BoxShape.circle,
              ),
              child: SvgPicture.asset('assets/icons/support.svg',
                  width: 64, height: 64,
                  colorFilter: ColorFilter.mode(AppTheme.accentBlue.withAlpha(160), BlendMode.srcIn)),
            ),
            const SizedBox(height: 20),
            const Text('No Support Tickets',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Have a question or issue?\nWe\u2019re here to help!',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, height: 1.5)),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => _showCreateTicket(),
              icon: const Icon(Icons.add_circle_outline, size: 18),
              label: const Text('Raise a Ticket'),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.cardRadius)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBecomeAgentCard() {
    final isPending = _agentRequestStatus == 'pending';
    final isApproved = _agentRequestStatus == 'approved';

    if (isApproved) {
      return Card(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(30),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.verified, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('You\'re an Assure Agent',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    SizedBox(height: 2),
                    Text('You can now earn commissions by referring members',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isPending
                ? [const Color(0xFFE65100), const Color(0xFFEF6C00)]
                : [const Color(0xFF1A237E), const Color(0xFF283593)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(30),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isPending ? Icons.hourglass_top_rounded : Icons.badge_outlined,
                color: Colors.white, size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPending ? 'Application In Progress' : 'Become an Agent',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isPending
                        ? 'Our team will contact you within 24 hours'
                        : 'Earn commissions by referring members',
                    style: TextStyle(color: Colors.white.withAlpha(180), fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (!isPending)
              OutlinedButton(
                onPressed: () => _showBecomeAgentSheet(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white70),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
                child: Text(_agentRequestStatus == 'rejected' ? 'Apply Again' : 'Apply',
                    style: const TextStyle(fontSize: 13)),
              ),
          ],
        ),
      ),
    );
  }

  void _showBecomeAgentSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withAlpha(20),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.badge_rounded, size: 48, color: AppTheme.primaryColor),
            ),
            const SizedBox(height: 16),
            const Text('Become an Assure Agent',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            Text(
              'As an Assure agent, you can earn commissions by referring new members to chit groups. Would you like to submit your request?',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, height: 1.4),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  try {
                    final res = await ApiService.post('/users/agent-request', {});
                    if (mounted) {
                      setState(() => _agentRequestStatus = 'pending');
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res['message'] ?? 'Agent request submitted!'), backgroundColor: AppTheme.successColor),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.errorColor),
                      );
                    }
                  }
                },
                icon: const Icon(Icons.send, size: 18),
                label: const Text('Submit Request'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketCard(Map<String, dynamic> ticket) {
    final status = ticket['status'] ?? 'open';
    final priority = ticket['priority'] ?? 'medium';
    final category = ticket['category'];
    final createdAt = DateTime.tryParse(ticket['created_at'] ?? '');
    final ticketNo = ticket['ticket_number'] ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.cardRadius)),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.cardRadius),
          boxShadow: AppTheme.cardShadow,
        ),
        child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        onTap: () => _showTicketDetail(ticket),
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
                        style: TextStyle(
                            color: _statusColor(status),
                            fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _priorityColor(priority).withAlpha(26),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(priority.toString().toUpperCase(),
                        style: TextStyle(
                            color: _priorityColor(priority),
                            fontSize: 10, fontWeight: FontWeight.w600)),
                  ),
                  const Spacer(),
                  Text(ticketNo,
                      style: const TextStyle(color: Colors.grey, fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ],
              ),
              if (category != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.label_outline, size: 13, color: Colors.grey.shade500),
                    const SizedBox(width: 4),
                    Text(category.toString(),
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Text(ticket['subject'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 4),
              Text(ticket['description'] ?? '',
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              if (createdAt != null) ...[
                const SizedBox(height: 8),
                Text(DateFormat('dd MMM yyyy, hh:mm a').format(createdAt.toLocal()),
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 11)),
              ],
              if (ticket['resolution'] != null && ticket['resolution'].toString().isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.successColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle, color: AppTheme.successColor, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(ticket['resolution'],
                           style: const TextStyle(fontSize: 12, color: AppTheme.successColor)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      ),
    );
  }

  void _showTicketDetail(Map<String, dynamic> ticket) {
    final status = ticket['status'] ?? 'open';
    final priority = ticket['priority'] ?? 'medium';
    final createdAt = DateTime.tryParse(ticket['created_at'] ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
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
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
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
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _priorityColor(priority).withAlpha(26),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(priority.toString().toUpperCase(),
                        style: TextStyle(color: _priorityColor(priority),
                            fontWeight: FontWeight.w600, fontSize: 11)),
                  ),
                  const Spacer(),
                  Text(ticket['ticket_number'] ?? '',
                      style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 16),
              Text(ticket['subject'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              if (createdAt != null) ...[
                const SizedBox(height: 6),
                Text(DateFormat('EEEE, dd MMM yyyy at hh:mm a').format(createdAt.toLocal()),
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
              ],
              if (ticket['category'] != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.category_outlined, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(ticket['category'].toString(),
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              // Status Timeline
              _buildStatusTimeline(status, createdAt, ticket),
              const SizedBox(height: 16),
              const Text('Description', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              Text(ticket['description'] ?? '', style: const TextStyle(height: 1.5)),
              if (ticket['resolution'] != null && ticket['resolution'].toString().isNotEmpty) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.successColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.successColor.withAlpha(50)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.successColor, size: 18),
                          SizedBox(width: 8),
                          Text('Resolution',
                              style: TextStyle(fontWeight: FontWeight.w600,
                                  color: AppTheme.successColor)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(ticket['resolution'],
                          style: const TextStyle(height: 1.5)),
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

  Widget _buildStatusTimeline(String currentStatus, DateTime? createdAt, Map<String, dynamic> ticket) {
    final steps = ['open', 'in_progress', 'resolved', 'closed'];
    final currentIdx = steps.indexOf(currentStatus);
    final resolvedAt = DateTime.tryParse(ticket['resolved_at'] ?? '');
    final updatedAt = DateTime.tryParse(ticket['updated_at'] ?? '');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Status Timeline',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 12),
          ...List.generate(steps.length, (i) {
            final isDone = i <= currentIdx;
            final isCurrent = i == currentIdx;
            final isLast = i == steps.length - 1;
            String? timeStr;
            if (i == 0 && createdAt != null) {
              timeStr = DateFormat('dd MMM, hh:mm a').format(createdAt.toLocal());
            } else if (steps[i] == 'resolved' && isDone && resolvedAt != null) {
              timeStr = DateFormat('dd MMM, hh:mm a').format(resolvedAt.toLocal());
            } else if (isCurrent && updatedAt != null && i > 0) {
              timeStr = DateFormat('dd MMM, hh:mm a').format(updatedAt.toLocal());
            }

            return Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 24, height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDone ? _statusColor(steps[i]) : Colors.grey.shade300,
                          ),
                          child: Icon(
                            isDone ? Icons.check : Icons.circle_outlined,
                            size: 14,
                            color: isDone ? Colors.white : Colors.grey,
                          ),
                        ),
                        if (!isLast)
                          Container(
                            width: 2, height: 28,
                            color: isDone && i < currentIdx
                                ? _statusColor(steps[i])
                                : Colors.grey.shade300,
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_statusLabel(steps[i]),
                              style: TextStyle(
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                color: isDone ? Colors.black87 : Colors.grey,
                                fontSize: 13,
                              )),
                          if (timeStr != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(timeStr,
                                  style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                            ),
                          if (!isLast) const SizedBox(height: 8),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}
