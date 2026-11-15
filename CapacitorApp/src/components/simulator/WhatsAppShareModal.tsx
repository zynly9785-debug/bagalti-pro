/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Share2, Copy, Check, MessageSquare, X } from 'lucide-react';
import { shareTextEverywhere } from '../../utils/nativeServices.ts';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  messageText: string;
  targetPhone?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  title,
  messageText,
  targetPhone,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => { try { await navigator.clipboard.writeText(messageText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('انسخ النص التالي', messageText); } };

  const handleOpenWhatsApp = () => {
    void shareTextEverywhere(title, messageText).catch(() => handleCopy());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-emerald-800/30 flex flex-col">
        {/* Header */}
        <div className="bg-[#25D366] text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* معاينة المحتوى المراد مشاركته */}
        <div className="p-4 space-y-3">
          <div className="bg-[#EFEAE2] p-3 rounded-2xl border border-[#d6cfc5] shadow-inner max-h-60 overflow-y-auto">
            <div className="bg-white p-3 rounded-xl shadow-xs text-xs font-sans text-gray-800 whitespace-pre-wrap leading-relaxed select-text">
              {messageText}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 bg-[#25D366] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#20ba59] transition shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة عبر التطبيقات</span>
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 flex items-center gap-1 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
