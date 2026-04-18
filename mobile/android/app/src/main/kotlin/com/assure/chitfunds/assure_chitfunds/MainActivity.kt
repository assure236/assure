package com.assure.chitfunds.assure_chitfunds

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode

class MainActivity: FlutterFragmentActivity() {
    private val CHANNEL = "com.assure.chitfunds/qr_scanner"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "scanQR") {
                val options = GmsBarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .enableAutoZoom()
                    .build()
                val scanner = GmsBarcodeScanning.getClient(this, options)
                scanner.startScan()
                    .addOnSuccessListener { barcode ->
                        result.success(barcode.rawValue)
                    }
                    .addOnCanceledListener {
                        result.success(null)
                    }
                    .addOnFailureListener { e ->
                        result.error("SCAN_ERROR", e.message, null)
                    }
            } else {
                result.notImplemented()
            }
        }
    }
}
