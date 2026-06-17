import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/orders_provider.dart';
import '../models/category.dart';
import '../models/product.dart';
import '../core/theme.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  int _selectedCategoryIndex = 0;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  final List<CartItem> _cart = [];
  String _selectedTable = 'Mang về';
  bool _isPlacingOrder = false;

  List<Category> get _categories => context.read<MenuProvider>().categories;
  List<Product> get _filteredProducts {
    final menuProvider = context.read<MenuProvider>();
    if (_searchQuery.isNotEmpty) {
      return menuProvider.allProducts
          .where((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    }
    if (_categories.isEmpty) return [];
    if (_selectedCategoryIndex >= _categories.length) return [];
    return menuProvider.getProducts(_categories[_selectedCategoryIndex].id);
  }

  double get _totalAmount {
    return _cart.fold(0, (sum, item) => sum + (item.product.price * item.quantity));
  }

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  void _loadMenu() {
    final auth = context.read<AuthProvider>();
    if (auth.merchant != null) {
      context.read<MenuProvider>().fetchMenu(auth.merchant!.id);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Widget _buildProductImage(Product product) {
    final imageUrl = product.imageUrl;
    final hasValidUrl = imageUrl != null && imageUrl.isNotEmpty;

    // Nếu không có URL hoặc URL không hợp lệ, hiển thị placeholder
    if (!hasValidUrl) {
      return _buildImagePlaceholder(product);
    }

    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded) return child;
        return AnimatedOpacity(
          opacity: frame == null ? 0 : 1,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          child: child,
        );
      },
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return _buildImageLoading();
      },
      errorBuilder: (context, error, stackTrace) {
        // Không dùng setState trong errorBuilder - chỉ return placeholder
        return _buildImagePlaceholder(product);
      },
    );
  }

  Widget _buildImagePlaceholder(Product product) {
    return Container(
      color: Colors.grey.shade100,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.fastfood, size: 28, color: Colors.grey.shade400),
            const SizedBox(height: 4),
            Text(
              product.name.isNotEmpty ? product.name[0].toUpperCase() : '?',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImageLoading() {
    return Container(
      color: Colors.grey.shade100,
      child: const Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: GrabTheme.primary,
          ),
        ),
      ),
    );
  }

  void _addToCart(Product product) {
    if (!product.isAvailable) return;
    setState(() {
      final existingIndex = _cart.indexWhere((item) => item.product.id == product.id);
      if (existingIndex >= 0) {
        _cart[existingIndex].quantity++;
      } else {
        _cart.add(CartItem(product: product, quantity: 1));
      }
    });
  }

  void _removeFromCart(String productId) {
    setState(() {
      _cart.removeWhere((item) => item.product.id == productId);
    });
  }

  void _updateQuantity(String productId, int delta) {
    setState(() {
      final index = _cart.indexWhere((item) => item.product.id == productId);
      if (index >= 0) {
        _cart[index].quantity += delta;
        if (_cart[index].quantity <= 0) {
          _cart.removeAt(index);
        }
      }
    });
  }

  void _clearCart() {
    setState(() => _cart.clear());
  }

  Future<void> _placeOrder() async {
    if (_cart.isEmpty) return;

    setState(() => _isPlacingOrder = true);

    final auth = context.read<AuthProvider>();
    if (auth.merchant == null) {
      setState(() => _isPlacingOrder = false);
      return;
    }

    try {
      final orderData = {
        'merchantId': auth.merchant!.id,
        'tableNumber': _selectedTable,
        'items': _cart.map((item) => {
          'productId': item.product.id,
          'quantity': item.quantity,
          'price': item.product.price.toInt(),
        }).toList(),
        'totalPrice': _totalAmount.toInt(),
        'type': 'order',
        'fromPos': true, // Quan trọng: Đánh dấu đơn này từ POS để bypass session check
      };

      await context.read<OrdersProvider>().createOrder(auth.merchant!.id, orderData);

      if (mounted) {
        setState(() => _cart.clear());
        _selectedTable = 'Mang về';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _selectedTable == 'Mang về'
                  ? 'Đã tạo đơn mang về!'
                  : 'Đã gửi đơn cho $_selectedTable!',
            ),
            backgroundColor: GrabTheme.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Tạo đơn thất bại. Vui lòng thử lại.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPlacingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final menuProvider = context.watch<MenuProvider>();
    final categories = menuProvider.categories;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('POS - BÁN HÀNG', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_cart.isNotEmpty)
            TextButton.icon(
              onPressed: _clearCart,
              icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
              label: const Text('Xóa giỏ', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w800)),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _searchQuery = value),
              decoration: InputDecoration(
                hintText: 'Tìm kiếm món...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),

          // Category tabs
          if (categories.isNotEmpty)
            Container(
              height: 50,
              color: Colors.white,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: categories.length,
                itemBuilder: (context, index) {
                  final cat = categories[index];
                  final isSelected = index == _selectedCategoryIndex;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedCategoryIndex = index;
                          _searchQuery = '';
                          _searchController.clear();
                        });
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: isSelected ? GrabTheme.primary : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          cat.name,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.grey.shade700,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          // Products grid - 3 products per row
          Expanded(
            child: menuProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredProducts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.restaurant_menu, size: 64, color: Colors.grey.shade200),
                            const SizedBox(height: 16),
                            Text(
                              _searchQuery.isNotEmpty ? 'Không tìm thấy món' : 'Chưa có món nào',
                              style: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.all(12),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          childAspectRatio: 0.72,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                        itemCount: _filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = _filteredProducts[index];
                          return _buildProductCard(product);
                        },
                      ),
          ),

          // Cart summary bar
          _buildCartBar(),
        ],
      ),
    );
  }

  Widget _buildProductCard(Product product) {
    final inCart = _cart.indexWhere((item) => item.product.id == product.id) >= 0;
    final cartItem = inCart ? _cart.firstWhere((item) => item.product.id == product.id) : null;

    return GestureDetector(
      onTap: () => _addToCart(product),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: inCart ? GrabTheme.primary : Colors.grey.shade100,
            width: inCart ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: inCart ? GrabTheme.primary.withOpacity(0.15) : Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Image - chiếm 60% chiều cao
                Expanded(
                  flex: 6,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                    ),
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                      child: _buildProductImage(product),
                    ),
                  ),
                ),
                // Info - chiếm 40% chiều cao
                Expanded(
                  flex: 4,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Tên sản phẩm
                        Text(
                          product.name,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        // Giá + số lượng trong giỏ
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(product.price),
                                style: const TextStyle(
                                  color: GrabTheme.primary,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            if (inCart && cartItem != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: GrabTheme.primary,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${cartItem.quantity}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            // Unavailable overlay
            if (!product.isAvailable)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Center(
                    child: Text(
                      'HẾT HÀNG',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ),
              ),
            // Badge số lượng
            if (inCart && cartItem != null)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: GrabTheme.primary,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: GrabTheme.primary.withOpacity(0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    '${cartItem.quantity}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: GestureDetector(
                onTap: _cart.isNotEmpty ? _showCartSheet : null,
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Row(
                children: [
                  // Cart info
                  Expanded(
                    child: GestureDetector(
                      onTap: _cart.isNotEmpty ? _showCartSheet : null,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _cart.isEmpty ? Colors.grey.shade100 : GrabTheme.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Stack(
                              children: [
                                Icon(
                                  Icons.shopping_cart,
                                  color: _cart.isEmpty ? Colors.grey : GrabTheme.primary,
                                ),
                                if (_cart.isNotEmpty)
                                  Positioned(
                                    right: -4,
                                    top: -4,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: BoxDecoration(
                                        color: GrabTheme.primary,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        '${_cart.fold(0, (sum, item) => sum + item.quantity)}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _cart.isEmpty ? 'Giỏ hàng trống' : '${_cart.length} món trong giỏ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: _cart.isEmpty ? Colors.grey : Colors.black,
                                    ),
                                  ),
                                  if (_cart.isNotEmpty)
                                    Text(
                                      _selectedTable,
                                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                    ),
                                ],
                              ),
                            ),
                            if (_cart.isNotEmpty)
                              Text(
                                NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(_totalAmount),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: GrabTheme.primary,
                                  fontSize: 15,
                                ),
                              ),
                            const SizedBox(width: 8),
                            Icon(
                              Icons.keyboard_arrow_up,
                              color: _cart.isEmpty ? Colors.grey : GrabTheme.primary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Place order button
                  ElevatedButton(
                    onPressed: _cart.isEmpty || _isPlacingOrder ? null : _placeOrder,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: GrabTheme.primary,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      disabledBackgroundColor: Colors.grey.shade300,
                    ),
                    child: _isPlacingOrder
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Row(
                            children: [
                              const Icon(Icons.send, color: Colors.white, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                _selectedTable == 'Mang về' ? 'THANH TOÁN' : 'ĐẶT MÓN',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCartSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CartSheet(
        cart: _cart,
        selectedTable: _selectedTable,
        totalAmount: _totalAmount,
        onUpdateQuantity: _updateQuantity,
        onRemove: _removeFromCart,
        onClear: () {
          _clearCart();
          Navigator.pop(context);
        },
        onPlaceOrder: () {
          Navigator.pop(context);
          _placeOrder();
        },
        onTableChanged: (table) => setState(() => _selectedTable = table),
        isPlacingOrder: _isPlacingOrder,
      ),
    );
  }
}

// Cart Item model
class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, required this.quantity});
}

// Cart Bottom Sheet
class _CartSheet extends StatefulWidget {
  final List<CartItem> cart;
  final String selectedTable;
  final double totalAmount;
  final Function(String productId, int delta) onUpdateQuantity;
  final Function(String productId) onRemove;
  final VoidCallback onClear;
  final VoidCallback onPlaceOrder;
  final Function(String table) onTableChanged;
  final bool isPlacingOrder;

  const _CartSheet({
    required this.cart,
    required this.selectedTable,
    required this.totalAmount,
    required this.onUpdateQuantity,
    required this.onRemove,
    required this.onClear,
    required this.onPlaceOrder,
    required this.onTableChanged,
    required this.isPlacingOrder,
  });

  @override
  State<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends State<_CartSheet> {
  late String _selectedTable;

  @override
  void initState() {
    super.initState();
    _selectedTable = widget.selectedTable;
  }

  List<String> get _tableOptions {
    final options = ['Mang về'];
    // Generate table options based on merchant table count
    // Default 10 tables, could be more
    for (int i = 1; i <= 20; i++) {
      options.add('Bàn $i');
    }
    return options;
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      height: screenHeight * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
            ),
            child: Row(
              children: [
                const Icon(Icons.shopping_cart, color: GrabTheme.primary),
                const SizedBox(width: 12),
                Text(
                  'Giỏ hàng (${widget.cart.fold(0, (sum, item) => sum + item.quantity)} món)',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: widget.onClear,
                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                  label: const Text('Xóa tất cả', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          ),

          // Table selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Phục vụ tại',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 40,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _tableOptions.length,
                    itemBuilder: (context, index) {
                      final table = _tableOptions[index];
                      final isSelected = table == _selectedTable;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedTable = table),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: isSelected ? GrabTheme.primary : Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected ? GrabTheme.primary : Colors.grey.shade300,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              table,
                              style: TextStyle(
                                color: isSelected ? Colors.white : Colors.grey.shade700,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // Cart items
          Expanded(
            child: widget.cart.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_cart_outlined, size: 64, color: Colors.grey.shade200),
                        const SizedBox(height: 16),
                        const Text('Giỏ hàng trống', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: widget.cart.length,
                    itemBuilder: (context, index) {
                      final item = widget.cart[index];
                      return _buildCartItem(item);
                    },
                  ),
          ),

          // Footer
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 20,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Tổng cộng', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text(
                        NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(widget.totalAmount),
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: GrabTheme.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: widget.isPlacingOrder
                          ? null
                          : () {
                              widget.onTableChanged(_selectedTable);
                              widget.onPlaceOrder();
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GrabTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: widget.isPlacingOrder
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.check_circle, color: Colors.white),
                                const SizedBox(width: 8),
                                Text(
                                  _selectedTable == 'Mang về' ? 'THANH TOÁN & IN BILL' : 'GỬI ĐƠN ĐẾN BẾP',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItem(CartItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          // Product image
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 60,
              height: 60,
              color: Colors.grey.shade200,
              child: item.product.imageUrl != null && item.product.imageUrl!.isNotEmpty
                  ? Image.network(item.product.imageUrl!, fit: BoxFit.cover)
                  : const Icon(Icons.fastfood, color: Colors.grey),
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.product.name,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(item.product.price),
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          // Quantity controls
          Row(
            children: [
              _buildQtyButton(
                icon: Icons.remove,
                onTap: () => widget.onUpdateQuantity(item.product.id, -1),
              ),
              Container(
                width: 32,
                alignment: Alignment.center,
                child: Text(
                  '${item.quantity}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
              ),
              _buildQtyButton(
                icon: Icons.add,
                onTap: () => widget.onUpdateQuantity(item.product.id, 1),
              ),
            ],
          ),
          const SizedBox(width: 12),
          // Total for this item
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(item.product.price * item.quantity),
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: GrabTheme.primary),
              ),
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => widget.onRemove(item.product.id),
                child: Icon(Icons.close, size: 18, color: Colors.grey.shade400),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQtyButton({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Icon(icon, size: 16, color: Colors.grey.shade700),
      ),
    );
  }
}
