import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Scan, AlertCircle, Flashlight, Volume2, VolumeX } from 'lucide-react';
import { db } from '../../db/sqlite-simulation.ts';
import {
  decodeBarcodeFromImageFile,
  playScanBeep,
  startUnifiedBarcodeScanner,
  type BarcodeScannerSession,
} from '../../services/barcodeScannerEngine.ts';

interface BarcodeScannerModalProps {
  storeId: number;
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  storeId,
  isOpen,
  onClose,
  onBarcodeDetected,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<BarcodeScannerSession | null>(null);
  const startingRef = useRef(false);
  const handledRef = useRef(false);
  const activeProducts = db.getProducts(storeId);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      handledRef.current = false;
      void startCamera();
    } else {
      stopCamera();
      setManualCode('');
      setCameraError(null);
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startCamera = async () => {
    if (startingRef.current || sessionRef.current || !videoRef.current) return;
    startingRef.current = true;
    handledRef.current = false;
    setCameraError(null);

    try {
      const session = await startUnifiedBarcodeScanner({
        videoElement: videoRef.current,
        continuous: false,
        scanIntervalMs: 180,
        onReady: () => {
          if (!handledRef.current) setCameraActive(true);
        },
        onCameraError: (arabicMsg) => {
          setCameraError(arabicMsg);
          setCameraActive(false);
        },
        onDetected: (value) => {
          if (handledRef.current) return;
          handledRef.current = true;
          if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
          playScanBeep(soundOn);
          stopCamera();
          onBarcodeDetected(value);
        },
      });

      sessionRef.current = session;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (!handledRef.current) {
          stopCamera();
          setCameraError('انتهت مهلة المسح دون قراءة رمز. وجّه الكاميرا للباركود أو أدخل الكود يدوياً ثم أعد المحاولة.');
        }
      }, 45000);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'تعذر تشغيل الكاميرا');
      setCameraActive(false);
    } finally {
      startingRef.current = false;
    }
  };

  const stopCamera = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    sessionRef.current?.stop();
    sessionRef.current = null;
    startingRef.current = false;
    setCameraActive(false);
    setTorchOn(false);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const submitManualCode = () => {
    const code = manualCode.trim();
    if (code) {
      handledRef.current = true;
      playScanBeep(soundOn);
      stopCamera();
      onBarcodeDetected(code);
    }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    if (!sessionRef.current?.isTorchSupported()) {
      setCameraError('الفلاش غير مدعوم على هذه الكاميرا؛ قرّب المنتج إلى مصدر إضاءة.');
      return;
    }
    const ok = await sessionRef.current.toggleTorch(next);
    if (ok) setTorchOn(next);
    else setCameraError('تعذر تبديل الفلاش على هذا الجهاز.');
  };

  const handlePhotoFallback = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    setReadingPhoto(true);
    setCameraError(null);
    try {
      const value = await decodeBarcodeFromImageFile(file);
      playScanBeep(soundOn);
      onBarcodeDetected(value);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'تعذرت قراءة الصورة؛ حاول مرة أخرى.');
    } finally {
      setReadingPhoto(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#C9A961]/40 flex flex-col">
        <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#C9A961]" />
            <h3 className="font-bold text-sm">ماسح الباركود الموحد</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-label={soundOn ? 'كتم صوت المسح' : 'تفعيل صوت المسح'}
              className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="إغلاق الماسح"
              className="p-1 text-white/80 hover:text-white rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative w-full h-56 bg-black rounded-2xl overflow-hidden border-2 border-[#C9A961]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? '' : 'opacity-0'}`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Camera className="w-10 h-10 text-gray-400" />
                <p className="text-xs text-white/80">وجّه كاميرا الهاتف إلى الباركود</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="bg-[#C9A961] text-[#0B3D2E] font-bold text-xs px-4 py-2 rounded-xl"
                >
                  تشغيل الكاميرا / إعادة المحاولة
                </button>
              </div>
            )}
            {cameraActive && (
              <>
                <div className="pointer-events-none absolute inset-6 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                </div>
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  aria-label="الفلاش"
                  className="absolute bottom-2 left-2 rounded-full bg-black/60 p-2 text-white"
                >
                  <Flashlight className={`w-5 h-5 ${torchOn ? 'text-yellow-300' : ''}`} />
                </button>
              </>
            )}
          </div>

          <p className="text-center text-[10px] text-gray-500">
            يدعم EAN-13 و EAN-8 و UPC و CODE-128 و CODE-39 و QR محلياً بدون إنترنت.
          </p>

          {cameraError && (
            <div
              role="alert"
              className="flex items-start gap-1.5 p-2 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#0B3D2E] bg-white py-2 text-xs font-bold text-[#0B3D2E]">
            {readingPhoto ? 'جارٍ تحليل الصورة…' : 'التقاط صورة للباركود (بديل)'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFallback}
              className="hidden"
              disabled={readingPhoto}
            />
          </label>

          {!cameraActive && activeProducts.length > 0 && (
            <div className="max-h-28 overflow-y-auto space-y-1">
              <p className="text-[10px] text-gray-500">اختيار صنف سريع عند عدم توفر كاميرا:</p>
              {activeProducts.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onBarcodeDetected(p.barcode);
                  }}
                  className="w-full text-right p-2 rounded-lg bg-white border text-xs"
                >
                  {p.name} — <span className="font-mono">{p.barcode}</span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-gray-200 flex gap-2">
            <input
              type="text"
              inputMode="text"
              placeholder="أو أدخل الباركود يدوياً..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitManualCode();
              }}
              className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-[#0B3D2E]"
            />
            <button
              type="button"
              disabled={!manualCode.trim()}
              onClick={submitManualCode}
              className="bg-[#0B3D2E] text-white text-xs px-3 py-2 rounded-xl font-bold disabled:opacity-50"
            >
              تحقق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
