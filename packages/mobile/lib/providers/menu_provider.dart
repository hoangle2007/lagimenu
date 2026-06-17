import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/category.dart';
import '../models/product.dart';

class MenuProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  List<Category> _categories = [];
  Map<String, List<Product>> _productsByCategory = {};
  bool _isLoading = false;
  String? _error;

  List<Category> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Product> getProducts(String categoryId) => _productsByCategory[categoryId] ?? [];

  // Get all products flat
  List<Product> get allProducts {
    final products = <Product>[];
    for (final list in _productsByCategory.values) {
      products.addAll(list);
    }
    return products;
  }

  Future<void> fetchMenu(String merchantId) async {
    _error = null;
    // Set loading state in a microtask to avoid building phase notifyListeners errors
    Future.microtask(() {
      _isLoading = true;
      notifyListeners();
    });

    try {
      final catRes = await _api.get('menu/merchant/$merchantId/categories');
      if (catRes.statusCode == 200) {
        _categories = (catRes.data as List).map((c) => Category.fromJson(c)).toList();
        _categories.sort((a, b) => a.order.compareTo(b.order));
        _productsByCategory.clear();

        for (var cat in catRes.data) {
          if (cat['products'] != null) {
             final catId = cat['id'].toString();
             _productsByCategory[catId] = (cat['products'] as List).map((p) => Product.fromJson(p)).toList();
          }
        }
      }
    } catch (e) {
      _error = 'Failed to fetch menu: $e';
      debugPrint(_error);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Category CRUD
  Future<Category?> createCategory(String merchantId, String name) async {
    try {
      final response = await _api.post(
        'menu/merchant/$merchantId/categories',
        data: {'name': name, 'order': _categories.length},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newCat = Category.fromJson(response.data);
        _categories.add(newCat);
        _productsByCategory[newCat.id] = [];
        notifyListeners();
        return newCat;
      }
    } catch (e) {
      debugPrint('Create category error: $e');
    }
    return null;
  }

  Future<bool> updateCategory(String merchantId, String categoryId, String name) async {
    try {
      final response = await _api.put(
        'menu/merchant/$merchantId/categories/$categoryId',
        data: {'name': name},
      );
      if (response.statusCode == 200) {
        final index = _categories.indexWhere((c) => c.id == categoryId);
        if (index != -1) {
          _categories[index] = Category.fromJson(response.data);
          notifyListeners();
        }
        return true;
      }
    } catch (e) {
      debugPrint('Update category error: $e');
    }
    return false;
  }

  Future<bool> deleteCategory(String merchantId, String categoryId) async {
    try {
      final response = await _api.delete('menu/merchant/$merchantId/categories/$categoryId');
      if (response.statusCode == 200) {
        _categories.removeWhere((c) => c.id == categoryId);
        _productsByCategory.remove(categoryId);
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Delete category error: $e');
    }
    return false;
  }

  // Product CRUD
  Future<Product?> createProduct(String merchantId, String categoryId, Map<String, dynamic> productData) async {
    try {
      final response = await _api.post(
        'menu/merchant/$merchantId/products',
        data: {...productData, 'categoryId': categoryId},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newProduct = Product.fromJson(response.data);
        _productsByCategory[categoryId] ??= [];
        _productsByCategory[categoryId]!.add(newProduct);
        notifyListeners();
        return newProduct;
      }
    } catch (e) {
      debugPrint('Create product error: $e');
    }
    return null;
  }

  Future<bool> updateProduct(String merchantId, String productId, Map<String, dynamic> productData) async {
    try {
      final response = await _api.put(
        'menu/merchant/$merchantId/products/$productId',
        data: productData,
      );
      if (response.statusCode == 200) {
        final updatedProduct = Product.fromJson(response.data);
        // Find and update in the map
        for (var entry in _productsByCategory.entries) {
          final index = entry.value.indexWhere((p) => p.id == productId);
          if (index != -1) {
            _productsByCategory[entry.key]![index] = updatedProduct;
            break;
          }
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Update product error: $e');
    }
    return false;
  }

  Future<bool> deleteProduct(String merchantId, String productId) async {
    try {
      final response = await _api.delete('menu/merchant/$merchantId/products/$productId');
      if (response.statusCode == 200) {
        for (var entry in _productsByCategory.entries) {
          _productsByCategory[entry.key]!.removeWhere((p) => p.id == productId);
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Delete product error: $e');
    }
    return false;
  }

  Future<bool> toggleProductAvailability(String merchantId, String productId, bool isAvailable) async {
    try {
      final response = await _api.put(
        'menu/merchant/$merchantId/products/$productId',
        data: {'isAvailable': isAvailable},
      );
      if (response.statusCode == 200) {
        // Update local state
        for (var list in _productsByCategory.values) {
          final index = list.indexWhere((p) => p.id == productId);
          if (index != -1) {
            final old = list[index];
            list[index] = Product(
              id: old.id,
              name: old.name,
              description: old.description,
              price: old.price,
              imageUrl: old.imageUrl,
              isAvailable: isAvailable,
              categoryId: old.categoryId,
            );
            break;
          }
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Toggle availability error: $e');
    }
    return false;
  }
}
