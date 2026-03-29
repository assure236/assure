import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int? _expandedFaq;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  static const _tutorials = [
    {
      'title': 'Getting Started with Assure ChitFunds',
      'desc': 'Learn how to create your account, complete KYC, and enroll in your first chit.',
      'duration': '5 min',
      'icon': Icons.play_circle_outline,
    },
    {
      'title': 'How Chit Funds Work',
      'desc': 'Understand the chit fund mechanism — monthly auctions, dividends, and payouts.',
      'duration': '7 min',
      'icon': Icons.play_circle_outline,
    },
    {
      'title': 'How to Bid in an Auction',
      'desc': 'Step-by-step guide on entering a live auction room and placing your bid.',
      'duration': '4 min',
      'icon': Icons.play_circle_outline,
    },
    {
      'title': 'Making Payments',
      'desc': 'Learn how to make monthly installment payments and view payment history.',
      'duration': '3 min',
      'icon': Icons.play_circle_outline,
    },
    {
      'title': 'Understanding Your Credit Score',
      'desc': 'How your credit score is calculated and how timely payments improve it.',
      'duration': '4 min',
      'icon': Icons.play_circle_outline,
    },
    {
      'title': 'Refer & Earn Program',
      'desc': 'How to refer friends and earn rewards through your referral code.',
      'duration': '3 min',
      'icon': Icons.play_circle_outline,
    },
  ];

  static const _faqs = [
    {
      'q': 'What is a chit fund?',
      'a': 'A chit fund is a type of savings scheme where a group of members contribute a fixed amount every month. Each month, one member receives the entire pot through an auction (bidding process), minus a small commission and dividend shared among all members.',
    },
    {
      'q': 'How is the dividend calculated?',
      'a': 'The dividend = (Chit Value − Winning Bid) ÷ Number of Members. For example, if the chit value is ₹1,00,000 and the winning bid is ₹80,000, the prize money is ₹80,000 and the dividend per member is ₹20,000 ÷ (No. of members).',
    },
    {
      'q': 'When can I take the chit amount?',
      'a': 'You can take the prize by bidding in a monthly auction. Each member can only win once during the chit tenure. Non-prize-takers continue to pay installments and receive dividends.',
    },
    {
      'q': 'What happens if I miss a payment?',
      'a': 'Missing a payment results in a late fee and reduces your credit score. Repeated defaults may lead to suspension from the chit group. Timely payments keep you in good standing.',
    },
    {
      'q': 'How do I complete my KYC?',
      'a': 'Go to Profile → KYC & Documents. Upload a valid photo ID (Aadhaar/PAN), address proof, and a selfie. Our team reviews and approves within 24-48 hours.',
    },
    {
      'q': 'Is my money safe?',
      'a': 'Yes. Assure ChitFunds is a registered chit fund company regulated by the State Government under the Chit Funds Act. All transactions are recorded and audited.',
    },
    {
      'q': 'What is the referral program?',
      'a': 'Share your unique referral code with friends. When they enroll in a chit group, you earn cash rewards credited to your account. Rewards are unlocked after their first successful installment.',
    },
    {
      'q': 'How do I contact customer support?',
      'a': 'Use the "Contact Support" option in your Profile to send a message. Our team responds within 24 hours on working days. For urgent matters, call our helpline: 1800-XXX-XXXX.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Help Center'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.secondaryColor,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'Tutorials'),
            Tab(text: 'FAQs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTutorialsTab(),
          _buildFaqTab(),
        ],
      ),
    );
  }

  Widget _buildTutorialsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionHeader(
          icon: Icons.ondemand_video,
          title: 'Video Tutorials',
          subtitle: 'Learn how to use all features',
        ),
        const SizedBox(height: 12),
        ..._tutorials.map((t) => _TutorialCard(
              title: t['title'] as String,
              desc: t['desc'] as String,
              duration: t['duration'] as String,
              icon: t['icon'] as IconData,
            )),
        const SizedBox(height: 20),
        _ContactCard(),
      ],
    );
  }

  Widget _buildFaqTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionHeader(
          icon: Icons.help_outline,
          title: 'Frequently Asked Questions',
          subtitle: 'Quick answers to common questions',
        ),
        const SizedBox(height: 12),
        ..._faqs.asMap().entries.map((entry) {
          final idx = entry.key;
          final faq = entry.value;
          return _FaqTile(
            index: idx,
            question: faq['q']!,
            answer: faq['a']!,
            isExpanded: _expandedFaq == idx,
            onTap: () {
              setState(() {
                _expandedFaq = _expandedFaq == idx ? null : idx;
              });
            },
          );
        }),
        const SizedBox(height: 20),
        _ContactCard(),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0D47A1), Color(0xFF1976D2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              color: Colors.white24, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: Colors.white, size: 28),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16)),
            const SizedBox(height: 2),
            Text(subtitle,
                style:
                    const TextStyle(color: Colors.white70, fontSize: 12)),
          ]),
        ),
      ]),
    );
  }
}

class _TutorialCard extends StatelessWidget {
  final String title;
  final String desc;
  final String duration;
  final IconData icon;

  const _TutorialCard({
    required this.title,
    required this.desc,
    required this.duration,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 1,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: AppTheme.primaryColor, size: 26),
        ),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(desc,
                style:
                    const TextStyle(color: Colors.grey, fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.timer_outlined, size: 12, color: Colors.grey),
              const SizedBox(width: 4),
              Text(duration,
                  style:
                      const TextStyle(color: Colors.grey, fontSize: 11)),
            ]),
          ],
        ),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Video: $title'),
              behavior: SnackBarBehavior.floating,
              action: SnackBarAction(label: 'OK', onPressed: () {}),
            ),
          );
        },
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final int index;
  final String question;
  final String answer;
  final bool isExpanded;
  final VoidCallback onTap;

  const _FaqTile({
    required this.index,
    required this.question,
    required this.answer,
    required this.isExpanded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isExpanded
            ? const BorderSide(color: AppTheme.primaryColor, width: 1)
            : BorderSide.none,
      ),
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Q${index + 1}',
                    style: const TextStyle(
                        color: AppTheme.primaryColor,
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    question,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                Icon(
                  isExpanded ? Icons.expand_less : Icons.expand_more,
                  color: Colors.grey,
                ),
              ]),
              if (isExpanded) ...[
                const Divider(height: 16),
                Text(
                  answer,
                  style: const TextStyle(
                      color: Colors.black87, fontSize: 13, height: 1.5),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.secondaryColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.secondaryColor.withOpacity(0.3)),
      ),
      child: Column(children: [
        const Icon(Icons.headset_mic_outlined,
            color: AppTheme.secondaryColor, size: 36),
        const SizedBox(height: 8),
        const Text('Still need help?',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 4),
        const Text(
          'Our support team is available Mon–Sat, 9 AM – 6 PM',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey, fontSize: 12),
        ),
        const SizedBox(height: 12),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          ElevatedButton.icon(
            onPressed: () => Navigator.pushNamed(context, '/support'),
            icon: const Icon(Icons.chat_bubble_outline, size: 16),
            label: const Text('Chat with Us'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.secondaryColor,
              foregroundColor: Colors.white,
            ),
          ),
        ]),
      ]),
    );
  }
}
