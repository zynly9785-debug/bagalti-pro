/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Printer, X, Check, Share2 } from 'lucide-react';
import { formatCurrency } from '../../utils/pureLogic.ts';
import { SaleItem } from '../../types/index.ts';
import { db } from '../../db/sqlite-simulation.ts';
import { printReceiptOverBluetooth } from '../../services/bluetoothPrinter.ts';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  saleId: number;
  items: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentType: string;
  customerName?: string;
  dateStr: string;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  storeName,
  saleId,
  items,
  totalAmount,
  paidAmount,
  remainingAmount,
  paymentType,
  customerName,
  dateStr,
}) => {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  if (!isOpen) return null;
  const preferences = db.getSharedPreferences();
  const receiptFooter = preferences.receipt_footer?.trim() || 'شكراً لتسوقكم معنا ونسعد بخدمتكم دائماً';
  const receiptWidth = preferences.receipt_width_mm === '80' ? '300px' : '220px';

  const handlePrint = async () => {
    const printerAddress = preferences.thermal_printer_address;
    if (!Capacitor.isNativePlatform() || !printerAddress) {
      window.print();
      return;
    }
    const lines = [
      storeName,
      `فاتورة: #${saleId}    ${dateStr}`,
      ...(customerName ? [`العميل: ${customerName}`] : []),
      '--------------------------------',
      'الصنف | الكمية × السعر | الإجمالي',
      ...items.map((item) => `${item.product_name || `صنف #${item.product_id}`} | ${item.qty} × ${item.price} | ${formatCurrency(item.qty * item.price)}`),
      '--------------------------------',
      `الإجمالي: ${formatCurrency(totalAmount)}`,
      `المدفوع: ${formatCurrency(paidAmount)}`,
      ...(remainingAmount > 0 ? [`المتبقي: ${formatCurrency(remainingAmount)}`] : []),
      `طريقة الدفع: ${paymentType}`,
      '',
      receiptFooter,
      '',
    ];
    setPrinting(true);
    setPrintError('');
    try {
      await printReceiptOverBluetooth(printerAddress, lines.join('\n'));
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'تعذرت طباعة الإيصال.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-300 flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#C9A961]" />
            <h3 className="font-bold text-sm">معاينة وطباعة الفاتورة الحرارية</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Paper representation */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-100 flex justify-center">
          <div
            id="thermal-receipt"
            className="w-full bg-white p-4 shadow-md border-t-4 border-[#0B3D2E] text-gray-800 text-xs font-mono select-text"
            style={{ maxWidth: receiptWidth }}
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-2">
              <h2 className="font-bold text-base text-gray-900 font-sans">{storeName}</h2>
              <p className="text-[10px] text-gray-500">فاتورة مبيعات ضريبية مبسطة</p>
              <div className="mt-1 text-[11px] flex justify-between text-gray-600">
                <span>فاتورة: #{saleId}</span>
                <span>{dateStr}</span>
              </div>
              {customerName && (
                <p className="text-[11px] font-bold text-emerald-900 mt-0.5 text-right font-sans">
                  العميل: {customerName}
                </p>
              )}
            </div>

            {/* Items Table */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="flex justify-between font-bold text-[11px] border-b border-gray-200 pb-1 mb-1 font-sans">
                <span>الصنف</span>
                <span>الكمية × السعر</span>
                <span>المجموع</span>
              </div>
              <div className="space-y-1">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[110px] font-sans">{it.product_name || `صنف #${it.product_id}`}</span>
                    <span className="text-gray-500 font-mono">{it.qty} × {it.price}</span>
                    <span className="font-bold font-mono">{it.qty * it.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-b border-dashed border-gray-400 pb-2 mb-3">
              <div className="flex justify-between font-bold text-sm">
                <span>الإجمالي:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>المدفوع:</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>
              {remainingAmount > 0 && (
                <div className="flex justify-between text-[#8B2E2E] font-bold">
                  <span>المتبقي (دين):</span>
                  <span>{formatCurrency(remainingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-emerald-800">{paymentType}</span>
              </div>
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-1">
              <div className="font-mono text-[9px] tracking-widest text-gray-400">
                ||| | || |||| | ||| |||| |
              </div>
              <p className="text-[9px] text-gray-400">#{saleId}POS-SYSTEM</p>
              <p className="text-[10px] font-sans font-bold text-gray-700 mt-2">
                {receiptFooter}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {printError && <p role="alert" className="px-3 py-2 text-xs text-red-700">{printError}</p>}
        <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
          <button
            onClick={() => void handlePrint()}
            disabled={printing}
            className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#06231A] disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-[#C9A961]" />
            <span>{printing ? 'جارٍ إرسال الإيصال…' : 'طباعة الإيصال / حفظ PDF'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
