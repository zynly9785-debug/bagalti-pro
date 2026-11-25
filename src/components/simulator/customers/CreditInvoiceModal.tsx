/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Plus, Share2, Trash2, X } from 'lucide-react';
import type { Customer, Product } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface DraftItem {
  key: string;
  product_id?: number;
  product_name: string;
  qty: string;
  price: string;
}

interface CreditInvoiceModalProps {
  isOpen: boolean;
  storeId: number;
  customers: Customer[];
  products: Product[];
  fixedCustomer?: Customer | null;
  onClose: () => void;
  onSave: (
    payload: {
      customerId?: number | null;
      customerName?: string;
      items: Array<{ product_id?: number; product_name: string; qty: number; price: number; price_entered: boolean }>;
      totalAmount: number;
      notes?: string;
      idempotencyKey: string;
    },
    shareAfterSave: boolean,
  ) => void;
}

const createEmptyRow = (): DraftItem => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_name: '',
  qty: '1',
  price: '',
});

export const CreditInvoiceModal: React.FC<CreditInvoiceModalProps> = ({
  isOpen,
  customers,
  products,
  fixedCustomer,
  onClose,
  onSave,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [customerInput, setCustomerInput] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([createEmptyRow()]);
  const [activeProductRowKey, setActiveProductRowKey] = useState<string | null>(null);
  const [manualTotal, setManualTotal] = useState('');
  const [isTotalManuallyEdited, setIsTotalManuallyEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setIdempotencyKey(
      globalThis.crypto?.randomUUID?.() ||
        `CREDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    if (fixedCustomer) {
      setCustomerInput(fixedCustomer.name);
      setSelectedCustomerId(fixedCustomer.id);
    } else {
      setCustomerInput('');
      setSelectedCustomerId(null);
    }
    setShowCustomerDropdown(false);
    setItems([createEmptyRow()]);
    setActiveProductRowKey(null);
    setManualTotal('');
    setIsTotalManuallyEdited(false);
    setNotes('');
  }, [isOpen, fixedCustomer]);

  const computedItemsSum = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = Number(row.qty) > 0 ? Number(row.qty) : 1;
      const p = Number(row.price) > 0 ? Number(row.price) : 0;
      return sum + q * p;
    }, 0);
  }, [items]);

  const displayedTotal = isTotalManuallyEdited
    ? manualTotal
    : computedItemsSum > 0
      ? String(Number(computedItemsSum.toFixed(2)))
      : manualTotal;

  const customerSuggestions = useMemo(() => {
    const active = customers.filter((c) => c.status !== 'archived');
    const q = customerInput.trim().toLowerCase();
    if (!q) return active.slice(0, 6);
    return active
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 6);
  }, [customers, customerInput]);

  if (!isOpen) return null;

  const updateRow = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addRow = () => setItems((prev) => [...prev, createEmptyRow()]);
  const removeRow = (key: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const handleTotalChange = (val: string) => {
    setManualTotal(val);
    setIsTotalManuallyEdited(val.trim() !== '');
  };

  const submitInvoice = (shareAfterSave: boolean) => {
    setError('');
    const finalCustomerName = fixedCustomer ? fixedCustomer.name : customerInput.trim();
    if (!fixedCustomer && !selectedCustomerId && !finalCustomerName) {
      setError('يرجى كتابة اسم الزبون أو اختياره من الاقتراحات');
      return;
    }

    const preparedItems = items
      .map((row) => {
        const qty = Number(row.qty);
        const priceNum = Number(row.price);
        const hasPrice = row.price.trim() !== '' && Number.isFinite(priceNum) && priceNum >= 0;
        return {
          product_id: row.product_id || 0,
          product_name: row.product_name.trim(),
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          price: hasPrice ? priceNum : 0,
          price_entered: hasPrice,
        };
      })
      .filter((row) => row.product_name.length > 0);

    const parsedTotal = Number(displayedTotal);
    const finalTotal = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : computedItemsSum;

    if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
      setError('أدخل قيمة الأصناف أو المبلغ الإجمالي للفاتورة');
      return;
    }

    try {
      onSave(
        {
          customerId: fixedCustomer ? fixedCustomer.id : selectedCustomerId,
          customerName: finalCustomerName,
          items: preparedItems,
          totalAmount: finalTotal,
          notes: notes.trim() || undefined,
          idempotencyKey,
        },
        shareAfterSave,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الفاتورة الآجلة');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label="إنشاء فاتورة آجلة"
    >
      <div className={`${theme.cardBg} w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border ${theme.borderColor} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2 min-w-0">
            <FilePlus2 className="w-5 h-5 text-[#C9A961] shrink-0" />
            <h3 className="font-bold text-sm truncate">
              {fixedCustomer ? `فاتورة آجلة جديدة — ${fixedCustomer.name}` : 'فاتورة آجلة عامة'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الفاتورة الآجلة"
            className="p-1.5 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div role="alert" className={`text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-red-950/70 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {error}
            </div>
          )}

          {/* Interactive Customer Field for General Credit Invoice */}
          {!fixedCustomer && (
            <div className="relative">
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                اسم الزبون <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerInput}
                onFocus={() => setShowCustomerDropdown(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerInput(val);
                  setShowCustomerDropdown(true);
                  const exact = customers.find(
                    (c) => c.status !== 'archived' && c.name.trim().toLowerCase() === val.trim().toLowerCase(),
                  );
                  setSelectedCustomerId(exact ? exact.id : null);
                }}
                placeholder="اكتب اسم الزبون أو اختر من الاقتراحات السريعة..."
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#C9A961]`}
              />
              {showCustomerDropdown && customerSuggestions.length > 0 && (
                <div className={`mt-1.5 rounded-xl border ${theme.borderColor} ${isDarkMode ? 'bg-[#121B17]' : 'bg-white'} shadow-lg max-h-36 overflow-y-auto`}>
                  <div className={`px-2.5 py-1 text-[10px] font-bold border-b ${theme.borderColor} ${theme.textSecondary}`}>
                    اقتراحات سريعة من العملاء المسجلين:
                  </div>
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerInput(c.name);
                        setSelectedCustomerId(c.id);
                        setShowCustomerDropdown(false);
                      }}
                      className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between border-b last:border-b-0 ${theme.borderColor} ${
                        isDarkMode ? 'hover:bg-emerald-950/60' : 'hover:bg-emerald-50'
                      }`}
                    >
                      <span className="font-bold">{c.name}</span>
                      <span className="text-[10px] font-mono text-[#C9A961]">
                        {formatCurrency(c.total_debt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold ${theme.textSecondary}`}>
                الأصناف (إدخال يدوي حر — لا يشترط وجودها بالمخزون)
              </span>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 bg-[#C9A961] text-[#0B3D2E] px-2.5 py-1.5 rounded-lg text-[11px] font-bold hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إضافة صنف</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((row, idx) => {
                const qText = row.product_name.trim().toLowerCase();
                const prodSuggestions =
                  activeProductRowKey === row.key && qText.length >= 1
                    ? products.filter((p) => p.name.toLowerCase().includes(qText)).slice(0, 4)
                    : [];

                return (
                  <div
                    key={row.key}
                    className={`p-2.5 rounded-2xl border ${theme.borderColor} ${
                      isDarkMode ? 'bg-[#121B17]' : 'bg-[#FAF8F3]'
                    } space-y-2`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono w-5 text-center ${theme.textSecondary}`}>
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={row.product_name}
                        onFocus={() => setActiveProductRowKey(row.key)}
                        onChange={(e) =>
                          updateRow(row.key, {
                            product_name: e.target.value,
                            product_id: undefined,
                          })
                        }
                        placeholder="اسم الصنف (اختياري عند كتابة الإجمالي)"
                        className={`flex-1 ${theme.inputBg} border ${theme.borderColor} rounded-lg px-2.5 py-2 text-xs`}
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          aria-label={`حذف الصنف ${idx + 1}`}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {prodSuggestions.length > 0 && (
                      <div className={`rounded-lg border ${theme.borderColor} ${isDarkMode ? 'bg-[#0F1715]' : 'bg-white'} overflow-hidden`}>
                        {prodSuggestions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              updateRow(row.key, {
                                product_id: p.id,
                                product_name: p.name,
                                price: String(p.sale_price),
                              });
                              setActiveProductRowKey(null);
                            }}
                            className={`w-full text-right px-2.5 py-1.5 text-[11px] flex justify-between border-b last:border-b-0 ${theme.borderColor}`}
                          >
                            <span>{p.name}</span>
                            <span className="font-mono text-emerald-500">{formatCurrency(p.sale_price)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pr-5">
                      <div>
                        <label className={`block text-[10px] mb-0.5 ${theme.textSecondary}`}>الكمية (افتراضي 1)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={row.qty}
                          onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                          placeholder="1"
                          className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg px-2.5 py-1.5 text-xs font-mono`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] mb-0.5 ${theme.textSecondary}`}>السعر / القيمة (اختياري)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price}
                          onChange={(e) => updateRow(row.key, { price: e.target.value })}
                          placeholder="اختياري"
                          className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg px-2.5 py-1.5 text-xs font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Input */}
          <div className={`p-3 rounded-2xl border ${theme.borderColor} ${isDarkMode ? 'bg-emerald-950/35' : 'bg-emerald-50/70'} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold ${theme.textPrimary}`}>
                إجمالي قيمة الأصناف / الفاتورة <span className="text-red-500">*</span>
              </label>
              {isTotalManuallyEdited && computedItemsSum > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTotalManuallyEdited(false);
                    setManualTotal('');
                  }}
                  className="text-[10px] text-[#C9A961] underline font-bold"
                >
                  استخدام مجموع الأصناف ({formatCurrency(computedItemsSum)})
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={displayedTotal}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="يُجمع تلقائياً أو أدخل الإجمالي مباشرة..."
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-sm font-bold font-mono focus:outline-none focus:border-[#C9A961]`}
            />
          </div>

          {/* Optional Invoice Notes */}
          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              ملاحظات الفاتورة (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة اختيارية تظهر في الفاتورة وعند مشاركتها..."
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={`p-3.5 border-t ${theme.borderColor} grid grid-cols-3 gap-2`}>
          <button
            type="button"
            onClick={() => submitInvoice(false)}
            className="bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961]/50 py-2.5 rounded-xl text-xs font-bold transition"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={() => submitInvoice(true)}
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
  );
};
