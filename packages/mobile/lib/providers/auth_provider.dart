import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/merchant.dart';
import 'dart:convert';

enum UserType { merchant, employee }

class AuthProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  Merchant? _merchant;
  String? _token;
  String? _employeeToken;
  String? _employeeData;
  bool _isLoading = false;
  UserType? _userType;

  Merchant? get merchant => _merchant;
  String? get token => _token;
  String? get employeeToken => _employeeToken;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null || _employeeToken != null;
  UserType? get userType => _userType;
  bool get isMerchant => _token != null;
  bool get isEmployee => _employeeToken != null;

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();

    // Check for merchant session
    _token = prefs.getString('auth_token');
    final merchantData = prefs.getString('merchant_data');
    if (merchantData != null) {
      _merchant = Merchant.fromJson(json.decode(merchantData));
      _userType = UserType.merchant;
    }

    // Check for employee session
    _employeeToken = prefs.getString('employee_token');
    _employeeData = prefs.getString('employee_data');

    if (_employeeToken != null && _token == null) {
      _userType = UserType.employee;
    }

    notifyListeners();
  }

  // Merchant login
  Future<bool> login(String credential, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post('auth/login', data: {
        'email': credential,
        'password': password,
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        _token = data['access_token'];
        _userType = UserType.merchant;

        if (data['user'] != null) {
          _merchant = Merchant.fromJson(data['user']);
        } else if (data['merchant'] != null) {
          _merchant = Merchant.fromJson(data['merchant']);
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _token!);
        if (_merchant != null) {
          await prefs.setString('merchant_data', json.encode({
            'id': _merchant!.id,
            'name': _merchant!.name,
            'email': _merchant!.email,
            'phone': _merchant!.phone,
            'address': _merchant!.address,
            'tableCount': _merchant!.tableCount,
          }));
        }

        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Login error: $e');
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Employee login
  Future<bool> employeeLogin(String email, String pin, {String? shopSlug}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final Map<String, dynamic> data = {
        'email': email,
        'pin': pin,
      };
      if (shopSlug != null) {
        data['shopSlug'] = shopSlug;
      }

      final response = await _api.post('auth/employee-login', data: data);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        _employeeToken = data['access_token'];
        _userType = UserType.employee;

        // Save employee data
        final employeeInfo = data['user'] ?? data['employee'];
        if (employeeInfo != null) {
          _employeeData = json.encode(employeeInfo);
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('employee_token', _employeeToken!);
        if (_employeeData != null) {
          await prefs.setString('employee_data', _employeeData!);
        }

        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Employee login error: $e');
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Get employee info
  Map<String, dynamic>? get employeeInfo {
    if (_employeeData == null) return null;
    try {
      return json.decode(_employeeData!);
    } catch (e) {
      return null;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();

    // Clear all tokens
    _token = null;
    _employeeToken = null;
    _merchant = null;
    _employeeData = null;
    _userType = null;

    await prefs.remove('auth_token');
    await prefs.remove('merchant_data');
    await prefs.remove('employee_token');
    await prefs.remove('employee_data');

    notifyListeners();
  }

  Future<void> logoutMerchant() async {
    final prefs = await SharedPreferences.getInstance();
    _token = null;
    _merchant = null;
    if (_userType == UserType.merchant) {
      _userType = null;
    }
    await prefs.remove('auth_token');
    await prefs.remove('merchant_data');
    notifyListeners();
  }

  Future<void> logoutEmployee() async {
    final prefs = await SharedPreferences.getInstance();
    _employeeToken = null;
    _employeeData = null;
    if (_userType == UserType.employee) {
      _userType = null;
    }
    await prefs.remove('employee_token');
    await prefs.remove('employee_data');
    notifyListeners();
  }
}
