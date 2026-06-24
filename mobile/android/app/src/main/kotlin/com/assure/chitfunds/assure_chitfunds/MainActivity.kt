package com.assure.chitfunds.assure_chitfunds

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import android.os.Bundle
import android.view.WindowManager

class MainActivity: FlutterFragmentActivity() {
    private val CHANNEL = "com.assure.chitfunds/qr_scanner"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // SECURITY FIX: prevent screenshots/screen recording of sensitive screens.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Pre-install the barcode scanner module so it's ready when user taps scan
        val scanner = GmsBarcodeScanning.getClient(this)
        val moduleInstallClient = ModuleInstall.getClient(this)
        val request = ModuleInstallRequest.newBuilder().addApi(scanner).build()
        moduleInstallClient.installModules(request)
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
