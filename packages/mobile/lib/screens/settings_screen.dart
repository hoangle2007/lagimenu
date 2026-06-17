import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/merchant_provider.dart';
import '../providers/menu_provider.dart';
import '../providers/employee_provider.dart';
import '../core/theme.dart';
import '../models/category.dart';
import '../models/product.dart';
import 'menu_screen.dart';
import 'employees_screen.dart';
import 'package:intl/intl.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('CÀI ĐẶT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: GrabTheme.primary,
          labelColor: GrabTheme.primary,
          unselectedLabelColor: Colors.grey,
          labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 0.5),
          tabs: const [
            Tab(text: 'CÀI ĐẶT'),
            Tab(text: 'THỰC ĐƠN'),
            Tab(text: 'NHÂN VIÊN'),
            Tab(text: 'TÀI KHOẢN'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _SettingsTab(),
          _MenuTab(),
          _EmployeesTab(),
          _AccountTab(),
        ],
      ),
    );
  }
}

// Tab 1: Cài đặt cửa hàng
class _SettingsTab extends StatefulWidget {
  const _SettingsTab();

  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isOpen = true;
  String _name = '';
  String _address = '';
  String _phone = '';
  String _slogan = '';
  int _tableCount = 10;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final auth = context.read<AuthProvider>();
    if (auth.merchant != null) {
      setState(() {
        _isOpen = auth.merchant!.isOpen;
        _name = auth.merchant!.name;
        _address = auth.merchant!.address ?? '';
        _phone = auth.merchant!.phone ?? '';
        _tableCount = auth.merchant!.tableCount;
      });
    }
    setState(() => _isLoading = false);
  }

  Future<void> _saveSettings() async {
    final auth = context.read<AuthProvider>();
    if (auth.merchant == null) return;

    setState(() => _isSaving = true);

    final data = {
      'name': _name,
      'address': _address,
      'phone': _phone,
      'slogan': _slogan,
      'tableCount': _tableCount,
    };

    await context.read<MerchantProvider>().updateProfile(auth.merchant!.id, data, auth.token ?? '');

    setState(() => _isSaving = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã lưu cài đặt'), backgroundColor: GrabTheme.primary),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Store status toggle
        _buildSection(
          title: 'TRẠNG THÁI CỬA HÀNG',
          children: [
            _buildToggleTile(
              icon: Icons.store,
              iconColor: _isOpen ? Colors.green : Colors.grey,
              title: _isOpen ? 'Đang mở cửa' : 'Tạm đóng',
              subtitle: _isOpen ? 'Khách hàng có thể đặt món' : 'Cửa hàng tạm ngưng phục vụ',
              value: _isOpen,
              onChanged: (value) async {
                setState(() => _isOpen = value);
                await context.read<MerchantProvider>().updateMerchantStatus(
                  auth.merchant!.id,
                  value,
                  auth.token ?? '',
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(value ? 'Cửa hàng đã mở cửa' : 'Cửa hàng đã tạm đóng'),
                      backgroundColor: value ? Colors.green : Colors.orange,
                    ),
                  );
                }
              },
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Store info
        _buildSection(
          title: 'THÔNG TIN CỬA HÀNG',
          children: [
            _buildTextTile(
              icon: Icons.store,
              title: 'Tên cửa hàng',
              value: _name,
              onChanged: (value) => setState(() => _name = value),
            ),
            const Divider(height: 1),
            _buildTextTile(
              icon: Icons.location_on_outlined,
              title: 'Địa chỉ',
              value: _address,
              onChanged: (value) => setState(() => _address = value),
            ),
            const Divider(height: 1),
            _buildTextTile(
              icon: Icons.phone_outlined,
              title: 'Số điện thoại',
              value: _phone,
              onChanged: (value) => setState(() => _phone = value),
              keyboardType: TextInputType.phone,
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Table management
        _buildSection(
          title: 'QUẢN LÝ BÀN',
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: GrabTheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.table_restaurant, color: GrabTheme.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Số lượng bàn', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        Text('Tối đa $_tableCount bàn', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        _buildCountButton(icon: Icons.remove, onTap: () { if (_tableCount > 1) setState(() => _tableCount--); }),
                        Container(width: 48, alignment: Alignment.center, child: Text('$_tableCount', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: GrabTheme.primary))),
                        _buildCountButton(icon: Icons.add, onTap: () { if (_tableCount < 50) setState(() => _tableCount++); }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Save button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isSaving ? null : _saveSettings,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: GrabTheme.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: _isSaving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.save, color: Colors.white),
                      SizedBox(width: 8),
                      Text('LƯU CÀI ĐẶT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildSection({required String title, required List<Widget> children}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1)),
        ),
        Container(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.grey.shade100)),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildToggleTile({required IconData icon, required Color iconColor, required String title, required String subtitle, required bool value, required ValueChanged<bool> onChanged}) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: iconColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: iconColor)),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))])),
          Switch(value: value, activeColor: Colors.green, onChanged: onChanged),
        ],
      ),
    );
  }

  Widget _buildTextTile({required IconData icon, required String title, required String value, required ValueChanged<String> onChanged, TextInputType? keyboardType}) {
    return InkWell(
      onTap: () => _showEditDialog(title, value, onChanged, keyboardType: keyboardType),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: GrabTheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: GrabTheme.primary, size: 20)),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)), const SizedBox(height: 2), Text(value.isEmpty ? 'Chưa có' : value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: value.isEmpty ? Colors.grey.shade400 : Colors.black))])),
            Icon(Icons.edit, color: Colors.grey.shade300, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildCountButton({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(onTap: onTap, child: Container(width: 40, height: 40, alignment: Alignment.center, child: Icon(icon, color: GrabTheme.primary, size: 20)));
  }

  void _showEditDialog(String title, String currentValue, ValueChanged<String> onChanged, {TextInputType? keyboardType}) {
    final controller = TextEditingController(text: currentValue);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Sửa $title', style: const TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(controller: controller, autofocus: true, keyboardType: keyboardType, decoration: const InputDecoration(border: OutlineInputBorder(), labelText: '')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hủy')),
          ElevatedButton(onPressed: () { onChanged(controller.text.trim()); Navigator.pop(context); }, child: const Text('Lưu')),
        ],
      ),
    );
  }
}

