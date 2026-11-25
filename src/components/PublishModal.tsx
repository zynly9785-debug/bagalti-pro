/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Download,
  Terminal,
  Sparkles,
  CheckCircle2,
  Package,
  KeyRound,
  ShieldAlert,
  FileArchive,
  ArrowDownToLine,
  FolderCode,
  FileCode,
  Globe,
} from 'lucide-react';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToCodeTab: () => void;
  initialTab?: 'download' | 'apk' | 'owner' | 'link';
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'download',
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'apk' | 'owner' | 'link'>(initialTab);
  const [copiedDevLink, setCopiedDevLink] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!isOpen) return null;

  const devAppUrl = 'https://ais-dev-jmsewq6eu6wd22tiytbrnm-199478499524.europe-west2.run.app';

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleCopyDevLink = () => {
    navigator.clipboard.writeText(devAppUrl);
    setCopiedDevLink(true);
    setTimeout(() => setCopiedDevLink(false), 2500);
  };

  const buildCommand = `cd "/storage/emulated/0/GroceryPOS_Android_Native_Project" && ./gradlew assembleDebug`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(buildCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF8F3] border-2 border-[#C9A961] rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-right">
        {/* Header */}
        <div className="bg-[#0B3D2E] text-white p-5 rounded-t-[22px] flex items-center justify-between border-b border-[#C9A961]/40 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A961] text-[#0B3D2E] flex items-center justify-center font-black shadow-md">
              <FolderCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>بقالتي برو • مجلد الأكواد وحزم النشر والـ APK</span>
                <span className="bg-[#C9A961] text-[#0B3D2E] text-[10px] font-black px-2 py-0.5 rounded-full">
                  النسخة النظيفة 100%
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                تم مسح كافة البيانات التجريبية، الملفات جاهزة للاستخدام والإنتاج الفعلي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="p-3 bg-emerald-950/5 border-b border-gray-200 flex flex-wrap gap-2 sticky top-[73px] z-10 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('download')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              activeTab === 'download'
                ? 'bg-[#0B3D2E] text-white shadow-md'
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Download className="w-4 h-4 text-[#C9A961]" />
            <span>1. تحميل مجلدات وأكواد التطبيق (.ZIP)</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              activeTab === 'apk'
                ? 'bg-[#0B3D2E] text-white shadow-md'
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-[#C9A961]" />
            <span>2. طريقة بناء APK وتثبيته ونشره</span>
          </button>

          <button
            onClick={() => setActiveTab('owner')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              activeTab === 'owner'
                ? 'bg-[#0B3D2E] text-white shadow-md'
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <KeyRound className="w-4 h-4 text-[#C9A961]" />
            <span>3. الباب السري للمالك العام</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* TAB 1: DOWNLOAD CODE PACKAGES */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[#0B3D2E] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>تم تجهيز 3 حزم مضغوطة نظيفة 100% للتنزيل المباشر:</span>
                  </h3>
                  <span className="text-[10px] font-bold bg-emerald-700 text-white px-2.5 py-0.5 rounded-full">
                    خالية من أي بيانات تجريبية
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  تم مسح كافة البيانات الوهمية والتجريبية من النظام (أصناف، عملاء، فواتير، وديون سابقة). التطبيق الآن يبدأ بسجل نظيف فارغ تسجل فيه بياناتك الحقيقية.
                </p>
              </div>

                            {/* Package 1: v1.4.6 Complete Source Code ZIP */}
              <div className="bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-sm space-y-3 hover:border-emerald-600 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                      <FolderCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-[#0B3D2E]">
                        حزمة سورس كود الإصدار 1.4.6 الشاملة (bagalti-pro-v1.4.6.zip)
                      </h4>
                      <span className="text-[11px] text-gray-500">
                        يشمل: كافة ملفات التحديث (مشاركة بدون إنترنت، أسماء 4 حقول مركبة، قاعدة البيانات)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    الإصدار الأحدث v1.4.6
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  تحميل الحزمة المضغوطة الكاملة المحدثة للإصدار 1.4.6 جاهزة للاستخدام والاستنساخ والرفع اليدوي إلى المستودع الحالي.
                </p>
                <div className="pt-1">
                  <a
                    href="/bagalti-pro-v1.4.6.zip"
                    download="bagalti-pro-v1.4.6.zip"
                    className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-[#C9A961]" />
                    <span>تحميل حزمة سورس كود الإصدار 1.4.6 (bagalti-pro-v1.4.6.zip)</span>
                  </a>
                </div>
              </div>

              {/* Package 2: Full Source Code Repository */}
              <div className="bg-white border-2 border-amber-400 rounded-2xl p-5 shadow-sm space-y-3 hover:border-amber-500 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                      <FolderCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-gray-900">
                        مشروع التطبيق الكامل الجاهز لـ GitHub وبناء APK تلقائياً
                      </h4>
                      <span className="text-[11px] text-gray-500">
                        يشمل: .github/workflows/build-apk.yml + مجلد android (Capacitor) + src + public
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                    جاهز لـ GitHub
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  ارفع محتويات هذا الملف إلى مستودع GitHub، وسيقوم <strong>GitHub Actions</strong> تلقائياً ببناء التطبيق وتوليد ملف <strong>app-debug.apk</strong> جاهز للتحميل من تبويب Actions!
                </p>
                <div className="pt-1">
                  <a
                    href="/BaqalatyPro_Full_Source_Code.zip"
                    download="BaqalatyPro_Full_Source_Code.zip"
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-[#C9A961] hover:from-amber-700 hover:to-[#be9c4e] text-[#0B3D2E] font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>تحميل حزمة GitHub الكاملة لبناء APK (BaqalatyPro_Full_Source_Code.zip)</span>
                  </a>
                </div>
              </div>

              {/* Package 2: Web2APK Clean Package */}
              <div className="bg-white border-2 border-emerald-600/40 rounded-2xl p-5 shadow-sm space-y-3 hover:border-emerald-600 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-[#0B3D2E]">
                        حزمة الويب النظيفة الجاهزة لبناء APK فوري (Web2APK Clean)
                      </h4>
                      <span className="text-[11px] text-gray-500">
                        ملف index.html النظيف الشامل + manifest.json + الأيقونات
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    23 KB (.zip)
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  الحزمة المثالية لرفعها إلى مواقع تحويل الـ ZIP إلى APK مجاناً (مثل PWABuilder أو AppsGeyser) لتنزيل ملف <code className="font-mono text-[#0B3D2E] font-bold">BaqalatyPro.apk</code> في دقيقة واحدة!
                </p>
                <div className="pt-1">
                  <a
                    href="/BaqalatyPro_Web2APK_Clean.zip"
                    download="BaqalatyPro_Web2APK_Clean.zip"
                    className="w-full py-2.5 px-4 bg-[#0B3D2E] hover:bg-[#134937] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-[#C9A961]" />
                    <span>تحميل حزمة الويب لبناء APK النظيف (BaqalatyPro_Web2APK_Clean.zip)</span>
                  </a>
                </div>
              </div>

              {/* Package 3: Native Android Studio Project */}
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-emerald-600 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-800 flex items-center justify-center font-bold">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-gray-900">
                        مشروع أندرويد ستوديو الأصلي (Android Studio / AIDE Native Clean)
                      </h4>
                      <span className="text-[11px] text-gray-500">
                        كود Java نقي + واجهات XML + قاعدة بيانات SQLite + ملفات Gradle
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                    43 KB (.zip)
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  مشروع أندرويد نيتف كامل جاهز للفتح في Android Studio على الكمبيوتر أو تطبيق AndroidIDE على الهاتف لبناء حزم debug.apk أو release.apk أو حزمة النشر لمتجر جوجل بلاي (.aab).
                </p>
                <div className="pt-1">
                  <a
                    href="/BaqalatyPro_Android_Native_Clean.zip"
                    download="BaqalatyPro_Android_Native_Clean.zip"
                    className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-[#C9A961]" />
                    <span>تحميل سورس كود أندرويد ستوديو النظيف (BaqalatyPro_Android_Native_Clean.zip)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOW TO BUILD APK */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-[#0B3D2E] flex items-center gap-2 border-b pb-2">
                <Sparkles className="w-4 h-4 text-[#C9A961]" />
                <span>كيف تبني ملف APK حقيقي وتثبته على هاتفك وتنشره للمستخدمين؟</span>
              </h4>

              {/* Method 1: Phone */}
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2.5">
                <div className="font-bold text-amber-950 flex items-center justify-between text-xs">
                  <span>الطريقة 1 (الأسهل عبر الهاتف وبدون برامج): مواقع تحويل الـ ZIP إلى APK</span>
                  <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">دقيقة واحدة</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 pr-1">
                  <li>حمّل ملف <strong>BaqalatyPro_Web2APK_Clean.zip</strong> من التبويب السابق.</li>
                  <li>
                    افتح موقع <strong>PWABuilder.com</strong> أو <strong>AppsGeyser.com</strong> (اختر خيار ZIP App).
                  </li>
                  <li>ارفع ملف الـ ZIP واضغط <strong>Build APK</strong>.</li>
                  <li>سيتم تنزيل ملف <strong>BaqalatyPro.apk</strong> فوراً في مجلد التنزيلات بهاتفك.</li>
                  <li>ثبّته مباشرة، وشاركه في مجموعات الواتساب أو تيليجرام لأي شخص ليقوم بتثبيته بضغطة زر.</li>
                </ol>
              </div>

              {/* Method 2: Android Studio */}
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2 text-xs">
                <div className="font-bold text-blue-950 flex items-center justify-between">
                  <span>الطريقة 2 (عبر الحاسوب): Android Studio</span>
                  <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded text-[10px]">للمطورين</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 pr-1">
                  <li>فك ضغط ملف <strong>BaqalatyPro_Android_Native_Clean.zip</strong>.</li>
                  <li>افتح Android Studio واختر <strong>File &gt; Open</strong> وحدد المجلد.</li>
                  <li>اضغط من القائمة العلوية على: <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.</li>
                  <li>ستجد ملف APK الناتج في المسار: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[#0B3D2E] font-bold">app/build/outputs/apk/debug/app-debug.apk</code>.</li>
                </ol>
              </div>

              {/* Method 3: Command */}
              <div className="p-4 bg-gray-100 rounded-2xl border border-gray-200 space-y-2 text-xs">
                <div className="font-bold text-gray-900 flex items-center justify-between">
                  <span>الطريقة 3: في تطبيق AndroidIDE على الهاتف</span>
                  <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded text-[10px]">سطر الأوامر</span>
                </div>
                <div className="p-2.5 bg-gray-900 text-emerald-400 font-mono text-xs rounded-xl flex items-center justify-between gap-2 overflow-x-auto" dir="ltr">
                  <span className="truncate">{buildCommand}</span>
                  <button
                    onClick={handleCopyCommand}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md shrink-0 transition"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OWNER SECRET */}
          {activeTab === 'owner' && (
            <div className="space-y-4">
              <div className="bg-amber-50/90 rounded-2xl p-5 border-2 border-amber-300 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-700" />
                    <span>بوابة إدارة مالك التطبيق:</span>
                  </h4>
                  <span className="text-[10px] font-bold bg-[#0B3D2E] text-[#C9A961] px-2 py-0.5 rounded-full">
                    ميزة حصرية للمالك
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  تُتحقق صلاحية الدخول عبر حساب منصة موثّق في Supabase، ولا توجد كلمة مرور أو إجابة استرداد ثابتة داخل التطبيق.
                </p>

                <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs text-gray-700">
                  <strong className="text-[#0B3D2E]">الأمان:</strong> لا تُضمّن بيانات اعتماد الإدارة في ملف APK أو ملفات المصدر. يجب إنشاء حساب المنصة وتعيين صلاحية platform_owner من لوحة Supabase الموثوقة.
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs text-gray-700 space-y-1">
                  <strong className="text-[#0B3D2E] block">صلاحياتك من لوحة المالك:</strong>
                  <ul className="list-disc list-inside space-y-0.5 pr-2 text-gray-600">
                    <li>تفعيل أو تجميد أي متجر مسجل.</li>
                    <li>تعديل أيام الاشتراك وتصفيرها أو تمديدها بحرية تامة.</li>
                    <li>إدارة وتعديل أسعار الباقات الشهرية والسنوية.</li>
                    <li>الاطلاع على إحصائيات النظام الشاملة.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100/90 p-4 rounded-b-[22px] border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0">
          <span className="text-[11px] text-gray-500 font-medium">
            تطبيق بقالتي برو (Baqalaty Pro) © 2026 • نسخة الإنتاج النظيفة
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
