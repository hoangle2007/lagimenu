import 'order.dart';

enum TableStatus {
  empty,
  pending,
  preparing,
  ready,
  busy,
}

class TableInfo {
  final String number;
  final TableStatus status;
  final List<Order> orders;
  final double totalAmount;
  final DateTime? lastUpdate;
  final int readyItemsCount;

  TableInfo({
    required this.number,
    required this.status,
    required this.orders,
    required this.totalAmount,
    this.lastUpdate,
    required this.readyItemsCount,
  });

  factory TableInfo.fromOrders(String number, List<Order> allOrders) {
    // Normalize table number for comparison (handle both "1" and "01" formats)
    String normalizeTableNumber(String? num) {
      if (num == null) return '';
      final cleaned = num.trim().toLowerCase()
          .replaceAll('bàn', '')
          .replaceAll('table', '')
          .replaceAll('#', '')
          .trim();
      
      final parsed = int.tryParse(cleaned);
      if (parsed != null) {
        return parsed.toString();
      }
      return cleaned;
    }

    final normalizedNumber = normalizeTableNumber(number);
    final activeOrders = allOrders.where((o) {
      return normalizeTableNumber(o.tableNumber) == normalizedNumber &&
          o.status != OrderStatus.cancelled &&
          o.status != OrderStatus.paid;
    }).toList();

    TableStatus status = TableStatus.empty;
    if (activeOrders.any((o) => o.status == OrderStatus.ready)) {
      status = TableStatus.ready;
    } else if (activeOrders.any((o) => o.status == OrderStatus.pending)) {
      status = TableStatus.pending;
    } else if (activeOrders.any((o) => o.status == OrderStatus.preparing)) {
      status = TableStatus.preparing;
    } else if (activeOrders.isNotEmpty) {
      status = TableStatus.busy;
    }

    final totalAmount = activeOrders.fold(0.0, (sum, o) => sum + o.totalPrice);
    final readyItemsCount = activeOrders.where((o) => o.status == OrderStatus.ready).length;
    
    DateTime? lastUpdate;
    if (activeOrders.isNotEmpty) {
      activeOrders.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      lastUpdate = activeOrders.first.createdAt;
    }

    return TableInfo(
      number: number,
      status: status,
      orders: activeOrders,
      totalAmount: totalAmount,
      lastUpdate: lastUpdate,
      readyItemsCount: readyItemsCount,
    );
  }
}
