import 'package:flutter/material.dart';
import '../models/table_info.dart';

class TableCard extends StatelessWidget {
  final TableInfo table;
  final VoidCallback onTap;

  const TableCard({super.key, required this.table, required this.onTap});

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color? borderColor;
    Color textColor = Colors.black87;
    Color labelColor = Colors.grey;

    switch (table.status) {
      case TableStatus.empty:
        bgColor = Colors.white;
        borderColor = Colors.grey.shade200;
        textColor = Colors.grey.shade300;
        break;
      case TableStatus.pending:
        bgColor = const Color(0xFFFEF3C7); // Amber 100
        borderColor = const Color(0xFFFBBF24); // Amber 400
        textColor = const Color(0xFF92400E); // Amber 800
        labelColor = textColor.withOpacity(0.6);
        break;
      case TableStatus.preparing:
        bgColor = const Color(0xFFE0E7FF); // Indigo 100
        borderColor = const Color(0xFF6366F1); // Indigo 500
        textColor = const Color(0xFF3730A3); // Indigo 800
        labelColor = textColor.withOpacity(0.6);
        break;
      case TableStatus.ready:
        bgColor = const Color(0xFFD1FAE5); // Emerald 100
        borderColor = const Color(0xFF10B981); // Emerald 500
        textColor = const Color(0xFF065F46); // Emerald 800
        labelColor = textColor.withOpacity(0.6);
        break;
      case TableStatus.busy:
        bgColor = Colors.white;
        borderColor = const Color(0xFF6366F1).withOpacity(0.2);
        textColor = const Color(0xFF1F2937); // Gray 900
        break;
    }

    return Card(
      color: bgColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: borderColor != null ? BorderSide(color: borderColor, width: 1.5) : BorderSide.none,
      ),
      child: InkWell(
        onTap: table.status == TableStatus.empty ? null : onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'BÀN',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: labelColor,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                table.number,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 8),
              _buildBadge(table.status),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(TableStatus status) {
    String label;
    Color color;

    switch (status) {
      case TableStatus.empty:
        label = 'TRỐNG';
        color = Colors.grey.shade300;
        break;
      case TableStatus.pending:
        label = 'CÓ ĐƠN';
        color = const Color(0xFFD97706);
        break;
      case TableStatus.preparing:
        label = 'ĐANG LÀM';
        color = const Color(0xFF4F46E5);
        break;
      case TableStatus.ready:
        label = 'CHỜ GIAO';
        color = const Color(0xFF059669);
        break;
      case TableStatus.busy:
        label = 'CÓ KHÁCH';
        color = const Color(0xFF6366F1);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: status == TableStatus.empty ? Colors.transparent : color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: status == TableStatus.empty ? Border.all(color: color) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 8,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
