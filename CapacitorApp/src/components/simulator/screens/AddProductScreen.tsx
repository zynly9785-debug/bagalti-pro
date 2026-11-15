/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Scan, Package, Calculator, Check, AlertCircle, Calendar, Layers } from 'lucide-react';
import { db, convertSaleUnitsToBaseUnits } from '../../../db/sqlite-simulation.ts';
import { calculateCartonUnitPrices } from '../../../utils/pureLogic.ts';
import { BarcodeScannerModal } from '../BarcodeScannerModal.tsx';
import { ProductCalculatorDialog } from '../ProductCalculatorDialog.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface AddProductScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

const CATEGORIES = ['مواد أساسية', 'ألبان وأجبان', 'حبوب وبقوليات', 'زيوت وسمن', 'معلبات', 'مخبوزات', 'مشروبات ومياه', 'منظفات وعناية'];

export const AddProductScreen: React.FC<AddProductScreenProps> = ({ storeId, onNavigate }) => {
  const { isDarkMode, theme } = useTheme();
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unitType, setUnitType] = useState<'قطعة' | 'كرتون' | 'كيلو'>('قطعة');
  const [category, setCategory] = useState('مواد أساسية');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');
  const [baseUnitName, setBaseUnitName] = useState('');
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [packsPerCarton, setPacksPerCarton] = useState('');

  // Carton-specific fields
  const [cartonCostPrice, setCartonCostPrice] = useState('');
  const [piecesInCarton, setPiecesInCarton] = useState('');
  const [calculatedUnitCost, setCalculatedUnitCost] = useState<number | null>(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [calculatorTarget, setCalculatorTarget] = useState<'cost' | 'sale' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCartonMathChange = (cartonCost: string, pieces: string) => {
    setCartonCostPrice(cartonCost);
    setPiecesInCarton(pieces);
    const cost = Number(cartonCost) || 0;
    const count = Number(pieces) || 0;
    if (count > 0 && cost > 0) {
      const res = calculateCartonUnitPrices(cost, 0, count);
      setCalculatedUnitCost(res.unitCostPrice);
      setCostPrice(res.unitCostPrice.toString());
    } else {
      setCalculatedUnitCost(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !salePrice.trim() || !quantity.trim()) {
      setError('يرجى تعبئة الحقول الأساسية: اسم الصنف، سعر البيع، والكمية');
      return;
    }

    let finalCost = Number(costPrice) || 0;
    if (unitType === 'كرتون' && Number(piecesInCarton) > 0 && Number(cartonCostPrice) > 0) {
      finalCost = Math.round((Number(cartonCostPrice) / Number(piecesInCarton)) * 100) / 100;
    }

    const finalBarcode = barcode.trim() || `880${Date.now().toString().slice(-9)}`;
    const unitCount = Number(unitsPerPack) > 0 ? Number(unitsPerPack) : 1;
    const packCount = Number(packsPerCarton) > 0 ? Number(packsPerCarton) : 1;
    const packageFactor = unitType === 'قطعة' && (Number(unitsPerPack) > 0 || Number(packsPerCarton) > 0) ? unitCount * packCount : 1;
    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 0 || (unitType !== 'كيلو' && !Number.isInteger(Number(quantity)))) { setError(unitType === 'كيلو' ? 'أدخل وزناً صحيحاً غير سالب' : 'أدخل كمية صحيحة غير سالبة'); return; }

    db.insertProduct({
      store_id: storeId,
      name: name.trim(),
      barcode: finalBarcode,
      unit_type: unitType,
      base_unit_name: unitType === 'قطعة' ? (baseUnitName.trim() || undefined) : undefined,
      units_per_pack: unitType === 'قطعة' && Number(unitsPerPack) > 0 ? Number(unitsPerPack) : undefined,
      packs_per_carton: unitType === 'قطعة' && Number(packsPerCarton) > 0 ? Number(packsPerCarton) : undefined,
      base_units_per_sale_unit: packageFactor,
      category,
      cost_price: finalCost,
      sale_price: Number(salePrice),
      quantity: convertSaleUnitsToBaseUnits(Number(quantity), packageFactor),
      min_stock: Number(minStock) || 5,
      expiry_date: expiryDate || undefined,
      is_active: 1,
    });

    onNavigate('inventory');
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${theme.screenBg}`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('inventory')}
            className="p-1 hover:bg-white/10 rounded-full"
            title="رجوع للمخزون"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">إضافة منتج جديد للمخزن</h2>
        </div>
        <Package className="w-5 h-5 text-[#C9A961]" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSave} className="space-y-3">
          {/* Name */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
              اسم الصنف / المنتج:
            </label>
            <input
              type="text"
              placeholder="مثال: بسكويت أبو ولد الأصلي"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none border ${theme.inputBg}`}
              required
            />
          </div>

          {/* Barcode + Scanner */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
              الباركود (Barcode):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="أدخل الباركود أو امسحه..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className={`flex-1 font-mono rounded-xl px-3 py-2 text-xs focus:outline-none border ${theme.inputBg}`}
              />
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="bg-[#0B3D2E] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-[#06231A] transition shadow-xs"
              >
                <Scan className="w-4 h-4 text-[#C9A961]" />
                <span>مسح</span>
              </button>
            </div>
          </div>

          {/* Category & Unit Type (Spinners) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
                تصنيف الصنف:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full rounded-xl px-2.5 py-2 text-xs font-bold border ${theme.inputBg} ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className={isDarkMode ? 'bg-[#18221E] text-white' : ''}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
                وحدة البيع (Spinner):
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as any)}
                className={`w-full rounded-xl px-2.5 py-2 text-xs font-bold border ${theme.inputBg} ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}
              >
                <option value="قطعة" className={isDarkMode ? 'bg-[#18221E] text-white' : ''}>قطعة (حبة مفردة)</option>
                <option value="كرتون" className={isDarkMode ? 'bg-[#18221E] text-white' : ''}>كرتون (حساب سعر القطعة تلقائياً)</option>
                <option value="كيلو" className={isDarkMode ? 'bg-[#18221E] text-white' : ''}>كيلو (وزن)</option>
              </select>
            </div>
          </div>

          {unitType === 'قطعة' && (
            <div className={`p-3 rounded-2xl border space-y-2 text-xs ${isDarkMode ? 'bg-[#141F1A] border-emerald-900/60 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <p className="font-bold">تفاصيل وحدة الحبة (اختياري)</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[10px]">اسم الحبة<input value={baseUnitName} onChange={e => setBaseUnitName(e.target.value)} placeholder="سيجارة" className={`mt-1 w-full rounded-xl p-2 text-xs border ${theme.inputBg}`} /></label>
                <label className="text-[10px]">حبات بالباكيت<input type="number" min="1" step="1" value={unitsPerPack} onChange={e => setUnitsPerPack(e.target.value)} placeholder="20" className={`mt-1 w-full rounded-xl p-2 text-xs border ${theme.inputBg}`} /></label>
                <label className="text-[10px]">باكيت بالكرتون<input type="number" min="1" step="1" value={packsPerCarton} onChange={e => setPacksPerCarton(e.target.value)} placeholder="10" className={`mt-1 w-full rounded-xl p-2 text-xs border ${theme.inputBg}`} /></label>
              </div>
              <p className="text-[10px]">المعامل: {(Number(unitsPerPack) > 0 ? Number(unitsPerPack) : 1) * (Number(packsPerCarton) > 0 ? Number(packsPerCarton) : 1)} {baseUnitName.trim() || 'حبة'} لكل وحدة كمية مدخلة.</p>
            </div>
          )}

          {/* Carton math logic: Show 2 extra fields if "كرتون" */}
          {unitType === 'كرتون' && (
            <div className={`p-3 rounded-2xl border space-y-2 text-xs ${
              isDarkMode ? 'bg-[#141F1A] border-amber-900/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <Calculator className="w-4 h-4 text-amber-500" />
                <span>حساب سعر التكلفة للقطعة الواحدة من الكرتون:</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[11px] mb-0.5 ${theme.textSecondary}`}>سعر شراء الكرتون (ر.ي):</label>
                  <input
                    type="number"
                    placeholder="مثال: 12000"
                    value={cartonCostPrice}
                    onChange={(e) => handleCartonMathChange(e.target.value, piecesInCarton)}
                    className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-0.5 ${theme.textSecondary}`}>كم قطعة في الكرتون؟</label>
                  <input
                    type="number"
                    placeholder="مثال: 24"
                    value={piecesInCarton}
                    onChange={(e) => handleCartonMathChange(cartonCostPrice, e.target.value)}
                    className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
                  />
                </div>
              </div>

              {calculatedUnitCost !== null && (
                <div className={`p-2 rounded-xl border font-mono text-[11px] font-bold ${
                  isDarkMode ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-white border-amber-300 text-emerald-800'
                }`}>
                  ✓ تكلفة القطعة الواحدة برمجياً = {calculatedUnitCost} ر.ي
                </div>
              )}
            </div>
          )}

          {/* Pricing & Quantities */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`flex items-center justify-between text-xs font-bold mb-1 ${theme.textSecondary}`}><span>سعر التكلفة {unitType === 'قطعة' && (Number(unitsPerPack) > 0 || Number(packsPerCarton) > 0) ? `لـ${baseUnitName.trim() || 'الحبة'} الأساسية` : ''}:</span><button type="button" onClick={() => setCalculatorTarget('cost')} className="rounded-lg border border-[#C9A961] bg-amber-50 p-1 text-[#0B3D2E]" aria-label="فتح حاسبة سعر التكلفة"><Calculator className="h-4 w-4"/></button></label>
              <input
                type="number"
                placeholder="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
              />
            </div>
            <div>
              <label className={`flex items-center justify-between text-xs font-bold mb-1 ${theme.textSecondary}`}><span>سعر البيع {unitType === 'قطعة' && (Number(unitsPerPack) > 0 || Number(packsPerCarton) > 0) ? `لـ${baseUnitName.trim() || 'الحبة'} الأساسية` : 'للزبون'} (ر.ي):</span><button type="button" onClick={() => setCalculatorTarget('sale')} className="rounded-lg border border-[#C9A961] bg-amber-50 p-1 text-[#0B3D2E]" aria-label="فتح حاسبة سعر البيع"><Calculator className="h-4 w-4"/></button></label>
              <input
                type="number"
                placeholder="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className={`w-full rounded-xl p-2 text-xs font-mono font-bold text-[#C9A961] border ${theme.inputBg}`}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>الكمية المتوفرة {unitType === 'قطعة' && (Number(unitsPerPack) > 0 || Number(packsPerCarton) > 0) ? '(بعدد العبوات/الكرتون)' : unitType === 'كيلو' ? '(يمكن إدخال كسور)' : ''}:</label>
              <input
                type="number"
                step={unitType === 'كيلو' ? '0.001' : '1'}
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
                required
              />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>حد تنبيه الطلب الأدنى:</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className={`block text-xs font-bold mb-1 flex items-center gap-1 ${theme.textSecondary}`}>
              <Calendar className="w-3.5 h-3.5 text-[#C9A961]" />
              <span>تاريخ انتهاء الصلاحية (اختياري):</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={`w-full rounded-xl p-2 text-xs font-mono border ${theme.inputBg}`}
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2 bg-red-950/40 text-red-300 border border-red-800 rounded-xl text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#0B3D2E] hover:bg-[#06231A] text-white py-3 rounded-xl font-bold text-xs active:scale-98 transition shadow-md mt-3"
          >
            حفظ الصنف في قاعدة البيانات
          </button>
        </form>
      </div>

      {/* Barcode Scanner Modal */}
      <ProductCalculatorDialog isOpen={calculatorTarget !== null} onClose={() => setCalculatorTarget(null)} onUse={(value) => { if (calculatorTarget === 'cost') { setCostPrice(String(value)); setCartonCostPrice(''); setPiecesInCarton(''); setCalculatedUnitCost(null); } else if (calculatorTarget === 'sale') setSalePrice(String(value)); }} />
      <BarcodeScannerModal
        storeId={storeId}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={(code: string) => {
          setBarcode(code);
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
};
