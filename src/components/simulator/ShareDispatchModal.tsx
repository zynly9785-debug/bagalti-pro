/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  MessageCircle,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { db } from '../../db/sqlite-simulation.ts';
import {
  copyTextOffline,
  downloadTextFileOffline,
  formatShareOutcomeToast,
  shareTextEverywhere,
} from '../../utils/nativeServices.ts';
import { buildWhatsAppDirectUrl, normalizePhoneForWhatsApp } from '../../utils/customerLogic.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

interface ShareDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: number;
  customerId?: number | null;
  customerName?: string;
  targetPhone?: string;
  title: string;
  messageText: string;
  reference?: string;
  onOutboxChanged?: (toastMessage?: string) => void;
}

export const ShareDispatchModal: React.FC<ShareDispatchModalProps> = ({
  isOpen,
  onClose,
  storeId,
  customerId,
  customerName,
  targetPhone,
  title,
  messageText,
  reference,
  onOutboxChanged,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const normalizedPhone = normalizePhoneForWhatsApp(targetPhone);
  const whatsappUrl = buildWhatsAppDirectUrl(targetPhone, messageText);

  const recordOutbox = (
    channel: 'whatsapp' | 'system' | 'any',
    status: 'pending' | 'sent' | 'failed',
    errorMessage?: string,
  ) => {
    return db.enqueueShareOutbox(storeId, {
      customer_id: customerId ?? null,
      customer_name: customerName,
      customer_phone: targetPhone,
      title,
      message_text: messageText,
      channel,
      reference,
      status,
      error_message: errorMessage,
    });
  };

  const handleSaveForLater = (channel: 'whatsapp' | 'system' | 'any', note = 'محفوظ للمشاركة لاحقاً بدون إنترنت') => {
    recordOutbox(channel, 'pending', note);
    const msg = 'تم حفظ المحتوى في سجل المشاركات المحلي للرجوع إليه في أي وقت دون إنترنت.';
    setStatusNotice(msg);
    onOutboxChanged?.(msg);
  };

  const handleSystemShare = async () => {
    const entry = recordOutbox('system', 'pending');
    try {
      const outcome = await shareTextEverywhere(title, messageText);
      db.updateShareOutboxStatus(storeId, entry.id, 'sent');
      onOutboxChanged?.(formatShareOutcomeToast(outcome));
      onClose();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        db.removeShareOutboxItem(storeId, entry.id);
        return;
      }
      const msg = err instanceof Error ? err.message : 'تعذرت المشاركة الفورية';
      db.updateShareOutboxStatus(storeId, entry.id, 'failed', msg);
      setStatusNotice('تعذر فتح نافذة المشاركة؛ يمكنك النسخ أو حفظ ملف نصي مباشرة بدون إنترنت.');
      onOutboxChanged?.('يمكنك نسخ النص أو حفظه كملف نصي بدون إنترنت.');
    }
  };

  const handleWhatsAppClick = () => {
    const entry = recordOutbox('whatsapp', 'sent');
    db.updateShareOutboxStatus(storeId, entry.id, 'sent');
    onOutboxChanged?.(
      normalizedPhone
        ? `تم فتح واتساب لرقم العميل (${targetPhone}).`
        : 'تم فتح واتساب للمشاركة.',
    );
  };

  const handleCopy = async () => {
    const ok = await copyTextOffline(messageText);
    if (ok) {
      setCopied(true);
      setStatusNotice('تم نسخ النص إلى الحافظة — جاهز للصق والمشاركة بدون إنترنت.');
      onOutboxChanged?.('تم نسخ المستند للمشاركة بدون إنترنت.');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setStatusNotice('تعذر النسخ التلقائي؛ يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  const handleDownloadTxt = () => {
    const safeRef = reference || customerName || 'مستند';
    const ok = downloadTextFileOffline(`${title}-${safeRef}`, messageText);
    if (ok) {
      const entry = recordOutbox('system', 'sent');
      db.updateShareOutboxStatus(storeId, entry.id, 'sent');
      const msg = 'تم حفظ المستند كملف نصي (.txt) على الجهاز بدون إنترنت.';
      setStatusNotice(msg);
      onOutboxChanged?.(msg);
    } else {
      setStatusNotice('تعذر حفظ الملف على هذا المتصفح؛ استخدم النسخ أو مشاركة الجهاز.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`${theme.cardBg} rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border ${theme.borderColor} flex flex-col`}>
        {/* Header */}
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2 min-w-0">
            <Share2 className="w-5 h-5 text-[#C9A961] shrink-0" />
            <h3 className="font-bold text-sm truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاركة"
            className="p-1.5 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {targetPhone ? (
            <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <span>رقم العميل المستهدف:</span>
              <span className="font-mono font-bold" dir="ltr">{targetPhone}</span>
            </div>
          ) : (
            <div className={`text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-amber-950/50 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              لا يوجد رقم هاتف مسجل — يمكنك المشاركة مباشرة عبر أي تطبيق على الجهاز أو حفظ ملف نصي بدون إنترنت.
            </div>
          )}

          <div className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border ${
            isDarkMode ? 'bg-emerald-950/40 border-emerald-900 text-emerald-200' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}>
            المشاركة تعمل بالكامل بدون إنترنت (عبر تطبيقات الجهاز، البلوتوث، الرسائل، النسخ، أو ملف نصي).
          </div>

          {/* Message Preview */}
          <div className={`p-3 rounded-2xl border shadow-inner max-h-52 overflow-y-auto ${
            isDarkMode ? 'bg-[#0F1715] border-emerald-900/70' : 'bg-[#EFEAE2] border-[#d6cfc5]'
          }`}>
            <div className={`p-3 rounded-xl shadow-xs text-xs font-sans whitespace-pre-wrap leading-relaxed select-text ${
              isDarkMode ? 'bg-[#18221E] text-gray-100' : 'bg-white text-gray-900'
            }`}>
              {messageText}
            </div>
          </div>

          {statusNotice && (
            <div role="status" className={`text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-sky-950/60 border-sky-800 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}>
              {statusNotice}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSystemShare}
              className="w-full bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961]/50 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Send className="w-4 h-4 text-[#C9A961]" />
              <span>مشاركة عبر الجهاز / التطبيقات (بدون إنترنت)</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="w-full bg-[#1F9D55] hover:bg-[#198748] text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>
                {normalizedPhone
                  ? `فتح واتساب للعميل (${targetPhone})`
                  : 'فتح واتساب للمشاركة'}
              </span>
            </a>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                  isDarkMode
                    ? 'bg-[#141F1A] border-emerald-800 text-gray-100 hover:bg-[#1D2C25]'
                    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                  isDarkMode
                    ? 'bg-[#141F1A] border-emerald-800 text-gray-100 hover:bg-[#1D2C25]'
                    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>ملف نصي</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveForLater('any')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                  isDarkMode
                    ? 'bg-amber-950/60 border-amber-700 text-amber-200 hover:bg-amber-900/60'
                    : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>للمراجعة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
