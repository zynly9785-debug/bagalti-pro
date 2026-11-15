import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { ANDROID_SOURCE_FILES } from '../src/data/androidSourceFiles.ts';

const IGNORED_NAMES = new Set(['node_modules', '.git', 'dist', '.cache', '.DS_Store', '.aistudio', '.gradle']);

function addDirectoryToZip(zip: JSZip, localDir: string, zipPrefix: string = '') {
  const items = fs.readdirSync(localDir);
  for (const item of items) {
    if (IGNORED_NAMES.has(item)) {
      continue;
    }
    const fullPath = path.join(localDir, item);
    const relPath = path.relative(path.resolve('.'), fullPath).replace(/\\/g, '/');

    // Exclude Gradle / Android build outputs and generated Capacitor web copy
    if (
      relPath === 'android/build' ||
      relPath === 'android/app/build' ||
      relPath === 'android/app/src/main/assets/public' ||
      relPath === 'android/capacitor-cordova-android-plugins/build'
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    const zipPath = zipPrefix ? `${zipPrefix}/${item}` : item;

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath);
    } else {
      if (item.endsWith('.zip')) continue;
      const content = fs.readFileSync(fullPath);
      const isExecutable = item === 'gradlew';
      zip.file(zipPath, content, isExecutable ? { unixPermissions: '755' } : undefined);
    }
  }
}

async function generateZips() {
  console.log('Generating GitHub & APK Ready ZIP packages...');

  const cleanReadme = `# مشروع بقالتي برو (Baqalaty Pro POS) - جاهز للرفع إلى GitHub وبناء APK تلقائياً

هذه الحزمة جاهزة تماماً للرفع إلى مستودع GitHub وبناء ملف APK تلقائياً عبر GitHub Actions (Capacitor + Gradle).
تم مسح كافة البيانات التجريبية لتبدأ بقاعدة بيانات إنتاجية نظيفة تماماً.

---

## طريقة النشر وبناء APK تلقائياً على GitHub:
1. فك ضغط ملف \`BaqalatyPro_Full_Source_Code.zip\`.
2. ارفع الملفات (بما فيها مجلد \`.github/workflows/build-apk.yml\` ومجلد \`android/\`) إلى مستودع GitHub جديد على الفرع \`main\`.
3. ادخل إلى تبويب **Actions** في صفحتك على GitHub.
4. انتظر انتهاء مهمة **Build Baqalaty Pro Android APK** (حوالي دقيقتين).
5. من قسم **Artifacts** في أسفل صفحة المهمة، حمّل ملف **BaqalatyPro-Android-APK** الذي يحتوي على ملف \`app-debug.apk\` الجاهز للتثبيت والنشر!
`;

  // 1. Android Studio Java/XML Clean Project ZIP
  const androidZip = new JSZip();
  for (const file of ANDROID_SOURCE_FILES) {
    const isExecutable = file.path === 'gradlew';
    androidZip.file(file.path, file.content, isExecutable ? { unixPermissions: '755' } : undefined);
  }
  androidZip.file('README_PRODUCTION.md', cleanReadme);

  const nativeBuffer = await androidZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.resolve('public', 'BaqalatyPro_Android_Native_Clean.zip'), nativeBuffer);
  console.log(`Saved BaqalatyPro_Android_Native_Clean.zip (${nativeBuffer.length} bytes)`);

  // 2. Web2APK Clean Standalone Package ZIP
  const webZip = new JSZip();
  const indexHtmlContent = fs.readFileSync(path.resolve('public', 'index_complete.html'), 'utf8');
  webZip.file('index.html', indexHtmlContent);

  if (fs.existsSync(path.resolve('public', 'manifest.json'))) {
    webZip.file('manifest.json', fs.readFileSync(path.resolve('public', 'manifest.json'), 'utf8'));
  }
  if (fs.existsSync(path.resolve('public', 'icon-192.svg'))) {
    webZip.file('icon-192.svg', fs.readFileSync(path.resolve('public', 'icon-192.svg'), 'utf8'));
  }
  if (fs.existsSync(path.resolve('public', 'icon-512.svg'))) {
    webZip.file('icon-512.svg', fs.readFileSync(path.resolve('public', 'icon-512.svg'), 'utf8'));
  }
  webZip.file('README_INSTRUCTIONS.md', cleanReadme);

  const webBuffer = await webZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.resolve('public', 'BaqalatyPro_Web2APK_Clean.zip'), webBuffer);
  console.log(`Saved BaqalatyPro_Web2APK_Clean.zip (${webBuffer.length} bytes)`);

  // 3. Complete GitHub-Ready + Capacitor Android Source Code ZIP
  const fullCodeZip = new JSZip();
  console.log('Packaging GitHub-ready source code + Capacitor Android + GitHub Actions...');
  addDirectoryToZip(fullCodeZip, path.resolve('.'), '');

  const fullCodeBuffer = await fullCodeZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fullCodeZipPath = path.resolve('public', 'BaqalatyPro_Full_Source_Code.zip');
  fs.writeFileSync(fullCodeZipPath, fullCodeBuffer);
  console.log(`Saved BaqalatyPro_Full_Source_Code.zip (${fullCodeBuffer.length} bytes)`);

  console.log('All ZIP packages generated successfully!');
}

generateZips().catch(console.error);
