import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';

class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcode = capture.barcodes.firstOrNull;
    final raw = barcode?.rawValue;
    if (raw == null || !raw.startsWith('assure://qr-login?session=')) return;

    final uri = Uri.parse(raw.replaceFirst('assure://', 'https://'));
    final sessionId = uri.queryParameters['session'];
    if (sessionId == null || sessionId.isEmpty) return;

    setState(() => _isProcessing = true);
    await _controller.stop();

    if (!mounted) return;
    _showConfirmDialog(sessionId);
  }

  void _showConfirmDialog(String sessionId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        icon: const Icon(Icons.computer, color: Color(0xFF1976D2), size: 52),
        title: const Text('Login to Web Portal?'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'You are about to log in to the Assure ChitFunds web portal using your account.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.black54),
            ),
            SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield, color: Colors.green, size: 16),
                SizedBox(width: 4),
                Text('Secure login via QR code', style: TextStyle(fontSize: 12, color: Colors.green)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() => _isProcessing = false);
              _controller.start();
            },
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.of(context).pop();
              final auth = context.read<AuthProvider>();
              final res = await auth.confirmQrLogin(sessionId);
              if (!mounted) return;
              _showResult(res['success'] == true, res['message'] ?? 'Unknown error');
            },
            icon: const Icon(Icons.check_circle, size: 18),
            label: const Text('Confirm Login'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1976D2),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }

  void _showResult(bool success, String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        icon: Icon(
          success ? Icons.check_circle_outline : Icons.error_outline,
          color: success ? Colors.green : Colors.red,
          size: 52,
        ),
        title: Text(success ? 'Web Login Confirmed' : 'Login Failed'),
        content: Text(
          success
              ? 'Your web browser is now logged in. You can switch back to the browser.'
              : message,
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // close dialog
              if (success) {
                Navigator.of(context).pop(); // go back to previous screen
              } else {
                setState(() => _isProcessing = false);
                _controller.start();
              }
            },
            child: Text(success ? 'Done' : 'Try Again'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Web QR Code'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Toggle flash',
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Dark overlay with cutout
          CustomPaint(painter: _OverlayPainter(), child: const SizedBox.expand()),
          // Bottom instructions
          Positioned(
            bottom: 48,
            left: 16,
            right: 16,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(153),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Point camera at the QR code on the\nAssure ChitFunds web portal',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 14, height: 1.5),
                  ),
                ),
                if (_isProcessing) ...[
                  const SizedBox(height: 20),
                  const CircularProgressIndicator(color: Colors.white),
                  const SizedBox(height: 8),
                  const Text('Confirming login...',
                      style: TextStyle(color: Colors.white, fontSize: 14)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final overlayPaint = Paint()..color = Colors.black54;
    final cutSize = size.width * 0.72;
    final left = (size.width - cutSize) / 2;
    final top = (size.height - cutSize) / 2 - 40;
    final cutout = Rect.fromLTWH(left, top, cutSize, cutSize);

    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()..addRRect(RRect.fromRectAndRadius(cutout, const Radius.circular(16))),
      ),
      overlayPaint,
    );

    final cornerPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const cLen = 28.0;
    for (final corner in [
      [cutout.topLeft, const Offset(cLen, 0), const Offset(0, cLen)],
      [cutout.topRight, const Offset(-cLen, 0), const Offset(0, cLen)],
      [cutout.bottomLeft, const Offset(cLen, 0), const Offset(0, -cLen)],
      [cutout.bottomRight, const Offset(-cLen, 0), const Offset(0, -cLen)],
    ]) {
      final origin = corner[0];
      canvas.drawLine(origin, origin + corner[1], cornerPaint);
      canvas.drawLine(origin, origin + corner[2], cornerPaint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
