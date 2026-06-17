class Employee {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isActive;
  final DateTime createdAt;
  final String? shopId;

  Employee({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.isActive,
    required this.createdAt,
    this.shopId,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? 'Nhân viên',
      email: json['email'] ?? '',
      phone: json['phone'],
      isActive: json['isActive'] ?? json['is_active'] ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'])
              : DateTime.now(),
      shopId: json['shopId'] ?? json['shop_id'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'isActive': isActive,
      'createdAt': createdAt.toIso8601String(),
      'shopId': shopId,
    };
  }
}