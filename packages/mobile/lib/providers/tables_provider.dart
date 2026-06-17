import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../models/order.dart';
import '../models/table_info.dart';

class TablesProvider with ChangeNotifier {
  List<TableInfo> _tables = [];
  bool _isLoading = false;
  int _tableCount = 10;

  List<TableInfo> get tables => _tables;
  bool get isLoading => _isLoading;

  void _safeNotify() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });
  }

  void updateTableCount(int count) {
    _tableCount = count;
    _safeNotify();
  }

  void refreshTables(List<Order> allOrders) {
    _tables = List.generate(_tableCount, (index) {
      final tableNum = (index + 1).toString().padLeft(2, '0');
      return TableInfo.fromOrders(tableNum, allOrders);
    });
    _safeNotify();
  }

  // Statistics for tables specifically
  int get occupiedCount => _tables.where((t) => t.status != TableStatus.empty).length;
  int get emptyCount => _tables.where((t) => t.status == TableStatus.empty).length;
  double get totalActiveRevenue => _tables.fold(0.0, (sum, t) => sum + t.totalAmount);
  int get totalNewItems => _tables.fold(0, (sum, t) => sum + t.orders.where((o) => o.status == OrderStatus.pending).length);
  int get totalReadyItems => _tables.fold(0, (sum, t) => sum + t.readyItemsCount);
}
