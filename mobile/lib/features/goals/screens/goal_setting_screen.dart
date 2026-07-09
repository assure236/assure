import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class GoalSettingScreen extends StatefulWidget {
  const GoalSettingScreen({super.key});

  @override
  State<GoalSettingScreen> createState() => _GoalSettingScreenState();
}

class _GoalSettingScreenState extends State<GoalSettingScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _goals = [];
  List<Map<String, dynamic>> _myChits = [];
  final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    await Future.wait([_fetchGoals(), _fetchMyChits()]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _fetchGoals() async {
    try {
      final res = await ApiService.get('/users/goals');
      if (res['success'] == true && mounted) {
        setState(() => _goals = List<Map<String, dynamic>>.from(res['data'] ?? []));
      }
    } catch (_) {}
  }

  Future<void> _fetchMyChits() async {
    try {
      final res = await ApiService.get('/dashboard/member');
      if (res['success'] == true) {
        final memberships = List<Map<String, dynamic>>.from(res['data']?['memberships'] ?? []);
        _myChits = memberships.map((m) {
          final group = (m['chit_group_id'] as Map<String, dynamic>?) ?? {};
          return {
            'id': (group['_id'] ?? group['id'] ?? '').toString(),
            'name': group['group_name']?.toString() ?? 'Chit Group',
            'invested': double.tryParse(m['total_paid']?.toString() ?? '0') ?? 0,
          };
        }).where((g) => (g['id'] as String).isNotEmpty).toList();
      }
    } catch (_) {}
  }

  void _showGoalForm({Map<String, dynamic>? goal}) {
    final isEdit = goal != null;
    final nameCtrl = TextEditingController(text: goal?['name']?.toString() ?? '');
    final targetCtrl = TextEditingController(
      text: goal != null
          ? (double.tryParse(goal['target_amount']?.toString() ?? '0') ?? 0).toStringAsFixed(0)
          : '',
    );
    String category = goal?['category']?.toString() ?? 'Savings';
    final categories = ['Savings', 'Home', 'Education', 'Marriage', 'Business', 'Vehicle', 'Emergency', 'Other'];
    final linked = <String>{
      ...List<String>.from(
        (goal?['linked_chit_group_ids'] as List?)?.map((e) => e.toString()) ?? [],
      ),
    };

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isEdit ? Icons.edit_outlined : Icons.flag_outlined,
                      color: AppTheme.primaryColor,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isEdit ? 'Modify Goal' : 'Set a Goal',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                    ),
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
                    labelText: 'Category',
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
                  controller: nameCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: 'Goal Name *',
                    hintText: 'e.g. New Home Down Payment',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.edit_outlined),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: targetCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Target Amount (₹) *',
                    hintText: 'e.g. 500000',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.currency_rupee),
                  ),
                ),
                if (_myChits.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  const Text(
                    'Link Chit Schemes',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Invested amount from selected schemes counts toward this goal.',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  ..._myChits.map((chit) {
                    final id = chit['id'] as String;
                    final selected = linked.contains(id);
                    return CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: selected,
                      title: Text(chit['name']?.toString() ?? 'Chit'),
                      subtitle: Text(
                        'Invested: ${_inr.format(chit['invested'] ?? 0)}',
                        style: const TextStyle(fontSize: 11),
                      ),
                      onChanged: (v) {
                        setSheetState(() {
                          if (v == true) {
                            linked.add(id);
                          } else {
                            linked.remove(id);
                          }
                        });
                      },
                    );
                  }),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      if (nameCtrl.text.trim().isEmpty || targetCtrl.text.trim().isEmpty) {
                        return;
                      }
                      Navigator.pop(ctx);
                      try {
                        final payload = {
                          'name': nameCtrl.text.trim(),
                          'target_amount': double.tryParse(targetCtrl.text.trim()) ?? 0,
                          'category': category,
                          'linked_chit_group_ids': linked.toList(),
                        };
                        final res = isEdit
                            ? await ApiService.put('/users/goals/${goal['_id']}', payload)
                            : await ApiService.post('/users/goals', payload);
                        if (res['success'] == true && mounted) {
                          _snack(isEdit ? 'Goal updated' : 'Goal created');
                          _loadAll();
                        }
                      } catch (_) {}
                    },
                    icon: Icon(isEdit ? Icons.save_outlined : Icons.check),
                    label: Text(isEdit ? 'Save Changes' : 'Create Goal'),
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

  Future<void> _confirmDelete(Map<String, dynamic> goal) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete goal?'),
        content: Text('Remove "${goal['name']}"? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.errorColor),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await ApiService.delete('/users/goals/${goal['_id']}');
      if (res['success'] == true && mounted) {
        _snack('Goal deleted');
        _fetchGoals();
      }
    } catch (_) {}
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppTheme.successColor,
      behavior: SnackBarBehavior.floating,
    ));
  }

  IconData _categoryIcon(String? cat) {
    switch (cat) {
      case 'Home':
        return Icons.home_outlined;
      case 'Education':
        return Icons.school_outlined;
      case 'Marriage':
        return Icons.favorite_outline;
      case 'Business':
        return Icons.business_outlined;
      case 'Vehicle':
        return Icons.directions_car_outlined;
      case 'Emergency':
        return Icons.health_and_safety_outlined;
      default:
        return Icons.savings_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Goal Setting'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showGoalForm(),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Goal'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _goals.isEmpty
              ? _buildEmpty()
              : RefreshIndicator(
                  onRefresh: _loadAll,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _goals.length,
                    itemBuilder: (_, i) => _buildGoalCard(_goals[i]),
                  ),
                ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppTheme.secondaryColor.withAlpha(20),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.flag_outlined, size: 56, color: AppTheme.secondaryColor.withAlpha(180)),
          ),
          const SizedBox(height: 20),
          const Text('No Goals Set', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            'Set investment targets to track\nyour progress',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[500], height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildGoalCard(Map<String, dynamic> goal) {
    final target = double.tryParse(goal['target_amount']?.toString() ?? '0') ?? 0;
    final current = double.tryParse(goal['current_amount']?.toString() ?? '0') ?? 0;
    final progress = target > 0 ? (current / target).clamp(0.0, 1.0) : 0.0;
    final category = goal['category'] ?? 'Savings';
    final linkedCount = (goal['linked_chit_group_ids'] as List?)?.length ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.cardRadius)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(_categoryIcon(category), color: AppTheme.primaryColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(goal['name'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      Text(category, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                      if (linkedCount > 0)
                        Text(
                          '$linkedCount linked chit${linkedCount == 1 ? '' : 's'}',
                          style: const TextStyle(fontSize: 11, color: AppTheme.primaryColor),
                        ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == 'modify') _showGoalForm(goal: goal);
                    if (v == 'delete') _confirmDelete(goal);
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'modify', child: Text('Modify')),
                    PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
                Text(
                  '${(progress * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation<Color>(
                  progress >= 1.0 ? AppTheme.successColor : AppTheme.primaryColor,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _inr.format(current),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryColor,
                  ),
                ),
                Text('of ${_inr.format(target)}',
                    style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
