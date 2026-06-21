import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ActiveMemberProvider with ChangeNotifier {
  static const _prefsKey = 'active_member_id';
  String? _activeMemberId;

  String? get activeMemberId => _activeMemberId;

  ActiveMemberProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey)?.trim();
    _activeMemberId = (raw == null || raw.isEmpty) ? null : raw.toUpperCase();
    notifyListeners();
  }

  Future<void> setActiveMemberId(String? memberId) async {
    final normalized = memberId?.trim().toUpperCase();
    final nextValue =
        (normalized == null || normalized.isEmpty) ? null : normalized;
    if (_activeMemberId == nextValue) return;

    _activeMemberId = nextValue;
    final prefs = await SharedPreferences.getInstance();
    if (_activeMemberId == null) {
      await prefs.remove(_prefsKey);
    } else {
      await prefs.setString(_prefsKey, _activeMemberId!);
    }
    notifyListeners();
  }
}
