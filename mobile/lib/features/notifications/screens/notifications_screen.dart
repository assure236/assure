import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/notification_provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = false;
  List<Map<String, dynamic>> _notifications = [];
  String? _error;
  int _page = 1;
  bool _hasMore = true;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchNotifications(reset: true);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchNotifications({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _hasMore = true;
        _notifications = [];
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final res = await ApiService.get('/notifications?page=$_page&limit=20');
      if (res['success'] == true) {
        final rawData = res['data'];
        final List<Map<String, dynamic>> newItems;
        if (rawData is Map && rawData.containsKey('notifications')) {
          newItems = List<Map<String, dynamic>>.from(rawData['notifications'] ?? []);
        } else {
          newItems = List<Map<String, dynamic>>.from(rawData ?? []);
        }
        setState(() {
          if (reset) {
            _notifications = newItems;
          } else {
            _notifications.addAll(newItems);
          }
          _hasMore = newItems.length == 20;
          _page++;
        });
      } else {
        setState(() => _error = res['message'] ?? 'Failed to load notifications');
      }
    } catch (e) {
      setState(() => _error = 'Could not connect to server');
    } finally {
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _markRead(String id) async {
    // Update local state immediately
    setState(() {
      final idx = _notifications.indexWhere((n) => (n['_id'] ?? n['id']).toString() == id);
      if (idx != -1) _notifications[idx] = {..._notifications[idx], 'is_read': true};
    });
    try {
      await ApiService.put('/notifications/$id/mark-read', {});
      if (mounted) context.read<NotificationProvider>().markReadLocal(id);
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    try {
      await ApiService.put('/notifications/mark-all-read', {});
      setState(() {
        _notifications = _notifications
            .map((n) => {...n, 'is_read': true})
            .toList();
      });
      if (mounted) context.read<NotificationProvider>().markAllReadLocal();
      _showSnackBar('All notifications marked as read', isError: false);
    } catch (e) {
      _showSnackBar('Failed to mark all as read');
    }
  }

  Future<void> _deleteNotification(String id) async {
    try {
      await ApiService.delete('/notifications/$id');
      setState(() {
        _notifications.removeWhere((n) => (n['_id'] ?? n['id']).toString() == id);
      });
    } catch (e) {
      _showSnackBar('Failed to delete notification');
      _fetchNotifications(reset: true); // Re-fetch on failure
    }
  }

  void _showSnackBar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? AppTheme.errorColor : AppTheme.successColor,
    ));
  }

  List<Map<String, dynamic>> get _unread =>
      _notifications.where((n) => n['is_read'] != true).toList();

  int get _unreadCount => _unread.length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read',
                  style: TextStyle(color: Colors.white, fontSize: 12)),
            ),
          IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => _fetchNotifications(reset: true)),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.secondaryColor,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: [
            const Tab(text: 'All'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Unread'),
                  if (_unreadCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.secondaryColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('$_unreadCount',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildList(_notifications, showAll: true),
                    _buildList(_unread, showAll: false),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
                onPressed: () => _fetchNotifications(reset: true),
                child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> items, {required bool showAll}) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.notifications_none, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(showAll ? 'No notifications yet' : 'No unread notifications',
                style: const TextStyle(color: Colors.grey, fontSize: 16)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _fetchNotifications(reset: true),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: items.length + (_hasMore && showAll ? 1 : 0),
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index == items.length) {
            return _buildLoadMore();
          }
          return _buildNotificationTile(items[index]);
        },
      ),
    );
  }

  Widget _buildLoadMore() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Center(
        child: _loadingMore
            ? const CircularProgressIndicator()
            : TextButton(
                onPressed: () => _fetchNotifications(),
                child: const Text('Load More'),
              ),
      ),
    );
  }

  Widget _buildNotificationTile(Map<String, dynamic> n) {
    final id = (n['_id'] ?? n['id'] ?? '').toString();
    final isRead = n['is_read'] == true;
    final type = n['type'] ?? 'system';
    final title = n['title'] ?? '';
    final message = n['message'] ?? '';
    final createdAt = n['created_at'];

    return Dismissible(
      key: ValueKey('notif_$id'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Notification'),
            content: const Text('Are you sure you want to delete this notification?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
            ],
          ),
        ) ?? false;
      },
      background: Container(
        color: AppTheme.errorColor,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => _deleteNotification(id),
      child: InkWell(
        onTap: () {
          if (!isRead) _markRead(id);
          _showNotificationPopup(n);
        },
        child: Container(
          color: isRead ? Colors.transparent : AppTheme.primaryColor.withAlpha(10),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _typeColor(type).withAlpha(38),
                  shape: BoxShape.circle,
                ),
                child: Icon(_typeIcon(type), color: _typeColor(type), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(title,
                              style: TextStyle(
                                  fontWeight:
                                      isRead ? FontWeight.normal : FontWeight.bold,
                                  fontSize: 14)),
                        ),
                        if (!isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppTheme.primaryColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    if (message.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(message,
                          style: const TextStyle(color: Colors.grey, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      createdAt != null ? _timeAgo(createdAt) : '',
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'payment': return Icons.payment;
      case 'auction': return Icons.gavel;
      case 'chit_group': return Icons.group;
      case 'kyc': return Icons.verified_user;
      default: return Icons.notifications;
    }
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'payment': return AppTheme.successColor;
      case 'auction': return AppTheme.secondaryColor;
      case 'chit_group': return AppTheme.primaryColor;
      case 'kyc': return const Color(0xFF9C27B0);
      default: return Colors.grey;
    }
  }

  Future<void> _markUnread(String id) async {
    setState(() {
      final idx = _notifications.indexWhere((n) => (n['_id'] ?? n['id']).toString() == id);
      if (idx != -1) _notifications[idx] = {..._notifications[idx], 'is_read': false};
    });
    try {
      await ApiService.put('/notifications/$id/mark-unread', {});
    } catch (_) {}
  }

  void _showNotificationPopup(Map<String, dynamic> n) {
    final id = (n['_id'] ?? n['id'] ?? '').toString();
    final title = n['title'] ?? '';
    final message = n['message'] ?? '';
    final type = n['type'] ?? 'system';
    final createdAt = n['created_at'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _typeColor(type).withAlpha(38),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(_typeIcon(type), color: _typeColor(type), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(title,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(message, style: const TextStyle(fontSize: 14, height: 1.5)),
            if (createdAt != null) ...[
              const SizedBox(height: 12),
              Text(_timeAgo(createdAt),
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _markUnread(id);
                      Navigator.pop(ctx);
                    },
                    child: const Text('Mark as Unread'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate).toLocal();
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return DateFormat('dd MMM').format(dt);
    } catch (_) {
      return '';
    }
  }
}
