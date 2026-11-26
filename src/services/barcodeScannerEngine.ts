/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export const SUPPORTED_BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

const NATIVE_DETECTOR_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
];

export interface BarcodeScannerSession {
  stop: () => void;
  toggleTorch: (enabled: boolean) => Promise<boolean>;
  isTorchSupported: () => boolean;
}

export interface StartBarcodeScannerOptions {
  videoElement: HTMLVideoElement;
  onDetected: (barcode: string) => void;
  onCameraError?: (arabicMessage: string) => void;
  onReady?: () => void;
  continuous?: boolean;
  scanIntervalMs?: number;
}

let audioCtx: AudioContext | null = null;

export function playScanBeep(soundEnabled = true): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(55);
    } catch {
      // ignore vibration block
    }
  }
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!audioCtx) audioCtx = new AudioContextCtor();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => undefined);
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.11);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // ignore audio block
  }
}

export function playScanAlertBeep(soundEnabled = true): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([40, 40, 40]);
    } catch {
      // ignore
    }
  }
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!audioCtx) audioCtx = new AudioContextCtor();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => undefined);
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.19);
  } catch {
    // ignore
  }
}

export function createConfiguredReader(scanIntervalMs = 190): BrowserMultiFormatReader {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_BARCODE_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: scanIntervalMs,
    delayBetweenScanSuccess: 300,
  });
}

async function ensureNativeCameraPermission(): Promise<boolean> {
  try {
    const cap = (window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    }).Capacitor;

    if (!cap?.isNativePlatform || !cap.isNativePlatform()) {
      return true;
    }

    const modName = '@capacitor/camera';
    const cameraMod = await (new Function('p', 'return import(p)')(modName) as Promise<{
      Camera?: {
        checkPermissions?: () => Promise<{ camera?: string }>;
        requestPermissions?: (opts?: { permissions?: string[] }) => Promise<{ camera?: string }>;
      };
    }>).catch(() => null);

    const Camera = cameraMod?.Camera;
    if (!Camera?.checkPermissions || !Camera?.requestPermissions) {
      return true;
    }

    const status = await Camera.checkPermissions();
    if (status?.camera === 'granted') {
      return true;
    }

    const req = await Camera.requestPermissions({ permissions: ['camera'] });
    return req?.camera === 'granted' || req?.camera === 'limited';
  } catch {
    return true;
  }
}

function mapCameraErrorToArabic(error: unknown): string {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error || '');
  if (/NotAllowed|Permission|denied/i.test(msg)) {
    return 'تعذر الوصول إلى الكاميرا. تأكد من منح صلاحية الكاميرا للتطبيق من إعدادات الهاتف ثم أعد المحاولة.';
  }
  if (/NotFound|Requested device not found|no camera|DevicesNotFound/i.test(msg)) {
    return 'لم يتم العثور على كاميرا متصلة في هذا الجهاز. يمكنك إدخال الباركود يدوياً أو عبر ماسح خارجي.';
  }
  if (/NotReadable|TrackStartError|in use/i.test(msg)) {
    return 'الكاميرا مستخدمة حالياً في تطبيق آخر. أغلق التطبيق الآخر ثم أعد المحاولة.';
  }
  return 'تعذر تشغيل الكاميرا. تحقق من الأذونات أو أدخل الباركود يدوياً.';
}

async function applyOptimalTrackConstraints(videoElement: HTMLVideoElement): Promise<void> {
  try {
    const stream = videoElement.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    const caps = (typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}) as Record<string, unknown>;
    const advanced: Record<string, unknown> = {};
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      advanced.focusMode = 'continuous';
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advanced.exposureMode = 'continuous';
    }
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      advanced.whiteBalanceMode = 'continuous';
    }
    if (Object.keys(advanced).length > 0) {
      await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
    }
  } catch {
    // Graceful no-op when camera driver does not support advanced constraints
  }
}

function tryCreateNativeDetector(): { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } | null {
  try {
    const Ctor = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Ctor) return null;
    return new Ctor({ formats: NATIVE_DETECTOR_FORMATS });
  } catch {
    return null;
  }
}

function enhanceVideoFrameToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const sw = Math.max(160, Math.floor(vw * 0.84));
  const sh = Math.max(120, Math.floor(vh * 0.58));
  const sx = Math.floor((vw - sw) / 2);
  const sy = Math.floor((vh - sh) / 2);
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.filter = 'contrast(1.45) grayscale(1) brightness(1.06)';
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.filter = 'none';
  return true;
}

