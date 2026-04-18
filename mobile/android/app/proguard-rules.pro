## Flutter-specific
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

## Cashfree PG SDK
-keep class com.cashfree.** { *; }
-dontwarn com.cashfree.**

## Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

## Geolocator
-keep class com.baseflow.geolocator.** { *; }

## Suppress warnings
-dontwarn javax.xml.stream.XMLStreamException
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

## Play Core (deferred components)
-dontwarn com.google.android.play.core.**
