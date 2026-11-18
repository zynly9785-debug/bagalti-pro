import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Scan, AlertCircle, Flashlight } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { db } from '../../db/sqlite-simulation.ts';

interface BarcodeScannerModalProps {
  storeId: number;
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ storeId, isOpen, onClose, onBarcodeDetected }) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
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
    return () => { if (!isOpen) stopCamera(); };
    // A fresh reader is created per open; closing stops its video track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startCamera = async () => {
    if (startingRef.current || controlsRef.current) return;
    startingRef.current = true;
    handledRef.current = false;
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('هذا النظام لا يتيح للمتصفح الوصول إلى الكاميرا. حدّث WebView/المتصفح أو استخدم ماسح باركود خارجي.');
      }
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 1000 });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current ?? undefined,
        (result, scanError) => {
          if (result && !handledRef.current) {
            handledRef.current = true;
            const value = result.getText().trim();
            if (value) {
              if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
              controlsRef.current?.stop();
              onBarcodeDetected(value);
            }
          } else if (scanError && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(scanError.name)) {
            // These reader exceptions are normal while no code is in frame. Only surface camera failures.
            if (/permission|camera|device|media|constraint/i.test(scanError.name + ' ' + scanError.message)) {
              setCameraError(scanError.message || 'تعذر قراءة الكاميرا. تحقق من إذن الكاميرا ثم حاول مجدداً.');
            }
          }
        },
      );
      controlsRef.current = controls;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (!handledRef.current) {
          controls.stop();
          controlsRef.current = null;
          setCameraActive(false);
          setCameraError('انتهت مهلة البحث ولم يُعثر على باركود. حرك الرمز أو أدخل الكود يدوياً ثم أعد التشغيل.');
        }
      }, 30000);
      if (!handledRef.current) setCameraActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تشغيل الكاميرا';
      setCameraError(/NotAllowed|Permission|denied/i.test(message)
        ? 'إذن الكاميرا مرفوض. اسمح للتطبيق باستخدام الكاميرا من إعدادات الهاتف ثم أعد المحاولة.'
        : message);
      setCameraActive(false);
    } finally { startingRef.current = false; }
  };

  const stopCamera = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    startingRef.current = false;
    setCameraActive(false);
    setTorchOn(false);
  };

  const handleClose = () => { stopCamera(); onClose(); };
  const submitManualCode = () => {
    const code = manualCode.trim();
    if (code) { handledRef.current = true; stopCamera(); onBarcodeDetected(code); }
  };
  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      if (!controlsRef.current?.switchTorch) { setCameraError('الفلاش غير مدعوم في هذه الكاميرا؛ قرّب المنتج إلى مصدر إضاءة.'); return; }
      await controlsRef.current.switchTorch(next);
      setTorchOn(next);
    } catch { setCameraError('تعذر تشغيل الفلاش على هذا الجهاز.'); }
  };
  const handlePhotoFallback = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    setReadingPhoto(true);
    setCameraError(null);
    const imageUrl = URL.createObjectURL(file);
    try {
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(imageUrl);
      const value = result.getText().trim();
      if (!value) throw new Error('لم يُعثر على باركود واضح في الصورة؛ جرّب صورة أقرب وأكثر إضاءة.');
      onBarcodeDetected(value);
    } catch (error) {
      setCameraError(error instanceof Error && /No MultiFormat Readers|NotFound/i.test(error.message)
        ? 'لم يُعثر على باركود. قرّب الرمز وامنع الوهج ثم أعد التصوير.'
        : error instanceof Error ? error.message : 'تعذرت قراءة الصورة؛ حاول مرة أخرى.');
    } finally { URL.revokeObjectURL(imageUrl); setReadingPhoto(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#C9A961]/40 flex flex-col">
        <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Scan className="w-5 h-5 text-[#C9A961]"/><h3 className="font-bold text-sm">ماسح باركود مضمّن</h3></div>
          <button onClick={handleClose} aria-label="إغلاق الماسح" className="p-1 text-white/80 hover:text-white rounded-full hover:bg-white/10"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative w-full h-56 bg-black rounded-2xl overflow-hidden border-2 border-[#C9A961]">
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraActive ? '' : 'opacity-0'}`} />
            {!cameraActive && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"><Camera className="w-10 h-10 text-gray-400"/><p className="text-xs text-white/80">وجّه كاميرا الهاتف إلى الباركود</p><button onClick={() => void startCamera()} className="bg-[#C9A961] text-[#0B3D2E] font-bold text-xs px-4 py-2 rounded-xl">تشغيل الكاميرا / إعادة المحاولة</button></div>}
            {cameraActive && <><div className="absolute inset-x-7 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_red] animate-pulse"/><button onClick={() => void toggleTorch()} aria-label="الفلاش" className="absolute bottom-2 left-2 rounded-full bg-black/60 p-2 text-white"><Flashlight className={`w-5 h-5 ${torchOn ? 'text-yellow-300' : ''}`}/></button></>}
          </div>
          <p className="text-center text-[10px] text-gray-500">المسح يعمل محلياً داخل التطبيق ولا يحتاج إلى تنزيل وحدة Google أو اتصال إنترنت.</p>
          {cameraError && <div role="alert" className="flex items-start gap-1.5 p-2 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/><span>{cameraError}</span></div>}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#0B3D2E] bg-white py-2 text-xs font-bold text-[#0B3D2E]">{readingPhoto ? 'جارٍ تحليل الصورة…' : 'التقاط صورة للباركود (بديل)'}<input type="file" accept="image/*" capture="environment" onChange={handlePhotoFallback} className="hidden" disabled={readingPhoto}/></label>
          {!cameraActive && activeProducts.length > 0 && <div className="max-h-28 overflow-y-auto space-y-1"><p className="text-[10px] text-gray-500">اختر صنفاً موجوداً أثناء اختبار التطبيق:</p>{activeProducts.slice(0, 8).map(p => <button key={p.id} onClick={() => { stopCamera(); onBarcodeDetected(p.barcode); }} className="w-full text-right p-2 rounded-lg bg-white border text-xs">{p.name} — <span className="font-mono">{p.barcode}</span></button>)}</div>}
          <div className="pt-2 border-t border-gray-200 flex gap-2">
            <input type="text" inputMode="numeric" placeholder="أو أدخل الباركود يدوياً..." value={manualCode} onChange={e => setManualCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitManualCode(); }} className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-[#0B3D2E]"/>
            <button disabled={!manualCode.trim()} onClick={submitManualCode} className="bg-[#0B3D2E] text-white text-xs px-3 py-2 rounded-xl font-bold disabled:opacity-50">تحقق</button>
          </div>
        </div>
      </div>
    </div>
  );
};