export async function startUnifiedBarcodeScanner(
  options: StartBarcodeScannerOptions,
): Promise<BarcodeScannerSession> {
  const {
    videoElement,
    onDetected,
    onCameraError,
    onReady,
    continuous = true,
    scanIntervalMs = 190,
  } = options;

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const errMsg = 'هذا المتصفح/النظام لا يدعم الوصول المباشر إلى الكاميرا. يمكنك استخدام الإدخال اليدوي أو ماسح خارجي.';
    onCameraError?.(errMsg);
    throw new Error(errMsg);
  }

  const permitted = await ensureNativeCameraPermission();
  if (!permitted) {
    const permMsg = 'تعذر الوصول إلى الكاميرا. تأكد من منح صلاحية الكاميرا للتطبيق من إعدادات الهاتف ثم أعد المحاولة.';
    onCameraError?.(permMsg);
    throw new Error(permMsg);
  }

  let stopped = false;
  let controls: IScannerControls | null = null;
  let enhanceTimer: number | null = null;
  let nativeTimer: number | null = null;
  const offscreenCanvas = document.createElement('canvas');
  const reader = createConfiguredReader(scanIntervalMs);
  const nativeDetector = tryCreateNativeDetector();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (enhanceTimer !== null) {
      window.clearInterval(enhanceTimer);
      enhanceTimer = null;
    }
    if (nativeTimer !== null) {
      window.clearInterval(nativeTimer);
      nativeTimer = null;
    }
    try {
      controls?.stop();
    } catch {
      // ignore
    }
    controls = null;
    const stream = videoElement.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }
    videoElement.srcObject = null;
  };

  const emitCode = (raw: string) => {
    const clean = raw.trim();
    if (!clean || stopped) return;
    if (!continuous) {
      stop();
    }
    onDetected(clean);
  };

  try {
    controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      videoElement,
      (result, scanError) => {
        if (stopped) return;
        if (result) {
          emitCode(result.getText());
          return;
        }
        if (
          scanError &&
          !['NotFoundException', 'ChecksumException', 'FormatException'].includes(scanError.name)
        ) {
          if (/permission|camera|device|media|constraint/i.test(`${scanError.name} ${scanError.message}`)) {
            onCameraError?.(mapCameraErrorToArabic(scanError));
          }
        }
      },
    );

    if (stopped) {
      stop();
      return {
        stop,
        toggleTorch: async () => false,
        isTorchSupported: () => false,
      };
    }

    await applyOptimalTrackConstraints(videoElement);
    onReady?.();

    if (nativeDetector) {
      nativeTimer = window.setInterval(() => {
        if (stopped || videoElement.readyState < 2) return;
        void nativeDetector
          .detect(videoElement)
          .then((codes) => {
            const first = codes.find((c) => typeof c.rawValue === 'string' && c.rawValue.trim().length > 0);
            if (first?.rawValue) emitCode(first.rawValue);
          })
          .catch(() => undefined);
      }, 240);
    }

    enhanceTimer = window.setInterval(() => {
      if (stopped || videoElement.readyState < 2) return;
      try {
        if (!enhanceVideoFrameToCanvas(videoElement, offscreenCanvas)) return;
        const result = reader.decodeFromCanvas(offscreenCanvas);
        if (result) emitCode(result.getText());
      } catch {
        // Expected on frames without readable code
      }
    }, 480);
  } catch (error) {
    stop();
    const arabicError = mapCameraErrorToArabic(error);
    onCameraError?.(arabicError);
    throw new Error(arabicError);
  }

  return {
    stop,
    isTorchSupported: () => Boolean(controls?.switchTorch),
    toggleTorch: async (enabled: boolean) => {
      if (!controls?.switchTorch) return false;
      try {
        await controls.switchTorch(enabled);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export async function decodeBarcodeFromImageFile(file: File): Promise<string> {
  const reader = createConfiguredReader(150);
  const imageUrl = URL.createObjectURL(file);
  try {
    try {
      const result = await reader.decodeFromImageUrl(imageUrl);
      const val = result.getText().trim();
      if (val) return val;
    } catch {
      // Retry via contrast-enhanced canvas
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذر تحميل الصورة'));
      el.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    canvas.width = Math.max(100, Math.round(img.width * scale));
    canvas.height = Math.max(100, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر معالجة الصورة');
    ctx.filter = 'contrast(1.5) grayscale(1)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const enhancedResult = reader.decodeFromCanvas(canvas);
    const text = enhancedResult.getText().trim();
    if (!text) throw new Error('لم يُعثر على باركود واضح في الصورة؛ قرّب الرمز وتجنب الوهج.');
    return text;
  } catch (error) {
    if (error instanceof Error && /No MultiFormat Readers|NotFound/i.test(error.message)) {
      throw new Error('لم يُعثر على باركود واضح في الصورة؛ قرّب الرمز وحاول بإضاءة أفضل.');
    }
    throw error instanceof Error ? error : new Error('تعذرت قراءة الباركود من الصورة.');
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
