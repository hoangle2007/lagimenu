import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/tables_provider.dart';
import '../providers/merchant_provider.dart';
import '../models/order.dart';
import '../core/theme.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final tablesProvider = context.watch<TablesProvider>();
    final merchantProvider = context.watch<MerchantProvider>();

    // Calculate today's revenue only
    final now = DateTime.now();
    final todayOrders = ordersProvider.orders.where((o) {
      return o.createdAt.year == now.year &&
          o.createdAt.month == now.month &&
          o.createdAt.day == now.day &&
          o.status != OrderStatus.cancelled &&
          o.status != OrderStatus.pending;
    }).toList();

    final todayRevenue = todayOrders.fold(0.0, (sum, o) => sum + o.totalPrice);
    final todayOrderCount = todayOrders.length;

    // Calculate yesterday's revenue for growth percentage
    final yesterday = now.subtract(const Duration(days: 1));
    final yesterdayOrders = ordersProvider.orders.where((o) {
      return o.createdAt.year == yesterday.year &&
          o.createdAt.month == yesterday.month &&
          o.createdAt.day == yesterday.day &&
          o.status != OrderStatus.cancelled &&
          o.status != OrderStatus.pending;
    }).toList();
    final yesterdayRevenue = yesterdayOrders.fold(0.0, (sum, o) => sum + o.totalPrice);

    double growthPercent = 0;
    if (yesterdayRevenue > 0) {
      growthPercent = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            if (auth.merchant != null) {
              await ordersProvider.fetchOrders(auth.merchant!.id);
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
                              Text(auth.merchant?.name ?? 'Admin', style: Theme.of(context).textTheme.headlineSmall),
                              Text('${DateFormat('EEEE, dd/MM').format(now)}, hôm nay', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          _buildStatusToggle(context, auth, merchantProvider),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _buildSummaryCard(context, todayRevenue, todayOrderCount, growthPercent),
                      const SizedBox(height: 24),
                      Text('PHỤC VỤ TẠI BÀN', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
                      const SizedBox(height: 12),
                      _buildTableStats(context, tablesProvider),
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('ĐƠN HÀNG MỚI', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
                          TextButton(
                            onPressed: () {
                              // Switch to Orders Tab (caller handles this)
                            },
                            child: const Text('Xem tất cả', style: TextStyle(color: GrabTheme.primary, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
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

  Widget _buildStatusToggle(BuildContext context, AuthProvider auth, MerchantProvider provider) {
    // Current status from auth.merchant (cached)
    final isOpen = auth.merchant?.isOpen ?? true;

    return GestureDetector(
      onTap: () {
        if (auth.merchant != null && auth.token != null) {
          provider.updateMerchantStatus(auth.merchant!.id, !isOpen, auth.token!).then((_) {
             // In a real app, AuthProvider should update its merchant state
             // For now, let's just force a local update if possible
             auth.merchant?.isOpen = !isOpen; 
             // Note: Normally we'd fetch fresh merchant data
          });
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isOpen ? GrabTheme.primary.withOpacity(0.1) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isOpen ? GrabTheme.primary : Colors.grey.shade300),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: isOpen ? GrabTheme.primary : Colors.grey, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(isOpen ? 'MỞ CỬA' : 'TẠM ĐÓNG', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: isOpen ? GrabTheme.primary : Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(BuildContext context, double revenue, int totalOrders, double growthPercent) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: GrabTheme.primary,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(color: GrabTheme.primary.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('DOANH THU HÔM NAY', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1)),
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
          Container(
            height: 1,
            color: Colors.white.withOpacity(0.2),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildSmallStat('ĐƠN HÀNG', totalOrders.toString()),
              const SizedBox(width: 32),
              _buildSmallStat('TĂNG TRƯỞNG', '${growthPercent >= 0 ? '+' : ''}${growthPercent.toStringAsFixed(0)}%'),
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

  Widget _buildTableStats(BuildContext context, TablesProvider provider) {
    return Row(
      children: [
        _buildTableStatCard(context, 'CÓ KHÁCH', provider.occupiedCount.toString(), Colors.blue),
        const SizedBox(width: 12),
        _buildTableStatCard(context, 'BÀN TRỐNG', provider.emptyCount.toString(), Colors.grey),
        const SizedBox(width: 12),
        _buildTableStatCard(context, 'CHỜ GIAO', provider.totalReadyItems.toString(), GrabTheme.primary),
      ],
    );
  }

  Widget _buildTableStatCard(BuildContext context, String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: color.withOpacity(0.6))),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildSimpleOrderCard(BuildContext context, Order order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: InkWell(
        onTap: () {
          // Logic for viewing detail
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.table_restaurant, color: Color(0xFF6366F1), size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('BÀN ${order.tableNumber}', 
                      style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5, fontSize: 15)
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${order.items.length} món • ${NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(order.totalPrice)}', 
                      style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w700)
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('MỚI', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.w900, fontSize: 9)),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_ios, color: Color(0xFFCBD5E1), size: 14),
            ],
          ),
        ),
      ),
    );
  }
}
