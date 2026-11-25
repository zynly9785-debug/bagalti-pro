/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CreditCard, Share2, X } from 'lucide-react';
import type { Customer, CustomerPayment } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (
    payload: {
      amount: number;
      method: CustomerPayment['method'];
      notes?: string;
      idempotencyKey: string;
    },
    shareAfterSave: boolean,
  ) => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSave,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CustomerPayment['method']>('نقداً');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (!isOpen || !customer) return;
    setAmount('');
    setMethod('نقداً');
    setNotes('');
    setError('');
    setIdempotencyKey(`RCPT-${Date.now()}-${customer.id}-${Math.random().toString(36).slice(2, 6)}`);
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  const currentDebt = customer.total_debt || 0;
  const numericAmount = Number(amount);
  const validReceived = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0;
  const remainingAfter = Math.max(0, currentDebt - validReceived);

  const handleSubmit = (shareAfterSave: boolean) => {
    setError('');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('يرجى إدخال المبلغ المستلم');
      return;
    }
    if (numericAmount > currentDebt + 1e-9) {
      setError('المبلغ المستلم أكبر من المديونية الحالية');
      return;
    }
    try {
      onSave(
        {
          amount: numericAmount,
          method,
          notes: notes.trim() || undefined,
          idempotencyKey,
        },
        shareAfterSave,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ سند القبض');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تسجيل سند قبض"
    >
      <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} shadow-2xl overflow-hidden`}>
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-5 h-5 text-[#C9A961] shrink-0" />
            <h3 className="font-bold text-sm truncate">سند قبض — {customer.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق سند القبض"
            className="p-1.5 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div role="alert" className={`text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-red-950/70 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {error}
            </div>
          )}

          {/* Current Debt Display */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between ${
            isDarkMode ? 'bg-red-950/40 border-red-900/60' : 'bg-red-50 border-red-200'
          }`}>
            <span className={`text-xs font-bold ${theme.textSecondary}`}>المديونية الحالية:</span>
            <span className={`text-sm font-extrabold font-mono ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
              {formatCurrency(currentDebt)}
            </span>
          </div>

          {/* Received Amount + Full Fill Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[11px] font-bold ${theme.textSecondary}`}>
                المبلغ المستلم <span className="text-red-500">*</span>
              </label>
              {currentDebt > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(currentDebt))}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#C9A961]/25 text-[#C9A961] hover:bg-[#C9A961]/35"
                >
                  تعبئة كامل المديونية
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="أدخل المبلغ المستلم..."
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-sm font-bold font-mono focus:outline-none focus:border-[#C9A961]`}
            />
          </div>

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              طريقة الاستلام
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as CustomerPayment['method'])}
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs`}
            >
              <option value="نقداً">نقداً</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="محفظة إلكترونية">محفظة إلكترونية</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              ملاحظات السند (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة اختيارية تخص سند القبض..."
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs`}
            />
          </div>

          {/* Remaining After Payment */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between ${
            isDarkMode ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <span className={`text-xs font-bold ${theme.textSecondary}`}>المبلغ متبقي بعد السداد:</span>
            <span className={`text-sm font-extrabold font-mono ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
              {formatCurrency(remainingAfter)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961]/50 py-2.5 rounded-xl text-xs font-bold transition"
            >
              حفظ السند
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="bg-[#1F9D55] hover:bg-[#198748] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>حفظ ومشاركة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`border py-2.5 rounded-xl text-xs font-bold transition ${
                isDarkMode
                  ? 'border-emerald-800 text-gray-200 hover:bg-white/5'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
