/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Clock, Send, Trash2, X } from 'lucide-react';
import type { ShareOutboxItem } from '../../../types/index.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface OutboxQueueModalProps {
  isOpen: boolean;
  items: ShareOutboxItem[];
  onClose: () => void;
  onRetryItem: (item: ShareOutboxItem) => void;
  onDeleteItem: (id: string) => void;
}

export const OutboxQueueModal: React.FC<OutboxQueueModalProps> = ({
  isOpen,
  items,
  onClose,
  onRetryItem,
  onDeleteItem,
}) => {
  const { isDarkMode, theme } = useTheme();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="طابور الإرسال المحلي"
    >
      <div className={`${theme.cardBg} w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border ${theme.borderColor} shadow-2xl overflow-hidden`}>
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C9A961]" />
            <h3 className="font-bold text-sm">سجل المشاركات المحفوظة ({items.length})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق طابور الإرسال"
            className="p-1 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className={`text-center py-10 text-xs ${theme.textSecondary}`}>
              لا توجد رسائل أو فواتير محفوظة في سجل المشاركات
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border ${theme.borderColor} ${
                  isDarkMode ? 'bg-[#121B17]' : 'bg-[#FAF8F3]'
                } space-y-2`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.title}</p>
                    <p className={`text-[10px] ${theme.textSecondary}`}>
                      {item.customer_name || 'عميل'} {item.customer_phone ? `• ${item.customer_phone}` : ''}
                    </p>
                    <p className={`text-[9px] font-mono ${theme.textSecondary}`}>
                      {item.created_at.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                    item.status === 'sent'
                      ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : item.status === 'failed'
                        ? isDarkMode ? 'bg-red-950 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300'
                        : isDarkMode ? 'bg-amber-950 text-amber-200 border-amber-700' : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {item.status === 'sent' ? 'تمت المشاركة' : item.status === 'failed' ? 'جاهز للإعادة' : 'محفوظ للمشاركة'}
                  </span>
                </div>

                {item.error_message && item.status !== 'sent' && (
                  <p className="text-[10px] text-amber-500">{item.error_message}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  {item.status !== 'sent' ? (
                    <button
                      type="button"
                      onClick={() => onRetryItem(item)}
                      className="px-3 py-1.5 rounded-xl bg-[#1F9D55] hover:bg-[#198748] text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>مشاركة الآن</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>مكتمل</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label="حذف من الطابور"
                    className="p-1.5 rounded-xl text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
