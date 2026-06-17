import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/staff_call_provider.dart';
import '../models/order.dart';
import '../core/theme.dart';
import 'pos_screen.dart';
import 'order_detail_screen.dart';
import 'employee_login_screen.dart';

class EmployeeDashboardScreen extends StatefulWidget {
  const EmployeeDashboardScreen({super.key});

  @override
  State<EmployeeDashboardScreen> createState() => _EmployeeDashboardScreenState();
}

class _EmployeeDashboardScreenState extends State<EmployeeDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _orderTabController;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _orderTabController = TabController(length: 4, vsync: this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final employeeInfo = auth.employeeInfo;
      final shopId = employeeInfo?['shopId'] ?? auth.merchant?.id;

      if (shopId != null) {
        final orders = context.read<OrdersProvider>();
        orders.fetchOrders(shopId.toString());
        orders.initSocket(shopId.toString());

        // Listen for staff calls
        orders.socket?.on('callStaff', (data) {
          if (data != null && data['tableNumber'] != null) {
            final tableNum = data['tableNumber'].toString();
            context.read<StaffCallProvider>().addCall(tableNum);

            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('BÀN $tableNum ĐANG GỌI NHÂN VIÊN!', style: const TextStyle(fontWeight: FontWeight.w900)),
                  backgroundColor: Colors.orange.shade700,
                  behavior: SnackBarBehavior.floating,
                  action: SnackBarAction(label: 'XEM', textColor: Colors.white, onPressed: () {}),
                ),
              );
            }
          }
        });

        context.read<MenuProvider>().fetchMenu(shopId.toString());
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
    final auth = context.watch<AuthProvider>();
    final employeeInfo = auth.employeeInfo;
    final shopId = employeeInfo?['shopId'] ?? auth.merchant?.id;
    final employeeName = employeeInfo?['name'] ?? 'Nhân viên';
    final ordersProvider = context.watch<OrdersProvider>();

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: [
              _EmployeeHomeTab(employeeName: employeeName),
              _EmployeeOrdersTab(shopId: shopId?.toString()),
              const PosScreen(),
              _EmployeeProfileTab(employeeName: employeeName),
            ],
          ),
          // Notification overlays - shown on all tabs
          if (ordersProvider.hasNotifications)
            _EmployeeNotificationOverlays(provider: ordersProvider),
          // Socket status indicator
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: _EmployeeSocketStatusIndicator(isConnected: ordersProvider.socket?.connected ?? false),
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
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'TRANG CHỦ'),
            BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'ĐƠN HÀNG'),
            BottomNavigationBarItem(icon: Icon(Icons.point_of_sale_outlined), activeIcon: Icon(Icons.point_of_sale), label: 'POS'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'TÀI KHOẢN'),
          ],
        ),
      ),
    );
  }
}

class _EmployeeHomeTab extends StatelessWidget {
  final String employeeName;

  const _EmployeeHomeTab({required this.employeeName});

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();

