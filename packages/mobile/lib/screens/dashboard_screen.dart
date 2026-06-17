import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/menu_provider.dart';
import '../core/theme.dart';
import 'home_tab.dart';
import 'tables_screen.dart';
import 'pos_screen.dart';
import 'settings_screen.dart';
import 'order_detail_screen.dart';
import '../models/order.dart';
import 'package:intl/intl.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _orderTabController;
  int _currentIndex = 0;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _orderTabController = TabController(length: 4, vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _initialized = true;
      _initializeApp();
    }
  }

  void _initializeApp() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = context.read<AuthProvider>();
      if (auth.merchant != null) {
        final orders = context.read<OrdersProvider>();
        orders.fetchOrders(auth.merchant!.id);
        orders.initSocket(auth.merchant!.id);

        context.read<MenuProvider>().fetchMenu(auth.merchant!.id);
      }
    });
  }

  @override
  void dispose() {
    _orderTabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();
    final pendingCount = ordersProvider.pendingOrders.length;

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: const [
              HomeTab(),
              _OrdersTab(),
              TablesScreen(),
              PosScreen(),
              SettingsScreen(),
            ],
          ),
          // Notification overlays - shown on all tabs
          if (ordersProvider.hasNotifications)
            _buildNotificationOverlays(ordersProvider),
          // Socket status indicator
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: SocketStatusIndicator(isConnected: ordersProvider.socket?.connected ?? false),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, -5)),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          type: BottomNavigationBarType.fixed,
          items: [
            const BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'TRANG CHỦ'),
            BottomNavigationBarItem(
              icon: _buildBadgeIcon(Icons.receipt_long_outlined, pendingCount),
              activeIcon: _buildBadgeIcon(Icons.receipt_long, pendingCount),
              label: 'ĐƠN HÀNG',
            ),
            const BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined), activeIcon: Icon(Icons.grid_view), label: 'BÀN'),
            const BottomNavigationBarItem(icon: Icon(Icons.point_of_sale_outlined), activeIcon: Icon(Icons.point_of_sale), label: 'POS'),
            const BottomNavigationBarItem(icon: Icon(Icons.settings_outlined), activeIcon: Icon(Icons.settings), label: 'CÀI ĐẶT'),
          ],
        ),
      ),
    );
  }

  Widget _buildBadgeIcon(IconData icon, int count) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon),
        if (count > 0)
          Positioned(
            right: -8,
            top: -4,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: GrabTheme.primary,
                shape: BoxShape.circle,
              ),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              child: Text(
                count > 99 ? '99+' : count.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }

  /// Build notification overlays for real-time events
  Widget _buildNotificationOverlays(OrdersProvider ordersProvider) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Column(
          children: [
            // New order notification
            if (ordersProvider.newOrderNotify != null)
              NotificationBanner(
                icon: Icons.restaurant,
                color: const Color(0xFF7C3AED),
                title: '🆕 Đơn mới từ Bàn ${ordersProvider.newOrderNotify!.tableNumber}',
                subtitle: '${ordersProvider.newOrderNotify!.items.length} món • ${_formatCurrency(ordersProvider.newOrderNotify!.totalPrice)}',
                onDismiss: () => ordersProvider.clearNewOrderNotify(),
              ),
            // Call staff notifications
            ...ordersProvider.activeCallStaff.map((call) => NotificationBanner(
              icon: Icons.person_pin_circle,
              color: Colors.red.shade600,
              title: '🆘 Bàn ${call['tableNumber']} gọi nhân viên!',
              subtitle: 'Nhấn để xác nhận đã xử lý',
              onDismiss: () => ordersProvider.clearCallStaff(call['tableNumber']),
            )),
            // Call payment notifications
            ...ordersProvider.activeCallPayment.map((call) => NotificationBanner(
              icon: Icons.payments,
              color: Colors.green.shade600,
              title: '💰 Bàn ${call['tableNumber']} yêu cầu thanh toán',
              subtitle: 'Nhấn để xác nhận',
              onDismiss: () => ordersProvider.clearCallPayment(call['tableNumber']),
            )),
            // Ready orders notifications
            ...ordersProvider.activeReadyOrders.map((call) => NotificationBanner(
              icon: Icons.check_circle,
              color: Colors.amber.shade700,
              title: '🍽️ Bàn ${call['tableNumber']} — Món đã nấu xong!',
              subtitle: 'Sẵn sàng phục vụ',
              onDismiss: () => ordersProvider.clearReadyOrder(call['tableNumber']),
            )),
          ],
        ),
      ),
    );
  }

  String _formatCurrency(double amount) {
    return NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(amount);
  }
}

/// Socket connection status indicator
class SocketStatusIndicator extends StatelessWidget {
  final bool isConnected;

  const SocketStatusIndicator({super.key, required this.isConnected});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: isConnected ? Colors.green : Colors.red,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isConnected ? 'Live' : 'Offline',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: isConnected ? Colors.green : Colors.red,
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual notification banner
class NotificationBanner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onDismiss;

