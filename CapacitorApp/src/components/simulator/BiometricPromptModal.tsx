/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Fingerprint, CheckCircle, X, ShieldAlert } from 'lucide-react';

interface BiometricPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}

export const BiometricPromptModal: React.FC<BiometricPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'تأكيد البصمة البيومترية',
  subtitle = 'المس مستشعر البصمة للمتابعة والتحقق',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFingerprintTap = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 700);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl border border-gray-200 flex flex-col items-center p-6 text-center animate-in zoom-in-95 duration-200">
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>

        <div className="my-6">
          <button
            onClick={handleFingerprintTap}
            disabled={isScanning || success}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              success
                ? 'bg-emerald-100 text-emerald-600 scale-105'
                : isScanning
                ? 'bg-amber-100 text-[#C9A961] animate-pulse ring-4 ring-[#C9A961]/30'
                : 'bg-emerald-50 text-[#0B3D2E] hover:bg-emerald-100 hover:scale-105 active:scale-95'
            }`}
          >
            {success ? (
              <CheckCircle className="w-12 h-12" />
            ) : (
              <Fingerprint className="w-12 h-12" />
            )}
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mb-4">
          {success
            ? 'تمت المصادقة بنجاح!'
            : isScanning
            ? 'جاري قراءة البصمة...'
            : 'انقر على أيقونة البصمة أعلاه لمحاكاة المسح'}
        </p>

        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:text-gray-900 font-bold px-4 py-1.5 rounded-lg border border-gray-300"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
};
