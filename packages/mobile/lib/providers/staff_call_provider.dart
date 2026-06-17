import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

class StaffCall {
  final String tableNumber;
  final DateTime createdAt;
  bool isHandled;

  StaffCall({
    required this.tableNumber,
    required this.createdAt,
    this.isHandled = false,
  });
}

class StaffCallProvider with ChangeNotifier {
  final List<StaffCall> _calls = [];

  List<StaffCall> get activeCalls => _calls.where((c) => !c.isHandled).toList();
  List<StaffCall> get allCalls => _calls;

  void _safeNotify() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });
  }

  void addCall(String tableNumber) {
    _calls.insert(0, StaffCall(tableNumber: tableNumber, createdAt: DateTime.now()));
    _safeNotify();
  }

  void handleCall(StaffCall call) {
    call.isHandled = true;
    _safeNotify();
  }

  void clearAll() {
    _calls.clear();
    _safeNotify();
  }
}
