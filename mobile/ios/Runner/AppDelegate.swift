import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  // SECURITY FIX: prevent screenshots when app moves inactive.
  private func setWindowHidden(_ hidden: Bool) {
    self.window??.isHidden = hidden
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func applicationWillResignActive(_ application: UIApplication) {
    setWindowHidden(true)
    super.applicationWillResignActive(application)
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    setWindowHidden(false)
    super.applicationDidBecomeActive(application)
  }
}
