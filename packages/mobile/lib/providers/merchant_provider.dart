import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/merchant.dart';

class MerchantProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  bool _isLoading = false;

  bool get isLoading => _isLoading;

  Future<void> updateMerchantStatus(String merchantId, bool isOpen, String token) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.put('merchants/$merchantId', data: {'isOpen': isOpen});
    } catch (e) {
      debugPrint('Update merchant status error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Merchant?> updateProfile(String merchantId, Map<String, dynamic> data, String token) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.put('merchants/$merchantId', data: data);

      if (response.statusCode == 200) {
        return Merchant.fromJson(response.data);
      }
    } catch (e) {
      debugPrint('Update profile error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return null;
  }
}