  const NotificationBanner({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: color.withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onDismiss,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13)),
                      Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 18),
                  onPressed: onDismiss,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrdersTab extends StatefulWidget {
  const _OrdersTab();

  @override
  State<_OrdersTab> createState() => _OrdersTabState();
}

enum OrderFilter { all, pending, preparing, ready }

class _OrdersTabState extends State<_OrdersTab> with SingleTickerProviderStateMixin {
  OrderFilter _activeFilter = OrderFilter.all;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Refresh UI every minute to update "time ago" labels
    _refreshTimer = Timer.periodic(const Duration(minutes: 1), (timer) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('QUẢN LÝ ĐƠN HÀNG', 
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1)
        ),
        elevation: 0,
        backgroundColor: Colors.white,
      ),
      body: Column(
        children: [
          _buildFilterBar(ordersProvider),
          Expanded(
            child: _buildOrderList(_getFilteredOrders(ordersProvider)),
          ),
        ],
      ),
    );
  }

  List<Order> _getFilteredOrders(OrdersProvider provider) {
    switch (_activeFilter) {
      case OrderFilter.pending:   return provider.pendingOrders;
      case OrderFilter.preparing: return provider.preparingOrders;
      case OrderFilter.ready:     return provider.readyOrders;
      case OrderFilter.all:       return provider.orders;
    }
  }

  Widget _buildFilterBar(OrdersProvider provider) {
    return Container(
      height: 60,
      color: Colors.white,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        children: [
          _buildFilterChip('TẤT CẢ', OrderFilter.all, provider.orders.length),
          _buildFilterChip('CHỜ', OrderFilter.pending, provider.pendingOrders.length, color: Colors.amber),
          _buildFilterChip('ĐANG LÀM', OrderFilter.preparing, provider.preparingOrders.length, color: Colors.orange),
          _buildFilterChip('XONG', OrderFilter.ready, provider.readyOrders.length, color: Colors.green),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, OrderFilter filter, int count, {Color? color}) {
    final isSelected = _activeFilter == filter;
    final themeColor = color ?? const Color(0xFF6366F1);

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () => setState(() => _activeFilter = filter),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: isSelected ? themeColor : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey.shade700,
                  fontWeight: FontWeight.w900,
                  fontSize: 10,
                  letterSpacing: 0.5,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.white.withOpacity(0.2) : themeColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    count.toString(),
                    style: TextStyle(
                      color: isSelected ? Colors.white : themeColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderList(List<Order> orders) {
    final ordersProvider = context.read<OrdersProvider>();
    final auth = context.read<AuthProvider>();

    if (orders.isEmpty && !ordersProvider.isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade200),
            const SizedBox(height: 16),
            const Text('Chưa có đơn hàng nào', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (scrollInfo) {
        if (scrollInfo.metrics.pixels >= scrollInfo.metrics.maxScrollExtent - 200) {
          if (ordersProvider.hasMorePages && !ordersProvider.isLoading) {
            if (auth.merchant != null) {
              ordersProvider.loadMoreOrders(auth.merchant!.id);
            }
          }
        }
        return false;
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length + (ordersProvider.hasMorePages ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == orders.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _buildOrderCard(orders[index]);
        },
      ),
    );
  }

  Color _getStatusColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:    return const Color(0xFFF59E0B);
      case OrderStatus.confirmed:  return const Color(0xFF3B82F6);
      case OrderStatus.preparing:  return Colors.orange;
      case OrderStatus.ready:      return Colors.green;
      case OrderStatus.paid:       return const Color(0xFF10B981);
      case OrderStatus.completed:  return const Color(0xFF6366F1);
      case OrderStatus.cancelled:  return Colors.red;
    }
  }

  String _getTimeAgo(DateTime createdAt) {
    final diff = DateTime.now().difference(createdAt);
    if (diff.inMinutes < 1) return 'Vừa xong';
    return '${diff.inMinutes} phút trước';
  }

  Widget _buildOrderCard(Order order) {
    final diffMinutes = DateTime.now().difference(order.createdAt).inMinutes;
    final isUrgent = diffMinutes > 15 && order.status != OrderStatus.paid && order.status != OrderStatus.completed;
    final statusColor = _getStatusColor(order.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12, left: 16, right: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (context) => OrderDetailScreen(order: order)));
        },
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Table & Status
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEE4D2D).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(Icons.receipt_long, color: Color(0xFFEE4D2D), size: 16),
                      ),
                      const SizedBox(width: 8),
                      Text('BÀN ${order.tableNumber}', 
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: -0.5)
                      ),
                    ],
                  ),
                  _buildShopeeStatusBadge(order.status, isUrgent),
                ],
              ),
            ),
            
            const Divider(height: 1, color: Color(0xFFF8FAFC)),
            
            // Body: Items
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...order.items.take(3).map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${item.quantity}x', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF64748B))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(item.productName, 
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF1E293B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(item.price * item.quantity),
                          style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)
                        ),
                      ],
                    ),
                  )),
                  if (order.items.length > 3)
                    Text('Xem thêm ${order.items.length - 3} món...', 
                      style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.access_time, size: 14, color: isUrgent ? Colors.red : Colors.grey),
                      const SizedBox(width: 4),
                      Text(_getTimeAgo(order.createdAt), 
                        style: TextStyle(fontSize: 12, color: isUrgent ? Colors.red : Colors.grey, fontWeight: FontWeight.w600)
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            const Divider(height: 1, color: Color(0xFFF8FAFC)),
            
            // Footer: Total & Actions
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('TỔNG CỘNG', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w800)),
                      Text(NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(order.totalPrice),
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFFEE4D2D))
                      ),
                    ],
                  ),
                  _buildShopeeActionButton(order),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShopeeStatusBadge(OrderStatus status, bool isUrgent) {
    Color color; String label;
    switch (status) {
      case OrderStatus.pending:    color = const Color(0xFF3B82F6); label = 'Mới'; break;
      case OrderStatus.confirmed:  color = const Color(0xFF6366F1); label = 'Đã nhận'; break;
      case OrderStatus.preparing:  color = const Color(0xFFF59E0B); label = 'Đang làm'; break;
      case OrderStatus.ready:      color = const Color(0xFF10B981); label = 'Xong'; break;
      case OrderStatus.completed:  color = const Color(0xFF64748B); label = 'Đã phục vụ'; break;
      case OrderStatus.paid:       color = const Color(0xFF10B981); label = 'Đã trả'; break;
      case OrderStatus.cancelled:  color = Colors.red; label = 'Đã hủy'; break;
    }

    if (isUrgent && status != OrderStatus.paid && status != OrderStatus.completed) {
      color = Colors.red;
      label = 'Cần gấp';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label.toUpperCase(), 
        style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 0.5)
      ),
    );
  }

  Widget _buildShopeeActionButton(Order order) {
    if (order.status == OrderStatus.completed ||
        order.status == OrderStatus.paid ||
        order.status == OrderStatus.cancelled) {
      return OutlinedButton(
        onPressed: () {
          Navigator.push(context, MaterialPageRoute(builder: (context) => OrderDetailScreen(order: order)));
        },
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFE2E8F0)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          minimumSize: const Size(0, 36),
        ),
        child: const Text('CHI TIẾT', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w900, fontSize: 11)),
      );
    }

    String label; OrderStatus next; Color color = const Color(0xFFEE4D2D);
    
    switch (order.status) {
      case OrderStatus.pending:   label = 'TIẾP NHẬN'; next = OrderStatus.preparing; break;
      case OrderStatus.preparing: label = 'HOÀN TẤT'; next = OrderStatus.ready; break;
      case OrderStatus.ready:     label = 'PHỤC VỤ'; next = OrderStatus.completed; color = const Color(0xFF10B981); break;
      default: return const SizedBox.shrink();
    }

    return ElevatedButton(
      onPressed: () {
        final auth = context.read<AuthProvider>();
        context.read<OrdersProvider>().updateOrderStatus(auth.merchant!.id, order.id, next);
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        minimumSize: const Size(0, 36),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 0.5)),
    );
  }

  Widget _buildCompactStatusBadge(OrderStatus status) {
    final color = _getStatusColor(status);
    String label = '';
    switch (status) {
      case OrderStatus.pending:    label = 'MỚI'; break;
      case OrderStatus.confirmed:  label = 'ĐÃ NHẬN'; break;
      case OrderStatus.preparing:  label = 'ĐANG LÀM'; break;
      case OrderStatus.ready:      label = 'XONG'; break;
      case OrderStatus.completed:  label = 'PHỤC VỤ'; break;
      case OrderStatus.paid:       label = 'ĐÃ TRẢ'; break;
      case OrderStatus.cancelled:  label = 'HỦY'; break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 9, letterSpacing: 0.5)),
    );
  }

  Widget _buildFastActionButton(Order order) {
    if (order.status == OrderStatus.completed ||
        order.status == OrderStatus.paid ||
        order.status == OrderStatus.cancelled) return const SizedBox.shrink();

    String label; OrderStatus next; Color color;
    
    switch (order.status) {
      case OrderStatus.pending:
        label = 'NHẬN ĐƠN'; next = OrderStatus.preparing; color = GrabTheme.primary;
        break;
      case OrderStatus.preparing:
        label = 'BÁO XONG'; next = OrderStatus.ready; color = Colors.orange;
        break;
      case OrderStatus.ready:
        label = 'PHỤC VỤ'; next = OrderStatus.completed; color = Colors.green;
        break;
      default: return const SizedBox.shrink();
    }

    return ElevatedButton(
      onPressed: () {
        final auth = context.read<AuthProvider>();
        context.read<OrdersProvider>().updateOrderStatus(auth.merchant!.id, order.id, next);
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        minimumSize: const Size(0, 32),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 0.5)),
    );
  }
}
