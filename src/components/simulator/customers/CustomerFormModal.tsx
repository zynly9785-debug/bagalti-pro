/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Customer } from '../../../types/index.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface CustomerFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  customer?: Customer | null;
  focusField?: 'phone' | 'due' | 'name';
  onClose: () => void;
  onSave: (payload: {
    name: string;
    phone: string;
    openingBalance: number;
    totalDebt?: number;
    creditLimit: number;
    category: 'جديد' | 'منتظم' | 'VIP' | 'موقوف';
    nextDueAt?: string;
    notes?: string;
  }) => void;
}

const normalizeCategory = (cat?: Customer['category']): 'جديد' | 'منتظم' | 'VIP' | 'موقوف' => {
  if (cat === 'VIP' || cat === 'مميز') return 'VIP';
  if (cat === 'منتظم') return 'منتظم';
  if (cat === 'موقوف') return 'موقوف';
  return 'جديد';
};

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  mode,
  customer,
  focusField,
  onClose,
  onSave,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [previousDebt, setPreviousDebt] = useState('0');
  const [currentDebtEdit, setCurrentDebtEdit] = useState('0');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [category, setCategory] = useState<'جديد' | 'منتظم' | 'VIP' | 'موقوف'>('جديد');
  const [nextDueAt, setNextDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (mode === 'edit' && customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setPreviousDebt(String(customer.opening_balance ?? 0));
      setCurrentDebtEdit(String(customer.total_debt ?? 0));
      setCreditLimit(String(customer.credit_limit ?? 50000));
      setCategory(customer.status === 'suspended' ? 'موقوف' : normalizeCategory(customer.category));
      setNextDueAt(customer.next_due_at ? customer.next_due_at.slice(0, 10) : '');
      setNotes(customer.notes || '');
    } else {
      setName('');
      setPhone('');
      setPreviousDebt('0');
      setCurrentDebtEdit('0');
      setCreditLimit('50000');
      setCategory('جديد');
      setNextDueAt('');
      setNotes('');
    }
  }, [isOpen, mode, customer]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('اسم العميل إجباري');
      return;
    }
    const opening = Math.max(0, Number(previousDebt) || 0);
    const editedTotal = Math.max(0, Number(currentDebtEdit) || 0);
    const limit = creditLimit.trim() === '' ? 50000 : Math.max(0, Number(creditLimit) || 0);

    try {
      onSave({
        name: name.trim(),
        phone: phone.trim(),
        openingBalance: opening,
        totalDebt: mode === 'edit' ? editedTotal : undefined,
        creditLimit: limit,
        category,
        nextDueAt: nextDueAt || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ بيانات العميل');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'add' ? 'إضافة عميل جديد' : 'تعديل بيانات العميل'}
    >
      <div className={`${theme.cardBg} w-full max-w-sm max-h-[88vh] overflow-y-auto rounded-3xl border ${theme.borderColor} shadow-2xl`}>
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#C9A961]" />
            <h3 className="font-bold text-sm">
              {mode === 'add' ? 'إضافة عميل جديد' : `تعديل بيانات: ${customer?.name || ''}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1 hover:bg-white/10 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div role="alert" className={`text-xs px-3 py-2 rounded-xl border ${
              isDarkMode ? 'bg-red-950/70 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {error}
            </div>
          )}

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              اسم العميل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus={focusField !== 'phone' && focusField !== 'due'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: محمد أحمد علي"
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#C9A961]`}
            />
          </div>

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              رقم الهاتف (اختياري)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus={focusField === 'phone'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="77xxxxxxx"
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-[#C9A961]`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                {mode === 'add' ? 'إجمالي مديونية سابقة' : 'الرصيد الافتتاحي السابق'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={previousDebt}
                onChange={(e) => setPreviousDebt(e.target.value)}
                placeholder="0"
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-[#C9A961]`}
              />
            </div>

            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                الحد الائتماني (اختياري)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="50000"
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-[#C9A961]`}
              />
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                الرصيد / إجمالي المديونية الحالية (تعديل مباشر إن لزم)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentDebtEdit}
                onChange={(e) => setCurrentDebtEdit(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-[#C9A961]`}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                تصنيف العميل
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'جديد' | 'منتظم' | 'VIP' | 'موقوف')}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-2.5 py-2.5 text-xs focus:outline-none focus:border-[#C9A961]`}
              >
                <option value="جديد">جديد</option>
                <option value="منتظم">منتظم</option>
                <option value="VIP">VIP</option>
                <option value="موقوف">موقوف</option>
              </select>
            </div>

            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
                موعد السداد المجدول
              </label>
              <input
                type="date"
                autoFocus={focusField === 'due'}
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-2.5 py-2.5 text-xs focus:outline-none focus:border-[#C9A961]`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>
              ملاحظات (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل أو عنوان للعميل..."
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961]/50 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {mode === 'add' ? 'حفظ العميل' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 border py-2.5 rounded-xl text-xs font-bold transition ${
                isDarkMode
                  ? 'border-emerald-800 text-gray-200 hover:bg-white/5'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