// Tab 2: Thực đơn (inline)
class _MenuTab extends StatefulWidget {
  const _MenuTab();

  @override
  State<_MenuTab> createState() => _MenuTabState();
}

class _MenuTabState extends State<_MenuTab> with SingleTickerProviderStateMixin {
  TabController? _tabController;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _categoryCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshMenu());
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
    _updateTabController(categories.length);

    return Scaffold(
      backgroundColor: Colors.white,
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
                      ElevatedButton.icon(onPressed: () => _showAddCategoryDialog(context), icon: const Icon(Icons.add), label: const Text('Thêm danh mục')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // Search bar
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (value) => setState(() => _searchQuery = value),
                        decoration: InputDecoration(
                          hintText: 'Tìm kiếm món...',
                          prefixIcon: const Icon(Icons.search),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                    ),
                    // Category tabs
                    if (categories.isNotEmpty)
                      TabBar(
                        controller: _tabController!,
                        isScrollable: true,
                        indicatorColor: GrabTheme.primary,
                        labelColor: GrabTheme.primary,
                        unselectedLabelColor: Colors.grey,
                        tabs: categories.map((c) => Tab(text: c.name.toUpperCase())).toList(),
                      ),
                    // Products list
                    Expanded(
                      child: TabBarView(
                        controller: _tabController!,
                        children: categories.map((c) => _buildProductList(menuProvider, c)).toList(),
                      ),
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddCategoryDialog(context),
        backgroundColor: GrabTheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildProductList(MenuProvider provider, Category category) {
    final products = _searchQuery.isEmpty
        ? provider.getProducts(category.id)
        : provider.getProducts(category.id).where((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    if (products.isEmpty) {
      return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.coffee, size: 48, color: Colors.grey.shade200),
        const SizedBox(height: 8),
        Text(_searchQuery.isEmpty ? 'Không có món ăn nào' : 'Không tìm thấy món', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
      ]));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: products.length,
      itemBuilder: (context, index) => _buildProductCard(provider, category, products[index]),
    );
  }

  Widget _buildProductCard(MenuProvider provider, Category category, Product product) {
    final auth = context.read<AuthProvider>();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade100)),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 64, height: 64,
              color: Colors.grey.shade50,
              child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                  ? Image.network(product.imageUrl!, fit: BoxFit.cover,
                      frameBuilder: (c, child, frame, was) => AnimatedOpacity(opacity: frame == null ? 0 : 1, duration: const Duration(milliseconds: 200), child: child),
                      errorBuilder: (_, __, ___) => const Icon(Icons.fastfood, color: Colors.grey))
                  : const Icon(Icons.fastfood, color: Colors.grey),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: Text(product.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (!product.isAvailable) Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: Colors.orange.shade100, borderRadius: BorderRadius.circular(6)),
                    child: Text('ẨN', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.orange.shade700)),
                  ),
                ]),
                const SizedBox(height: 4),
                Text(NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(product.price), style: const TextStyle(color: GrabTheme.primary, fontWeight: FontWeight.w900, fontSize: 13)),
              ],
            ),
          ),
          Icon(Icons.edit, color: Colors.grey.shade400, size: 20),
        ],
      ),
    );
  }

  void _showAddCategoryDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Thêm danh mục mới', style: TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Tên danh mục', border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              final auth = context.read<AuthProvider>();
              if (auth.merchant != null) {
                await context.read<MenuProvider>().createCategory(auth.merchant!.id, controller.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
  }
}

