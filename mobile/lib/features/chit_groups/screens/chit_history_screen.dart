import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/chit_group_provider.dart';
import '../../../core/theme/app_theme.dart';

class ChitHistoryScreen extends StatelessWidget {
  final String status; // 'completed' or 'cancelled'
  const ChitHistoryScreen({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final title = status == 'completed' ? 'Completed Chits' : 'Cancelled Chits';
    final icon = status == 'completed'
        ? Icons.check_circle_outline
        : Icons.cancel_outlined;
    final color =
        status == 'completed' ? AppTheme.successColor : Colors.grey;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Consumer<ChitGroupProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final groups = provider.chitGroups
              .where((g) => g.status == status)
              .toList();

          if (groups.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text('No $title',
                      style: const TextStyle(
                          color: Colors.grey, fontSize: 16, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  Text('Your ${status} chit groups will appear here',
                      style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchMyChitGroups(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: groups.length,
              itemBuilder: (context, i) {
                final g = groups[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 1,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => context.push('/chit-groups/${g.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: color.withAlpha(26),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(icon, color: color, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(g.groupName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14)),
                                const SizedBox(height: 2),
                                Text(g.groupNumber,
                                    style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 12)),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: color.withAlpha(20),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                color: color,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
