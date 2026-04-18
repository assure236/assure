import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';

class BidAnalyticsWidget extends StatefulWidget {
  final String auctionId;

  const BidAnalyticsWidget({super.key, required this.auctionId});

  @override
  State<BidAnalyticsWidget> createState() => _BidAnalyticsWidgetState();
}

class _BidAnalyticsWidgetState extends State<BidAnalyticsWidget> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _fetchAnalytics();
  }

  Future<void> _fetchAnalytics() async {
    try {
      final res = await ApiService.get('/auctions/${widget.auctionId}/bid-analytics');
      if (res['success'] == true && mounted) {
        setState(() {
          _data = res['data'];
          _loading = false;
        });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    if (_data == null) return const SizedBox.shrink();

    final suggestion = _data!['ai_suggestion'] as Map<String, dynamic>?;
    final history = _data!['history'] as Map<String, dynamic>?;
    final trend = List<Map<String, dynamic>>.from(history?['trend'] ?? []);
    final sugMin = (suggestion?['suggested_min'] ?? 0) as num;
    final sugMax = (suggestion?['suggested_max'] ?? 0) as num;
    final message = suggestion?['message'] ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.indigo.shade50, Colors.blue.shade50],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.indigo.shade100),
      ),
      child: Column(
        children: [
          // Header tap to expand
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.auto_awesome, color: Colors.indigo.shade700, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('AI Bid Suggestion',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        if (sugMin > 0 && sugMax > 0)
                          Text(
                            '₹${NumberFormat('#,##,###').format(sugMin.toInt())} — ₹${NumberFormat('#,##,###').format(sugMax.toInt())}',
                            style: TextStyle(
                              color: Colors.indigo.shade700,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: Colors.grey,
                  ),
                ],
              ),
            ),
          ),

          if (_expanded) ...[
            // Suggestion message
            if (message.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.lightbulb_outline, size: 16, color: Colors.amber.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(message,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade700, height: 1.4)),
                    ),
                  ],
                ),
              ),

            // Stats row
            if (history != null && (history['total_completed'] as num) > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                child: Row(
                  children: [
                    _statChip('Avg', history['avg_winning_bid'] as num, Colors.blue),
                    const SizedBox(width: 8),
                    _statChip('Min', history['min_winning_bid'] as num, AppTheme.successColor),
                    const SizedBox(width: 8),
                    _statChip('Max', history['max_winning_bid'] as num, AppTheme.errorColor),
                  ],
                ),
              ),

            // Trend chart
            if (trend.length >= 2) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
                child: Row(
                  children: [
                    Icon(Icons.trending_up, size: 16, color: Colors.grey.shade600),
                    const SizedBox(width: 6),
                    Text('Bid Trend (by month)',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                  ],
                ),
              ),
              SizedBox(
                height: 160,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
                  child: _buildTrendChart(trend),
                ),
              ),
            ],

            const SizedBox(height: 4),
          ],
        ],
      ),
    );
  }

  Widget _statChip(String label, num value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(51)),
        ),
        child: Column(
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(
              '₹${NumberFormat.compact().format(value.toInt())}',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendChart(List<Map<String, dynamic>> trend) {
    final spots = trend.asMap().entries.map((entry) {
      return FlSpot(
        entry.key.toDouble(),
        (entry.value['winning_bid'] as num).toDouble(),
      );
    }).toList();

    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b);
    final yRange = maxY - minY;
    final chartMinY = (minY - yRange * 0.15).clamp(0.0, double.infinity);
    final chartMaxY = maxY + yRange * 0.15;

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: yRange > 0 ? yRange / 4 : 1000,
          getDrawingHorizontalLine: (value) => FlLine(
            color: Colors.grey.shade200,
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 48,
              interval: yRange > 0 ? yRange / 3 : 1000,
              getTitlesWidget: (value, meta) => Text(
                '₹${NumberFormat.compact().format(value.toInt())}',
                style: TextStyle(fontSize: 9, color: Colors.grey.shade600),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (value, meta) {
                final idx = value.toInt();
                if (idx < 0 || idx >= trend.length) return const SizedBox.shrink();
                return Text(
                  'M${trend[idx]['month']}',
                  style: TextStyle(fontSize: 9, color: Colors.grey.shade600),
                );
              },
            ),
          ),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: (spots.length - 1).toDouble(),
        minY: chartMinY,
        maxY: chartMaxY,
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => spots.map((spot) {
              return LineTooltipItem(
                '₹${NumberFormat('#,##,###').format(spot.y.toInt())}',
                const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
              );
            }).toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: Colors.indigo,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                radius: 3.5,
                color: Colors.indigo,
                strokeWidth: 1.5,
                strokeColor: Colors.white,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  Colors.indigo.withAlpha(51),
                  Colors.indigo.withAlpha(10),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
