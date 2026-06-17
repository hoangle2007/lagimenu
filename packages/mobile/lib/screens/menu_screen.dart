import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/menu_provider.dart';
import '../models/category.dart';
import '../models/product.dart';
import '../core/theme.dart';
import 'package:intl/intl.dart';

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key});

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> with SingleTickerProviderStateMixin {
  TabController? _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _categoryCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshMenu();
    });
  }

  @override
  void dispose() {
    _tabController?.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _refreshMenu() {
    final auth = context.read<AuthProvider>();
    if (auth.merchant != null) {
      context.read<MenuProvider>().fetchMenu(auth.merchant!.id);
    }
  }

  void _updateTabController(int count) {
    if (_categoryCount == count) return;
    _categoryCount = count;
    _tabController?.dispose();
    _tabController = TabController(length: count, vsync: this);
  }

  List<Category> _getFilteredCategories(List<Category> categories) {
    if (_searchQuery.isEmpty) return categories;
    return categories.where((cat) {
      final products = context.read<MenuProvider>().getProducts(cat.id);
      return cat.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          products.any((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase()));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final menuProvider = context.watch<MenuProvider>();
    final categories = _getFilteredCategories(menuProvider.categories);

    // Update tab controller when categories change
    _updateTabController(categories.length);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('THỰC ĐƠN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        actions: [
          IconButton(onPressed: _refreshMenu, icon: const Icon(Icons.refresh)),
          const SizedBox(width: 8),
        ],
        bottom: categories.isEmpty
          ? null
          : PreferredSize(
              preferredSize: const Size.fromHeight(48),
              child: Column(
                children: [
                  // Search bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (value) => setState(() => _searchQuery = value),
                      decoration: InputDecoration(
                        hintText: 'Tìm kiếm món...',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
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
                  TabBar(
                    controller: _tabController!,
                    isScrollable: true,
                    indicatorColor: GrabTheme.primary,
                    labelColor: GrabTheme.primary,
                    unselectedLabelColor: Colors.grey,
                    labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 0.5),
                    tabs: categories.map((c) => Tab(text: c.name.toUpperCase())).toList(),
                  ),
                ],
              ),
            ),
      ),
      body: menuProvider.isLoading && categories.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : categories.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.restaurant_menu, size: 64, color: Colors.grey.shade100),
                      const SizedBox(height: 16),
                      const Text('Chưa có danh mục món ăn nào', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () => _showAddCategoryDialog(),
                        icon: const Icon(Icons.add),
                        label: const Text('Thêm danh mục đầu tiên'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController!,
                  children: categories.map((c) => _buildProductList(menuProvider, c)).toList(),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddCategoryDialog(),
        backgroundColor: GrabTheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildProductList(MenuProvider provider, Category category) {
    final products = _searchQuery.isEmpty
        ? provider.getProducts(category.id)
        : provider.getProducts(category.id)
            .where((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase()))
            .toList();

    return Stack(
      children: [
        products.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.coffee, size: 48, color: Colors.grey.shade200),
                    const SizedBox(height: 8),
                    Text(
                      _searchQuery.isEmpty ? 'Không có món ăn nào' : 'Không tìm thấy món',
                      style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                itemCount: products.length,
                itemBuilder: (context, index) {
                  final product = products[index];
                  return _buildProductCard(provider, category, product);
                },
              ),
        // Add product FAB for this category
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton.small(
            heroTag: 'add_product_${category.id}',
            onPressed: () => _showAddProductSheet(category),
            backgroundColor: GrabTheme.primary,
            child: const Icon(Icons.add, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }

  Widget _buildProductCard(MenuProvider provider, Category category, Product product) {
    final auth = context.read<AuthProvider>();

    return Dismissible(
      key: Key('product_${product.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (direction) => _confirmDelete(
        'Xóa món "${product.name}"?',
        'Món này sẽ bị xóa vĩnh viễn khỏi thực đơn.',
      ),
      onDismissed: (direction) {
        if (auth.merchant != null) {
          provider.deleteProduct(auth.merchant!.id, product.id);
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => _showEditProductSheet(category, product),
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 72,
                      height: 72,
                      color: Colors.grey.shade50,
                      child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                          ? Image.network(
                              product.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.fastfood, color: Colors.grey, size: 32),
                            )
                          : const Icon(Icons.fastfood, color: Colors.grey, size: 32),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                product.name,
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (!product.isAvailable)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.orange.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'ẨN',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.orange.shade700,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        if (product.description != null && product.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              product.description!,
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(product.price),
                              style: const TextStyle(color: GrabTheme.primary, fontWeight: FontWeight.w900, fontSize: 14),
                            ),
                            Transform.scale(
                              scale: 0.8,
                              child: Switch(
                                value: product.isAvailable,
                                activeColor: GrabTheme.primary,
                                onChanged: (value) {
                                  if (auth.merchant != null) {
                                    provider.toggleProductAvailability(auth.merchant!.id, product.id, value);
                                  }
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.edit, color: Colors.grey.shade400, size: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Category dialogs
  void _showAddCategoryDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Thêm danh mục mới', style: TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Tên danh mục',
            hintText: 'Ví dụ: Trà Sữa, Cà Phê...',
            border: OutlineInputBorder(),
          ),
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              final auth = context.read<AuthProvider>();
              if (auth.merchant != null) {
                await context.read<MenuProvider>().createCategory(auth.merchant!.id, controller.text.trim());
                if (mounted) {
                  Navigator.pop(context);
                  _refreshMenu();
                }
              }
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
  }

  void _showEditCategoryDialog(Category category) {
    final controller = TextEditingController(text: category.name);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Sửa danh mục', style: TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Tên danh mục',
            border: OutlineInputBorder(),
          ),
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              final auth = context.read<AuthProvider>();
              if (auth.merchant != null) {
                await context.read<MenuProvider>().updateCategory(auth.merchant!.id, category.id, controller.text.trim());
                if (mounted) {
                  Navigator.pop(context);
                  _refreshMenu();
                }
              }
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  void _showDeleteCategoryDialog(Category category) async {
    final confirmed = await _confirmDelete(
      'Xóa danh mục "${category.name}"?',
      'Tất cả các món trong danh mục này cũng sẽ bị xóa.',
    );
    if (confirmed == true) {
      final auth = context.read<AuthProvider>();
      if (auth.merchant != null) {
        await context.read<MenuProvider>().deleteCategory(auth.merchant!.id, category.id);
        _refreshMenu();
      }
    }
  }

  // Product sheets
  void _showAddProductSheet(Category category) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ProductFormSheet(categoryId: category.id, categoryName: category.name),
        fullscreenDialog: true,
      ),
    ).then((_) => _refreshMenu());
  }

  void _showEditProductSheet(Category category, Product product) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ProductFormSheet(
          categoryId: category.id,
          categoryName: category.name,
          product: product,
        ),
        fullscreenDialog: true,
      ),
    ).then((_) => _refreshMenu());
  }

  Future<bool?> _confirmDelete(String title, String message) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red.shade400),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16))),
          ],
        ),
        content: Text(message, style: TextStyle(color: Colors.grey.shade700)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade400),
            child: const Text('Xóa', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

// Product Form Sheet (Add/Edit)
class ProductFormSheet extends StatefulWidget {
  final String categoryId;
  final String categoryName;
  final Product? product;

  const ProductFormSheet({
    super.key,
    required this.categoryId,
    required this.categoryName,
    this.product,
  });

  @override
  State<ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<ProductFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _imageUrlController = TextEditingController();
  bool _isAvailable = true;
  bool _isLoading = false;

  bool get isEditing => widget.product != null;

  @override
  void initState() {
    super.initState();
    if (widget.product != null) {
      _nameController.text = widget.product!.name;
      _priceController.text = widget.product!.price.toInt().toString();
      _descriptionController.text = widget.product!.description ?? '';
      _imageUrlController.text = widget.product!.imageUrl ?? '';
      _isAvailable = widget.product!.isAvailable;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _descriptionController.dispose();
    _imageUrlController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final auth = context.read<AuthProvider>();
    if (auth.merchant == null) return;

    final data = {
      'name': _nameController.text.trim(),
      'price': _priceController.text.trim(),
      'description': _descriptionController.text.trim(),
      'imageUrl': _imageUrlController.text.trim(),
      'isAvailable': _isAvailable,
    };

    bool success = false;

    if (isEditing) {
      success = await context.read<MenuProvider>().updateProduct(
        auth.merchant!.id,
        widget.product!.id,
        data,
      );
    } else {
      final result = await context.read<MenuProvider>().createProduct(
        auth.merchant!.id,
        widget.categoryId,
        data,
      );
      success = result != null;
    }

    setState(() => _isLoading = false);

    if (success && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isEditing ? 'Đã cập nhật món ăn' : 'Đã thêm món ăn mới'),
          backgroundColor: GrabTheme.primary,
        ),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Có lỗi xảy ra. Vui lòng thử lại.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isEditing ? 'Sửa món ăn' : 'Thêm món mới',
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (isEditing)
            IconButton(
              icon: Icon(Icons.delete, color: Colors.red.shade400),
              onPressed: () async {
                final auth = context.read<AuthProvider>();
                if (auth.merchant != null) {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      title: const Text('Xóa món này?'),
                      content: Text('Món "${widget.product!.name}" sẽ bị xóa vĩnh viễn.'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
                        ElevatedButton(
                          onPressed: () => Navigator.pop(context, true),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                          child: const Text('Xóa', style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true) {
                    await context.read<MenuProvider>().deleteProduct(auth.merchant!.id, widget.product!.id);
                    if (mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Đã xóa món ăn'), backgroundColor: Colors.red),
                      );
                    }
                  }
                }
              },
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Image preview
            Center(
              child: GestureDetector(
                onTap: () => _showImageUrlDialog(),
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: _imageUrlController.text.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.network(
                            _imageUrlController.text,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _buildImagePlaceholder(),
                          ),
                        )
                      : _buildImagePlaceholder(),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: TextButton.icon(
                onPressed: () => _showImageUrlDialog(),
                icon: const Icon(Icons.image, size: 18),
                label: Text(_imageUrlController.text.isEmpty ? 'Thêm ảnh' : 'Đổi ảnh'),
              ),
            ),
            const SizedBox(height: 24),

            // Name field
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Tên món *',
                hintText: 'Ví dụ: Trà Sữa Trân Châu',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (value) => value == null || value.trim().isEmpty ? 'Vui lòng nhập tên món' : null,
            ),
            const SizedBox(height: 16),

            // Price field
            TextFormField(
              controller: _priceController,
              decoration: const InputDecoration(
                labelText: 'Giá (VNĐ) *',
                hintText: '45000',
                border: OutlineInputBorder(),
                prefixText: '',
                suffixText: 'đ',
              ),
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.trim().isEmpty) return 'Vui lòng nhập giá';
                if (int.tryParse(value) == null) return 'Giá phải là số';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description field
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Mô tả',
                hintText: 'Hương vị đặc trưng, thành phần...',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),

            // Image URL field
            TextFormField(
              controller: _imageUrlController,
              decoration: const InputDecoration(
                labelText: 'Link ảnh (URL)',
                hintText: 'https://...',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.link),
              ),
              keyboardType: TextInputType.url,
              onChanged: (value) => setState(() {}),
            ),
            const SizedBox(height: 24),

            // Availability toggle
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _isAvailable ? GrabTheme.primary.withOpacity(0.05) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isAvailable ? GrabTheme.primary.withOpacity(0.2) : Colors.grey.shade300,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isAvailable ? Icons.visibility : Icons.visibility_off,
                    color: _isAvailable ? GrabTheme.primary : Colors.grey,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hiển thị trên menu',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: _isAvailable ? GrabTheme.primary : Colors.grey.shade700,
                          ),
                        ),
                        Text(
                          _isAvailable ? 'Khách có thể thấy và đặt món này' : 'Món bị ẩn, chỉ bạn thấy',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _isAvailable,
                    activeColor: GrabTheme.primary,
                    onChanged: (value) => setState(() => _isAvailable = value),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _save,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: GrabTheme.primary,
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Text(
                    isEditing ? 'LƯU THAY ĐỔI' : 'THÊM MÓN',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildImagePlaceholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.add_a_photo, size: 40, color: Colors.grey.shade300),
        const SizedBox(height: 8),
        Text(
          'Thêm ảnh',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade400, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  void _showImageUrlDialog() {
    final controller = TextEditingController(text: _imageUrlController.text);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Link ảnh món ăn', style: TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'URL ảnh',
            hintText: 'https://example.com/image.jpg',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.url,
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () {
              setState(() => _imageUrlController.text = controller.text.trim());
              Navigator.pop(context);
            },
            child: const Text('Cập nhật'),
          ),
        ],
      ),
    );
  }
}
