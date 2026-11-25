/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, CreditCard, FileSpreadsheet, FileText, ListFilter, Share2, X } from 'lucide-react';
import type { Customer, CustomerPayment, Sale } from '../../../types/index.ts';
import type { CustomerTimelineRow } from '../../../utils/customerLogic.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface ShareMenuModalProps {
  isOpen: boolean;
  customer: Customer | null;
  lastCreditSale?: Sale;
  lastPayment?: CustomerPayment;
  timeline: CustomerTimelineRow[];
  onClose: () => void;
  onSelectLastCreditInvoice: () => void;
  onSelectLastReceipt: () => void;
  onSelectSpecificRow: (row: CustomerTimelineRow) => void;
  onSelectStatement: () => void;
}

export const ShareMenuModal: React.FC<ShareMenuModalProps> = ({
  isOpen,
  customer,
  lastCreditSale,
  lastPayment,
  timeline,
  onClose,
  onSelectLastCreditInvoice,
  onSelectLastReceipt,
  onSelectSpecificRow,
  onSelectStatement,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [pickingSpecific, setPickingSpecific] = useState(false);

  if (!isOpen || !customer) return null;

  const closeAll = () => {
    setPickingSpecific(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="خيارات المشاركة"
    >
      <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} shadow-2xl overflow-hidden`}>
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2 min-w-0">
            {pickingSpecific && (
              <button
                type="button"
                onClick={() => setPickingSpecific(false)}
                aria-label="العودة لقائمة المشاركة"
                className="p-1 hover:bg-white/10 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <Share2 className="w-4 h-4 text-[#C9A961] shrink-0" />
            <h3 className="font-bold text-sm truncate">
              {pickingSpecific ? `اختر فاتورة أو سند — ${customer.name}` : `مشاركة مع ${customer.name}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeAll}
            aria-label="إغلاق خيارات المشاركة"
            className="p-1 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
          {!pickingSpecific ? (
            <>
              <button
                type="button"
                disabled={!lastCreditSale}
                onClick={() => { closeAll(); onSelectLastCreditInvoice(); }}
                className={`w-full text-right p-3 rounded-2xl border flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                  isDarkMode
                    ? 'bg-[#121B17] border-emerald-800 text-gray-100 hover:bg-emerald-950/60'
                    : 'bg-[#FAF8F3] border-gray-200 text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#C9A961]" />
                  <div>
                    <p className="text-xs font-bold">1. مشاركة آخر فاتورة آجلة</p>
                    <p className={`text-[10px] ${theme.textSecondary}`}>
                      {lastCreditSale
                        ? `فاتورة #${lastCreditSale.id} • ${formatCurrency(lastCreditSale.total_amount)}`
                        : 'لا توجد فاتورة آجلة مسجلة'}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={!lastPayment}
                onClick={() => { closeAll(); onSelectLastReceipt(); }}
                className={`w-full text-right p-3 rounded-2xl border flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                  isDarkMode
                    ? 'bg-[#121B17] border-emerald-800 text-gray-100 hover:bg-emerald-950/60'
                    : 'bg-[#FAF8F3] border-gray-200 text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-xs font-bold">2. مشاركة آخر سند قبض</p>
                    <p className={`text-[10px] ${theme.textSecondary}`}>
                      {lastPayment
                        ? `سند #${lastPayment.id} • ${formatCurrency(lastPayment.amount)}`
                        : 'لا يوجد سند قبض مسجل'}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={timeline.length === 0}
                onClick={() => setPickingSpecific(true)}
                className={`w-full text-right p-3 rounded-2xl border flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                  isDarkMode
                    ? 'bg-[#121B17] border-emerald-800 text-gray-100 hover:bg-emerald-950/60'
                    : 'bg-[#FAF8F3] border-gray-200 text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ListFilter className="w-4 h-4 text-sky-500" />
                  <div>
                    <p className="text-xs font-bold">3. مشاركة فاتورة أو سند محدد</p>
                    <p className={`text-[10px] ${theme.textSecondary}`}>
                      اختيار حركة معينة من سجل العميل ({timeline.length})
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { closeAll(); onSelectStatement(); }}
                className={`w-full text-right p-3 rounded-2xl border flex items-center justify-between gap-2 transition ${
                  isDarkMode
                    ? 'bg-[#121B17] border-emerald-800 text-gray-100 hover:bg-emerald-950/60'
                    : 'bg-[#FAF8F3] border-gray-200 text-gray-900 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#C9A961]" />
                  <div>
                    <p className="text-xs font-bold">4. مشاركة كشف حساب / إجمالي المديونية</p>
                    <p className={`text-[10px] ${theme.textSecondary}`}>
                      الرصيد المستحق: {formatCurrency(customer.total_debt)}
                    </p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <div className="space-y-2">
              {timeline.map((row) => (
                <button
                  key={row.uid}
                  type="button"
                  onClick={() => { closeAll(); onSelectSpecificRow(row); }}
                  className={`w-full text-right p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    isDarkMode
                      ? 'bg-[#121B17] border-emerald-800 text-gray-100 hover:bg-emerald-950/60'
                      : 'bg-[#FAF8F3] border-gray-200 text-gray-900 hover:bg-emerald-50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A961]" />
                      <span>{row.title}</span>
                    </p>
                    <p className={`text-[10px] font-mono ${theme.textSecondary}`}>{row.date}</p>
                  </div>
                  <span className="text-xs font-bold font-mono">{formatCurrency(row.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
