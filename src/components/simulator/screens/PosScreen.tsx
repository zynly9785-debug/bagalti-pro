/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  Flashlight,
  Volume2,
  VolumeX,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Product, Customer, CartItem, SaleItem, ParkedSale } from '../../../types/index.ts';
import { calculateSaleRemaining, calculateDiscountedTotal, checkCreditLimitWarning, formatCurrency } from '../../../utils/pureLogic.ts';
import { scanCooldownCheck } from '../../../utils/appRules.ts';
import {
  playScanAlertBeep,
  playScanBeep,
  startUnifiedBarcodeScanner,
  type BarcodeScannerSession,
} from '../../../services/barcodeScannerEngine.ts';
import { BarcodeScannerModal } from '../BarcodeScannerModal.tsx';
import { ReceiptPrintModal } from '../ReceiptPrintModal.tsx';
import { WhatsAppShareModal } from '../WhatsAppShareModal.tsx';
import { SmartQuantityKeypad } from '../pos/SmartQuantityKeypad.tsx';
import { FreeInvoiceModal } from '../pos/FreeInvoiceModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface PosScreenProps {
  storeId: number;
  isSuspended: boolean;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({ storeId, isSuspended, onNavigate }) => {
  const { isDarkMode, theme } = useTheme();
  const restriction = db.getStoreRestriction(storeId);
  const isRestricted = isSuspended || restriction.restricted;

  const [productQuery, setProductQuery] = useState('');
  const [quickBarcodeInput, setQuickBarcodeInput] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Continuous Embedded Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<BarcodeScannerSession | null>(null);
  const startingCameraRef = useRef(false);
  const lastScanRef = useRef<{ code: string | null; at: number }>({ code: null, at: 0 });
  const [scannerExpanded, setScannerExpanded] = useState(true);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [lastScannedLabel, setLastScannedLabel] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  // Modals & Interactive Panels
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [keypadProduct, setKeypadProduct] = useState<Product | null>(null);
  const [unregisteredBarcode, setUnregisteredBarcode] = useState<string | null>(null);
  const [isFreeInvoiceOpen, setIsFreeInvoiceOpen] = useState(false);

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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  useEffect(() => {
    loadParked();
    setQuickProducts(db.getQuickProducts(storeId));
  }, [storeId]);

  const loadParked = () => {
    setParkedSales(db.getParkedSales(storeId));
  };

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

  const stopEmbeddedCamera = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    startingCameraRef.current = false;
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const addProductDirectly = useCallback(
    (product: Product, qtyToAdd = 1) => {
      if (product.quantity <= 0) {
        showToast(`⚠️ المخزون نفد للصنف: ${product.name}`);
        return;
      }
      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
        if (existingIndex > -1) {
          const currentQty = prevCart[existingIndex].qty;
          const nextQty = Math.min(product.quantity, currentQty + qtyToAdd);
          if (nextQty === currentQty) {
            showToast(`⚠️ الحد المتوفر في المخزن ${product.quantity} فقط`);
            return prevCart;
          }
          const updated = [...prevCart];
          updated[existingIndex] = {
            ...updated[existingIndex],
            qty: nextQty,
            subtotal: nextQty * product.sale_price,
          };
          return updated;
        }
        const initialQty = Math.min(product.quantity, qtyToAdd);
        return [
          ...prevCart,
          {
            product,
            qty: initialQty,
            price: product.sale_price,
            subtotal: initialQty * product.sale_price,
          },
        ];
      });
      showToast(`✅ أضيف للسلة: ${product.name}`);
    },
    [showToast],
  );

  const setExactCartQty = useCallback(
    (product: Product, exactQty: number) => {
      setCart((prevCart) => {
        const idx = prevCart.findIndex((item) => item.product.id === product.id);
        if (idx > -1) {
          const updated = [...prevCart];
          updated[idx] = {
            ...updated[idx],
            qty: exactQty,
            subtotal: exactQty * product.sale_price,
          };
          return updated;
        }
        return [
          ...prevCart,
          {
            product,
            qty: exactQty,
            price: product.sale_price,
            subtotal: exactQty * product.sale_price,
          },
        ];
      });
      setKeypadProduct(null);
      showToast(`✅ تم تحديث كمية ${product.name} إلى ${exactQty}`);
    },
    [showToast],
  );

  const processBarcodeDetection = useCallback(
    (rawBarcode: string, ignoreCooldown = false) => {
      const code = rawBarcode.trim();
      if (!code) return;
      const now = Date.now();
      if (
        !ignoreCooldown &&
        !scanCooldownCheck(lastScanRef.current.code, lastScanRef.current.at, code, now, 1500)
      ) {
        return;
      }
      lastScanRef.current = { code, at: now };

      const prod = db.getProductByBarcode(storeId, code);
      if (prod) {
        playScanBeep(soundOn);
        setUnregisteredBarcode(null);
        setScanCount((c) => c + 1);
        setLastScannedLabel(`${prod.name} (${code})`);
        addProductDirectly(prod, 1);
        setKeypadProduct(prod);
      } else {
        playScanAlertBeep(soundOn);
        setUnregisteredBarcode(code);
        showToast(`باركود غير مسجل: ${code}`);
      }
    },
    [storeId, soundOn, addProductDirectly, showToast],
  );

  const startEmbeddedCamera = useCallback(async () => {
    if (startingCameraRef.current || sessionRef.current || !videoRef.current || scannerPaused || !scannerExpanded) {
      return;
    }
    startingCameraRef.current = true;
    setCameraError(null);
    try {
      const session = await startUnifiedBarcodeScanner({
        videoElement: videoRef.current,
        continuous: true,
        scanIntervalMs: 185,
        onReady: () => {
          setCameraActive(true);
          setCameraError(null);
        },
        onCameraError: (arabicMsg) => {
          setCameraError(arabicMsg);
          setCameraActive(false);
        },
        onDetected: (code) => {
          processBarcodeDetection(code, false);
        },
      });
      sessionRef.current = session;
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'تعذر تشغيل الكاميرا');
      setCameraActive(false);
    } finally {
      startingCameraRef.current = false;
    }
  }, [scannerPaused, scannerExpanded, processBarcodeDetection]);

  useEffect(() => {
    const prefs = db.getSharedPreferences();
    if (prefs.barcode_source !== 'external' && scannerExpanded && !scannerPaused) {
      void startEmbeddedCamera();
    } else {
      stopEmbeddedCamera();
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopEmbeddedCamera();
      } else if (
        document.visibilityState === 'visible' &&
        db.getSharedPreferences().barcode_source !== 'external' &&
        scannerExpanded &&
        !scannerPaused
      ) {
        void startEmbeddedCamera();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopEmbeddedCamera();
    };
  }, [scannerExpanded, scannerPaused, startEmbeddedCamera, stopEmbeddedCamera]);

  const handleTogglePause = () => {
    if (scannerPaused) {
      setScannerPaused(false);
    } else {
      setScannerPaused(true);
      stopEmbeddedCamera();
    }
  };

  const handleToggleTorch = async () => {
    if (!sessionRef.current?.isTorchSupported()) {
      showToast('الفلاش غير مدعوم على هذه الكاميرا');
      return;
    }
    const next = !torchOn;
    const ok = await sessionRef.current.toggleTorch(next);
    if (ok) setTorchOn(next);
  };

  const handleQuickBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBarcodeInput.trim()) return;
    processBarcodeDetection(quickBarcodeInput, true);
    setQuickBarcodeInput('');
  };

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = Math.max(0, Number(discountInput) || 0);
  const totalAmount = calculateDiscountedTotal(rawSubtotal, discountAmount);

  const paidAmount = paidInput === '' ? totalAmount : Math.max(0, Number(paidInput) || 0);
  const { remainingAmount } = calculateSaleRemaining(totalAmount, paidAmount);

  // Currency conversions
  const sarEquiv = (totalAmount / 140).toFixed(1);
  const usdEquiv = (totalAmount / 530).toFixed(1);

  const creditLimitWarning =
    selectedCustomer && remainingAmount > 0
      ? checkCreditLimitWarning(selectedCustomer.total_debt, remainingAmount, selectedCustomer.credit_limit || 50000)
      : null;

  const handleSelectProduct = (product: Product) => {
    setProductQuery('');
    setProductSuggestions([]);
    addProductDirectly(product, 1);
    setKeypadProduct(product);
  };

  const updateCartItemQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = Math.min(item.product.quantity, Math.max(0, item.qty + delta));
            return {
              ...item,
              qty: nextQty,
              subtotal: nextQty * item.price,
            };
          }
          return item;
        })
        .filter((item) => item.qty > 0),
    );
  };

  const removeCartItem = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    if (keypadProduct?.id === productId) setKeypadProduct(null);
  };

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
    setCart([]);
    setKeypadProduct(null);
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
    if (isRestricted) {
      showToast(restriction.message || '⚠️ الحساب موقوف أو منتهي الاشتراك! لا يمكنك إجراء عمليات بيع.');
      return;
    }

    if (cart.length === 0) {
      showToast('⚠️ سلة المشتريات فارغة!');
      return;
    }

    const customerIdToUse = selectedCustomer ? selectedCustomer.id : null;
    let customerNameToUse = selectedCustomer ? selectedCustomer.name : undefined;

    if (remainingAmount > 0) {
      if (!customerIdToUse) {
        const typedName = customerQuery.trim();
        if (!typedName) {
          showToast('⚠️ البيع الآجل يتطلب إدخال اسم الزبون لفتح حساب وتسجيل الدين!');
          return;
        }
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
    try {
      result = db.completeSale({
        store_id: storeId,
        customer_id: customerIdToUse,
        new_customer_name: customerNameToUse,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        payment_type: paymentType,
        items: saleItemsParam,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إتمام البيع');
      return;
    }

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

    setCart([]);
    setKeypadProduct(null);
    setPaidInput('');
    setDiscountInput('');
    setProductQuery('');
    setCustomerQuery('');
    setSelectedCustomer(null);
  };

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
      <div className="bg-[#0B3D2E] text-white p-2.5 flex items-center justify-between gap-1.5 shadow-md">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => {
              stopEmbeddedCamera();
              onNavigate('dashboard');
            }}
            className="p-1 hover:bg-white/10 rounded-full shrink-0"
            title="رجوع للرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-xs sm:text-sm truncate">نقطة البيع (POS)</h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={isRestricted}
            onClick={() => setIsFreeInvoiceOpen(true)}
            className="bg-emerald-900/80 hover:bg-emerald-800 disabled:opacity-40 text-emerald-100 px-2 py-1.5 rounded-xl flex items-center gap-1 text-[11px] font-bold border border-emerald-700"
            title="إضافة فاتورة حرة مستقلة"
          >
            <FileText className="w-3.5 h-3.5 text-[#C9A961]" />
            <span>فاتورة حرة</span>
          </button>

          <button
            type="button"
            onClick={() => setIsParkedModalOpen(true)}
            className="relative bg-white/10 hover:bg-white/20 text-[#C9A961] px-2 py-1.5 rounded-xl flex items-center gap-1 text-[11px] font-bold transition"
            title="الفواتير المعلقة"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>معلقة</span>
            {parkedSales.length > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {parkedSales.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="bg-[#C9A961] hover:bg-[#e0be75] text-[#0B3D2E] px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-sm font-bold text-[11px] transition"
            title="فتح نافذة المسح المكبرة أو التصوير"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>ماسح</span>
          </button>
        </div>
      </div>

      {isRestricted && (
        <div className="bg-[#8B2E2E] text-white px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{restriction.message || 'الحساب مقيد حالياً — البيع معطل حتى تجديد الاشتراك أو تفعيل الحساب.'}</span>
        </div>
      )}

      {/* Embedded Continuous Scanner Panel */}
      <div className={`border-b transition-colors ${isDarkMode ? 'bg-[#0F1814] border-emerald-900/60' : 'bg-[#EEF5F1] border-emerald-900/15'}`}>
        <div className="px-3 py-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cameraActive && !scannerPaused ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-[11px] font-extrabold truncate ${theme.textPrimary}`}>
              {scannerPaused ? 'الكاميرا متوقفة مؤقتاً' : cameraActive ? 'المسح المستمر نشط' : 'ماسح الباركود المباشر'}
            </span>
            {scanCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#0B3D2E] text-[#C9A961]">
                {scanCount} مسح
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleTogglePause}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
                scannerPaused
                  ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                  : `${theme.cardBg} ${theme.borderColor} ${theme.textPrimary}`
              }`}
            >
              {scannerPaused ? <PlayCircle className="w-3.5 h-3.5 text-[#C9A961]" /> : <PauseCircle className="w-3.5 h-3.5 text-amber-500" />}
              <span>{scannerPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleToggleTorch()}
              aria-label="فلاش الكاميرا"
              className={`p-1 rounded-lg border ${theme.cardBg} ${theme.borderColor}`}
            >
              <Flashlight className={`w-3.5 h-3.5 ${torchOn ? 'text-amber-400' : theme.textSecondary}`} />
            </button>

            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-label="صوت المسح"
              className={`p-1 rounded-lg border ${theme.cardBg} ${theme.borderColor}`}
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
            </button>

            <button
              type="button"
              onClick={() => setScannerExpanded((v) => !v)}
              aria-label={scannerExpanded ? 'طي الماسح' : 'فتح الماسح'}
              className={`p-1 rounded-lg border ${theme.cardBg} ${theme.borderColor}`}
            >
              {scannerExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {scannerExpanded && (
          <div className="px-3 pb-2 space-y-1.5">
            <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-black border border-[#C9A961]/60">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive && !scannerPaused ? '' : 'opacity-20'}`}
              />
              {cameraActive && !scannerPaused ? (
                <div className="pointer-events-none absolute inset-x-10 inset-y-4 border-2 border-emerald-400/80 rounded-xl">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center gap-1">
                  <Camera className="w-5 h-5 text-gray-300" />
                  <p className="text-[10px] text-white/85 max-w-[260px]">
                    {scannerPaused
                      ? 'المسح متوقف مؤقتاً — اضغط «استئناف» للمتابعة'
                      : cameraError || 'جاهز لتشغيل الكاميرا أو استخدام الماسح الخارجي أدناه'}
                  </p>
                  {!scannerPaused && cameraError && (
                    <button
                      type="button"
                      onClick={() => void startEmbeddedCamera()}
                      className="bg-[#C9A961] text-[#0B3D2E] px-2.5 py-0.5 rounded-lg text-[10px] font-bold"
                    >
                      إعادة المحاولة
                    </button>
                  )}
                </div>
              )}
              {lastScannedLabel && (
                <div className="absolute bottom-1 right-1 bg-black/75 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-lg max-w-[85%] truncate">
                  آخر مسح: {lastScannedLabel}
                </div>
              )}
            </div>

            {/* Instant barcode input (for hardware scanners & quick code testing without closing camera) */}
            <form onSubmit={handleQuickBarcodeSubmit} className="flex gap-1.5">
              <input
                type="text"
                inputMode="text"
                value={quickBarcodeInput}
                onChange={(e) => setQuickBarcodeInput(e.target.value)}
                placeholder="إدخال / قراءة باركود سريع (Enter للإضافة أو التحقق)..."
                aria-label="إدخال باركود سريع"
                className={`flex-1 rounded-xl px-2.5 py-1.5 text-[11px] font-mono border ${theme.inputBg} ${theme.textPrimary}`}
              />
              <button
                type="submit"
                disabled={!quickBarcodeInput.trim()}
                className="bg-[#0B3D2E] text-white px-3 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-40"
              >
                مسح
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Quick Products Strip */}
      <div className={`px-3 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-[#141F1A] border-emerald-900/50' : 'bg-emerald-950/20 border-emerald-900/10'}`}>
        <span className={`text-[10px] font-bold shrink-0 ${theme.textSecondary}`}>أصنافي السريعة:</span>
        {quickProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              addProductDirectly(p, 1);
              setKeypadProduct(p);
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold border bg-white border-emerald-200 text-[#0B3D2E]"
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setShowQuickManager(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold border bg-[#0B3D2E] text-[#C9A961]"
        >
          إدارة الأصناف السريعة
        </button>
      </div>

      {/* Search & Customer Input Section */}
      <div className={`p-2 border-b space-y-1.5 transition-colors duration-300 ${theme.cardBg}`}>
        <div className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="ابحث بالاسم أو الباركود (حرفين فأكثر)..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              className={`w-full rounded-xl px-3 py-1.5 text-xs focus:outline-none border ${theme.inputBg}`}
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          </div>

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
                      باركود: {p.barcode} | المتوفر: {p.quantity} {p.base_units_per_sale_unit && p.base_units_per_sale_unit > 1 ? p.base_unit_name || 'حبة أساسية' : p.unit_type}
                    </p>
                  </div>
                  <span className="font-bold text-[#C9A961] font-mono">{p.sale_price} ر.ي</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Customer AutoComplete */}
        <div className="relative">
          {selectedCustomer ? (
            <div
              className={`flex items-center justify-between border rounded-xl p-1.5 text-xs ${
                isDarkMode ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-[#0B3D2E]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <User className="w-3.5 h-3.5 text-[#C9A961] shrink-0" />
                <span className="font-bold truncate">{selectedCustomer.name}</span>
                <span className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  ({formatCurrency(selectedCustomer.total_debt)})
                </span>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[10px] text-red-400 hover:underline font-bold px-1 shrink-0"
              >
                تغيير
              </button>
            </div>
          ) : (
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="تحديد العميل للآجل (اسم مسجل أو جديد)..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className={`w-full rounded-xl px-3 py-1.5 text-xs focus:outline-none border ${theme.inputBg}`}
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
                  <span className="text-[10px] text-red-400 font-bold">دين: {formatCurrency(c.total_debt)}</span>
                </button>
              ))}
            </div>
          )}

          {!selectedCustomer && customerQuery.trim().length > 1 && customerSuggestions.length === 0 && (
            <div
              className={`mt-1 flex items-center gap-1.5 text-[10px] p-1.5 rounded-lg border font-semibold ${
                isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#C9A961]" />
              <span>زبون جديد: سيتم إنشاء حساب له تلقائياً عند إتمام البيع الآجل!</span>
            </div>
          )}
        </div>
      </div>

      {creditLimitWarning?.isExceeded && (
        <div className="mx-3 mt-1 bg-amber-950/40 border border-amber-800 rounded-xl p-2 flex items-center gap-2 text-xs text-amber-200 font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            تنبيه سقف الائتمان: سيصل الدين إلى {formatCurrency(creditLimitWarning.totalProjectedDebt)} (تجاوز بمقدار {formatCurrency(creditLimitWarning.exceededAmount)})!
          </span>
        </div>
      )}

      {toastMessage && (
        <div role="status" className="mx-3 mt-1 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-xl text-center shadow-lg font-bold">
          {toastMessage}
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
            <Scan className="w-10 h-10 text-gray-400 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold">سلة المشتريات فارغة حالياً</p>
            <p className={`text-[11px] mt-1 ${theme.textMuted}`}>
              وجّه الكاميرا إلى الباركود أو اختر صنفاً سريعاً للإضافة فوراً
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product.id}
              onClick={() => setKeypadProduct(item.product)}
              className={`rounded-xl p-2.5 border flex items-center justify-between cursor-pointer transition-colors ${
                keypadProduct?.id === item.product.id
                  ? 'border-[#C9A961] ring-1 ring-[#C9A961]/50 ' + theme.cardBg
                  : theme.cardBg
              }`}
            >
              <div className="flex-1 truncate pr-1">
                <p className={`font-bold text-xs truncate ${theme.textPrimary}`}>{item.product.name}</p>
                <p className={`text-[10px] font-mono ${theme.textSecondary}`}>
                  {item.price} ر.ي × {item.qty} = <span className="font-bold text-[#C9A961]">{item.subtotal} ر.ي</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => updateCartItemQty(item.product.id, -1)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                    isDarkMode ? 'bg-[#141F1A] hover:bg-[#1f2e27] text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setKeypadProduct(item.product)}
                  className={`min-w-7 px-1 text-center font-bold font-mono text-xs underline decoration-dotted ${theme.textPrimary}`}
                  title="اضغط لفتح لوحة الكمية الذكية"
                >
                  {item.qty}
                </button>
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

      {/* Non-blocking Smart Quantity Keypad (keeps live scanner active!) */}
      <SmartQuantityKeypad
        product={keypadProduct}
        currentCartQty={cart.find((i) => i.product.id === keypadProduct?.id)?.qty ?? 0}
        onConfirmQty={setExactCartQty}
        onClose={() => setKeypadProduct(null)}
      />

      {/* Payment & Summary Card */}
      <div className={`border-t p-2.5 shadow-lg space-y-1.5 transition-colors duration-300 ${theme.cardBg}`}>
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

          <div
            className={`rounded-lg px-2 py-1 flex items-center justify-between text-[10px] font-mono border ${
              isDarkMode ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300' : 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
            }`}
          >
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
          <span className="font-bold font-mono text-red-400">{formatCurrency(remainingAmount)}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          <button
            onClick={handleParkSale}
            disabled={cart.length === 0}
            className={`col-span-1 border py-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center disabled:opacity-40 transition ${
              isDarkMode ? 'bg-[#141F1A] hover:bg-[#1a2822] text-amber-300 border-amber-900/60' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            <PauseCircle className="w-4 h-4 text-[#C9A961]" />
            <span className="text-[10px]">تعليق</span>
          </button>

          <button
            onClick={handleCompleteSale}
            disabled={isRestricted || cart.length === 0}
            className={`col-span-3 py-2 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
              isRestricted
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : cart.length === 0
                  ? isDarkMode
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#0B3D2E] text-white hover:bg-[#06231A]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#C9A961]" />
            <span>{isRestricted ? 'الحساب مقيد (تعطيل البيع)' : 'إتمام عملية البيع'}</span>
          </button>
        </div>
      </div>

      {/* Unregistered Barcode Dialog */}
      {unregisteredBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border-2 border-[#C9A961] text-center space-y-3`}>
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className={`font-extrabold text-sm ${theme.textPrimary}`}>هذا المنتج غير مسجل</h3>
            <p className={`text-xs ${theme.textSecondary}`}>
              الباركود المقروء غير موجود في مخزون المتجر:
            </p>
            <div className="rounded-xl bg-black/10 dark:bg-white/10 py-2 px-3 font-mono font-bold text-xs" dir="ltr">
              {unregisteredBarcode}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const code = unregisteredBarcode;
                  setUnregisteredBarcode(null);
                  stopEmbeddedCamera();
                  onNavigate('addProduct', { initialBarcode: code });
                }}
                className="bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs border border-[#C9A961]/40"
              >
                إضافة منتج جديد
              </button>
              <button
                type="button"
                onClick={() => setUnregisteredBarcode(null)}
                className={`py-2.5 rounded-xl border text-xs font-bold ${theme.borderColor} ${theme.textSecondary}`}
              >
                تجاهل
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 text-gray-900">
            <h3 className="font-bold text-[#0B3D2E]">حدد أصنافك السريعة</h3>
            <p className="text-xs text-gray-500">اضغط الصنف لإضافته أو إزالته من شريط البيع.</p>
            <div className="max-h-72 overflow-auto space-y-1">
              {db.getProducts(storeId).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setQuickProducts(db.toggleQuickProduct(storeId, p.id))}
                  className={`w-full text-right p-2 rounded-lg border ${
                    quickProducts.some((q) => q.id === p.id) ? 'bg-emerald-50 border-emerald-500' : 'border-gray-200'
                  }`}
                >
                  {quickProducts.some((q) => q.id === p.id) ? '✓ ' : '+ '}
                  {p.name} — {p.sale_price} ر.ي
                </button>
              ))}
            </div>
            <button onClick={() => setShowQuickManager(false)} className="w-full py-2 rounded-xl bg-[#0B3D2E] text-white">
              تم
            </button>
          </div>
        </div>
      )}

      {/* Parked Sales Modal */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-[#C9A961] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0B3D2E] flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>الفواتير المعلقة ({parkedSales.length})</span>
              </h3>
              <button onClick={() => setIsParkedModalOpen(false)} className="text-xs text-gray-500 hover:text-gray-800 font-bold">
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
                    <div key={ps.id} className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-800">{ps.customer_name || 'زبون عام (بدون اسم)'}</p>
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
                        <button onClick={() => handleDeleteParkedSale(ps.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
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

      {/* Post-Sale Completion Modal */}
      {completedSaleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-xs p-5 shadow-2xl border-2 border-emerald-700 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#0B3D2E] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-[#0B3D2E]" />
            </div>
            <h3 className="font-bold text-base text-[#0B3D2E]">تم حفظ الفاتورة بنجاح!</h3>
            <p className="text-xs text-gray-600 font-mono">رقم الفاتورة: #{completedSaleData.saleId}</p>
            {completedSaleData.customerName && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 py-1 rounded-lg">العميل: {completedSaleData.customerName}</p>
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
            <button onClick={() => setCompletedSaleData(null)} className="w-full text-xs text-gray-500 hover:text-gray-800 font-bold py-1.5">
              بدء فاتورة جديدة
            </button>
          </div>
        </div>
      )}

      {/* Free Invoice Modal */}
      <FreeInvoiceModal
        storeId={storeId}
        isOpen={isFreeInvoiceOpen}
        isRestricted={isRestricted}
        onClose={() => setIsFreeInvoiceOpen(false)}
        onCreated={(summary) => showToast(summary)}
      />

      {/* Fullscreen/Fallback Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={(code) => {
          setIsScannerOpen(false);
          processBarcodeDetection(code, true);
        }}
        storeId={storeId}
      />

      {completedSaleData && (
        <WhatsAppShareModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title="مشاركة فاتورة مبيعات"
          messageText={generateWhatsAppInvoiceText()}
          targetPhone=""
        />
      )}

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
