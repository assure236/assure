import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/chit_group_model.dart';
import '../services/api_service.dart';

class ChitGroupProvider with ChangeNotifier {
  List<ChitGroup> _chitGroups = [];
  ChitGroup? _selectedChitGroup;
  bool _isLoading = false;

  static const _cacheKey = 'chit_groups_cache';
  static const _cacheTsKey = 'chit_groups_cache_ts';

  List<ChitGroup> get chitGroups => _chitGroups;
  ChitGroup? get selectedChitGroup => _selectedChitGroup;
  bool get isLoading => _isLoading;

  Future<void> fetchMyChitGroups() async {
    // Load from cache immediately for fast UI
    if (_chitGroups.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs.getString(_cacheKey);
        if (cached != null) {
          final list = jsonDecode(cached) as List;
          _chitGroups = list
              .map((j) => ChitGroup.fromJson(Map<String, dynamic>.from(j)))
              .where((g) => g.id.isNotEmpty)
              .toList();
          notifyListeners();
        }
      } catch (_) {}
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await ApiService.get('/users/my-chit-groups');

      if (response['success']) {
        _chitGroups = (response['data'] as List)
            .map((json) => ChitGroup.fromJson(json['chit_group_id'] as Map<String, dynamic>))
            .where((g) => g.id.isNotEmpty)
            .toList();
        // Persist to cache
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_cacheKey, jsonEncode(
            _chitGroups.map((g) => g.toJson()).toList(),
          ));
          await prefs.setInt(_cacheTsKey, DateTime.now().millisecondsSinceEpoch);
        } catch (_) {}
      }
    } catch (e) {
      debugPrint('Error fetching chit groups: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> fetchChitGroupDetails(String id) async {
    _selectedChitGroup = null;
    _isLoading = true;
    notifyListeners();
    try {
      final response = await ApiService.get('/chit-groups/$id');
      
      if (response['success']) {
        _selectedChitGroup = ChitGroup.fromJson(response['data']);
      }
    } catch (e) {
      debugPrint('Error fetching chit group details: $e');
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<List<Map<String, dynamic>>> fetchGroupAuctions(String groupId) async {
    try {
      final response = await ApiService.get('/chit-groups/$groupId/auctions');
      if (response['success'] == true) {
        return List<Map<String, dynamic>>.from(response['data'] ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching group auctions: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> enrollInChitGroup(String groupId) async {
    try {
      final response = await ApiService.post('/chit-groups/$groupId/enroll', {});
      final success = response['success'] == true;
      if (success) {
        await fetchMyChitGroups();
      }
      return {
        'success': success,
        'message': response['message'] ?? (success ? 'Enrolled successfully' : 'Enrollment failed'),
      };
    } catch (e) {
      debugPrint('Error enrolling in chit group: $e');
      return {
        'success': false,
        'message': 'Unable to enroll right now. Please try again.',
      };
    }
  }

  Future<List<Map<String, dynamic>>> fetchAvailableGroups() async {
    try {
      final response = await ApiService.get('/chit-groups?status=active');
      if (response['success'] == true) {
        final data = response['data'];
        final list = (data is Map) ? data['groups'] : data;
        return List<Map<String, dynamic>>.from(list ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching available groups: $e');
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchVacantGroups() async {
    try {
      final response = await ApiService.get('/chit-groups?status=vacant&limit=50');
      if (response['success'] == true) {
        final data = response['data'];
        final list = (data is Map) ? data['groups'] : data;
        return List<Map<String, dynamic>>.from(list ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching vacant groups: $e');
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchNewGroups() async {
    try {
      final response = await ApiService.get('/chit-groups?status=not_started,active&limit=50');
      if (response['success'] == true) {
        final data = response['data'];
        final list = (data is Map) ? data['groups'] : data;
        return List<Map<String, dynamic>>.from(list ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching new groups: $e');
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchGroupMembers(String groupId) async {
    try {
      final response = await ApiService.get('/chit-groups/$groupId/members');
      if (response['success'] == true) {
        return List<Map<String, dynamic>>.from(response['data'] ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching group members: $e');
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchGroupPayments(String groupId) async {
    try {
      final response = await ApiService.get('/chit-groups/$groupId/payment-schedule');
      if (response['success'] == true) {
        return List<Map<String, dynamic>>.from(response['data'] ?? []);
      }
    } catch (e) {
      debugPrint('Error fetching group payments: $e');
    }
    return [];
  }
}
