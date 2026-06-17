class Category {
  final String id;
  final String name;
  final int order;

  Category({
    required this.id,
    required this.name,
    required this.order,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      order: json['order'] ?? 0,
    );
  }
}
