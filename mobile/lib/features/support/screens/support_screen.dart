import 'package:flutter/material.dart';


import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  final List<_ChatMessage> _messages = [
    _ChatMessage(
      text: 'Hello! Welcome to Assure ChitFunds support. How can I help you today?',
      isBot: true,
      time: DateTime.now(),
    ),
    _ChatMessage(
      text: 'Please choose a topic or type your question:',
      isBot: true,
      time: DateTime.now(),
      quickReplies: [
        'Payment issue',
        'KYC help',
        'Auction query',
        'Account problem',
        'Other',
      ],
    ),
  ];

  static const _autoResponses = {
    'payment issue': 'For payment issues, please check your internet connection and try again. If the problem persists, contact your branch or email support@assurechitfunds.com.',
    'kyc help': 'For KYC verification, go to Profile → KYC & Documents. Upload your Aadhaar, PAN, and a selfie. Our team reviews within 24-48 hours.',
    'auction query': 'Auctions happen on the scheduled date each month. Enter the auction room before it starts to place your bid. The highest bidder wins the prize money.',
    'account problem': 'For account issues, please verify your mobile number and email. If locked out, use "Forgot MPIN" on the login screen or contact support.',
    'other': 'I\'ve noted your query. Our support team will reach out to you via SMS and email within 24 hours on working days.',
  };

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    _controller.clear();
    setState(() {
      _messages.add(_ChatMessage(text: text, isBot: false, time: DateTime.now()));
      _sending = true;
    });
    _scrollToBottom();

    // Submit ticket to backend
    try {
      await ApiService.post('/users/support', {
        'subject': 'Mobile App Support Request',
        'message': text,
        'category': 'general',
      });
    } catch (_) {
      // Silently ignore – we still show bot response
    }

    // Auto-response after short delay
    await Future.delayed(const Duration(milliseconds: 900));
    final lower = text.toLowerCase();
    String botReply =
        'Thank you for reaching out. Your message has been received. Our team will respond within 24 business hours.';

    for (final entry in _autoResponses.entries) {
      if (lower.contains(entry.key)) {
        botReply = entry.value;
        break;
      }
    }

    if (mounted) {
      setState(() {
        _messages.add(_ChatMessage(text: botReply, isBot: true, time: DateTime.now()));
        _sending = false;
      });
      _scrollToBottom();
    }
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

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
                color: Colors.white24, shape: BoxShape.circle),
            child: const Icon(Icons.support_agent,
                color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Support Chat',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold)),
              Text('We reply within 24 hrs',
                  style:
                      TextStyle(color: Colors.white60, fontSize: 11)),
            ],
          ),
        ]),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length + (_sending ? 1 : 0),
              itemBuilder: (context, i) {
                if (_sending && i == _messages.length) {
                  return _TypingIndicator();
                }
                return _ChatBubble(
                  message: _messages[i],
                  onQuickReply: _sendMessage,
                );
              },
            ),
          ),
          _InputBar(
            controller: _controller,
            sending: _sending,
            onSend: () => _sendMessage(_controller.text),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  final String text;
  final bool isBot;
  final DateTime time;
  final List<String>? quickReplies;

  _ChatMessage({
    required this.text,
    required this.isBot,
    required this.time,
    this.quickReplies,
  });
}

class _ChatBubble extends StatelessWidget {
  final _ChatMessage message;
  final void Function(String) onQuickReply;

  const _ChatBubble({required this.message, required this.onQuickReply});

  @override
  Widget build(BuildContext context) {
    final isBot = message.isBot;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            isBot ? CrossAxisAlignment.start : CrossAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment:
                isBot ? MainAxisAlignment.start : MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (isBot) ...[
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                      color: AppTheme.primaryColor, shape: BoxShape.circle),
                  child: const Icon(Icons.support_agent,
                      color: Colors.white, size: 16),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isBot ? Colors.white : AppTheme.primaryColor,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isBot ? 4 : 16),
                      bottomRight: Radius.circular(isBot ? 16 : 4),
                    ),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 4,
                          offset: const Offset(0, 2))
                    ],
                  ),
                  child: Text(
                    message.text,
                    style: TextStyle(
                        color: isBot ? Colors.black87 : Colors.white,
                        fontSize: 14,
                        height: 1.4),
                  ),
                ),
              ),
              if (!isBot) const SizedBox(width: 8),
            ],
          ),
          if (message.quickReplies != null && message.quickReplies!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 36),
              child: Wrap(
                spacing: 8,
                runSpacing: 6,
                children: message.quickReplies!.map((qr) {
                  return InkWell(
                    onTap: () => onQuickReply(qr),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.primaryColor),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(qr,
                          style: const TextStyle(
                              color: AppTheme.primaryColor,
                              fontSize: 12,
                              fontWeight: FontWeight.w500)),
                    ),
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Container(
          width: 28,
          height: 28,
          decoration: const BoxDecoration(
              color: AppTheme.primaryColor, shape: BoxShape.circle),
          child:
              const Icon(Icons.support_agent, color: Colors.white, size: 16),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(children: [
            _Dot(delay: 0),
            _Dot(delay: 200),
            _Dot(delay: 400),
          ]),
        ),
      ]),
    );
  }
}

class _Dot extends StatefulWidget {
  final int delay;
  const _Dot({required this.delay});
  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        duration: const Duration(milliseconds: 600), vsync: this);
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
    _anim = Tween(begin: 0.3, end: 1.0).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: FadeTransition(
        opacity: _anim,
        child: Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
              color: Colors.grey, shape: BoxShape.circle),
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  const _InputBar({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 10,
        bottom: MediaQuery.of(context).viewInsets.bottom + 10,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 10,
              offset: const Offset(0, -4))
        ],
      ),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            maxLines: null,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'Type your message...',
              filled: true,
              fillColor: AppTheme.backgroundColor,
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 10),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none),
            ),
            onSubmitted: (_) => onSend(),
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: AppTheme.primaryColor,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: sending ? null : onSend,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child:
                          CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.send, color: Colors.white, size: 22),
            ),
          ),
        ),
      ]),
    );
  }
}
