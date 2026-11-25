/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Edit, Trash2, Search, Package, AlertTriangle, Calendar, Layers } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Product } from '../../../types/index.ts';
import { formatCurrency, checkItemExpiryStatus } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { Scan } from 'lucide-react';
import { BarcodeScannerModal } from '../BarcodeScannerModal.tsx';

interface InventoryScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

const CATEGORIES = ['الكل', 'مواد أساسية', 'ألبان وأجبان', 'حبوب وبقوليات', 'زيوت وسمن', 'معلبات', 'مخبوزات', 'مشروبات ومياه'];

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ storeId, onNavigate }) => {
  const { isDarkMode, theme } = useTheme();
  const restriction = db.getStoreRestriction(storeId);
  const isRestricted = restriction.restricted;
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const lowStockAlertsEnabled = db.getSharedPreferences().low_stock_alerts_enabled !== false;

  // Edit form state
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => {
    loadProducts();
  }, [storeId]);

  const loadProducts = () => {
    const list = db.getProducts(storeId);
    setProducts(list);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    const matchesCategory =
      selectedCategory === 'الكل' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openEditDialog = (p: Product) => {
    if (isRestricted) return;
    setEditingProduct(p);
    setEditSalePrice(p.sale_price.toString());
    setEditCostPrice(p.cost_price.toString());
    setEditQuantity(p.quantity.toString());
    setEditExpiryDate(p.expiry_date || '');
    setEditCategory(p.category || 'مواد أساسية');
  };

  const handleSaveEdit = () => {
    if (!editingProduct || isRestricted) return;
    const sale = Number(editSalePrice) || editingProduct.sale_price;
    const cost = Number(editCostPrice) || editingProduct.cost_price;
    const qty = Number(editQuantity) || editingProduct.quantity;

    db.updateProduct(storeId, editingProduct.id, {
      sale_price: sale,
      cost_price: cost,
      quantity: qty,
      expiry_date: editExpiryDate || undefined,
      category: editCategory || undefined,
    });

    setEditingProduct(null);
    loadProducts();
  };

  const handleConfirmDelete = () => {
    if (!deleteCandidate || isRestricted) return;
    db.softDeleteProduct(storeId, deleteCandidate.id);
    setDeleteCandidate(null);
    loadProducts();
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative transition-colors duration-300 ${theme.screenBg}`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
            title="رجوع للرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">إدارة المخزون والأصناف</h2>
        </div>
        <span className="text-xs text-[#C9A961] font-mono font-bold">
          {products.length} صنف نشط
        </span>
      </div>

      {isRestricted && (
        <div className="bg-[#8B2E2E] text-white px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{restriction.message}</span>
        </div>
      )}

      {/* Search Input & Category Pills */}
      <div className={`p-3 border-b space-y-2 transition-colors duration-300 ${theme.cardBg}`}>
        <div className="relative flex gap-2">
          <input
            type="text"
            placeholder="بحث في المخزون بالاسم أو الباركود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none border ${theme.inputBg}`}
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <button onClick={() => setIsScannerOpen(true)} className="bg-[#0B3D2E] text-[#C9A961] px-3 rounded-xl flex items-center gap-1 text-xs font-bold"><Scan className="w-4 h-4"/> مسح</button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-[#0B3D2E] text-[#C9A961] shadow-2xs font-bold'
                  : isDarkMode
                  ? 'bg-[#141F1A] text-gray-300 hover:bg-[#1a2822]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products List (RecyclerView) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-20">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-xs font-semibold">لا توجد منتجات مطابقة للبحث</p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isLowStock = lowStockAlertsEnabled && p.quantity <= p.min_stock;
            const expiryStatus = checkItemExpiryStatus(p.expiry_date, 60);

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-3 border transition-colors ${theme.cardBg}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className={`font-bold text-xs ${theme.textPrimary}`}>{p.name}</h3>
                      {p.category && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${
                          isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-[#0B3D2E] border-emerald-100'
                        }`}>
                          {p.category}
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] font-mono mt-0.5 ${theme.textSecondary}`}>
                      باركود: {p.barcode} | الوحدة: {p.unit_type}{p.base_units_per_sale_unit && p.base_units_per_sale_unit > 1 ? ` | ${p.units_per_pack ? `${p.units_per_pack} ${p.base_unit_name || 'حبة'}/باكيت` : ''}${p.packs_per_carton ? ` × ${p.packs_per_carton} باكيت/كرتون` : ''} (المعامل ${p.base_units_per_sale_unit})` : ''}
                    </p>

                    {/* Expiry Date & Low Stock Badges */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {p.expiry_date && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            expiryStatus.isExpired
                              ? 'bg-red-950 text-red-300 border border-red-800 font-bold'
                              : expiryStatus.isNearExpiry
                              ? 'bg-amber-950 text-amber-300 border border-amber-800 font-bold'
                              : isDarkMode
                              ? 'bg-[#141F1A] text-gray-300'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          <span>انتهاء: {p.expiry_date}</span>
                          {expiryStatus.isExpired && <span>(منتهي!)</span>}
                          {expiryStatus.isNearExpiry && <span>(باقي {expiryStatus.daysLeft} يوم)</span>}
                        </span>
                      )}

                      {isLowStock && (
                        <span className="text-[9px] bg-red-950 text-red-300 font-bold px-1.5 py-0.5 rounded border border-red-800 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>كمية منخفضة!</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <p className="font-extrabold text-xs text-[#C9A961]">
                      {formatCurrency(p.sale_price)}
                    </p>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      تكلفة: {p.cost_price} ر.ي
                    </p>
                  </div>
                </div>

                {/* Stock Quantity & Actions */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-700/20 text-xs">
                  <div className="flex items-center gap-1 font-mono">
                    <span className={`text-[11px] ${theme.textSecondary}`}>المخزون الحالي:</span>
                    <span
                      className={`font-bold text-xs ${
                        isLowStock ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.quantity} {p.base_units_per_sale_unit && p.base_units_per_sale_unit > 1 ? (p.base_unit_name || 'حبة أساسية') : p.unit_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditDialog(p)}
                      className="p-1.5 hover:bg-emerald-50 text-[#0B3D2E] rounded-lg transition"
                      title="تعديل السعر والمخزون"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteCandidate(p)}
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition"
                      title="حذف الصنف (تعطيل)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB: Add Product */}
      <button
        onClick={() => onNavigate('addProduct')}
        className="absolute bottom-4 left-4 w-12 h-12 rounded-2xl bg-[#0B3D2E] text-white flex items-center justify-center shadow-xl hover:bg-[#06231A] active:scale-95 transition border border-[#C9A961]"
        title="إضافة صنف جديد"
      >
        <Plus className="w-6 h-6 text-[#C9A961]" />
      </button>

      <BarcodeScannerModal storeId={storeId} isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onBarcodeDetected={(code) => { setSearchQuery(code); setIsScannerOpen(false); }} />
      {/* Edit Dialog */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-[#C9A961] space-y-3">
            <h3 className="font-bold text-sm text-[#0B3D2E]">
              تعديل بيانات: {editingProduct.name}
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-0.5">سعر البيع (ر.ي):</label>
                <input
                  type="number"
                  value={editSalePrice}
                  onChange={(e) => setEditSalePrice(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-0.5">سعر التكلفة (ر.ي):</label>
                <input
                  type="number"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-0.5">الكمية في المخزن {editingProduct.base_units_per_sale_unit && editingProduct.base_units_per_sale_unit > 1 ? `(بوحدة ${editingProduct.base_unit_name || 'الحبة الأساسية'})` : ''}:</label>
                <input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-0.5">تاريخ انتهاء الصلاحية:</label>
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl font-bold text-xs hover:bg-[#06231A]"
              >
                حفظ التعديل
              </button>
              <button
                onClick={() => setEditingProduct(null)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-red-300 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-[#8B2E2E] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">تعطيل / حذف الصنف؟</h3>
            <p className="text-xs text-gray-600">
              هل أنت متأكد من رغبتك في حذف الصنف "{deleteCandidate.name}" من قائمة البيع النشطة؟
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-[#8B2E2E] text-white py-2 rounded-xl font-bold text-xs hover:bg-red-900"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
