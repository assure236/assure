import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

class ChatbotScreen extends StatefulWidget {
  const ChatbotScreen({super.key});

  @override
  State<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  static const _historyKey = 'chatbot_history_v1';

  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [
    _ChatMessage(
      from: 'bot',
      text: "Hi! I'm Assure Bot 🤖\nHow can I help you today?\n\nTry: \"Show chits for 20 months\" or \"My payments\"",
    ),
  ];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_historyKey);
      if (raw == null || raw.isEmpty) return;
      final list = jsonDecode(raw) as List<dynamic>;
      final cutoff = DateTime.now().subtract(const Duration(days: 7));
      final loaded = list
          .map((e) => _ChatMessage.fromJson(e as Map<String, dynamic>))
          .where((m) => m.timestamp.isAfter(cutoff))
          .toList();
      if (loaded.isNotEmpty && mounted) {
        setState(() {
          _messages
            ..clear()
            ..addAll(loaded);
        });
        _scrollToBottom();
      }
    } catch (_) {}
  }

  Future<void> _saveHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          _historyKey, jsonEncode(_messages.map((m) => m.toJson()).toList()));
    } catch (_) {}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty || _loading) return;
    setState(() {
      _messages.add(_ChatMessage(from: 'user', text: text.trim()));
      _loading = true;
    });
    _saveHistory();
    _controller.clear();
    _scrollToBottom();

    try {
      // Build short history (last 8 turns, skipping the welcome message and the
      // user message we just added — server prepends the current message itself).
      final historyMessages = _messages
          .where((m) => m.text.isNotEmpty)
          .toList();
      // Drop the user message just appended so server doesn't see it twice
      if (historyMessages.isNotEmpty && historyMessages.last.from == 'user') {
        historyMessages.removeLast();
      }
      final history = historyMessages
          .skip(historyMessages.length > 8 ? historyMessages.length - 8 : 0)
          .map((m) => {
                'role': m.from == 'user' ? 'user' : 'assistant',
                'content': m.text,
              })
          .toList();

      final res = await ApiService.post('/chatbot/chat', {
        'message': text.trim(),
        'history': history,
      });
      if (res['success'] == true) {
        final data = res['data'];
        final userQuery = text.trim();
        final allChitGroups =
            (data['chitGroups'] as List?)?.map((g) => Map<String, dynamic>.from(g)).toList() ?? [];
        final List<Map<String, dynamic>> chitGroups = _limitChitGroups(allChitGroups, maxItems: 3);
        final quickLinks = _quickLinksFromUserQuery(userQuery);
        final reply = _compactReply(data['reply']?.toString() ?? '', userQuery, allChitGroups.length);
        setState(() {
          _messages.add(_ChatMessage(
            from: 'bot',
            text: reply,
            chitGroups: chitGroups,
            quickLinks: quickLinks,
          ));
        });
        _saveHistory();
      } else {
        setState(() {
          _messages.add(_ChatMessage(from: 'bot', text: 'Sorry, something went wrong.'));
        });
        _saveHistory();
      }
    } catch (_) {
      setState(() {
        _messages.add(_ChatMessage(from: 'bot', text: 'Unable to reach server. Try again later.'));
      });
      _saveHistory();
    } finally {
      setState(() => _loading = false);
      _scrollToBottom();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: SvgPicture.asset('assets/icons/chatbot.svg'),
              ),
            ),
            const SizedBox(width: 8),
            const Text('Assure Bot'),
          ],
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppTheme.primaryDark, AppTheme.primaryColor],
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length + (_loading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length && _loading) {
                  return const Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: EdgeInsets.all(8.0),
                      child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                  );
                }
                final msg = _messages[index];
                final isUser = msg.from == 'user';
                return _MessageBubble(
                  msg: msg,
                  isUser: isUser,
                  onChitTap: (id) {
                    context.push('/chit-groups/$id');
                  },
                );
              },
            ),
          ),

          // Quick chips
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: ['My payments', 'Wallet balance', 'Next auction', 'My profile', 'KYC status', 'Referral code', 'Active chits', 'Help']
                  .map((q) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ActionChip(
                          label: Text(q, style: const TextStyle(fontSize: 12)),
                          onPressed: () => _sendMessage(q),
                        ),
                      ))
                  .toList(),
            ),
          ),

          // Input
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4, offset: const Offset(0, -1))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: InputDecoration(
                      hintText: 'Type your message...',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      filled: true,
                      fillColor: AppTheme.backgroundColor,
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: _sendMessage,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: AppTheme.primaryColor),
                  onPressed: () => _sendMessage(_controller.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  final String from;
  final String text;
  final List<Map<String, dynamic>> chitGroups;
  final List<Map<String, dynamic>> quickLinks;
  final DateTime timestamp;

  _ChatMessage({
    required this.from,
    required this.text,
    this.chitGroups = const [],
    this.quickLinks = const [],
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'from': from,
        'text': text,
        'timestamp': timestamp.toIso8601String(),
        'chitGroups': chitGroups,
        'quickLinks': quickLinks,
      };

  static _ChatMessage fromJson(Map<String, dynamic> json) => _ChatMessage(
        from: json['from'] as String? ?? 'bot',
        text: json['text'] as String? ?? '',
        timestamp:
            DateTime.tryParse(json['timestamp'] as String? ?? '') ?? DateTime.now(),
        chitGroups: (json['chitGroups'] as List<dynamic>?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [],
        quickLinks: (json['quickLinks'] as List<dynamic>?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [],
      );
}

// ── Feature action links derived from user's question ────────────────────────
List<Map<String, dynamic>> _quickLinksFromUserQuery(String text) {
  final lower = text.toLowerCase();
  final actions = <Map<String, dynamic>>[];

  if (lower.contains('payment') || lower.contains('due') || lower.contains('installment') || lower.contains('wallet')) {
    actions.add({'label': '💳 Payments', 'route': '/payments'});
  }
  if (lower.contains('kyc') || lower.contains('aadhaar') || lower.contains('pan')) {
    actions.add({'label': '🪪 KYC', 'route': '/kyc'});
  }
  if (lower.contains('auction')) {
    actions.add({'label': '🔨 Auctions', 'route': '/auctions'});
  }
  if (lower.contains('chit') || lower.contains('invest') || lower.contains('enroll') || lower.contains('scheme')) {
    actions.add({'label': '📈 Invest', 'route': '/chit-groups'});
  }
  if (lower.contains('profile') || lower.contains('account details')) {
    actions.add({'label': '👤 My Profile', 'route': '/edit-profile'});
  }
  if (lower.contains('document') || lower.contains('vault') || lower.contains('proof')) {
    // Documents Vault removed — use KYC flows for document upload.
  }
  if (lower.contains('referral') || lower.contains('refer') || lower.contains('reward')) {
    actions.add({'label': '🎁 Referrals', 'route': '/referrals'});
  }
  if (lower.contains('support') || lower.contains('ticket') || lower.contains('help') || lower.contains('issue')) {
    actions.add({'label': '🎧 Support', 'route': '/support'});
  }
  if (lower.contains('notification')) {
    actions.add({'label': '🔔 Notifications', 'route': '/notifications'});
  }
  if (lower.contains('analytic') || lower.contains('insight') || lower.contains('report')) {
    actions.add({'label': '📊 Analytics', 'route': '/analytics'});
  }
  if (lower.contains('loan')) {
    actions.add({'label': '🏦 Apply Loan', 'route': '/apply-loan'});
  }
  if (lower.contains('goal')) {
    actions.add({'label': '🎯 Goals', 'route': '/goals'});
  }
  final seen = <String>{};
  return actions.where((a) => seen.add(a['route'] as String)).toList();
}

bool _isChitQuery(String text) {
  final lower = text.toLowerCase();
  return lower.contains('chit') || lower.contains('scheme') || lower.contains('invest') || lower.contains('plan');
}

List<Map<String, dynamic>> _limitChitGroups(List<Map<String, dynamic>> all, {int maxItems = 3}) {
  if (all.length <= maxItems) return all;
  return all.take(maxItems).toList();
}

String _compactReply(String reply, String userQuery, int totalChits) {
  final text = reply.trim();
  if (_isChitQuery(userQuery) && totalChits > 3) {
    return 'Here are the top chit options for you. Tap a card below to view details. For more schemes, click Invest.';
  }
  if (text.length > 700) {
    return '${text.substring(0, 700).trim()}...';
  }
  return text;
}

class _MessageBubble extends StatelessWidget {
  final _ChatMessage msg;
  final bool isUser;
  final void Function(String) onChitTap;

  const _MessageBubble({required this.msg, required this.isUser, required this.onChitTap});

  Widget _buildFormattedText(String text) {
    final spans = <TextSpan>[];
    final regex = RegExp(r'\*\*(.+?)\*\*');
    int last = 0;
    for (final match in regex.allMatches(text)) {
      if (match.start > last) {
        spans.add(TextSpan(text: text.substring(last, match.start)));
      }
      spans.add(TextSpan(
        text: match.group(1),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ));
      last = match.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return RichText(
      text: TextSpan(
        style: const TextStyle(color: Colors.black87, fontSize: 14, height: 1.4),
        children: spans,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final actions = isUser ? <Map<String, dynamic>>[] : msg.quickLinks;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isUser ? AppTheme.primaryColor : Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: Colors.black.withAlpha(15), blurRadius: 4, offset: const Offset(0, 1))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            isUser
                ? Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4))
                : _buildFormattedText(msg.text),
            // Chit group cards
            if (msg.chitGroups.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...msg.chitGroups.map((g) => GestureDetector(
                    onTap: () => onChitTap(g['_id']),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundColor,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE0E0E0)),
                      ),
                      child: Row(children: [
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(g['group_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text(
                            '${_inr.format(g['chit_value'] ?? 0)} • ${g['duration_months']}mo • ${_inr.format(g['monthly_installment'] ?? 0)}/mo',
                            style: const TextStyle(fontSize: 11, color: Colors.black54),
                          ),
                        ])),
                        const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.primaryColor),
                      ]),
                    ),
                  )),
              GestureDetector(
                onTap: () => context.push('/chit-groups'),
                child: Container(
                  margin: const EdgeInsets.only(top: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.primaryColor.withAlpha(60)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.trending_up, size: 14, color: AppTheme.primaryColor),
                      SizedBox(width: 6),
                      Text(
                        'Invest to see more chits',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primaryColor),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            // Feature action links
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text('Quick links:', style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: actions.map((a) => GestureDetector(
                onTap: () => context.push(a['route'] as String),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withAlpha(12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.primaryColor.withAlpha(60)),
                  ),
                  child: Text(a['label'] as String,
                      style: const TextStyle(fontSize: 12, color: AppTheme.primaryColor, fontWeight: FontWeight.w600)),
                ),
              )).toList()),
            ],
          ],
        ),
      ),
    );
  }
}
