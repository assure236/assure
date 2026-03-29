import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// A 6-dot PIN display + custom numpad.
/// Calls [onCompleted] whenever all 6 digits are entered.
class PinInputRow extends StatefulWidget {
  const PinInputRow({
    super.key,
    required this.onCompleted,
    this.showMismatch = false,
  });

  final ValueChanged<String> onCompleted;
  final bool showMismatch;

  @override
  State<PinInputRow> createState() => _PinInputRowState();
}

class _PinInputRowState extends State<PinInputRow> {
  String _value = '';

  void _append(String digit) {
    if (_value.length >= 6) return;
    setState(() => _value += digit);
    if (_value.length == 6) widget.onCompleted(_value);
  }

  void _backspace() {
    if (_value.isEmpty) return;
    setState(() => _value = _value.substring(0, _value.length - 1));
    widget.onCompleted(_value);
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = widget.showMismatch ? AppTheme.errorColor : AppTheme.primaryColor;

    return Column(
      children: [
        // ── Dot indicators ──────────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (i) {
            final filled = i < _value.length;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? dotColor : Colors.grey.shade300,
                border: Border.all(
                  color: filled ? dotColor : Colors.grey.shade400,
                  width: 1.5,
                ),
              ),
            );
          }),
        ),
        if (widget.showMismatch) ...[
          const SizedBox(height: 8),
          const Text('MPINs do not match',
              style: TextStyle(color: AppTheme.errorColor, fontSize: 12)),
        ],
        const SizedBox(height: 28),
        // ── Numpad ───────────────────────────────────────────────────────────
        _buildNumpad(),
      ],
    );
  }

  Widget _buildNumpad() {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '<'],
    ];

    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: row.map((key) {
              if (key.isEmpty) return const SizedBox(width: 72, height: 52);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: _NumpadKey(
                  label: key,
                  onTap: () {
                    if (key == '<') {
                      _backspace();
                    } else {
                      _append(key);
                    }
                  },
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}

class _NumpadKey extends StatelessWidget {
  const _NumpadKey({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isBackspace = label == '<';
    return Material(
      color: Colors.grey.shade100,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: SizedBox(
          width: 72,
          height: 52,
          child: Center(
            child: isBackspace
                ? const Icon(Icons.backspace_outlined, size: 22, color: Colors.black54)
                : Text(
                    label,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w500),
                  ),
          ),
        ),
      ),
    );
  }
}
