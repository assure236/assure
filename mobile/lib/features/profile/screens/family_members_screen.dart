import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class FamilyMembersScreen extends StatelessWidget {
  const FamilyMembersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Family Members'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(26),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.family_restroom,
                    size: 64, color: AppTheme.primaryColor),
              ),
              const SizedBox(height: 24),
              const Text('Family Members',
                  style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Text(
                'Link your family members to your account for easy chit group management and seamless payments.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600], fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.withAlpha(76)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.construction, color: Colors.orange, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'This feature is coming soon! We are working hard to bring family account linking to you.',
                        style: TextStyle(color: Colors.orange, fontSize: 13),
                      ),
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
}