    final revenue = ordersProvider.orders
        .where((o) => o.status != OrderStatus.cancelled)
        .fold(0.0, (sum, o) => sum + o.totalPrice);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            final auth = context.read<AuthProvider>();
            final shopId = auth.employeeInfo?['shopId'] ?? auth.merchant?.id;
            if (shopId != null) {
              await ordersProvider.fetchOrders(shopId.toString());
            }
          },
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Xin chào, $employeeName', style: Theme.of(context).textTheme.headlineSmall),
                              const Text('Hoạt động hôm nay', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: const Color(0xFF6366F1).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                            child: const Icon(Icons.badge, color: Color(0xFF6366F1)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _buildSummaryCard(context, revenue, ordersProvider.orders.length),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ĐƠN HÀNG MỚI', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final order = ordersProvider.pendingOrders[index];
                    return _buildSimpleOrderCard(context, order);
                  },
                  childCount: ordersProvider.pendingOrders.take(5).length,
                ),
              ),
              if (ordersProvider.pendingOrders.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.check_circle_outline, size: 48, color: Colors.grey.shade200),
                          const SizedBox(height: 8),
                          const Text('Chưa có đơn hàng mới', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard(BuildContext context, double revenue, int totalOrders) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF4338CA)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('DOANH THU ƯỚC TÍNH', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1)),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(revenue),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 32, letterSpacing: -1),
              ),
              const SizedBox(width: 4),
              const Text('VNĐ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 16),
          Container(height: 1, color: Colors.white.withOpacity(0.2)),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildSmallStat('ĐƠN HÀNG', totalOrders.toString()),
              const SizedBox(width: 32),
              _buildSmallStat('CHỜ XỬ LÝ', context.watch<OrdersProvider>().pendingOrders.length.toString()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSmallStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 0.5)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
      ],
    );
  }

  Widget _buildSimpleOrderCard(BuildContext context, Order order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: const Color(0xFF6366F1).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.receipt_long, color: Color(0xFF6366F1)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bàn ${order.tableNumber}', style: const TextStyle(fontWeight: FontWeight.w900)),
                Text('${order.items.length} món • ${NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(order.totalPrice)}', style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
    );
  }
}

class _EmployeeOrdersTab extends StatefulWidget {
  final String? shopId;

  const _EmployeeOrdersTab({this.shopId});

  @override
  State<_EmployeeOrdersTab> createState() => _EmployeeOrdersTabState();
}

enum OrderFilter { all, pending, confirmed, preparing, ready }

class _EmployeeOrdersTabState extends State<_EmployeeOrdersTab> {
  OrderFilter _activeFilter = OrderFilter.all;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
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
        centerTitle: false,
        actions: [
          IconButton(
            onPressed: () {
              if (widget.shopId != null) ordersProvider.fetchOrders(widget.shopId!);
            },
            icon: const Icon(Icons.refresh, size: 20, color: Color(0xFF6366F1)),
          ),
          const SizedBox(width: 8),
        ],
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
      case OrderFilter.confirmed: return provider.confirmedOrders;
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
          _buildFilterChip('CHỜ DUYỆT', OrderFilter.pending, provider.pendingOrders.length, color: Colors.amber),
          _buildFilterChip('ĐÃ NHẬN', OrderFilter.confirmed, provider.confirmedOrders.length, color: Colors.blue),
          _buildFilterChip('ĐANG LÀM', OrderFilter.preparing, provider.preparingOrders.length, color: Colors.orange),
          _buildFilterChip('NẤU XONG', OrderFilter.ready, provider.readyOrders.length, color: Colors.green),
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

