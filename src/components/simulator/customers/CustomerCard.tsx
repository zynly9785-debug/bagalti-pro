/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Edit2,
  Eye,
  FilePlus2,
  FileText,
  Merge,
  MoreVertical,
  Phone,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { Customer, CustomerPayment, Sale } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import {
  type CustomerTimelineRow,
  formatDateTimeDisplay,
  getCustomerAccountStatus,
  hasReachedOrExceededCreditLimit,
  isCustomerArchived,
  isCustomerSuspended,
} from '../../../utils/customerLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface CustomerCardProps {
  customer: Customer;
  sales: Sale[];
  payments: CustomerPayment[];
  timeline: CustomerTimelineRow[];
  onOpenStatement: (c: Customer) => void;
  onOpenNewCreditInvoice: (c: Customer) => void;
  onOpenPayment: (c: Customer) => void;
  onOpenShareMenu: (c: Customer) => void;
  onOpenQuickPhone: (c: Customer) => void;
  onEditCustomer: (c: Customer) => void;
  onScheduleDueDate: (c: Customer) => void;
  onMergeCustomer: (c: Customer) => void;
  onArchiveCustomer: (c: Customer) => void;
  onRestoreCustomer: (c: Customer) => void;
  onSafeDeleteCustomer: (c: Customer) => void;
  onReleaseSuspended: (c: Customer) => void;
  onAllowCreditOverride: (c: Customer, allow: boolean) => void;
  onViewInvoiceItems: (c: Customer, row: CustomerTimelineRow) => void;
  onShareTimelineRow: (c: Customer, row: CustomerTimelineRow) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  sales,
  payments,
  timeline,
  onOpenStatement,
  onOpenNewCreditInvoice,
  onOpenPayment,
  onOpenShareMenu,
  onOpenQuickPhone,
  onEditCustomer,
  onScheduleDueDate,
  onMergeCustomer,
  onArchiveCustomer,
  onRestoreCustomer,
  onSafeDeleteCustomer,
  onReleaseSuspended,
  onAllowCreditOverride,
  onViewInvoiceItems,
  onShareTimelineRow,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const statusInfo = getCustomerAccountStatus(customer);
  const suspended = isCustomerSuspended(customer);
  const archived = isCustomerArchived(customer);
  const limit = customer.credit_limit ?? 50000;
  const available = Math.max(0, limit - (customer.total_debt || 0));
  const limitReached = hasReachedOrExceededCreditLimit(customer);

  const sortedCreditSales = [...sales]
    .filter((s) => s.payment_type === 'آجل' || s.remaining_amount > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const latestSale = sortedCreditSales[0] || [...sales].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestPayment = [...payments].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];

  const statusToneClasses = {
    emerald: isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-300',
    amber: isDarkMode ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-900 border-amber-300',
    red: isDarkMode ? 'bg-red-950 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-300',
    purple: isDarkMode ? 'bg-purple-950 text-purple-200 border-purple-700' : 'bg-purple-100 text-purple-900 border-purple-300',
    slate: isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-300',
  }[statusInfo.tone];

  return (
    <article
      className={`${theme.cardBg} rounded-2xl border ${theme.borderColor} p-3 space-y-2.5 relative`}
      aria-label={`بطاقة العميل ${customer.name}`}
    >
      {/* Top Row: Identity, Debt, Status & ⋮ Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenStatement(customer)}
              className={`font-extrabold text-sm hover:text-[#C9A961] text-right truncate ${theme.textPrimary}`}
            >
              {customer.name}
            </button>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusToneClasses}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className={`text-[11px] flex items-center gap-1.5 flex-wrap ${theme.textSecondary}`}>
            <span className="font-mono font-semibold">#{customer.id}</span>
            <span>•</span>
            <Phone className="w-3 h-3 shrink-0" />
            {customer.phone ? (
              <span className="font-mono" dir="ltr">{customer.phone}</span>
            ) : (
              <span className="flex items-center gap-1">
                <span>بدون هاتف</span>
                <button
                  type="button"
                  onClick={() => onOpenQuickPhone(customer)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                    isDarkMode
                      ? 'bg-[#121B17] border-[#C9A961]/60 text-[#C9A961] hover:bg-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>إضافة رقم</span>
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Balance + ⋮ Button */}
        <div className="flex items-start gap-1.5 shrink-0">
          <div className={`text-left px-2.5 py-1.5 rounded-xl border ${
            customer.total_debt > 0
              ? isDarkMode
                ? 'bg-red-950/60 border-red-800/80'
                : 'bg-red-50 border-red-200'
              : isDarkMode
                ? 'bg-emerald-950/50 border-emerald-800/80'
                : 'bg-emerald-50 border-emerald-200'
          }`}>
            <p className={`text-[9px] font-semibold ${theme.textSecondary}`}>الرصيد / المديونية</p>
            <p className={`font-extrabold text-xs font-mono ${
              customer.total_debt > 0
                ? isDarkMode ? 'text-red-300' : 'text-red-700'
                : isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              {formatCurrency(customer.total_debt)}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={`خيارات إضافية للعميل ${customer.name}`}
              aria-expanded={menuOpen}
              className={`p-1.5 rounded-xl border transition ${
                isDarkMode
                  ? 'bg-[#121B17] border-emerald-800 text-gray-200 hover:bg-emerald-950'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className={`absolute left-0 top-9 z-30 w-44 rounded-2xl border shadow-xl overflow-hidden ${
                  isDarkMode ? 'bg-[#121B17] border-emerald-800 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEditCustomer(customer); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b ${theme.borderColor} ${
                    isDarkMode ? 'hover:bg-emerald-950/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#C9A961]" />
                  <span>تعديل بيانات العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onScheduleDueDate(customer); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b ${theme.borderColor} ${
                    isDarkMode ? 'hover:bg-emerald-950/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5 text-sky-500" />
                  <span>جدولة السداد</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onMergeCustomer(customer); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b ${theme.borderColor} ${
                    isDarkMode ? 'hover:bg-emerald-950/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <Merge className="w-3.5 h-3.5 text-amber-500" />
                  <span>دمج عميل</span>
                </button>
                {archived ? (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onRestoreCustomer(customer); }}
                    className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b ${theme.borderColor} ${
                      isDarkMode ? 'hover:bg-emerald-950/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                    <span>استعادة من الأرشيف</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onArchiveCustomer(customer); }}
                    className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b ${theme.borderColor} ${
                      isDarkMode ? 'hover:bg-emerald-950/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5 text-gray-400" />
                    <span>أرشفة العميل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onSafeDeleteCustomer(customer); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold flex items-center gap-2 text-red-500 ${
                    isDarkMode ? 'hover:bg-red-950/50' : 'hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف آمن</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Special Action Banner 1: Release Suspended Customer */}
      {suspended && (
        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
          isDarkMode ? 'bg-purple-950/60 border-purple-700 text-purple-100' : 'bg-purple-50 border-purple-300 text-purple-950'
        }`}>
          <span className="text-[11px] font-bold">العميل موقوف حالياً عن البيع الآجل</span>
          <button
            type="button"
            onClick={() => onReleaseSuspended(customer)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961] text-[11px] font-bold flex items-center gap-1 shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9A961]" />
            <span>إخراج من الموقوفين</span>
          </button>
        </div>
      )}

      {/* Special Action Banner 2: Reached / Exceeded Credit Limit */}
      {limitReached && (
        <div className={`p-2.5 rounded-xl border space-y-1.5 ${
          isDarkMode ? 'bg-amber-950/50 border-amber-700 text-amber-100' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                بلغ أو تجاوز الحد الائتماني ({formatCurrency(customer.total_debt)} / {formatCurrency(limit)})
              </span>
            </div>
            {customer.allow_credit_override ? (
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isDarkMode ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  تم السماح بالبيع الآجل
                </span>
                <button
                  type="button"
                  onClick={() => onAllowCreditOverride(customer, false)}
                  className="text-[10px] underline font-bold"
                >
                  إلغاء السماح
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAllowCreditOverride(customer, true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961] text-[11px] font-bold shrink-0"
              >
                سماح بمواصلة البيع الآجل
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6-Cell Details Grid (covering Credit Limit, Available, Last Purchase + value, Last Payment + value, Next Due, Category) */}
      <div className={`grid grid-cols-2 gap-1.5 p-2.5 rounded-xl border text-[10px] ${
        isDarkMode ? 'bg-[#121B17] border-emerald-900/60 text-gray-200' : 'bg-[#FAF8F3] border-gray-200 text-gray-800'
      }`}>
        <div>
          <span className={theme.textSecondary}>الحد الائتماني: </span>
          <strong className="font-mono">{formatCurrency(limit)}</strong>
        </div>
        <div>
          <span className={theme.textSecondary}>المتاح: </span>
          <strong className={`font-mono ${available === 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {formatCurrency(available)}
          </strong>
        </div>
        <div className="truncate">
          <span className={theme.textSecondary}>آخر شراء: </span>
          <strong>
            {latestSale
              ? `${latestSale.created_at.slice(0, 10)} (${formatCurrency(latestSale.total_amount)})`
              : customer.last_purchase_at?.slice(0, 10) || '-'}
          </strong>
        </div>
        <div className="truncate">
          <span className={theme.textSecondary}>آخر سداد: </span>
          <strong>
            {latestPayment
              ? `${latestPayment.created_at.slice(0, 10)} (${formatCurrency(latestPayment.amount)})`
              : customer.last_payment_at?.slice(0, 10) || '-'}
          </strong>
        </div>
        <div>
          <span className={theme.textSecondary}>السداد القادم: </span>
          <strong className="font-mono">{customer.next_due_at ? customer.next_due_at.slice(0, 10) : '-'}</strong>
        </div>
        <div>
          <span className={theme.textSecondary}>التصنيف: </span>
          <strong>{customer.category || 'جديد'}</strong>
        </div>
      </div>

      {/* Section: سجل الحركات والتفاصيل */}
      <div className={`rounded-xl border ${theme.borderColor} overflow-hidden`}>
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          className={`w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold ${
            isDarkMode ? 'bg-[#121B17] text-gray-100 hover:bg-[#17231E]' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
          }`}
        >
          <span>سجل الحركات والتفاصيل ({timeline.length})</span>
          {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {historyOpen && (
          <div className="divide-y divide-gray-200/20 max-h-56 overflow-y-auto">
            {timeline.length === 0 ? (
              <div className={`p-3 text-center text-[11px] ${theme.textSecondary}`}>
                لا توجد حركات فواتير أو سندات مسجلة بعد
              </div>
            ) : (
              timeline.map((row) => (
                <div key={row.uid} className="p-2.5 text-[10px] space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold px-1.5 py-0.5 rounded-md ${
                          row.kind === 'invoice'
                            ? isDarkMode ? 'bg-red-950/70 text-red-200' : 'bg-red-50 text-red-800'
                            : isDarkMode ? 'bg-emerald-950/70 text-emerald-200' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {row.sign ? `(${row.sign}) ` : ''}{row.title}
                        </span>
                      </div>
                      <p className={`text-[9px] font-mono mt-0.5 ${theme.textSecondary}`}>
                        {formatDateTimeDisplay(row.date)}
                      </p>
                      {row.note && (
                        <p className={`text-[10px] mt-0.5 ${theme.textSecondary}`}>ملاحظة: {row.note}</p>
                      )}
                    </div>

                    <div className="text-left shrink-0">
                      <p className={`font-bold font-mono ${
                        row.kind === 'invoice'
                          ? isDarkMode ? 'text-red-300' : 'text-red-700'
                          : isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                      }`}>
                        {row.sign}{formatCurrency(row.amount)}
                      </p>
                      <p className={`text-[9px] font-mono ${theme.textSecondary}`}>
                        الرصيد بعد الحركة: <strong>{formatCurrency(row.balanceAfter)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end">
                    {row.kind === 'invoice' && (
                      <button
                        type="button"
                        onClick={() => onViewInvoiceItems(customer, row)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                          isDarkMode
                            ? 'bg-[#121B17] border-sky-700 text-sky-200 hover:bg-sky-950/60'
                            : 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>تفاصيل الأصناف</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onShareTimelineRow(customer, row)}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                        isDarkMode
                          ? 'bg-[#121B17] border-emerald-700 text-emerald-200 hover:bg-emerald-950/60'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <Share2 className="w-3 h-3" />
                      <span>مشاركة الحركة</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom 4 Main Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenNewCreditInvoice(customer)}
          className="py-2.5 px-2.5 rounded-xl bg-[#0B3D2E] hover:bg-[#093125] text-white border border-[#C9A961]/60 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-[#C9A961] shrink-0" />
          <span>+ فاتورة آجلة جديدة</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenPayment(customer)}
          className="py-2.5 px-2.5 rounded-xl bg-[#1F9D55] hover:bg-[#198748] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
        >
          <CreditCard className="w-3.5 h-3.5 shrink-0" />
          <span>تسديد</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenStatement(customer)}
          className={`py-2.5 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
            isDarkMode
              ? 'bg-[#121B17] border-sky-600 text-sky-200 hover:bg-sky-950/60'
              : 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>كشف حساب</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenShareMenu(customer)}
          className={`py-2.5 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
            isDarkMode
              ? 'bg-[#121B17] border-[#C9A961]/70 text-[#F3D892] hover:bg-amber-950/40'
              : 'bg-amber-50 border-amber-400 text-amber-950 hover:bg-amber-100'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          <span>مشاركة</span>
        </button>
      </div>
    </article>
  );
};
