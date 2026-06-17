class OrderItem {
  final String productName;
  final int quantity;
  final double price;
  final String? note;

  OrderItem({required this.productName, required this.quantity, required this.price, this.note});

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      productName: json['product'] != null ? json['product']['name'] ?? 'N/A' : 'N/A',
      quantity: json['quantity'] ?? 1,
      price: double.tryParse((json['price'] ?? 0).toString()) ?? 0.0,
      note: json['note'],
    );
  }
}

enum OrderStatus {
  pending,
  confirmed,
  preparing,
  ready,
  completed,
  paid,
  cancelled,
}

class Order {
  final String id;
  final String tableNumber;
  final String? customerName;
  final String? customerPhone;
  final OrderStatus status;
  final double totalPrice;
  final List<OrderItem> items;
  final DateTime createdAt;
  final String? type;

  Order({
    required this.id,
    required this.tableNumber,
    this.customerName,
    this.customerPhone,
    required this.status,
    required this.totalPrice,
    required this.items,
    required this.createdAt,
    this.type,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    // Support both snake_case (from DB) and camelCase (from socket)
    final tableNum = json['table_number'] ?? json['tableNumber'] ?? '??';
    final custName = json['customer_name'] ?? json['customerName'];
    final custPhone = json['customer_phone'] ?? json['customerPhone'];
    final totalPriceRaw = json['total_price'] ?? json['totalPrice'] ?? '0';
    final createdAtRaw = json['created_at'] ?? json['createdAt'];
    return Order(
      id: json['id']?.toString() ?? '',
      tableNumber: tableNum.toString(),
      customerName: custName?.toString(),
      customerPhone: custPhone?.toString(),
      status: _parseStatus(json['status']),
      totalPrice: double.tryParse(totalPriceRaw.toString()) ?? 0.0,
      items: (json['items'] as List?)?.map((i) => OrderItem.fromJson(i)).toList() ?? [],
      createdAt: createdAtRaw != null
          ? DateTime.tryParse(createdAtRaw.toString()) ?? DateTime.now()
          : DateTime.now(),
      type: json['type'],
    );
  }

  static OrderStatus _parseStatus(String? status) {
    switch (status) {
      case 'pending':    return OrderStatus.pending;
      case 'confirmed':  return OrderStatus.confirmed;
      case 'preparing':  return OrderStatus.preparing;
      case 'ready':      return OrderStatus.ready;
      case 'completed':  return OrderStatus.completed;
      case 'paid':       return OrderStatus.paid;
      case 'cancelled':  return OrderStatus.cancelled;
      default:           return OrderStatus.pending;
    }
  }

  String get statusDisplay {
    switch (status) {
      case OrderStatus.pending:    return 'Chờ xác nhận';
      case OrderStatus.confirmed:  return 'Đã xác nhận';
      case OrderStatus.preparing:  return 'Đang làm';
      case OrderStatus.ready:      return 'Nấu xong';
      case OrderStatus.completed:  return 'Hoàn tất';
      case OrderStatus.paid:       return 'Đã thanh toán';
      case OrderStatus.cancelled:  return 'Đã hủy';
    }
  }
}
