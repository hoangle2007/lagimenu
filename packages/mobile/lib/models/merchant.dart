class Merchant {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? address;
  final int tableCount;
  bool isOpen;

  Merchant({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.address,
    this.tableCount = 10,
    this.isOpen = true,
  });

  factory Merchant.fromJson(Map<String, dynamic> json) {
    return Merchant(
      id: json['id'],
      name: json['name'] ?? 'Cửa hàng',
      email: json['email'],
      phone: json['phone'],
      address: json['address'],
      tableCount: json['tableCount'] ?? 10,
      isOpen: json['isOpen'] ?? true,
    );
  }
}
