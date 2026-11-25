/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Delete, Check, X, Plus, Minus } from 'lucide-react';
import type { Product } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface SmartQuantityKeypadProps {
  product: Product | null;
  currentCartQty: number;
  onConfirmQty: (product: Product, finalQty: number) => void;
  onClose: () => void;
}

export const SmartQuantityKeypad: React.FC<SmartQuantityKeypadProps> = ({
  product,
  currentCartQty,
  onConfirmQty,
  onClose,
}) => {
  const { theme, isDarkMode } = useTheme();
  const [rawInput, setRawInput] = useState('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setRawInput(currentCartQty > 0 ? String(currentCartQty) : product.unit_type === 'كيلو' ? '0.5' : '1');
    setError(null);
  }, [product, currentCartQty]);

  if (!product) return null;

  const isWeight = product.unit_type === 'كيلو';
  const unitLabel =
    product.base_units_per_sale_unit && product.base_units_per_sale_unit > 1
      ? product.base_unit_name || 'حبة'
      : product.unit_type;

  const pressDigit = (d: string) => {
    setError(null);
    setRawInput((prev) => {
      if (d === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : `${prev}.`;
      }
      if (prev === '0') return d;
      if (prev.length >= 7) return prev;
      return `${prev}${d}`;
    });
  };

  const adjustQty = (delta: number) => {
    setError(null);
    const current = Number(rawInput) || 0;
    const next = Math.max(isWeight ? 0.1 : 1, Math.round((current + delta) * 1000) / 1000);
    setRawInput(String(next));
  };

  const handleConfirm = () => {
    const qty = Number(rawInput);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('أدخل كمية صحيحة أكبر من صفر');
      return;
    }
    if (qty > product.quantity) {
      setError(`المتوفر في المخزن ${product.quantity} ${unitLabel} فقط`);
      return;
    }
    onConfirmQty(product, qty);
  };

  return (
    <div
      className={`border-t-2 border-[#C9A961] shadow-2xl p-3 space-y-2.5 transition-colors ${theme.cardBg}`}
      dir="rtl"
      aria-label="لوحة إدخال الكمية الذكية"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0B3D2E] text-[#C9A961]">
              تحديد الكمية السريع
            </span>
            {currentCartQty > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                في السلة: {currentCartQty}
              </span>
            )}
          </div>
          <h4 className={`font-extrabold text-xs truncate mt-1 ${theme.textPrimary}`}>{product.name}</h4>
          <p className={`text-[10px] font-mono ${theme.textSecondary}`}>
            السعر: {formatCurrency(product.sale_price)} / {unitLabel} · المتوفر: {product.quantity}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق لوحة الكمية"
          className={`p-1.5 rounded-xl border ${theme.borderColor} ${theme.textSecondary} hover:bg-gray-500/10`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Numeric Display & Quick Stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjustQty(isWeight ? -0.5 : -1)}
          aria-label="إنقاص الكمية"
          className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold ${theme.borderColor} ${isDarkMode ? 'bg-[#141F1A] text-white' : 'bg-gray-50 text-gray-800'}`}
        >
          <Minus className="w-4 h-4" />
        </button>

        <div
          className={`flex-1 h-10 rounded-xl border-2 border-[#C9A961]/70 flex items-center justify-between px-3 font-mono font-black text-base ${theme.inputBg} ${theme.textPrimary}`}
        >
          <span className="text-[11px] font-sans font-bold opacity-70">{unitLabel}</span>
          <span data-testid="smart-keypad-value" dir="ltr">
            {rawInput || '0'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => adjustQty(isWeight ? 0.5 : 1)}
          aria-label="زيادة الكمية"
          className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold ${theme.borderColor} ${isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-[#0B3D2E]'}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Presets */}
      <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
        {[1, 5, 10].map((inc) => (
          <button
            key={inc}
            type="button"
            onClick={() => adjustQty(inc)}
            className={`py-1.5 rounded-lg border ${theme.borderColor} ${isDarkMode ? 'bg-[#182520] text-emerald-300' : 'bg-emerald-50/70 text-[#0B3D2E]'}`}
          >
            +{inc}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRawInput('');
          }}
          className={`py-1.5 rounded-lg border border-red-400/50 text-red-500 ${isDarkMode ? 'bg-red-950/30' : 'bg-red-50'}`}
        >
          مسح (C)
        </button>
      </div>

      {/* Keypad Grid 0-9 */}
      <div className="grid grid-cols-4 gap-1.5 font-mono text-sm font-bold">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pressDigit(digit)}
            className={`py-2 rounded-xl border transition active:scale-95 ${theme.borderColor} ${isDarkMode ? 'bg-[#141F1A] text-white hover:bg-[#1e2f27]' : 'bg-white text-gray-900 hover:bg-gray-50'}`}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={() => pressDigit('.')}
          className={`py-2 rounded-xl border transition active:scale-95 ${theme.borderColor} ${isDarkMode ? 'bg-[#141F1A] text-white' : 'bg-white text-gray-900'}`}
        >
          .
        </button>
        <button
          type="button"
          onClick={() => pressDigit('0')}
          className={`py-2 rounded-xl border transition active:scale-95 ${theme.borderColor} ${isDarkMode ? 'bg-[#141F1A] text-white' : 'bg-white text-gray-900'}`}
        >
          0
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRawInput((prev) => prev.slice(0, -1));
          }}
          aria-label="حذف رقم"
          className={`py-2 rounded-xl border flex items-center justify-center ${theme.borderColor} ${isDarkMode ? 'bg-[#141F1A] text-amber-300' : 'bg-amber-50 text-amber-900'}`}
        >
          <Delete className="w-4 h-4" />
        </button>

        {/* Confirm button spans bottom row neatly */}
        <button
          type="button"
          onClick={handleConfirm}
          className="col-span-4 mt-0.5 py-2.5 rounded-xl bg-[#0B3D2E] hover:bg-[#06231A] text-white font-sans text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md border border-[#C9A961]/50"
        >
          <Check className="w-4 h-4 text-[#C9A961]" />
          <span>تأكيد الكمية وتحديث السلة (مع بقاء الكاميرا مفتوحة)</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-bold text-red-500 text-center">
          {error}
        </p>
      )}
    </div>
  );
};
