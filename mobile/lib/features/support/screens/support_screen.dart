import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _tickets = [];

  @override
  void initState() {
    super.initState();
    _fetchTickets();
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

  void _showCreateTicket() {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String priority = 'medium';

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
                Row(
                  children: ['low', 'medium', 'high', 'urgent'].map((p) {
                    final selected = priority == p;
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: ChoiceChip(
                          label: Text(p[0].toUpperCase() + p.substring(1),
                              style: TextStyle(
                                  fontSize: 11,
                                  color: selected ? Colors.white : null)),
                          selected: selected,
                          selectedColor: _priorityColor(p),
                          onSelected: (_) => setSheetState(() => priority = p),
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
                          'priority': priority,
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
      case 'urgent':
        return Colors.red;
      case 'high':
        return Colors.orange;
      case 'medium':
        return AppTheme.secondaryColor;
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
        return Colors.orange;
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
              child: _tickets.isEmpty
                  ? _buildEmpty()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _tickets.length,
                      itemBuilder: (_, i) => _buildTicketCard(_tickets[i]),
                    ),
            ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        Column(
          children: [
            Icon(Icons.support_agent, size: 80, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            const Text('No Support Tickets',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 8),
            Text('Tap "Raise Ticket" to create one',
                style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      ],
    );
  }

  Widget _buildTicketCard(Map<String, dynamic> ticket) {
    final status = ticket['status'] ?? 'open';
    final priority = ticket['priority'] ?? 'medium';
    final createdAt = DateTime.tryParse(ticket['created_at'] ?? '');
    final ticketNo = ticket['ticket_number'] ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
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
}
