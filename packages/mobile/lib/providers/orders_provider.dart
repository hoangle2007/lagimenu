import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/sound_service.dart';
import '../models/order.dart';
import '../core/config.dart';

class OrdersProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  final SoundService _sound = SoundService();
  IO.Socket? _socket;

  List<Order> _orders = [];
  bool _isLoading = false;
  String? _error;
  IO.Socket? get socket => _socket;

  // Notification states for UI
  Order? _newOrderNotify;
  List<Map<String, dynamic>> _activeCallStaff = [];
  List<Map<String, dynamic>> _activeCallPayment = [];
  List<Map<String, dynamic>> _activeReadyOrders = [];

  List<Order> get orders => _orders;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Order? get newOrderNotify => _newOrderNotify;
  List<Map<String, dynamic>> get activeCallStaff => _activeCallStaff;
  List<Map<String, dynamic>> get activeCallPayment => _activeCallPayment;
  List<Map<String, dynamic>> get activeReadyOrders => _activeReadyOrders;
  bool get hasNotifications =>
      _newOrderNotify != null ||
      _activeCallStaff.isNotEmpty ||
      _activeCallPayment.isNotEmpty ||
      _activeReadyOrders.isNotEmpty;

  List<Order> get pendingOrders =>
      _orders.where((o) => o.status == OrderStatus.pending).toList();
  List<Order> get confirmedOrders =>
      _orders.where((o) => o.status == OrderStatus.confirmed).toList();
  List<Order> get preparingOrders =>
      _orders.where((o) => o.status == OrderStatus.preparing).toList();
  List<Order> get readyOrders =>
      _orders.where((o) => o.status == OrderStatus.ready).toList();

  void _safeNotify() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });
  }

  void clearNewOrderNotify() {
    _newOrderNotify = null;
    _safeNotify();
  }

  void clearCallStaff(String tableNumber) {
    _activeCallStaff.removeWhere((c) => c['tableNumber'] == tableNumber);
    _safeNotify();
  }

  void clearCallPayment(String tableNumber) {
    _activeCallPayment.removeWhere((c) => c['tableNumber'] == tableNumber);
    _safeNotify();
  }

  void clearReadyOrder(String tableNumber) {
    _activeReadyOrders.removeWhere((c) => c['tableNumber'] == tableNumber);
    _safeNotify();
  }

  Future<void> initSocket(String merchantId) async {
    if (_socket != null) return;

    // Get token for socket auth
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('employee_token') ?? prefs.getString('auth_token');

    _socket = IO.io(
      Config.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token ?? ''})
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('Socket connected');
      _socket!.emit('joinMerchant', {'merchantId': merchantId});
    });

    _socket!.on('connected', (data) {
      debugPrint('Socket authenticated: $data');
    });

    _socket!.on('newOrder', (data) {
      debugPrint('New order received: $data');
      if (data != null) {
        final newOrder = Order.fromJson(data as Map<String, dynamic>);
        // Check if order already exists to avoid duplicates
        final exists = _orders.any((o) => o.id == newOrder.id);
        if (!exists) {
          _orders.insert(0, newOrder);
          _newOrderNotify = newOrder;
          _sound.playKitchenSound();
          _safeNotify();
        }
      }
    });

    _socket!.on('orderStatusUpdated', (data) {
      debugPrint('Order status updated: $data');
      if (data != null && data['id'] != null) {
        final orderId = data['id'].toString();
        final index = _orders.indexWhere((o) => o.id == orderId);
        if (index != -1) {
          _orders[index] = Order.fromJson(data as Map<String, dynamic>);
          _safeNotify();
        }
      }
    });

    _socket!.on('callStaff', (data) {
      debugPrint('Staff call: $data');
      if (data != null && data['tableNumber'] != null) {
        final tableNum = data['tableNumber'].toString();
        // Remove existing call for same table
        _activeCallStaff.removeWhere((c) => c['tableNumber'] == tableNum);
        _activeCallStaff.add({
          'tableNumber': tableNum,
          'createdAt': DateTime.now().toIso8601String()
        });
        _sound.playStaffCallSound();
        _safeNotify();
      }
    });

    _socket!.on('callPayment', (data) {
      debugPrint('Payment call: $data');
      if (data != null && data['tableNumber'] != null) {
        final tableNum = data['tableNumber'].toString();
        _activeCallPayment.removeWhere((c) => c['tableNumber'] == tableNum);
        _activeCallPayment.add({
          'tableNumber': tableNum,
          'createdAt': DateTime.now().toIso8601String()
        });
        _sound.playStaffCallSound();
        _safeNotify();
      }
    });

    _socket!.on('readyToServe', (data) {
      debugPrint('Ready to serve: $data');
      if (data != null && data['tableNumber'] != null) {
        final tableNum = data['tableNumber'].toString();
        _activeReadyOrders.removeWhere((c) => c['tableNumber'] == tableNum);
        _activeReadyOrders.add({
          'tableNumber': tableNum,
          'orderId': data['orderId'],
          'createdAt': DateTime.now().toIso8601String(),
        });
        _sound.playReadySound();
        _safeNotify();
      }
    });

    _socket!.onDisconnect((_) => debugPrint('Socket disconnected'));
    _socket!.onError((error) => debugPrint('Socket error: $error'));
  }

  Future<void> fetchOrders(String merchantId, {int page = 1, int limit = 20, bool refresh = false}) async {
    _isLoading = true;
    if (refresh) {
      _error = null;
    }
    _safeNotify();

    try {
      final response = await _api.get('orders/merchant/$merchantId?page=$page&limit=$limit');
      if (response.statusCode == 200) {
        final dynamic responseData = response.data;
        List<dynamic> data;
        
        if (responseData is Map) {
          data = responseData['orders'] as List<dynamic>? ?? [];
          _totalOrders = responseData['total'] ?? 0;
          _currentPage = responseData['page'] ?? page;
          _totalPages = responseData['totalPages'] ?? 1;
        } else if (responseData is List) {
          data = responseData;
        } else {
          data = [];
        }

        final newOrders = data.map((json) => Order.fromJson(json)).toList();

        if (refresh || page == 1) {
          _orders = newOrders;
        } else {
          _orders.addAll(newOrders);
        }
        _orders.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      }
    } catch (e) {
      _error = 'Failed to fetch orders: $e';
      debugPrint('fetchOrders error: $e');
    } finally {
      _isLoading = false;
      _safeNotify();
    }
  }

  // Pagination state
  int _currentPage = 1;
  int _totalPages = 1;
  int _totalOrders = 0;

  int get currentPage => _currentPage;
  int get totalPages => _totalPages;
  int get totalOrders => _totalOrders;
  bool get hasMorePages => _currentPage < _totalPages;

  Future<void> loadMoreOrders(String merchantId) async {
    if (_isLoading || !hasMorePages) return;
    await fetchOrders(merchantId, page: _currentPage + 1);
  }

  Future<void> refreshOrders(String merchantId) async {
    _currentPage = 1;
    await fetchOrders(merchantId, page: 1, refresh: true);
  }

  /// Optimized: Fetch only active orders (not completed/cancelled/paid)
  /// Use this for tables screen to reduce data transfer
  Future<List<Order>> fetchTableOrders(String merchantId) async {
    try {
      final response = await _api.get('orders/merchant/$merchantId/tables');
      if (response.statusCode == 200) {
        final dynamic responseData = response.data;
        List<dynamic> data;
        if (responseData is Map && responseData.containsKey('orders')) {
          data = responseData['orders'] as List<dynamic>;
        } else if (responseData is List) {
          data = responseData;
        } else {
          data = [];
        }
        final orders = data.map((json) => Order.fromJson(json)).toList();
        // Update local cache
        _orders = orders;
        _safeNotify();
        return orders;
      }
    } catch (e) {
      debugPrint('fetchTableOrders error: $e');
    }
    return [];
  }

  /// Fetch orders for a specific table only
  Future<List<Order>> fetchOrdersForTable(
      String merchantId, String tableNumber) async {
    try {
      final response =
          await _api.get('orders/active/$merchantId/$tableNumber');
      if (response.statusCode == 200) {
        final dynamic responseData = response.data;
        List<dynamic> data;
        if (responseData is Map && responseData.containsKey('orders')) {
          data = responseData['orders'] as List<dynamic>;
        } else if (responseData is List) {
          data = responseData;
        } else {
          data = [];
        }
        return data.map((json) => Order.fromJson(json)).toList();
      }
    } catch (e) {
      debugPrint('fetchOrdersForTable error: $e');
    }
    return [];
  }

  Future<bool> updateOrderStatus(
      String merchantId, String orderId, OrderStatus status) async {
    final statusStr = status.toString().split('.').last;
    try {
      final response = await _api.put(
          'orders/merchant/$merchantId/$orderId/status',
          data: {
            'status': statusStr,
          });

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Backend may return { order: {...} } or the order directly
        final dynamic responseData = response.data;
        final Map<String, dynamic> orderJson =
            responseData is Map && responseData.containsKey('order')
                ? responseData['order'] as Map<String, dynamic>
                : responseData as Map<String, dynamic>;
        final index = _orders.indexWhere((o) => o.id == orderId);
        if (index != -1) {
          _orders[index] = Order.fromJson(orderJson);
          _safeNotify();
        }
        return true;
      }
    } catch (e) {
      debugPrint('Update status error: $e');
    }
    return false;
  }

  Future<bool> payTable(String merchantId, String tableNumber) async {
    try {
      final response =
          await _api.post('orders/merchant/$merchantId/table/$tableNumber/pay');
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchTableOrders(merchantId);
        return true;
      }
    } catch (e) {
      debugPrint('Pay table error: $e');
    }
    return false;
  }

  Future<dynamic> createOrder(
      String merchantId, Map<String, dynamic> orderData) async {
    try {
      final response = await _api.post('orders', data: orderData);
      if (response.statusCode == 200 || response.statusCode == 201) {
        // Fetch fresh orders to update the list
        await fetchOrders(merchantId);
        return response.data;
      }
    } catch (e) {
      debugPrint('Create order error: $e');
      rethrow;
    }
    return null;
  }

  void disposeSocket() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  @override
  void dispose() {
    disposeSocket();
    super.dispose();
  }
}
