import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/employee.dart';

class EmployeeProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  List<Employee> _employees = [];
  bool _isLoading = false;
  String? _error;

  List<Employee> get employees => _employees;
  List<Employee> get activeEmployees => _employees.where((e) => e.isActive).toList();
  List<Employee> get inactiveEmployees => _employees.where((e) => !e.isActive).toList();
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchEmployees() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('employees');
      if (response.statusCode == 200) {
        final data = response.data;
        final employeesList = data is List ? data : data['employees'] ?? [];
        _employees = employeesList.map((e) => Employee.fromJson(e)).toList();
        _employees.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      }
    } catch (e) {
      _error = 'Failed to fetch employees: $e';
      debugPrint(_error);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Employee?> createEmployee(Map<String, dynamic> employeeData) async {
    try {
      final response = await _api.post('employees', data: employeeData);
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newEmployee = Employee.fromJson(response.data);
        _employees.insert(0, newEmployee);
        notifyListeners();
        return newEmployee;
      }
    } catch (e) {
      debugPrint('Create employee error: $e');
    }
    return null;
  }

  Future<bool> updateEmployee(String employeeId, Map<String, dynamic> employeeData) async {
    try {
      final response = await _api.put('employees/$employeeId', data: employeeData);
      if (response.statusCode == 200) {
        final updatedEmployee = Employee.fromJson(response.data);
        final index = _employees.indexWhere((e) => e.id == employeeId);
        if (index != -1) {
          _employees[index] = updatedEmployee;
          notifyListeners();
        }
        return true;
      }
    } catch (e) {
      debugPrint('Update employee error: $e');
    }
    return false;
  }

  Future<bool> deactivateEmployee(String employeeId) async {
    try {
      final response = await _api.delete('employees/$employeeId');
      if (response.statusCode == 200) {
        final index = _employees.indexWhere((e) => e.id == employeeId);
        if (index != -1) {
          // Update local state - mark as inactive
          final old = _employees[index];
          _employees[index] = Employee(
            id: old.id,
            name: old.name,
            email: old.email,
            phone: old.phone,
            isActive: false,
            createdAt: old.createdAt,
            shopId: old.shopId,
          );
          notifyListeners();
        }
        return true;
      }
    } catch (e) {
      debugPrint('Deactivate employee error: $e');
    }
    return false;
  }

  Future<bool> activateEmployee(String employeeId) async {
    try {
      final response = await _api.put('employees/$employeeId', data: {'isActive': true});
      if (response.statusCode == 200) {
        final updatedEmployee = Employee.fromJson(response.data);
        final index = _employees.indexWhere((e) => e.id == employeeId);
        if (index != -1) {
          _employees[index] = updatedEmployee;
          notifyListeners();
        }
        return true;
      }
    } catch (e) {
      debugPrint('Activate employee error: $e');
    }
    return false;
  }
}