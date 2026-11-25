# مشروع إدارة البقالة الذكي - بقالتي برو (Android Native POS)
مطور بلغة Java النقية وواجهات XML المتوافقة مع أندرويد ستوديو وموجه الأوامر (بدون Kotlin / Jetpack Compose).

## تعليمات التشغيل في بيئة الهاتف أو الطرفية (Termux / AndroidIDE / Linux CLI):
1. تأكد من أنك داخل المجلد الرئيسي الذي يحتوي على ملف `gradlew` و `settings.gradle` باستخدام الأمر:
   ```bash
   pwd
   ls -la
   ```
2. امنح ملف `gradlew` صلاحية التنفيذ (Execute permission):
   ```bash
   chmod +x ./gradlew
   ```
3. لبناء التطبيق بصيغة APK للتجربة:
   ```bash
   ./gradlew assembleDebug
   ```
4. ستجد ملف الـ APK الناتج في المسار:
   `app/build/outputs/apk/debug/app-debug.apk`

## تعليمات التشغيل في Android Studio:
1. قم بفك ضغط هذا المجلد في حاسوبك.
2. افتح Android Studio واختر: **File > Open** واختر مجلد المشروع.
3. انتظر انتهاء مزامنة Gradle (Sync Project with Gradle Files).
4. تأكد من توفر اتصال بالإنترنت لتحميل مكتبات:
   - ZXing: 'com.journeyapps:zxing-android-embedded:4.3.0'
   - Biometric: 'androidx.biometric:biometric:1.1.0'
   - Material Design: 'com.google.android.material:material:1.11.0'
5. شغّل التطبيق على محاكي أندرويد أو جهاز حقيقي!

## الألوان المعتمدة في التصميم:
- الأساسي: زمردي #0B3D2E
- الثانوي: ذهبي #C9A961
- الخلفية: عاجي #FAF8F3
- الخطر: أحمر #8B2E2E

## الميزات السرية:
- النقر 10 مرات متتالية على الشعار في LoginActivity يفتح بوابة المالك.
- بيانات دخول المالك يجب ضبطها وحفظها بأمان، وعدم تضمين كلمات مرور ثابتة داخل ملفات المشروع أو مستودع عام.
