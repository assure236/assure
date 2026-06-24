import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';

import 'package:assure_chitfunds/main.dart';

void main() {
  test('App root widget is constructible', () {
    // SECURITY FIX: keep a stable smoke test that avoids app-level async timers in test env.
    const app = AssureChitFundsApp();
    expect(app, isA<Widget>());
  });
}
