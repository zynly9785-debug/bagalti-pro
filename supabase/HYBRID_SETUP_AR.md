# إعداد التخزين الهجين — بقالتي برو

## المشروع السحابي
- Project ref: `unylexdkocktkzwvawsu`.
- أنشئ المشروع بعد موافقة المستخدم على عرض التكلفة البالغ 0 شهرياً. هذا عرض التكلفة وقت الإنشاء وليس ضماناً بأن استهلاك الخدمات أو تجاوز الحصص لن يترتب عليه تكلفة لاحقاً.
- طُبّق المخطط `20261114010000_bagalati_hybrid_schema.sql`: ملفات المتاجر والعضويات والحزم وسجل أحداث الاشتراك وسجل مزامنة محكوم بـ Row Level Security.
- أظهر فحص Supabase security advisors عدم وجود lints في آخر فحص.
- مفتاح عميل Supabase هو **publishable key فقط**، ويحفظه سير بناء GitHub في `VITE_SUPABASE_PUBLISHABLE_KEY`. لا يُسمح بإضافة `service_role` أو secret key إلى APK أو ملفات العميل.

## قاعدة الجهاز
- Android يستخدم إضافة Capacitor SQLite مع SQLCipher؛ تُنشأ كلمة مرور عشوائية عند أول فتح وتحفظها الإضافة في مخزن النظام الآمن، ثم تفتح قاعدة `bagalati_pro` المشفرة.
- توجد جداول صفوف كيان SQLite ومؤشرات metadata وpreferences. التغييرات تُكتب بتغييرات صفّية ضمن transactions بدلاً من نسخ كتلة JSON على كل تعديل.
- أول تشغيل يهاجر بيانات snapshot القديمة من localStorage إلى SQLite قبل عرض التطبيق، وبعد نجاح الحفظ يزيل مفاتيح المصدر القديمة. إذا تعذر فتح قاعدة البيانات، لا يعرض التطبيق واجهة تسمح بالكتابة إلى مخزن بديل صامت.
- تطبيق الويب/المحاكي يبقى على localStorage؛ قاعدة SQLite المشفرة خاصة بمنصة Android native.

## المزامنة والنسخ السحابي
- يحتوي التطبيق على مزامنة صفّية `sync_records` ونسخ/استعادة كاملة عبر جدول `cloud_backups`.
- طُبّق migration `20261119000000_cloud_backups.sql` على مشروع Supabase؛ الجدول محمي بثلاث سياسات RLS تستخدم `private.is_store_member`، والوصول المجهول مرفوض.
- النسخ السحابي يزيل حقلي كلمة المرور ورمز PIN من سجلات المستخدم قبل رفعها. اختبر الاستعادة على جهاز تجريبي قبل الاعتماد على النسخ كوسيلة وحيدة للحفظ.
- إعداد مفتاح `VITE_SUPABASE_PUBLISHABLE_KEY` لا يفعّل SMS؛ تسجيل الدخول لا يرسل OTP.

## حدود قبل إعلان مزامنة الإنتاج
- يلزم اختبار المزامنة والاستعادة بحسابي متجرين مستقلين وعلى أجهزة Android فعلية قبل اعتمادها إنتاجياً.
- لم يُضبط SMS provider في مشروع Supabase. إنشاء حساب بالهاتف مع التحقق عبر OTP يحتاج إعداد مزود رسائل (مثل Twilio أو مزود متوافق) وقد يضيف كلفة رسائل. يجب اختيار التدفق قبل جعل التسجيل السحابي فعلياً.
- لا يتم تشغيل إدارة مالك التطبيق على أساس كلمة ثابتة داخل APK. صلاحية `platform_owner` يجب أن يتحقق منها الخادم، وتُدار من حساب موثق.
- يلزم اختبار Android على جهاز فعلي لتأكيد عمل التشفير والترحيل، وتجربة المزامنة مع حسابي متجرين مستقلين قبل التوزيع العام.

## المراجع الرسمية التي روجعت
- Capacitor Community SQLite API: https://github.com/capacitor-community/sqlite/blob/master/docs/API.md
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Phone Login: https://supabase.com/docs/guides/auth/phone-login
- PowerSync client integration (مرجع معماري تمت مراجعته؛ لم يُدمج كاعتماد): https://docs.powersync.com/client-sdks/advanced-setup/client-side-integration
