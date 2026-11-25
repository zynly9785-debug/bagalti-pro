/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Copy,
  Check,
  Download,
  Terminal,
  Code2,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ANDROID_SOURCE_FILES, AndroidFile } from '../../data/androidSourceFiles.ts';
import JSZip from 'jszip';

export const AndroidCodeInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_SOURCE_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllAsZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();

      // Add all Android files with exact project paths
      ANDROID_SOURCE_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Add a helpful README for Android Studio & CLI/Phone building
      const readme = `# مشروع إدارة البقالة الذكي - بقالتي برو (Android Native POS)
مطور بلغة Java النقية وواجهات XML المتوافقة مع أندرويد ستوديو وموجه الأوامر (بدون Kotlin / Jetpack Compose).

## تعليمات التشغيل في بيئة الهاتف أو الطرفية (Termux / AndroidIDE / Linux CLI):
1. تأكد من أنك داخل المجلد الرئيسي الذي يحتوي على ملف \`gradlew\` و \`settings.gradle\` باستخدام الأمر:
   \`\`\`bash
   pwd
   ls -la
   \`\`\`
2. امنح ملف \`gradlew\` صلاحية التنفيذ (Execute permission):
   \`\`\`bash
   chmod +x ./gradlew
   \`\`\`
3. لبناء التطبيق بصيغة APK للتجربة:
   \`\`\`bash
   ./gradlew assembleDebug
   \`\`\`
4. ستجد ملف الـ APK الناتج في المسار:
   \`app/build/outputs/apk/debug/app-debug.apk\`

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

## بوابة إدارة مالك التطبيق:
- لا تُحفظ كلمة مرور الإدارة أو إجابة استرداد داخل التطبيق أو مستودع المصدر.
- تتطلب البوابة حساباً موثقاً وصلاحية platform_owner في خدمة Supabase.
`;
      zip.file('README_ANDROID_STUDIO.md', readme);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GroceryPOS_Android_Native_Project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingZip(false);
    }
  };

  const categories = [
    { id: 'database', label: 'قاعدة البيانات (SQLite)', icon: Layers },
    { id: 'activities', label: 'الشاشات (Java Activities)', icon: Code2 },
    { id: 'layouts', label: 'الواجهات (XML Layouts)', icon: FileCode },
    { id: 'values', label: 'الألوان والنصوص (Values)', icon: FileText },
    { id: 'manifest', label: 'ملف البيان (Manifest)', icon: Terminal },
    { id: 'gradle', label: 'إعدادات البناء (Gradle)', icon: Terminal },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-[#0E1714] text-gray-200 overflow-hidden border border-emerald-950/40 rounded-3xl shadow-2xl">
      {/* Sidebar: File Explorer Tree */}
      <div className="w-full md:w-80 bg-[#06120E] border-l border-emerald-900/30 flex flex-col h-72 md:h-full">
        {/* Top Header of Sidebar */}
        <div className="p-4 border-b border-emerald-900/30 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-emerald-300 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-[#C9A961]" />
              <span>مستكشف ملفات أندرويد</span>
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">مشروع Android Studio كامل (Java & XML)</p>
          </div>

          <button
            onClick={handleDownloadAllAsZip}
            disabled={downloadingZip}
            title="تحميل جميع الملفات بصيغة ZIP جاهزة للأندرويد ستوديو"
            className="bg-[#C9A961] hover:bg-[#e0be75] text-[#0B3D2E] p-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{downloadingZip ? 'جاري الضغط...' : 'تحميل ZIP'}</span>
          </button>
        </div>

        {/* Files Tree List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {categories.map((cat) => {
            const files = ANDROID_SOURCE_FILES.filter((f) => f.category === cat.id);
            if (files.length === 0) return null;
            const IconComp = cat.icon;

            return (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-[#C9A961] uppercase tracking-wider">
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </div>

                <div className="space-y-0.5 pr-2">
                  {files.map((file) => {
                    const isSelected = selectedFile.path === file.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-right px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-[#0B3D2E] text-white font-bold border border-[#C9A961]/50 shadow-xs'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-emerald-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                              file.language === 'java'
                                ? 'bg-orange-950 text-orange-400'
                                : file.language === 'xml'
                                ? 'bg-blue-950 text-blue-400'
                                : file.language === 'shell'
                                ? 'bg-purple-950 text-purple-300'
                                : file.language === 'properties'
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-emerald-950 text-emerald-400'
                            }`}
                          >
                            {file.language.toUpperCase()}
                          </span>
                          <span className="truncate">{file.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Code View Area */}
      <div className="flex-1 flex flex-col h-full bg-[#081711] overflow-hidden">
        {/* Code View Header */}
        <div className="p-4 bg-[#0B2117] border-b border-emerald-900/40 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white font-mono">{selectedFile.name}</span>
              <span className="text-[10px] font-mono text-gray-400 bg-black/40 px-2 py-0.5 rounded-md">
                {selectedFile.path}
              </span>
            </div>
            <p className="text-xs text-emerald-300 mt-1">{selectedFile.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="bg-emerald-900/60 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-700/50 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#C9A961]" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-emerald-100 bg-[#050D0A] leading-relaxed select-text" dir="ltr">
          <pre className="tab-4">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
