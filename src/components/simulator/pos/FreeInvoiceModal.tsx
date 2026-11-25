/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Share2, User, X } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import type { Customer } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { formatShareOutcomeToast, shareTextEverywhere } from '../../../utils/nativeServices.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface FreeInvoiceModalProps {
  storeId: number;
  isOpen: boolean;
  isRestricted: boolean;
  onClose: () => void;
  onCreated?: (summary: string) => void;
}

export const FreeInvoiceModal: React.FC<FreeInvoiceModalProps> = ({
  storeId,
  isOpen,
  isRestricted,
  onClose,
  onCreated,
}) => {
  const { theme, isDarkMode } = useTheme();
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [details, setDetails] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paymentType, setPaymentType] = useState<'نقداً' | 'آجل'>('نقداً');
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<{
    saleId: number;
    customerName?: string;
    details: string;
    amount: number;
    paymentType: 'نقداً' | 'آجل';
    dateStr: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCustomerName('');
      setSelectedCustomer(null);
      setSuggestions([]);
      setDetails('');
      setAmountInput('');
      setPaymentType('نقداً');
      setError(null);
      setShareNotice(null);
      setSavedInvoice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedCustomer) {
      setSuggestions([]);
      return;
    }
    const q = customerName.trim();
    if (q.length >= 1) {
      setSuggestions(db.searchCustomers(storeId, q).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [customerName, isOpen, selectedCustomer, storeId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isRestricted) {
      setError('الحساب موقوف أو منتهي الاشتراك — لا يمكن إنشاء فاتورة حرة حالياً.');
      return;
    }
    const amount = Number(amountInput);
    if (!details.trim()) {
      setError('يرجى كتابة تفاصيل الفاتورة الحرة');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }
    const finalName = selectedCustomer?.name || customerName.trim();
    if (paymentType === 'آجل' && !finalName) {
      setError('يرجى إدخال اسم العميل أو اختياره للفاتورة الآجلة');
      return;
    }

    try {
      const result = db.insertFreePosInvoice(storeId, {
        customerId: selectedCustomer?.id || null,
        customerName: finalName || undefined,
        details: details.trim(),
        amount,
        paymentType,
      });
      setSavedInvoice({
        saleId: result.sale.id,
        customerName: finalName || undefined,
        details: details.trim(),
        amount,
        paymentType,
        dateStr: result.sale.created_at,
      });
      onCreated?.(`تم حفظ الفاتورة الحرة #${result.sale.id} بمبلغ ${formatCurrency(amount)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الفاتورة الحرة');
    }
  };

  const buildShareText = () => {
    if (!savedInvoice) return '';
    const store = db.findUserById(storeId);
    return [
      `🧾 فاتورة حرة #${savedInvoice.saleId} — ${store?.store_name || 'بقالتي برو'}`,
      `التاريخ: ${savedInvoice.dateStr}`,
      savedInvoice.customerName ? `العميل: ${savedInvoice.customerName}` : '',
      `النوع: ${savedInvoice.paymentType}`,
      `التفاصيل: ${savedInvoice.details}`,
      `الإجمالي: ${formatCurrency(savedInvoice.amount)}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleShare = async () => {
    try {
      const outcome = await shareTextEverywhere(`فاتورة حرة #${savedInvoice?.saleId}`, buildShareText());
      setShareNotice(formatShareOutcomeToast(outcome, 'الفاتورة الحرة'));
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setShareNotice('تعذرت المشاركة؛ تحقق من إذن الجهاز.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs" dir="rtl">
      <div
        className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3 max-h-[92vh] overflow-y-auto`}
      >
        <div className={`flex items-center justify-between border-b pb-2.5 ${theme.borderColor}`}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#C9A961]" />
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>إضافة فاتورة حرة</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الفاتورة الحرة"
            className={`p-1 rounded-full ${theme.textSecondary} hover:bg-gray-500/10`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {savedInvoice ? (
          <div className="space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#0B3D2E] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className={`font-extrabold text-sm ${theme.textPrimary}`}>
              تم حفظ الفاتورة الحرة #{savedInvoice.saleId}
            </h4>
            <div className={`rounded-2xl border p-3 text-xs text-right space-y-1.5 ${theme.secondaryBox}`}>
              <p>
                <b>النوع:</b> {savedInvoice.paymentType}
              </p>
              {savedInvoice.customerName && (
                <p>
                  <b>العميل:</b> {savedInvoice.customerName}
                </p>
              )}
              <p>
                <b>التفاصيل:</b> {savedInvoice.details}
              </p>
              <p>
                <b>المبلغ:</b>{' '}
                <span className="font-mono font-bold text-[#C9A961]">{formatCurrency(savedInvoice.amount)}</span>
              </p>
            </div>
            {shareNotice && (
              <p role="status" className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                {shareNotice}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="bg-[#25D366] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة الفاتورة</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs"
              >
                تم
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className={`text-[11px] ${theme.textSecondary}`}>
              تُسجل الفاتورة الحرة مباشرة دون التأثير على سلة البيع الحالية.
            </p>

            {/* Payment type toggle */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentType('نقداً')}
                className={`py-2 rounded-xl border transition ${
                  paymentType === 'نقداً'
                    ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                    : `${theme.borderColor} ${theme.textSecondary}`
                }`}
              >
                فاتورة نقدية (كاش)
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('آجل')}
                className={`py-2 rounded-xl border transition ${
                  paymentType === 'آجل'
                    ? 'bg-[#8B2E2E] text-white border-red-400'
                    : `${theme.borderColor} ${theme.textSecondary}`
                }`}
              >
                فاتورة آجلة (دين)
              </button>
            </div>

            {/* Customer autocomplete */}
            <div className="relative">
              <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>
                العميل {paymentType === 'آجل' ? '*' : '(اختياري)'}:
              </label>
              {selectedCustomer ? (
                <div
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs ${
                    isDarkMode ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-[#0B3D2E]'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#C9A961]" />
                    {selectedCustomer.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] font-bold text-red-500"
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={paymentType === 'آجل' ? 'اكتب اسم العميل (إجباري للآجل)...' : 'اسم العميل أو زبون عام...'}
                  className={`w-full rounded-xl border px-3 py-2 text-xs ${theme.inputBg} ${theme.textPrimary}`}
                />
              )}

              {suggestions.length > 0 && !selectedCustomer && (
                <div className={`mt-1 rounded-xl border shadow-lg max-h-32 overflow-y-auto ${theme.cardBg}`}>
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerName('');
                        setSuggestions([]);
                      }}
                      className={`w-full text-right px-3 py-2 text-xs border-b last:border-0 flex justify-between ${theme.borderColor}`}
                    >
                      <span className="font-bold">{c.name}</span>
                      <span className="font-mono text-[10px] text-red-400">{formatCurrency(c.total_debt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>تفاصيل الفاتورة الحرة *:</label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="مثال: مقاضي متنوعة غير مسجلة بالباركود أو خدمة توصيل..."
                className={`w-full rounded-xl border px-3 py-2 text-xs ${theme.inputBg} ${theme.textPrimary}`}
                required
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>المبلغ الإجمالي (ر.ي) *:</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0"
                className={`w-full rounded-xl border px-3 py-2 text-sm font-mono font-bold ${theme.inputBg} ${theme.textPrimary}`}
                required
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-bold text-red-500 bg-red-500/10 rounded-xl p-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isRestricted}
                className="flex-1 bg-[#0B3D2E] hover:bg-[#06231A] disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-xs border border-[#C9A961]/40"
              >
                حفظ الفاتورة الحرة
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${theme.borderColor} ${theme.textSecondary}`}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
