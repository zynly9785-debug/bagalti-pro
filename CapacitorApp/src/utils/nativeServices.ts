import { Capacitor } from '@capacitor/core';
import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';
import { db } from '../db/sqlite-simulation.ts';

const BIOMETRIC_SERVER = 'com.baqalatypro.pos.login';
export async function isBiometricReady(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return (await NativeBiometric.isAvailable()).isAvailable; } catch { return false; }
}
export async function saveBiometricCredentials(phone: string, password: string): Promise<void> {
  const available = await NativeBiometric.isAvailable();
  if (!available.isAvailable) throw new Error('لا توجد بصمة/مصادقة حيوية مسجلة على هذا الهاتف.');
  // setCredentials shows the enrollment/authentication prompt itself. Do not call
  // verifyIdentity first: that caused two consecutive prompts on Android.
  await NativeBiometric.setCredentials({
    username: phone,
    password,
    server: BIOMETRIC_SERVER,
    accessControl: AccessControl.BIOMETRY_ANY,
    title: 'تفعيل الدخول ببصمة الهاتف',
    negativeButtonText: 'إلغاء',
    maxAttempts: 3,
  });
}
export async function loginWithBiometrics(): Promise<{ username: string; password: string }> {
  // The secure read performs one BiometricPrompt cryptographically bound to the key.
  return NativeBiometric.getSecureCredentials({
    server: BIOMETRIC_SERVER,
    title: 'الدخول إلى بقالتي برو',
    subtitle: 'استخدم بصمة الهاتف للدخول',
    negativeButtonText: 'استخدام كلمة المرور',
    maxAttempts: 3,
  });
}
export async function clearBiometricCredentials(): Promise<void> {
  if (Capacitor.isNativePlatform()) await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER }).catch(() => undefined);
}

function fileDateStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
export async function createLocalBackup(storeId: number): Promise<string> {
  const snapshot = db.getRawState();
  const zip = new JSZip();
  zip.file('grocery_pos_database.json', JSON.stringify({ app: 'بقالتي برو', version: 1, createdAt: new Date().toISOString(), storeId, data: snapshot }, null, 2));
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const name = `بقالتي برو/نسخة_${fileDateStamp()}.zip`;
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Documents, recursive: true });
    return `تم حفظ النسخة في مجلد مستندات التطبيق باسم ${name.split('/').pop()}`;
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name.split('/').pop()!; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return `تم تنزيل النسخة الاحتياطية باسم ${name.split('/').pop()}`;
}

export async function shareTextEverywhere(title: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text, dialogTitle: 'مشاركة عبر تطبيق آخر' });
    return;
  }
  if (navigator.share) { await navigator.share({ title, text }); return; }
  await navigator.clipboard.writeText(text);
}

export async function shareBackupEverywhere(storeId: number): Promise<void> {
  const snapshot = db.getRawState();
  const zip = new JSZip(); zip.file('grocery_pos_database.json', JSON.stringify({ app: 'بقالتي برو', version: 1, createdAt: new Date().toISOString(), storeId, data: snapshot }, null, 2));
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  if (!Capacitor.isNativePlatform()) { await createLocalBackup(storeId); return; }
  const name = `بقالتي برو/نسخة_${fileDateStamp()}.zip`;
  const result = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache, recursive: true });
  await Share.share({ title: 'نسخة بقالتي برو الاحتياطية', text: `نسخة بيانات المتجر ${storeId}`, files: [result.uri], dialogTitle: 'إرسال النسخة الاحتياطية' });
}
