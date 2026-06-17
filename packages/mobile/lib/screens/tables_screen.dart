import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/tables_provider.dart';
import '../widgets/table_card.dart';
import '../models/order.dart';
import '../models/table_info.dart';
import 'order_detail_screen.dart';
import '../core/theme.dart';

class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  bool _tablesInitialized = false;

  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  void _refreshData() {
    final auth = context.read<AuthProvider>();
    if (auth.merchant != null) {
      final ordersProvider = context.read<OrdersProvider>();
      final tablesProvider = context.read<TablesProvider>();

      // Use optimized endpoint: only fetch active orders, not all orders
      ordersProvider.fetchTableOrders(auth.merchant!.id).then((orders) {
        tablesProvider.updateTableCount(auth.merchant!.tableCount);
        tablesProvider.refreshTables(orders);
      });
    }
  }

  String _getTimeAgo(DateTime? dateTime) {
    if (dateTime == null) return '';
    final difference = DateTime.now().difference(dateTime);
    if (difference.inMinutes < 1) return 'Vừa xong';
    if (difference.inMinutes < 60) return '${difference.inMinutes}p';
    return '${difference.inHours}h';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final tablesProvider = context.watch<TablesProvider>();

    // Refresh tables when orders change (only if we have orders data)
    if (ordersProvider.orders.isNotEmpty || _tablesInitialized) {
      _tablesInitialized = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        tablesProvider.refreshTables(ordersProvider.orders);
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                     'SƠ ĐỒ BÀN',
                     style: TextStyle(
                       fontSize: 24,
                       fontWeight: FontWeight.w900,
                       color: Color(0xFF1E293B),
                       letterSpacing: -0.5,
                     ),
                  ),
                  const SizedBox(height: 16),
                  _buildStats(tablesProvider),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'DANH SÁCH BÀN',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: Colors.grey,
                          letterSpacing: 1,
                        ),
                      ),
                      IconButton(
                        onPressed: _refreshData,
                        icon: const Icon(Icons.refresh, size: 18, color: Color(0xFF6366F1)),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 1.0,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final table = tablesProvider.tables[index];
                  return TableCard(
                    table: table,
                    onTap: () => _showTableDetails(context, table),
                  );
                },
                childCount: tablesProvider.tables.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  Widget _buildStats(TablesProvider provider) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF6366F1),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStatItem('CÓ KHÁCH', '${provider.occupiedCount}/${provider.tables.length}', Colors.white),
              _buildStatItem('ĐƠN MỚI', provider.totalNewItems.toString(), Colors.amberAccent),
              _buildStatItem('CHỜ GIAO', provider.totalReadyItems.toString(), Colors.greenAccent),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            color: Colors.white.withOpacity(0.6),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: valueColor,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }

  void _showTableDetails(BuildContext context, TableInfo initialTable) {
     showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) {
          return Consumer<TablesProvider>(
            builder: (context, tablesProvider, _) {
              // Find the fresh version of this table
              final table = tablesProvider.tables.firstWhere(
                (t) => t.number == initialTable.number,
                orElse: () => initialTable,
              );
              return _buildTableDetailSheet(context, table);
            },
          );
        },
     );
  }

  Widget _buildTableDetailSheet(BuildContext context, TableInfo table) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(32),
          topRight: Radius.circular(32),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        table.number,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 24),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Chi tiết phục vụ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                        Text(
                          'Khách ngồi ${_getTimeAgo(table.lastUpdate)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('TẠM TÍNH', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 0.5)),
                    Text(
                      '${(table.totalAmount / 1000).toStringAsFixed(0)}kđ',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF6366F1)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              itemCount: table.orders.length,
              itemBuilder: (context, index) {
                final order = table.orders[index];
                return _buildOrderInTable(order);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('ĐÓNG', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () => _handlePayment(table),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: const Color(0xFF6366F1),
                    ),
                    child: const Text('THANH TOÁN & DỌN BÀN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderInTable(Order order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Đơn #${order.id}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
              _buildStatusBadge(order.status),
            ],
          ),
          const SizedBox(height: 12),
          ...order.items.map((it) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Text('${it.quantity}×', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1), fontSize: 12)),
                const SizedBox(width: 8),
                Expanded(child: Text(it.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ],
            ),
          )),
          const SizedBox(height: 12),
          _buildActionButton(order),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(OrderStatus status) {
    Color color;
    String label;
    switch (status) {
      case OrderStatus.pending: color = Colors.amber; label = 'CHỜ'; break;
      case OrderStatus.preparing: color = Colors.indigo; label = 'LÀM'; break;
      case OrderStatus.ready: color = Colors.green; label = 'XONG'; break;
      case OrderStatus.completed: color = Colors.blue; label = 'GIAO'; break;
      default: color = Colors.grey; label = '---';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: color, fontSize: 8, fontWeight: FontWeight.w900)),
    );
  }

  Widget _buildActionButton(Order order) {
     if (order.status == OrderStatus.completed) return const SizedBox.shrink();

     String label;
     OrderStatus next;
     Color color = const Color(0xFF6366F1);

     if (order.status == OrderStatus.pending) {
       label = 'NHẬN LÀM MÓN'; next = OrderStatus.preparing; color = Colors.amber.shade700;
     } else if (order.status == OrderStatus.preparing) {
       label = 'BÁO NẤU XONG'; next = OrderStatus.ready; color = Colors.indigo;
     } else if (order.status == OrderStatus.ready) {
       label = 'XÁC NHẬN ĐÃ GIAO'; next = OrderStatus.completed; color = Colors.green.shade700;
     } else {
       return const SizedBox.shrink();
     }

     return SizedBox(
       width: double.infinity,
       child: ElevatedButton(
         onPressed: () {
            final auth = context.read<AuthProvider>();
            context.read<OrdersProvider>().updateOrderStatus(auth.merchant!.id, order.id, next);
         },
         style: ElevatedButton.styleFrom(
           backgroundColor: color,
           padding: const EdgeInsets.symmetric(vertical: 8),
           shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
           elevation: 2,
         ),
         child: Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
       ),
     );
  }

  void _handlePayment(TableInfo table) async {
     final auth = context.read<AuthProvider>();
     try {
       final success = await context.read<OrdersProvider>().payTable(auth.merchant!.id, table.number);
       if (success && mounted) {
         Navigator.pop(context);
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Đã thanh toán và dọn bàn ${table.number}'), backgroundColor: GrabTheme.primary),
         );
       } else if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           const SnackBar(content: Text('Không thể thanh toán. Vui lòng thử lại.'), backgroundColor: Colors.red),
         );
       }
     } catch (e) {
       debugPrint('Payment error: $e');
       if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
         );
       }
     }
  }
}
