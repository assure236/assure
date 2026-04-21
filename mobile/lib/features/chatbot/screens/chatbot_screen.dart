import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

class ChatbotScreen extends StatefulWidget {
  const ChatbotScreen({Key? key}) : super(key: key);

  @override
  State<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [
    _ChatMessage(
      from: 'bot',
      text: "Hi! I'm Assure Bot 🤖\nHow can I help you today?\n\nTry: \"Show chits for 20 months\" or \"My payments\"",
    ),
  ];
  bool _loading = false;

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
    _controller.clear();
    _scrollToBottom();

    try {
      final res = await ApiService.post('/chatbot/chat', {'message': text.trim()});
      if (res['success'] == true) {
        final data = res['data'];
        final List<Map<String, dynamic>> chitGroups =
            (data['chitGroups'] as List?)?.map((g) => Map<String, dynamic>.from(g)).toList() ?? [];
        setState(() {
          _messages.add(_ChatMessage(
            from: 'bot',
            text: data['reply'] ?? '',
            chitGroups: chitGroups,
          ));
        });
      } else {
        setState(() {
          _messages.add(_ChatMessage(from: 'bot', text: 'Sorry, something went wrong.'));
        });
      }
    } catch (_) {
      setState(() {
        _messages.add(_ChatMessage(from: 'bot', text: 'Unable to reach server. Try again later.'));
      });
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
              radius: 14,
              backgroundColor: Colors.white24,
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: SvgPicture.asset('assets/icons/chatbot.svg',
                    colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
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

  _ChatMessage({required this.from, required this.text, this.chitGroups = const []});
}

class _MessageBubble extends StatelessWidget {
  final _ChatMessage msg;
  final bool isUser;
  final void Function(String) onChitTap;

  const _MessageBubble({required this.msg, required this.isUser, required this.onChitTap});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
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
            Text(
              msg.text,
              style: TextStyle(color: isUser ? Colors.white : Colors.black87, fontSize: 14, height: 1.4),
            ),
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
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(g['group_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                const SizedBox(height: 2),
                                Text(
                                  '${_inr.format(g['chit_value'] ?? 0)} • ${g['duration_months']}mo • ${_inr.format(g['monthly_installment'] ?? 0)}/mo',
                                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.primaryColor),
                        ],
                      ),
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}
