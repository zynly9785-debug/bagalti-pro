/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, FileText, CheckCircle2, History, AlertCircle } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Sale, Product, Customer, ReturnItem } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface ReturnsScreenProps {
  storeId: number;
  initialCustomerId?: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const ReturnsScreen: React.FC<ReturnsScreenProps> = ({
  storeId,
  initialCustomerId,
  onNavigate,
}) => {
  const { theme, isDarkMode } = useTheme();
  const restriction = db.getStoreRestriction(storeId);
  const isRestricted = restriction.restricted;
  const [returnsList, setReturnsList] = useState<ReturnItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Dialogs
  const [showFromInvoiceModal, setShowFromInvoiceModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Return from invoice form state
  const [selectedSaleId, setSelectedSaleId] = useState<number | ''>('');
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [returnQty, setReturnQty] = useState('1');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Credit return form state
  const [creditCustomerId, setCreditCustomerId] = useState<number | ''>(initialCustomerId || '');
  const [creditProductId, setCreditProductId] = useState<number | ''>('');
  const [creditAmount, setCreditAmount] = useState('');

  useEffect(() => {
    loadData();
  }, [storeId]);

  const loadData = () => {
    setReturnsList(db.getReturns(storeId));
    setSales(db.getSales(storeId));
    setCustomers(db.getCustomers(storeId));
    setProducts(db.getProducts(storeId));
  };

  const handleSaleSelectChange = (saleIdStr: string) => {
    if (!saleIdStr) {
      setSelectedSaleId('');
      setInvoiceItems([]);
      return;
    }
    const saleId = Number(saleIdStr);
    setSelectedSaleId(saleId);
    const items = db.getSaleItems(saleId);
    setInvoiceItems(items);
    if (items.length > 0) {
      setSelectedProductId(items[0].product_id);
      setReturnQty('1');
    }
  };

  const sortedSales = [...sales].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const filteredSales = sortedSales.filter((sale) => {
    const customerName = sale.customer_name || customers.find((customer) => customer.id === sale.customer_id)?.name || '';
    const query = invoiceSearch.trim().toLocaleLowerCase();
    return !query || String(sale.id).includes(query) || customerName.toLocaleLowerCase().includes(query);
  });
  const openInvoiceModal = () => {
    if (isRestricted) return;
    setInvoiceSearch('');
    setShowFromInvoiceModal(true);
    const preferredSale = sortedSales.find((sale) => initialCustomerId && sale.customer_id === initialCustomerId);
    if (preferredSale) handleSaleSelectChange(String(preferredSale.id));
  };

  const selectedInvoiceLine = invoiceItems.find((it) => it.product_id === Number(selectedProductId));
  const returnedQtyForLine = selectedSaleId && selectedProductId ? db.getReturns(storeId).filter(r => r.type === 'invoice' && r.sale_id === Number(selectedSaleId) && r.product_id === Number(selectedProductId)).reduce((sum, r) => sum + r.qty, 0) : 0;
  const availableReturnQty = Math.max(0, (selectedInvoiceLine?.qty || 0) - returnedQtyForLine);

  const handleExecuteInvoiceReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted || !selectedSaleId || !selectedProductId) return;

    const sale = db.getSaleById(storeId, Number(selectedSaleId));
    if (!sale) return;

    const item = invoiceItems.find((it) => it.product_id === Number(selectedProductId));
    const qty = Number(returnQty);
    if (!Number.isFinite(qty) || qty <= 0 || !item || qty > availableReturnQty + 1e-9) { setNotice(`الكمية غير صالحة. المتاح للإرجاع: ${availableReturnQty}`); return; }
    const itemPrice = item.price;
    const amount = qty * itemPrice;

    try { db.returnFromInvoice({ store_id: storeId, sale_id: sale.id, customer_id: sale.customer_id, product_id: Number(selectedProductId), qty, amount }); } catch (err) { setNotice(err instanceof Error ? err.message : 'تعذر تسجيل المرتجع'); return; }

    setNotice(`تم إرجاع الصنف بنجاح وإعادة الكمية للمخزون${sale.customer_id && sale.payment_type === 'آجل' ? ' وخصم القيمة من دين العميل' : ''}!`);
    setShowFromInvoiceModal(false);
    setSelectedSaleId('');
    setSelectedProductId('');
    setReturnQty('1');
    loadData();
    setTimeout(() => setNotice(null), 3500);
  };

  const handleExecuteCreditReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted || !creditCustomerId || !creditAmount) return;

    const amount = Number(creditAmount);
    try {
      db.creditReturn({
        store_id: storeId,
        customer_id: Number(creditCustomerId),
        product_id: Number(creditProductId) || (products[0] ? products[0].id : 1),
        amount,
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'تعذر تسجيل المرتجع الدائن');
      return;
    }

    setNotice(`تم خصم ${amount} ر.ي من دين العميل كمرتجع دائن بنجاح!`);
    setShowCreditModal(false);
    setCreditAmount('');
    loadData();
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden relative`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">إدارة المرتجعات والتسويات</h2>
        </div>
        <RotateCcw className="w-5 h-5 text-[#C9A961]" />
      </div>

      {isRestricted && (
        <div className="bg-[#8B2E2E] text-white px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{restriction.message}</span>
        </div>
      )}

      {notice && (
        <div className="bg-emerald-700 text-white p-2.5 text-xs text-center font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#C9A961]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Action Buttons: [مرتجع من فاتورة] و [مرتجع دائن] */}
      <div className={`p-4 ${theme.cardBg} border-b ${theme.borderColor} grid grid-cols-2 gap-3 shadow-xs`}>
        <button
          disabled={isRestricted}
          onClick={openInvoiceModal}
          className={`p-3 disabled:opacity-40 ${
            isDarkMode ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-800' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
          } border rounded-2xl flex flex-col items-center text-center transition`}
        >
          <FileText className="w-6 h-6 text-[#C9A961] mb-1" />
          <span className={`font-bold text-xs ${theme.textPrimary}`}>مرتجع من فاتورة</span>
          <span className={`text-[10px] ${theme.textSecondary} mt-0.5`}>إرجاع صنف من مبيعات سابقة</span>
        </button>

        <button
          disabled={isRestricted}
          onClick={() => setShowCreditModal(true)}
          className={`p-3 disabled:opacity-40 ${
            isDarkMode ? 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-800' : 'bg-amber-50 hover:bg-amber-100 border-amber-300'
          } border rounded-2xl flex flex-col items-center text-center transition`}
        >
          <RotateCcw className="w-6 h-6 text-[#C9A961] mb-1" />
          <span className={`font-bold text-xs ${theme.textPrimary}`}>مرتجع دائن</span>
          <span className={`text-[10px] ${theme.textSecondary} mt-0.5`}>خصم مباشر من دين الزبون</span>
        </button>
      </div>

      {/* History of Returns */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        <h3 className="font-bold text-xs text-[#C9A961] flex items-center gap-1.5 mb-2">
          <History className="w-4 h-4 text-[#C9A961]" />
          <span>سجل العمليات المرتجعة:</span>
        </h3>

        {returnsList.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            لا توجد مرتجعات مسجلة حتى الآن
          </div>
        ) : (
          returnsList.map((ret) => (
            <div
              key={ret.id}
              className={`${theme.cardBg} rounded-2xl p-3 shadow-xs border ${theme.borderColor} text-xs space-y-1`}
            >
              <div className="flex justify-between items-center">
                <span className={`font-bold ${theme.textPrimary}`}>
                  {ret.type === 'invoice' ? `مرتجع فاتورة #${ret.sale_id}` : 'مرتجع دائن (تسوية دين)'}
                </span>
                <span className="font-bold text-[#8B2E2E] font-mono">
                  - {formatCurrency(ret.amount)}
                </span>
              </div>
              <p className={`text-[10px] ${theme.textSecondary} font-mono`}>
                {ret.created_at} | كمية: {ret.qty}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Return From Invoice Modal */}
      {showFromInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>مرتجع من فاتورة سابقة</h3>

            <form onSubmit={handleExecuteInvoiceReturn} className="space-y-3">
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>ابحث برقم الفاتورة أو اسم العميل:</label>
                <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="رقم الفاتورة أو العميل" className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs mb-2`} />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredSales.map((sale) => {
                    const name = sale.customer_name || customers.find((customer) => customer.id === sale.customer_id)?.name || 'عميل نقدي';
                    return <button type="button" key={sale.id} onClick={() => handleSaleSelectChange(String(sale.id))} className={`w-full text-right rounded-lg border p-2 text-[10px] ${Number(selectedSaleId) === sale.id ? 'border-[#C9A961] bg-[#C9A961]/10' : theme.borderColor}`}>
                      <span className="font-bold">فاتورة #{sale.id}</span><span className={`block ${theme.textSecondary}`}>{sale.created_at} · {sale.total_amount} ر.ي · {name}</span>
                    </button>;
                  })}
                  {!filteredSales.length && <p className={`text-[10px] ${theme.textSecondary} p-2`}>لا توجد فواتير مطابقة</p>}
                </div>
              </div>

              {invoiceItems.length > 0 && (
                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>الصنف المرتجع:</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`}
                    required
                  >
                    {invoiceItems.map((it) => (
                      <option key={it.id} value={it.product_id} className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>
                        {it.product_name || `صنف #${it.product_id}`} (الأصلي: {it.qty}، المرتجع: {db.getReturns(storeId).filter(r => r.type === 'invoice' && r.sale_id === Number(selectedSaleId) && r.product_id === it.product_id).reduce((n,r) => n+r.qty,0)}، المتاح: {Math.max(0, it.qty - db.getReturns(storeId).filter(r => r.type === 'invoice' && r.sale_id === Number(selectedSaleId) && r.product_id === it.product_id).reduce((n,r) => n+r.qty,0))})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>الكمية المرتجعة:</label>
                <input
                  type="number"
                  min={products.find((product) => product.id === Number(selectedProductId))?.unit_type === 'كيلو' ? '0.001' : '1'}
                  max={availableReturnQty}
                  step={products.find((product) => product.id === Number(selectedProductId))?.unit_type === 'كيلو' ? '0.001' : '1'}
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs font-mono`}
                  required
                  disabled={!availableReturnQty}
                />
                <p className="text-[10px] text-gray-500 mt-1">المتاح للإرجاع من هذا الصنف: {availableReturnQty}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!selectedSaleId || !availableReturnQty}
                  className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] disabled:opacity-50 border border-[#C9A961]/40"
                >
                  تأكيد الإرجاع
                </button>
                <button
                  type="button"
                  onClick={() => setShowFromInvoiceModal(false)}
                  className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Return Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-amber-800' : 'border-amber-400'} space-y-3`}>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>مرتجع دائن (خصم من الدين)</h3>

            <form onSubmit={handleExecuteCreditReturn} className="space-y-3">
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>اختر العميل:</label>
                <select
                  value={creditCustomerId}
                  onChange={(e) => setCreditCustomerId(Number(e.target.value))}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`}
                  required
                >
                  <option value="" className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>-- اختر العميل المدين --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>
                      {c.name} (الدين: {c.total_debt} ر.ي)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>المبلغ المراد خصمه (ر.ي):</label>
                <input
                  type="number"
                  placeholder="أدخل قيمة المرتجع..."
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs font-mono font-bold`}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!creditCustomerId || !creditAmount}
                  className="flex-1 bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-amber-800 disabled:opacity-50 border border-amber-500/40"
                >
                  تأكيد الخصم من الدين
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
