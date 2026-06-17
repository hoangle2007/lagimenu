import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../core/theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final merchant = auth.merchant;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('TÀI KHOẢN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        actions: [
          IconButton(
            onPressed: () => auth.logout(),
            icon: const Icon(Icons.logout, color: Colors.redAccent),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
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
              _buildSettingItem(Icons.info_outline, 'Thông tin quán'),
              _buildSettingItem(Icons.qr_code_2, 'Quản lý mã QR/Bàn'),
              _buildSettingItem(Icons.notifications_active_outlined, 'Cài đặt thông báo'),
            ]),
            _buildSettingsGroup('Hệ thống', [
              _buildSettingItem(Icons.help_outline, 'Trung tâm hỗ trợ'),
              _buildSettingItem(Icons.policy_outlined, 'Điều khoản & Bảo mật'),
              _buildSettingItem(Icons.info_outlined, 'Phiên bản app 1.0.0'),
            ]),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsGroup(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 1)),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Column(children: items),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildSettingItem(IconData icon, String title) {
    return ListTile(
      leading: Icon(icon, color: GrabTheme.secondary, size: 22),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
      onTap: () {},
    );
  }
}