  Widget _buildOrderList(List<Order> orders) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)],
              ),
              child: Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade200),
            ),
            const SizedBox(height: 24),
            Text('Chưa có đơn hàng nào', 
              style: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5)
            ),
          ],
        ),
      );
    }

    final sortedOrders = List<Order>.from(orders);
    sortedOrders.sort((a, b) => a.createdAt.compareTo(b.createdAt));

    return NotificationListener<ScrollNotification>(
      onNotification: (scrollInfo) {
        if (scrollInfo.metrics.pixels >= scrollInfo.metrics.maxScrollExtent - 200) {
          final ordersProvider = context.read<OrdersProvider>();
          if (ordersProvider.hasMorePages && !ordersProvider.isLoading && widget.shopId != null) {
            ordersProvider.loadMoreOrders(widget.shopId!);
          }
        }
        return false;
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: sortedOrders.length + (context.read<OrdersProvider>().hasMorePages ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == sortedOrders.length) {
            return context.watch<OrdersProvider>().isLoading 
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : const SizedBox(height: 80);
          }
          final order = sortedOrders[index];
          return _buildOrderCard(order);
        },
      ),
    );
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
      case OrderStatus.pending:   label = 'TIẾP NHẬN'; next = OrderStatus.confirmed; break;
      case OrderStatus.confirmed: label = 'BẮT ĐẦU NẤU'; next = OrderStatus.preparing; color = Colors.orange; break;
      case OrderStatus.preparing: label = 'HOÀN TẤT'; next = OrderStatus.ready; color = Colors.green; break;
      case OrderStatus.ready:     label = 'PHỤC VỤ'; next = OrderStatus.completed; color = const Color(0xFF10B981); break;
      default: return const SizedBox.shrink();
    }

    return ElevatedButton(
      onPressed: () {
        final auth = context.read<AuthProvider>();
        final shopId = auth.employeeInfo?['shopId'] ?? auth.merchant?.id;
        if (shopId != null) {
          context.read<OrdersProvider>().updateOrderStatus(shopId.toString(), order.id, next);
        }
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

}

class _EmployeeProfileTab extends StatelessWidget {
  final String employeeName;

  const _EmployeeProfileTab({required this.employeeName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('TÀI KHOẢN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        automaticallyImplyLeading: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Profile header
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF4338CA)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Center(
                    child: Text(
                      employeeName.isNotEmpty ? employeeName[0].toUpperCase() : 'N',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        employeeName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'NHÂN VIÊN',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Logout button
          Container(
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.red.shade100),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      title: const Text('Đăng xuất?'),
                      content: const Text('Bạn có chắc muốn đăng xuất khỏi tài khoản nhân viên?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
                        ElevatedButton(
                          onPressed: () => Navigator.pop(context, true),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                          child: const Text('Đăng xuất', style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    await context.read<AuthProvider>().logoutEmployee();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (context) => const EmployeeLoginScreen()),
                        (route) => false,
                      );
                    }
                  }
                },
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Icons.logout, color: Colors.red.shade400),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Đăng xuất',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Colors.red.shade700,
                              ),
                            ),
                            Text(
                              'Thoát khỏi tài khoản nhân viên',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right, color: Colors.red.shade300),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Notification overlays widget for Employee Dashboard
class _EmployeeNotificationOverlays extends StatelessWidget {
  final OrdersProvider provider;

  const _EmployeeNotificationOverlays({required this.provider});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Column(
          children: [
            // New order notification
            if (provider.newOrderNotify != null)
              _EmployeeNotificationBanner(
                icon: Icons.restaurant,
                color: const Color(0xFF7C3AED),
                title: '🆕 Đơn mới từ Bàn ${provider.newOrderNotify!.tableNumber}',
                subtitle: '${provider.newOrderNotify!.items.length} món • ${_formatCurrency(provider.newOrderNotify!.totalPrice)}',
                onDismiss: () => provider.clearNewOrderNotify(),
              ),
            // Call staff notifications
            ...provider.activeCallStaff.map((call) => _EmployeeNotificationBanner(
              icon: Icons.person_pin_circle,
              color: Colors.red.shade600,
              title: '🆘 Bàn ${call['tableNumber']} gọi nhân viên!',
              subtitle: 'Nhấn để xác nhận đã xử lý',
              onDismiss: () => provider.clearCallStaff(call['tableNumber']),
            )),
            // Call payment notifications
            ...provider.activeCallPayment.map((call) => _EmployeeNotificationBanner(
              icon: Icons.payments,
              color: Colors.green.shade600,
              title: '💰 Bàn ${call['tableNumber']} yêu cầu thanh toán',
              subtitle: 'Nhấn để xác nhận',
              onDismiss: () => provider.clearCallPayment(call['tableNumber']),
            )),
            // Ready orders notifications
            ...provider.activeReadyOrders.map((call) => _EmployeeNotificationBanner(
              icon: Icons.check_circle,
              color: Colors.amber.shade700,
              title: '🍽️ Bàn ${call['tableNumber']} — Món đã nấu xong!',
              subtitle: 'Sẵn sàng phục vụ',
              onDismiss: () => provider.clearReadyOrder(call['tableNumber']),
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

/// Individual notification banner for Employee
class _EmployeeNotificationBanner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onDismiss;

  const _EmployeeNotificationBanner({
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

/// Socket status indicator for Employee Dashboard
class _EmployeeSocketStatusIndicator extends StatelessWidget {
  final bool isConnected;

  const _EmployeeSocketStatusIndicator({required this.isConnected});

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
