/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Scan,
  Search,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  Share2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Percent,
  Coins,
  DollarSign,
  UserPlus,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Product, Customer, CartItem, SaleItem, ParkedSale } from '../../../types/index.ts';
import { calculateSaleRemaining, calculateDiscountedTotal, checkCreditLimitWarning, formatCurrency } from '../../../utils/pureLogic.ts';
import { BarcodeScannerModal } from '../BarcodeScannerModal.tsx';
import { ReceiptPrintModal } from '../ReceiptPrintModal.tsx';
import { WhatsAppShareModal } from '../WhatsAppShareModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface PosScreenProps {
  storeId: number;
  isSuspended: boolean;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({ storeId, isSuspended, onNavigate }) => {
  const { isDarkMode, theme } = useTheme();
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Dialogs
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [quantityDialogItem, setQuantityDialogItem] = useState<{ product: Product; defaultQty: number } | null>(null);
  const [dialogQtyInput, setDialogQtyInput] = useState('1');
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);
  const [quickProducts, setQuickProducts] = useState<Product[]>([]);
  const [showQuickManager, setShowQuickManager] = useState(false);

  // Post-sale completion modal
  const [completedSaleData, setCompletedSaleData] = useState<{
    saleId: number;
    total: number;
    paid: number;
    remaining: number;
    items: SaleItem[];
    dateStr: string;
    customerName?: string;
  } | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // AutoComplete lists
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);

  useEffect(() => {
    loadParked();
  }, [storeId]);

  const loadParked = () => { setParkedSales(db.getParkedSales(storeId)); };
  useEffect(() => { setQuickProducts(db.getQuickProducts(storeId)); }, [storeId]);

  useEffect(() => {
    if (productQuery.trim().length >= 2) {
      setProductSuggestions(db.searchProducts(storeId, productQuery));
    } else {
      setProductSuggestions([]);
    }
  }, [productQuery, storeId]);

  useEffect(() => {
    if (customerQuery.trim().length >= 1) {
      setCustomerSuggestions(db.searchCustomers(storeId, customerQuery));
    } else {
      setCustomerSuggestions([]);
    }
  }, [customerQuery, storeId]);

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = Math.max(0, Number(discountInput) || 0);
  const totalAmount = calculateDiscountedTotal(rawSubtotal, discountAmount);

  const paidAmount = paidInput === '' ? totalAmount : Math.max(0, Number(paidInput) || 0);
  const { remainingAmount } = calculateSaleRemaining(totalAmount, paidAmount);

  // Currency conversions (standard regional grocery rates)
  const sarEquiv = (totalAmount / 140).toFixed(1);
  const usdEquiv = (totalAmount / 530).toFixed(1);

  // Credit limit alert
  const creditLimitWarning =
    selectedCustomer && remainingAmount > 0
      ? checkCreditLimitWarning(selectedCustomer.total_debt, remainingAmount, selectedCustomer.credit_limit || 50000)
      : null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Fast direct add to cart (+1 or create)
  const addProductDirectly = (product: Product, qtyToAdd = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].qty + qtyToAdd;
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: newQty,
          subtotal: newQty * product.sale_price,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product,
            qty: qtyToAdd,
            price: product.sale_price,
            subtotal: qtyToAdd * product.sale_price,
          },
        ];
      }
    });
    showToast(`✅ أضيف للسلة: ${product.name} (+${qtyToAdd})`);
  };

  // Rapid continuous scanner handler
  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const prod = db.getProductByBarcode(storeId, barcode);
    if (prod) { setDialogQtyInput(prod.unit_type === 'كيلو' ? '0.5' : '1'); setQuantityDialogItem({ product: prod, defaultQty: 1 }); }
    else showToast(`لم يتم العثور على صنف بالباركود: ${barcode}`);
  };

  const handleSelectProduct = (product: Product) => {
    setProductQuery('');
    setProductSuggestions([]);
    setDialogQtyInput(product.unit_type === 'كيلو' ? '0.5' : '1');
    setQuantityDialogItem({ product, defaultQty: 1 });
  };

  const handleConfirmAddToCart = () => {
    if (!quantityDialogItem) return;
    const qty = Number(dialogQtyInput);
    if (!Number.isFinite(qty) || qty <= 0) { showToast('أدخل كمية أكبر من صفر'); return; }
    if (qty > quantityDialogItem.product.quantity) { showToast(`المتوفر ${quantityDialogItem.product.quantity} فقط`); return; }
    addProductDirectly(quantityDialogItem.product, qty);
    setQuantityDialogItem(null);
  };

  const updateCartItemQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = Math.max(0, item.qty + delta);
            return {
              ...item,
              qty: nextQty,
              subtotal: nextQty * item.price,
            };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const removeCartItem = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Park (Hold) Bill
  const handleParkSale = () => {
    if (cart.length === 0) {
      showToast('⚠️ السلة فارغة، لا يوجد ما يتم تعليقه!');
      return;
    }

    const parked: ParkedSale = {
      id: `PARK_${Date.now()}`,
      store_id: storeId,
      cart: [...cart],
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || customerQuery.trim() || undefined,
      discount: discountAmount,
      created_at: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
    };

    db.parkSale(parked);
    loadParked();
    // Clear current POS
    setCart([]);
    setSelectedCustomer(null);
    setCustomerQuery('');
    setPaidInput('');
    setDiscountInput('');
    showToast('⏸️ تم تعليق الفاتورة بنجاح. يمكنك خدمة العميل التالي!');
  };

  const handleResumeParkedSale = (parked: ParkedSale) => {
    setCart(parked.cart);
    setDiscountInput(parked.discount > 0 ? parked.discount.toString() : '');
    if (parked.customer_id) {
      const c = db.getCustomerById(storeId, parked.customer_id);
      setSelectedCustomer(c);
      setCustomerQuery('');
    } else if (parked.customer_name) {
      setCustomerQuery(parked.customer_name);
      setSelectedCustomer(null);
    }
    db.removeParkedSale(parked.id);
    loadParked();
    setIsParkedModalOpen(false);
    showToast('▶️ تم استرجاع الفاتورة المعلقة إلى السلة!');
  };

  const handleDeleteParkedSale = (id: string) => {
    db.removeParkedSale(id);
    loadParked();
  };

  const handleCompleteSale = () => {
    if (isSuspended) {
      showToast('⚠️ حسابك موقوف! لا يمكنك إجراء عمليات بيع.');
      return;
    }

    if (cart.length === 0) {
      showToast('⚠️ سلة المشتريات فارغة!');
      return;
    }

    let customerIdToUse = selectedCustomer ? selectedCustomer.id : null;
    let customerNameToUse = selectedCustomer ? selectedCustomer.name : undefined;

    // Strict Rule: Auto-create customer if name entered and sale is credit (remaining > 0)
    if (remainingAmount > 0) {
      if (!customerIdToUse) {
        const typedName = customerQuery.trim();
        if (!typedName) {
          showToast('⚠️ البيع الآجل يتطلب إدخال اسم الزبون لفتح حساب وتسجيل الدين!');
          return;
        }
        // Let completeSale handle finding or auto-creating the customer!
        customerNameToUse = typedName;
      }
    }

    const paymentType = remainingAmount > 0 ? 'آجل' : 'نقداً';

    const saleItemsParam = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      qty: item.qty,
      price: item.price,
    }));

    let result;
    try { result = db.completeSale({
      store_id: storeId,
      customer_id: customerIdToUse,
      new_customer_name: customerNameToUse,
      total_amount: totalAmount,
      discount_amount: discountAmount,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payment_type: paymentType,
      items: saleItemsParam,
    }); } catch (error) { showToast(error instanceof Error ? error.message : 'تعذر إتمام البيع'); return; }

    if (result.customerCreated) {
      showToast(`🎉 تم فتح حساب جديد تلقائياً للعميل: ${result.customerCreated.name} وقيد الدين عليه!`);
    }

    setCompletedSaleData({
      saleId: result.sale.id,
      total: totalAmount,
      paid: paidAmount,
      remaining: remainingAmount,
      items: result.items,
      dateStr: result.sale.created_at,
      customerName: result.sale.customer_name || customerNameToUse,
    });

    // Reset POS
    setCart([]);
    setPaidInput('');
    setDiscountInput('');
    setProductQuery('');
    setCustomerQuery('');
    setSelectedCustomer(null);
  };

  // Format WhatsApp invoice text
  const generateWhatsAppInvoiceText = () => {
    if (!completedSaleData) return '';
    const store = db.findUserById(storeId);
    let text = `🧾 *فاتورة مبيعات - ${store ? store.store_name : 'البقالة'}*\n`;
    text += `رقم الفاتورة: #${completedSaleData.saleId}\n`;
    text += `التاريخ: ${completedSaleData.dateStr}\n`;
    if (completedSaleData.customerName) {
      text += `العميل: ${completedSaleData.customerName}\n`;
    }
    text += `--------------------------------\n`;
    completedSaleData.items.forEach((item) => {
      text += `• ${item.product_name || 'صنف'} (${item.qty} × ${item.price}) = ${item.qty * item.price} ر.ي\n`;
    });
    text += `--------------------------------\n`;
    if (discountAmount > 0) {
      text += `🏷️ *الخصم:* ${discountAmount} ر.ي\n`;
    }
    text += `💰 *الإجمالي الصافي:* ${completedSaleData.total} ر.ي\n`;
    text += `💵 *المدفوع:* ${completedSaleData.paid} ر.ي\n`;
    if (completedSaleData.remaining > 0) {
      text += `⚠️ *المتبقي (دين مقيد في الحساب):* ${completedSaleData.remaining} ر.ي\n`;
    }
    text += `\nشكراً لزيارتكم ونسعد بخدمتكم دائماً!`;
    return text;
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${theme.screenBg}`}>
      {/* POS Toolbar */}
      <div className="bg-[#0B3D2E] text-white p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
            title="رجوع للرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">نقطة البيع السريعة (POS)</h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Parked Sales Button with Badge */}
          <button
            onClick={() => setIsParkedModalOpen(true)}
            className="relative bg-white/10 hover:bg-white/20 text-[#C9A961] px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold transition"
            title="الفواتير المعلقة"
          >
            <PauseCircle className="w-4 h-4" />
            <span>معلقة</span>
            {parkedSales.length > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {parkedSales.length}
              </span>
            )}
          </button>

          {/* Barcode Scanner */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="bg-[#C9A961] hover:bg-[#e0be75] text-[#0B3D2E] px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm font-bold text-xs transition"
          >
            <Scan className="w-4 h-4" />
            <span>مسح باركود</span>
          </button>
        </div>
      </div>

      <div className={`px-3 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-[#141F1A] border-emerald-900/50' : 'bg-emerald-950/20 border-emerald-900/10'}`}>
        <span className={`text-[10px] font-bold shrink-0 ${theme.textSecondary}`}>أصنافي السريعة:</span>
        {quickProducts.map((p) => <button key={p.id} onClick={() => {setDialogQtyInput(p.unit_type === 'كيلو' ? '0.5' : '1'); setQuantityDialogItem({product:p,defaultQty:1});}} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold border bg-white border-emerald-200 text-[#0B3D2E]">{p.name}</button>)}
        <button onClick={() => setShowQuickManager(true)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold border bg-[#0B3D2E] text-[#C9A961]">إدارة الأصناف السريعة</button>
      </div>

      {/* Search & Customer Input Section */}
      <div className={`p-2.5 border-b space-y-2 transition-colors duration-300 ${theme.cardBg}`}>
        {/* Product AutoComplete */}
        <div className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="ابحث بالاسم أو الباركود (حرفين فأكثر)..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none border ${theme.inputBg}`}
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          </div>

          {/* Product AutoComplete Dropdown */}
          {productSuggestions.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto ${theme.cardBg}`}>
              {productSuggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`w-full text-right p-2.5 border-b last:border-0 flex items-center justify-between text-xs transition ${
                    isDarkMode ? 'hover:bg-emerald-950/60 border-emerald-900/40 text-gray-100' : 'hover:bg-emerald-50 border-gray-100 text-gray-800'
                  }`}
                >
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className={`text-[10px] font-mono ${theme.textMuted}`}>
                      باركود: {p.barcode} | المتوفر: {p.quantity} {p.base_units_per_sale_unit && p.base_units_per_sale_unit > 1 ? (p.base_unit_name || 'حبة أساسية') : p.unit_type} {p.category ? `| ${p.category}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-[#C9A961] font-mono">
                    {p.sale_price} ر.ي
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Customer AutoComplete & Auto-registration */}
        <div className="relative">
          {selectedCustomer ? (
            <div className={`flex items-center justify-between border rounded-xl p-2 text-xs ${
              isDarkMode ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-[#0B3D2E]'
            }`}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#C9A961]" />
                <span className="font-bold">{selectedCustomer.name}</span>
                <span className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  (دين سابق: {formatCurrency(selectedCustomer.total_debt)})
                </span>
                {selectedCustomer.credit_limit && (
                  <span className="text-[9px] bg-emerald-900 text-emerald-200 px-1 rounded">
                    سقف: {formatCurrency(selectedCustomer.credit_limit)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[10px] text-red-400 hover:underline font-bold px-1"
              >
                تغيير
              </button>
            </div>
          ) : (
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="تحديد العميل للآجل (اكتب اسم الزبون مسجل أو جديد)..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none border ${theme.inputBg}`}
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3" />
            </div>
          )}

          {customerSuggestions.length > 0 && !selectedCustomer && (
            <div className={`absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-xl z-30 max-h-36 overflow-y-auto ${theme.cardBg}`}>
              {customerSuggestions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setCustomerQuery('');
                    setCustomerSuggestions([]);
                  }}
                  className={`w-full text-right p-2 border-b last:border-0 flex items-center justify-between text-xs transition ${
                    isDarkMode ? 'hover:bg-emerald-950/60 border-emerald-900/40 text-gray-100' : 'hover:bg-emerald-50 border-gray-100 text-gray-800'
                  }`}
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-[10px] text-red-400 font-bold">
                    دين: {formatCurrency(c.total_debt)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick badge if customer query is typed and not in database */}
          {!selectedCustomer && customerQuery.trim().length > 1 && customerSuggestions.length === 0 && (
            <div className={`mt-1 flex items-center gap-1.5 text-[10px] p-1.5 rounded-lg border font-semibold ${
              isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <UserPlus className="w-3.5 h-3.5 text-[#C9A961]" />
              <span>زبون جديد: سيتم إنشاء حساب له تلقائياً عند إتمام البيع الآجل!</span>
            </div>
          )}
        </div>
      </div>

      {/* Credit Limit Alert Banner */}
      {creditLimitWarning?.isExceeded && (
        <div className="mx-3 mt-1.5 bg-amber-950/40 border border-amber-800 rounded-xl p-2 flex items-center gap-2 text-xs text-amber-200 font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            تنبيه سقف الائتمان: إجمالي دين العميل سيصل إلى {formatCurrency(creditLimitWarning.totalProjectedDebt)} (تجاوز السقف بمقدار {formatCurrency(creditLimitWarning.exceededAmount)})!
          </span>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mx-3 mt-1.5 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-xl text-center shadow-lg font-bold animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Cart Items (RecyclerView) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <Scan className="w-12 h-12 text-gray-400 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold">سلة المشتريات فارغة حالياً</p>
            <p className={`text-[11px] mt-1 ${theme.textMuted}`}>
              امسح الباركود، اختر صنفاً سريعاً، أو ابحث بالاسم للإضافة فوراً
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product.id}
              className={`rounded-xl p-2.5 border flex items-center justify-between transition-colors ${theme.cardBg}`}
            >
              <div className="flex-1 truncate pr-1">
                <p className={`font-bold text-xs truncate ${theme.textPrimary}`}>
                  {item.product.name}
                </p>
                <p className={`text-[10px] font-mono ${theme.textSecondary}`}>
                  {item.price} ر.ي × {item.qty} {item.product.base_units_per_sale_unit && item.product.base_units_per_sale_unit > 1 ? (item.product.base_unit_name || 'حبة') : item.product.unit_type} = <span className="font-bold text-[#C9A961]">{item.subtotal} ر.ي</span>
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateCartItemQty(item.product.id, -1)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                    isDarkMode ? 'bg-[#141F1A] hover:bg-[#1f2e27] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className={`w-7 text-center font-bold font-mono text-xs ${theme.textPrimary}`}>
                  {item.qty}
                </span>
                <button
                  onClick={() => updateCartItemQty(item.product.id, 1)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold transition ${
                    isDarkMode ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900' : 'bg-emerald-50 hover:bg-emerald-100 text-[#0B3D2E]'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeCartItem(item.product.id)}
                  className="w-6 h-6 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center justify-center ml-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment & Summary Card */}
      <div className={`border-t p-3 shadow-lg space-y-2 transition-colors duration-300 ${theme.cardBg}`}>
        {/* Discount & Currency Converter Row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold shrink-0 flex items-center gap-0.5 ${theme.textSecondary}`}>
              <Percent className="w-3 h-3 text-[#C9A961]" />
              <span>خصم:</span>
            </span>
            <input
              id="pos-discount-amount"
              aria-label="الخصم"
              type="number"
              placeholder="0 ر.ي"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className={`w-full text-center font-mono font-bold rounded-lg py-1 px-1 text-xs focus:outline-none border ${theme.inputBg}`}
            />
          </div>

          <div className={`rounded-lg px-2 py-1 flex items-center justify-between text-[10px] font-mono border ${
            isDarkMode ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300' : 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
          }`}>
            <span className="flex items-center gap-0.5 font-bold">
              <Coins className="w-3 h-3 text-[#C9A961]" />
              <span>≈ {sarEquiv} ر.س</span>
            </span>
            <span className={`flex items-center gap-0.5 ${theme.textSecondary}`}>
              <DollarSign className="w-3 h-3" />
              <span>≈ {usdEquiv} $</span>
            </span>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/20">
          <span className={`font-bold ${theme.textSecondary}`}>الإجمالي الصافي:</span>
          <span className={`text-base font-extrabold ${isDarkMode ? 'text-emerald-300' : 'text-[#0B3D2E]'}`}>
            {formatCurrency(totalAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs gap-3">
          <span className={`font-semibold shrink-0 ${theme.textSecondary}`}>المدفوع:</span>
          <input
            id="pos-paid-amount"
            aria-label="المبلغ المدفوع"
            type="number"
            placeholder={totalAmount.toString()}
            value={paidInput}
            onChange={(e) => setPaidInput(e.target.value)}
            className={`w-28 text-left font-mono font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none border ${theme.inputBg}`}
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/20">
          <span className="font-bold text-red-400">المتبقي (دين):</span>
          <span className="font-bold font-mono text-red-400">
            {formatCurrency(remainingAmount)}
          </span>
        </div>

        {/* Action Buttons: Park Bill & Complete Sale */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <button
            onClick={handleParkSale}
            disabled={cart.length === 0}
            className={`col-span-1 border py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center disabled:opacity-40 transition ${
              isDarkMode ? 'bg-[#141F1A] hover:bg-[#1a2822] text-amber-300 border-amber-900/60' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
            title="تعليق الفاتورة مؤقتاً لخدمة زبون آخر"
          >
            <PauseCircle className="w-4 h-4 text-[#C9A961]" />
            <span className="text-[10px]">تعليق</span>
          </button>

          <button
            onClick={handleCompleteSale}
            disabled={isSuspended || cart.length === 0}
            className={`col-span-3 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
              isSuspended
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : cart.length === 0
                ? isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#0B3D2E] text-white hover:bg-[#06231A] active:scale-98'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#C9A961]" />
            <span>{isSuspended ? 'الحساب موقوف (تعطيل البيع)' : 'إتمام عملية البيع'}</span>
          </button>
        </div>
      </div>

      {showQuickManager && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"><div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3"><h3 className="font-bold text-[#0B3D2E]">حدد أصنافك السريعة</h3><p className="text-xs text-gray-500">اضغط الصنف لإضافته أو إزالته من شريط البيع.</p><div className="max-h-72 overflow-auto space-y-1">{db.getProducts(storeId).map(p => <button key={p.id} onClick={() => setQuickProducts(db.toggleQuickProduct(storeId,p.id))} className={`w-full text-right p-2 rounded-lg border ${quickProducts.some(q=>q.id===p.id) ? 'bg-emerald-50 border-emerald-500' : 'border-gray-200'}`}>{quickProducts.some(q=>q.id===p.id) ? '✓ ' : '+ '}{p.name} — {p.sale_price} ر.ي</button>)}</div><button onClick={()=>setShowQuickManager(false)} className="w-full py-2 rounded-xl bg-[#0B3D2E] text-white">تم</button></div></div>}

      {/* Quantity Dialog if opened manually */}
      {quantityDialogItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-[#C9A961]">
            <h3 className="font-bold text-sm text-[#0B3D2E] mb-1">
              {quantityDialogItem.product.name}
            </h3>
            <p className="text-xs text-gray-500 mb-3 font-mono">
              السعر: {quantityDialogItem.product.sale_price} ر.ي لكل {quantityDialogItem.product.base_units_per_sale_unit && quantityDialogItem.product.base_units_per_sale_unit > 1 ? (quantityDialogItem.product.base_unit_name || 'حبة') : quantityDialogItem.product.unit_type} | المتوفر: {quantityDialogItem.product.quantity} {quantityDialogItem.product.base_units_per_sale_unit && quantityDialogItem.product.base_units_per_sale_unit > 1 ? (quantityDialogItem.product.base_unit_name || 'حبة') : quantityDialogItem.product.unit_type}
            </p>

            <label className="block text-xs font-bold text-gray-700 mb-1">الكمية المطلوبة ({quantityDialogItem.product.base_units_per_sale_unit && quantityDialogItem.product.base_units_per_sale_unit > 1 ? (quantityDialogItem.product.base_unit_name || 'الحبة الأساسية') : quantityDialogItem.product.unit_type}):</label>
            <input
              type="number"
              min="0.001"
              step={quantityDialogItem.product.unit_type === 'كيلو' ? '0.001' : '1'}
              max={quantityDialogItem.product.quantity}
              value={dialogQtyInput}
              onChange={(e) => setDialogQtyInput(e.target.value)}
              autoFocus
              className="w-full text-center text-lg font-bold font-mono border border-gray-300 rounded-xl p-2 bg-white mb-4 focus:outline-none focus:border-[#0B3D2E]"
            />

            <div className="flex gap-2">
              <button
                onClick={handleConfirmAddToCart}
                className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl font-bold text-xs hover:bg-[#06231A]"
              >
                إضافة للسلة
              </button>
              <button
                onClick={() => setQuantityDialogItem(null)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parked Sales Modal (قائمة الفواتير المعلقة) */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-[#C9A961] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0B3D2E] flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>الفواتير المعلقة ({parkedSales.length})</span>
              </h3>
              <button
                onClick={() => setIsParkedModalOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-800 font-bold"
              >
                إغلاق
              </button>
            </div>

            {parkedSales.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">لا توجد فواتير معلقة حالياً</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {parkedSales.map((ps) => {
                  const itemsCount = ps.cart.reduce((a, b) => a + b.qty, 0);
                  const total = ps.cart.reduce((a, b) => a + b.subtotal, 0) - (ps.discount || 0);
                  return (
                    <div
                      key={ps.id}
                      className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-gray-800">
                          {ps.customer_name || 'زبون عام (بدون اسم)'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {ps.created_at} | {itemsCount} قطع | {formatCurrency(total)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleResumeParkedSale(ps)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-[#0B3D2E] px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 border border-emerald-200"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>استرجاع</span>
                        </button>
                        <button
                          onClick={() => handleDeleteParkedSale(ps.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                          title="حذف الفاتورة المعلقة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Sale Completion Modal (Dialog: Share & Print) */}
      {completedSaleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in zoom-in-95">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-xs p-5 shadow-2xl border-2 border-emerald-700 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#0B3D2E] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-[#0B3D2E]" />
            </div>

            <h3 className="font-bold text-base text-[#0B3D2E]">تم حفظ الفاتورة بنجاح!</h3>
            <p className="text-xs text-gray-600 font-mono">
              رقم الفاتورة: #{completedSaleData.saleId}
            </p>

            {completedSaleData.customerName && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 py-1 rounded-lg">
                العميل: {completedSaleData.customerName}
              </p>
            )}

            <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-bold">{completedSaleData.total} ر.ي</span>
              </div>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span>{completedSaleData.paid} ر.ي</span>
              </div>
              {completedSaleData.remaining > 0 && (
                <div className="flex justify-between text-[#8B2E2E] font-bold">
                  <span>المتبقي (دين مقيد):</span>
                  <span>{completedSaleData.remaining} ر.ي</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="bg-[#25D366] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-[#20ba59]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-[#06231A]"
              >
                <Printer className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>طباعة</span>
              </button>
            </div>

            <button
              onClick={() => setCompletedSaleData(null)}
              className="w-full text-xs text-gray-500 hover:text-gray-800 font-bold py-1.5"
            >
              بدء فاتورة جديدة
            </button>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={handleBarcodeScanned}
        storeId={storeId}
      />

      {/* WhatsApp Share Modal */}
      {completedSaleData && (
        <WhatsAppShareModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title="مشاركة فاتورة مبيعات"
          messageText={generateWhatsAppInvoiceText()}
          targetPhone=""
        />
      )}

      {/* Print Thermal Receipt Modal */}
      {completedSaleData && (
        <ReceiptPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          storeName={db.findUserById(storeId)?.store_name || 'بقالة الأمانة'}
          saleId={completedSaleData.saleId}
          items={completedSaleData.items}
          totalAmount={completedSaleData.total}
          paidAmount={completedSaleData.paid}
          remainingAmount={completedSaleData.remaining}
          paymentType={completedSaleData.remaining > 0 ? 'آجل' : 'نقداً'}
          customerName={completedSaleData.customerName}
          dateStr={completedSaleData.dateStr}
        />
      )}
    </div>
  );
};
