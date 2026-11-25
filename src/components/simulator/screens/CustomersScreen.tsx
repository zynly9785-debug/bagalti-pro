/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, UserPlus, Phone, CreditCard, FileText, RotateCcw, Search, Coins, Share2, CheckCircle2, ShieldAlert, Edit2 } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Customer } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { WhatsAppShareModal } from '../WhatsAppShareModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface CustomersScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ storeId, onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [repayTargetCustomer, setRepayTargetCustomer] = useState<Customer | null>(null);
  const [repayAmount, setRepayAmount] = useState('');

  // Repayment Receipt Modal state
  const [repaymentReceipt, setRepaymentReceipt] = useState<{
    customerName: string;
    customerPhone: string;
    paidAmount: number;
    previousDebt: number;
    remainingDebt: number;
    dateStr: string;
  } | null>(null);

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Edit Credit Limit Modal
  const [editingCreditLimitCustomer, setEditingCreditLimitCustomer] = useState<Customer | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInitialDebt, setNewInitialDebt] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('50000');

  useEffect(() => {
    loadCustomers();
  }, [storeId]);

  const loadCustomers = () => {
    const list = db.getCustomers(storeId);
    setCustomers(list);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const totalDebtSum = customers.reduce((acc, c) => acc + c.total_debt, 0);

  const handleConfirmRepay = () => {
    if (!repayTargetCustomer) return;
    const amount = Number(repayAmount) || 0;
    if (amount > 0) {
      const prev = repayTargetCustomer.total_debt;
      const rem = Math.max(0, prev - amount);
      const now = new Date();
      const dateStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

      db.payCustomerDebt(storeId, repayTargetCustomer.id, amount);

      setRepaymentReceipt({
        customerName: repayTargetCustomer.name,
        customerPhone: repayTargetCustomer.phone,
        paidAmount: amount,
        previousDebt: prev,
        remainingDebt: rem,
        dateStr,
      });

      setRepayTargetCustomer(null);
      setRepayAmount('');
      loadCustomers();
    }
  };

  const handleSaveCreditLimit = () => {
    if (!editingCreditLimitCustomer) return;
    const limit = Math.max(0, Number(limitInput) || 50000);
    db.updateCustomer(storeId, editingCreditLimitCustomer.id, { credit_limit: limit });
    setEditingCreditLimitCustomer(null);
    loadCustomers();
  };

  const handleSaveCustomerDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const name = editName.trim();
    const phone = editPhone.trim();
    if (!name || !phone) {
      setToastMessage('يرجى إدخال اسم العميل ورقم الهاتف');
      window.setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    db.updateCustomer(storeId, editingCustomer.id, { name, phone });
    setEditingCustomer(null);
    loadCustomers();
    setToastMessage('تم تحديث بيانات العميل بنجاح');
    window.setTimeout(() => setToastMessage(''), 3000);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCust = db.insertCustomer(
      storeId,
      newName.trim(),
      newPhone.trim(),
      Number(newInitialDebt) || 0
    );

    if (newCreditLimit) {
      db.updateCustomer(storeId, newCust.id, { credit_limit: Number(newCreditLimit) || 50000 });
    }

    setShowAddCustomerModal(false);
    setNewName('');
    setNewPhone('');
    setNewInitialDebt('');
    setNewCreditLimit('50000');
    loadCustomers();
  };

  const generateRepaymentReceiptWhatsAppText = () => {
    if (!repaymentReceipt) return '';
    const store = db.findUserById(storeId);
    let text = `📜 *سند قبض وتسديد دفعة - ${store ? store.store_name : 'البقالة'}*\n`;
    text += `التاريخ: ${repaymentReceipt.dateStr}\n`;
    text += `وصلنا من الأخ/الأخت: *${repaymentReceipt.customerName}*\n`;
    text += `مبلغ وقدره: *${repaymentReceipt.paidAmount} ر.ي*\n`;
    text += `وذلك سداداً من الحساب المقيد لدينا.\n`;
    text += `--------------------------------\n`;
    text += `• الرصيد السابق: ${repaymentReceipt.previousDebt} ر.ي\n`;
    text += `• المبلغ المسدد: ${repaymentReceipt.paidAmount} ر.ي\n`;
    text += `• الرصيد المتبقي حالياً: *${repaymentReceipt.remainingDebt} ر.ي*\n`;
    text += `--------------------------------\n`;
    text += `جزاكم الله خيراً وبارك الله في رزقكم!`;
    return text;
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden relative`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
            title="رجوع للرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">سجل العملاء والديون</h2>
        </div>

        <div className="text-left">
          <span className="text-[10px] text-emerald-200 block">إجمالي ديون السوق:</span>
          <span className="font-mono text-xs font-bold text-[#C9A961]">
            {formatCurrency(totalDebtSum)}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className={`p-3 ${theme.cardBg} border-b ${theme.borderColor}`}>
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Customers List (RecyclerView) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-20">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Coins className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-xs font-semibold">لا يوجد عملاء مسجلون</p>
          </div>
        ) : (
          filteredCustomers.map((c) => (
            <div
              key={c.id}
              className={`${theme.cardBg} rounded-2xl p-3 shadow-xs border ${theme.borderColor} hover:border-[#C9A961] transition`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1">
                    <h3 className={`font-bold text-xs ${theme.textPrimary}`}>{c.name}</h3>
                    <button
                      onClick={() => {
                        setEditingCustomer(c);
                        setEditName(c.name);
                        setEditPhone(c.phone || '');
                      }}
                      className="text-[9px] text-[#C9A961] hover:underline flex items-center gap-0.5 font-bold"
                      aria-label={`تعديل بيانات ${c.name}`}
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>تعديل البيانات</span>
                    </button>
                  </div>
                  <p className={`text-[11px] ${theme.textSecondary} font-mono mt-0.5 flex items-center gap-1`}>
                    <Phone className="w-3 h-3 text-[#C9A961]" />
                    <span>{c.phone || 'بدون هاتف'}</span>
                  </p>
                  {/* Credit limit badge */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`text-[10px] ${
                      isDarkMode ? 'bg-[#1D2C26] text-emerald-300 border border-emerald-900/60' : 'bg-gray-100 text-gray-700'
                    } px-1.5 py-0.5 rounded flex items-center gap-1 font-mono`}>
                      <ShieldAlert className="w-2.5 h-2.5 text-[#C9A961]" />
                      <span>سقف الائتمان: {c.credit_limit ? formatCurrency(c.credit_limit) : '50,000 ر.ي'}</span>
                    </span>
                    <button
                      onClick={() => {
                        setEditingCreditLimitCustomer(c);
                        setLimitInput((c.credit_limit || 50000).toString());
                      }}
                      className="text-[9px] text-[#C9A961] hover:underline flex items-center gap-0.5 font-bold"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>تعديل السقف</span>
                    </button>
                  </div>
                </div>

                <div className="text-left">
                  <span className={`text-[10px] ${theme.textSecondary} block`}>الرصيد المستحق:</span>
                  <span
                    className={`font-mono font-extrabold text-xs ${
                      c.total_debt > 0 ? 'text-[#8B2E2E]' : 'text-emerald-500'
                    }`}
                  >
                    {formatCurrency(c.total_debt)}
                  </span>
                </div>
              </div>

              {/* 3 Strict Action Buttons: [تسديد], [كشف حساب], [مرتجع] */}
              <div className={`grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t ${theme.borderColor} text-xs`}>
                {/* 1. تسديد */}
                <button
                  onClick={() => {
                    setRepayTargetCustomer(c);
                    setRepayAmount('');
                  }}
                  className={`py-1.5 px-2 ${
                    isDarkMode ? 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800' : 'bg-emerald-50 hover:bg-emerald-100 text-[#0B3D2E] border-emerald-200'
                  } rounded-xl font-bold flex items-center justify-center gap-1 border`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#C9A961]" />
                  <span>تسديد</span>
                </button>

                {/* 2. كشف حساب */}
                <button
                  onClick={() =>
                    onNavigate('statement', {
                      customerId: c.id,
                      customerName: c.name,
                      customerPhone: c.phone,
                      totalDebt: c.total_debt,
                    })
                  }
                  className={`py-1.5 px-2 ${
                    isDarkMode ? 'bg-blue-950/60 hover:bg-blue-900/70 text-blue-300 border-blue-800' : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
                  } rounded-xl font-bold flex items-center justify-center gap-1 border`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>كشف حساب</span>
                </button>

                {/* 3. مرتجع */}
                <button
                  onClick={() =>
                    onNavigate('returns', {
                      customerId: c.id,
                      customerName: c.name,
                    })
                  }
                  className={`py-1.5 px-2 ${
                    isDarkMode ? 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border-amber-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  } rounded-xl font-bold flex items-center justify-center gap-1 border`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>مرتجع</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB: Add Customer */}
      <button
        onClick={() => setShowAddCustomerModal(true)}
        className="absolute bottom-4 left-4 w-12 h-12 rounded-2xl bg-[#0B3D2E] text-white flex items-center justify-center shadow-xl hover:bg-[#06231A] active:scale-95 transition border border-[#C9A961]"
        title="إضافة عميل جديد"
      >
        <UserPlus className="w-6 h-6 text-[#C9A961]" />
      </button>

      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form onSubmit={handleSaveCustomerDetails} className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>تعديل بيانات العميل</h3>
            <div>
              <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>اسم العميل:</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`} />
            </div>
            <div>
              <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>رقم الهاتف:</label>
              <input type="tel" dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required className={`w-full text-right ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl font-bold text-xs border border-[#C9A961]/40">حفظ التعديل</button>
              <button type="button" onClick={() => setEditingCustomer(null)} className={`px-3 py-2 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary}`}>إلغاء</button>
            </div>
          </form>
        </div>
      )}
      {toastMessage && <div role="status" className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-gray-900 px-4 py-2 text-center text-xs font-bold text-white shadow-lg">{toastMessage}</div>}

      {/* Repay Dialog */}
      {repayTargetCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>
              تسديد دفعة: {repayTargetCustomer.name}
            </h3>
            <p className={`text-xs ${theme.textSecondary} font-mono`}>
              الدين الحالي المستحق: {formatCurrency(repayTargetCustomer.total_debt)}
            </p>

            <div>
              <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                المبلغ المسدد (ر.ي):
              </label>
              <input
                type="number"
                placeholder="أدخل المبلغ..."
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                autoFocus
                className={`w-full text-center text-lg font-bold font-mono border ${theme.borderColor} rounded-xl p-2.5 ${theme.inputBg} ${theme.textPrimary} focus:outline-none focus:border-[#C9A961]`}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmRepay}
                disabled={!repayAmount || Number(repayAmount) <= 0}
                className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] disabled:opacity-50 border border-[#C9A961]/40"
              >
                تأكيد التسديد والخصم
              </button>
              <button
                onClick={() => setRepayTargetCustomer(null)}
                className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Repayment Receipt Dialog */}
      {repaymentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in zoom-in-95">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border-2 border-emerald-700 text-center space-y-3`}>
            <div className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-100 text-[#0B3D2E]'} flex items-center justify-center mx-auto`}>
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>

            <h3 className={`font-bold text-base ${theme.textPrimary}`}>تم تسجيل سند القبض بنجاح!</h3>
            <p className={`text-xs font-bold ${theme.textSecondary}`}>
              العميل: {repaymentReceipt.customerName}
            </p>

            <div className={`p-3 ${theme.inputBg} rounded-xl border ${theme.borderColor} text-xs space-y-1 font-mono`}>
              <div className="flex justify-between">
                <span className={theme.textSecondary}>المبلغ المسدد:</span>
                <span className="font-bold text-emerald-500">{repaymentReceipt.paidAmount} ر.ي</span>
              </div>
              <div className={`flex justify-between ${theme.textSecondary}`}>
                <span>الدين السابق:</span>
                <span>{repaymentReceipt.previousDebt} ر.ي</span>
              </div>
              <div className={`flex justify-between text-[#8B2E2E] font-bold pt-1 border-t ${theme.borderColor}`}>
                <span>المتبقي في الذمة:</span>
                <span>{repaymentReceipt.remainingDebt} ر.ي</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="w-full bg-[#25D366] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#20ba59] shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>إرسال سند القبض عبر واتساب للعميل</span>
              </button>
            </div>

            <button
              onClick={() => setRepaymentReceipt(null)}
              className={`w-full text-xs ${theme.textSecondary} hover:text-[#C9A961] font-bold py-1.5`}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Edit Credit Limit Modal */}
      {editingCreditLimitCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>
              تعديل سقف الائتمان (الحد الأقصى للديون)
            </h3>
            <p className={`text-xs ${theme.textSecondary} font-semibold`}>
              العميل: {editingCreditLimitCustomer.name}
            </p>

            <div>
              <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                سقف الدين المسموح (ر.ي):
              </label>
              <input
                type="number"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                autoFocus
                className={`w-full text-center text-lg font-bold font-mono border ${theme.borderColor} rounded-xl p-2 ${theme.inputBg} ${theme.textPrimary} focus:outline-none focus:border-[#C9A961]`}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveCreditLimit}
                className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl font-bold text-xs hover:bg-[#06231A] border border-[#C9A961]/40"
              >
                حفظ التعديل
              </button>
              <button
                onClick={() => setEditingCreditLimitCustomer(null)}
                className={`px-3 py-2 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>إضافة عميل جديد</h3>

            <form onSubmit={handleCreateCustomer} className="space-y-2.5">
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>اسم العميل:</label>
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>رقم الهاتف:</label>
                <input
                  type="tel"
                  placeholder="مثال: 770112233"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className={`w-full text-right ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>دين سابق:</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newInitialDebt}
                    onChange={(e) => setNewInitialDebt(e.target.value)}
                    className={`w-full text-center ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>سقف الائتمان:</label>
                  <input
                    type="number"
                    placeholder="50000"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    className={`w-full text-center ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs font-mono`}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl font-bold text-xs hover:bg-[#06231A] border border-[#C9A961]/40"
                >
                  حفظ العميل
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className={`px-3 py-2 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Share Receipt Modal */}
      {repaymentReceipt && (
        <WhatsAppShareModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title="سند قبض وتسديد دفعة"
          messageText={generateRepaymentReceiptWhatsAppText()}
          targetPhone={repaymentReceipt.customerPhone}
        />
      )}
    </div>
  );
};
