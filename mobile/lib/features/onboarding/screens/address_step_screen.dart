import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/onboarding_api.dart';
import 'onboarding_layout.dart';

class AddressStepScreen extends StatefulWidget {
  const AddressStepScreen({super.key});
  @override
  State<AddressStepScreen> createState() => _AddressStepScreenState();
}

class _AddressStepScreenState extends State<AddressStepScreen> {
  final _addr = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _pin = TextEditingController();
  final _addr2 = TextEditingController();
  final _city2 = TextEditingController();
  final _state2 = TextEditingController();
  final _pin2 = TextEditingController();
  bool _same = true;
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_addr.text.isEmpty || _city.text.isEmpty || _state.text.isEmpty || _pin.text.isEmpty) {
      setState(() => _error = 'Please fill all permanent address fields.');
      return;
    }
    if (!RegExp(r'^\d{6}$').hasMatch(_pin.text)) { setState(() => _error = 'Pincode must be 6 digits.'); return; }
    if (!_same) {
      if (_addr2.text.isEmpty || _city2.text.isEmpty || _state2.text.isEmpty || _pin2.text.isEmpty) {
        setState(() => _error = 'Fill current address or tick "Same as permanent".');
        return;
      }
      if (!RegExp(r'^\d{6}$').hasMatch(_pin2.text)) { setState(() => _error = 'Current pincode must be 6 digits.'); return; }
    }
    setState(() => _busy = true);
    try {
      await OnboardingApi.saveAddress({
        'address': _addr.text, 'city': _city.text, 'state': _state.text, 'pincode': _pin.text,
        'current_same_as_permanent': _same,
        'current_address': _same ? _addr.text : _addr2.text,
        'current_city': _same ? _city.text : _city2.text,
        'current_state': _same ? _state.text : _state2.text,
        'current_pincode': _same ? _pin.text : _pin2.text,
      });
      await OnboardingApi.complete();
      if (mounted) context.go('/onboarding/done');
    } catch (e) {
      setState(() => _error = 'Failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      stepIndex: 4,
      title: 'Your address',
      subtitle: 'Last step. Enter your permanent address.',
      loading: _busy,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Permanent Address', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.grey)),
        TextField(controller: _addr, decoration: const InputDecoration(labelText: 'Street / House / Area'), maxLines: 2),
        Row(children: [
          Expanded(child: TextField(controller: _city, decoration: const InputDecoration(labelText: 'City'))),
          const SizedBox(width: 10),
          Expanded(child: TextField(controller: _state, decoration: const InputDecoration(labelText: 'State'))),
        ]),
        TextField(controller: _pin, decoration: const InputDecoration(labelText: 'Pincode'), keyboardType: TextInputType.number, maxLength: 6),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text('Current address is same as permanent'),
          value: _same,
          onChanged: (v) => setState(() => _same = v ?? true),
        ),
        if (!_same) ...[
          const Divider(),
          const SizedBox(height: 6),
          const Text('Current Address', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.grey)),
          TextField(controller: _addr2, decoration: const InputDecoration(labelText: 'Street / House / Area'), maxLines: 2),
          Row(children: [
            Expanded(child: TextField(controller: _city2, decoration: const InputDecoration(labelText: 'City'))),
            const SizedBox(width: 10),
            Expanded(child: TextField(controller: _state2, decoration: const InputDecoration(labelText: 'State'))),
          ]),
          TextField(controller: _pin2, decoration: const InputDecoration(labelText: 'Pincode'), keyboardType: TextInputType.number, maxLength: 6),
        ],
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        const SizedBox(height: 14),
        ElevatedButton(
          onPressed: _busy ? null : _submit,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0B1F3B), foregroundColor: Colors.white),
          child: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Save & Finish Onboarding')),
        ),
      ]),
    );
  }
}
