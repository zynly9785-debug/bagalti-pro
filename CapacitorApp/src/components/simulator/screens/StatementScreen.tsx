/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, Share2, Receipt, Phone, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Sale, SaleItem } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { WhatsAppShareModal } from '../WhatsAppShareModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface StatementScreenProps {
  storeId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const StatementScreen: React.FC<StatementScreenProps> = ({
  storeId,
  customerId,
  customerName,
  customerPhone,
  totalDebt,
  onNavigate,
}) => {
  const { theme, isDarkMode } = useTheme();
  const [sales, setSales] = useState<{ sale: Sale; items: SaleItem[] }[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [storeId, customerId]);

  const loadCustomerData = () => {
    const list = db.getCustomerSales(storeId, customerId);
    const detailed = list.map((s) => ({
      sale: s,
      items: db.getSaleItems(s.id),
    }));
    setSales(detailed);
  };

  const generateStatementText = () => {
    const store = db.findUserById(storeId);
    let text = `📋 *كشف حساب تفصيلي للعميل: ${customerName}*\n`;
    text += `متجر: ${store ? store.store_name : 'البقالة'}\n`;
    text += `رقم الهاتف: ${customerPhone || '-'}\n`;
    text += `💰 *الرصيد المستحق (الدين الحالي):* *${totalDebt} ر.ي*\n`;
    text += `================================\n`;
    text += `سجل العمليات والفواتير السابقة:\n\n`;

    sales.forEach((item) => {
      text += `🧾 فاتورة #${item.sale.id} (${item.sale.created_at})\n`;
      item.items.forEach((it) => {
        text += `  • ${it.product_name || 'صنف'} (${it.qty} × ${it.price})\n`;
      });
      text += `  المجموع: ${item.sale.total_amount} ر.ي | المدفوع: ${item.sale.paid_amount} ر.ي`;
      if (item.sale.remaining_amount > 0) {
        text += ` | المتبقي (آجل): ${item.sale.remaining_amount} ر.ي`;
      }
      text += `\n--------------------------------\n`;
    });

    text += `\nشاكرين لكم حسن التعامل والمبادرة بالسداد.`;
    return text;
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('customers')}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">كشف حساب العميل</h2>
        </div>

        <button
          onClick={() => setIsShareModalOpen(true)}
          className="bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>مشاركة كشف الحساب</span>
        </button>
      </div>

      {/* Customer Info Card */}
      <div className={`p-4 ${theme.cardBg} border-b ${theme.borderColor} shadow-xs`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>{customerName}</h3>
            <p className={`text-xs ${theme.textSecondary} font-mono mt-0.5`}>{customerPhone || 'بدون هاتف'}</p>
          </div>
          <div className={`text-left ${
            isDarkMode ? 'bg-red-950/60 border-red-900/60' : 'bg-red-50 border-red-200'
          } border px-3 py-1.5 rounded-xl`}>
            <span className={`text-[10px] ${theme.textSecondary} block`}>إجمالي الدين الحالي:</span>
            <span className="text-sm font-extrabold text-[#8B2E2E] font-mono">
              {formatCurrency(totalDebt)}
            </span>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <h4 className="text-xs font-bold text-[#C9A961] flex items-center gap-1">
          <Receipt className="w-4 h-4 text-[#C9A961]" />
          <span>سجل الفواتير والمشتريات:</span>
        </h4>

        {sales.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            لا توجد فواتير مسجلة لهذا العميل
          </div>
        ) : (
          sales.map(({ sale, items }) => (
            <div
              key={sale.id}
              className={`${theme.cardBg} rounded-2xl p-3 shadow-xs border ${theme.borderColor} space-y-2`}
            >
              <div className={`flex justify-between items-center text-xs pb-1.5 border-b ${theme.borderColor}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${theme.textPrimary}`}>فاتورة #{sale.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    sale.payment_type === 'نقداً'
                      ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                      : isDarkMode ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-100 text-[#8B2E2E]'
                  }`}>
                    {sale.payment_type}
                  </span>
                </div>
                <span className={`text-[10px] ${theme.textSecondary} font-mono`}>{sale.created_at}</span>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1 text-xs">
                {items.map((it) => (
                  <div key={it.id} className={`flex justify-between ${theme.textPrimary} text-[11px]`}>
                    <span className="truncate">{it.product_name || `صنف #${it.product_id}`}</span>
                    <span className={`font-mono ${theme.textSecondary}`}>{it.qty} × {it.price} = {it.qty * it.price} ر.ي</span>
                  </div>
                ))}
              </div>

              {/* Total & Remaining */}
              <div className={`pt-2 border-t ${theme.borderColor} flex justify-between text-xs font-mono`}>
                <div>
                  <span className={theme.textSecondary}>الإجمالي: </span>
                  <span className={`font-bold ${theme.textPrimary}`}>{sale.total_amount} ر.ي</span>
                </div>
                {sale.remaining_amount > 0 && (
                  <div>
                    <span className="text-[#8B2E2E] font-bold">باقي دين: </span>
                    <span className="font-bold text-[#8B2E2E]">{sale.remaining_amount} ر.ي</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="مشاركة كشف الحساب عبر واتساب"
        messageText={generateStatementText()}
        targetPhone={customerPhone}
      />
    </div>
  );
};