// Tab 3: Nhân viên (inline)
class _EmployeesTab extends StatelessWidget {
  const _EmployeesTab();

  @override
  Widget build(BuildContext context) {
    return const EmployeesScreen();
  }
}

// Tab 4: Tài khoản (inline)
class _AccountTab extends StatelessWidget {
  const _AccountTab();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final merchant = auth.merchant;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const SizedBox(height: 24),
          Center(
            child: Stack(
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: GrabTheme.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(color: GrabTheme.primary, width: 4),
                  ),
                  child: const Icon(Icons.store, size: 60, color: GrabTheme.primary),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: GrabTheme.primary, shape: BoxShape.circle),
                    child: const Icon(Icons.edit, size: 16, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(merchant?.name ?? 'Admin', style: Theme.of(context).textTheme.headlineSmall),
          Text(merchant?.email ?? '', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
          const SizedBox(height: 32),
          _buildSettingsGroup('Cửa hàng', [
            _buildSettingItem(context, Icons.info_outline, 'Thông tin quán'),
            _buildSettingItem(context, Icons.qr_code_2, 'Quản lý mã QR/Bàn'),
            _buildSettingItem(context, Icons.notifications_active_outlined, 'Cài đặt thông báo'),
          ]),
          _buildSettingsGroup('Hệ thống', [
            _buildSettingItem(context, Icons.help_outline, 'Trung tâm hỗ trợ'),
            _buildSettingItem(context, Icons.policy_outlined, 'Điều khoản & Bảo mật'),
            _buildSettingItem(context, Icons.info_outlined, 'Phiên bản app 1.0.0'),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => auth.logout(),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: const Icon(Icons.logout, color: Colors.white),
              label: const Text('ĐĂNG XUẤT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildSettingsGroup(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 1)),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Column(children: items),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildSettingItem(BuildContext context, IconData icon, String title) {
    return ListTile(
      leading: Icon(icon, color: GrabTheme.secondary, size: 22),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
      onTap: () {},
    );
  }
}
