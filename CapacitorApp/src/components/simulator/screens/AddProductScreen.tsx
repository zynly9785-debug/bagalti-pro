import React, { useMemo, useState } from 'react';
import { ArrowRight, Scan, Calculator, ChevronDown, Plus, X, Package, Trash2 } from 'lucide-react';
import { db, convertSaleUnitsToBaseUnits } from '../../../db/sqlite-simulation.ts';
import { BarcodeScannerModal } from '../BarcodeScannerModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface Props { storeId: number; onNavigate: (screen: string, params?: Record<string, unknown>) => void; }
type BuyMode = 'piece' | 'carton' | 'gram' | 'litre';

const CATEGORIES = ['بدون تصنيف','مواد أساسية','ألبان وأجبان','حبوب وبقوليات','زيوت وسمن','معلبات','مخبوزات','مشروبات ومياه','منظفات وعناية'];

export const AddProductScreen: React.FC<Props> = ({ storeId, onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [name,setName] = useState('');
  const [barcode,setBarcode] = useState('');
  const [mode,setMode] = useState<BuyMode>('piece');
  const [category,setCategory] = useState('بدون تصنيف');
  const [baseUnit,setBaseUnit] = useState('حبة');
  const [quantity,setQuantity] = useState('0');
  const [minStock,setMinStock] = useState('5');
  const [sku,setSku] = useState('');
  const [location,setLocation] = useState('');
  const [extraOpen,setExtraOpen] = useState(true);
  const [pieceCost,setPieceCost] = useState('');
  const [pieceSale,setPieceSale] = useState('');
  const [cartonCost,setCartonCost] = useState('');
  const [piecesPerCarton,setPiecesPerCarton] = useState('24');
  const [cartonPieceSale,setCartonPieceSale] = useState('');
  const [cartonSale,setCartonSale] = useState('');
  const [weightPurchase,setWeightPurchase] = useState('');
  const [weightGrams,setWeightGrams] = useState('');
  const [gramSale,setGramSale] = useState('');
  const [litrePurchase,setLitrePurchase] = useState('');
  const [litres,setLitres] = useState('');
  const [litreSale,setLitreSale] = useState('');
  const [units,setUnits] = useState<Array<{name:string;factor:string;price:string}>>([]);
  const [scanner,setScanner] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const calculations = useMemo(() => {
    const piece = Number(pieceCost)||0;
    const pieceSell = Number(pieceSale)||0;
    const cartonC = Number(cartonCost)||0;
    const pieces = Number(piecesPerCarton)||0;
    const cartonSellPiece = Number(cartonPieceSale)||0;
    const gramCost = piecesOf(weightPurchase,weightGrams);
    const litreCost = piecesOf(litrePurchase,litres);
    return {
      pieceProfit: pieceSell-piece,
      pieceMargin: pieceSell>0 ? ((pieceSell-piece)/pieceSell)*100 : 0,
      cartonUnitCost: cartonC>0&&pieces>0 ? cartonC/pieces : 0,
      cartonProfit: cartonSellPiece>0 ? cartonSellPiece-(cartonC/pieces) : 0,
      gramCost, gramProfit: (Number(gramSale)||0)-gramCost,
      litreCost, litreProfit: (Number(litreSale)||0)-litreCost,
    };
  },[pieceCost,pieceSale,cartonCost,piecesPerCarton,cartonPieceSale,weightPurchase,weightGrams,gramSale,litrePurchase,litres,litreSale]);

  function piecesOf(total:string, count:string) { const t=Number(total)||0; const c=Number(count)||0; return t>0&&c>0?t/c:0; }

  const generateBarcode = () => setBarcode(`88${Date.now().toString().slice(-11)}${String(storeId).padStart(2,'0')}`);
  const reset = () => { setName(''); setBarcode(''); setPieceCost(''); setPieceSale(''); setCartonCost(''); setPiecesPerCarton('24'); setCartonPieceSale(''); setCartonSale(''); setWeightPurchase(''); setWeightGrams(''); setGramSale(''); setLitrePurchase(''); setLitres(''); setLitreSale(''); setQuantity('0'); setSku(''); setLocation(''); setUnits([]); setError(''); };

  const save = (addAnother=false) => {
    setError('');
    if(!name.trim()) { setError('يرجى إدخال اسم الصنف'); return false; }
    if(!barcode.trim()) { setError('يرجى إدخال الباركود أو الضغط على «توليد تلقائي»'); return false; }
    if(db.getProductByBarcode(storeId,barcode.trim())) { setError('هذا الباركود مسجل لصنف آخر'); return false; }

    let cost=0,sale=0,unitType:'قطعة'|'كرتون'|'كيلو'='قطعة',factor=1,unitsPerPack:number|undefined,packsPerCarton:number|undefined;
    let finalBaseUnit=baseUnit;
    if(mode==='piece') { cost=Number(pieceCost)||0;sale=Number(pieceSale)||0; }
    if(mode==='carton') { const count=Number(piecesPerCarton)||0;if(count<=0){setError('أدخل عدد الحبات داخل الكرتون');return false;} cost=calculations.cartonUnitCost;sale=Number(cartonPieceSale)||0;unitType='كرتون';unitsPerPack=count;packsPerCarton=1;factor=count; }
    if(mode==='gram') { cost=calculations.gramCost;sale=Number(gramSale)||0;unitType='كيلو';finalBaseUnit='جرام';factor=1; }
    if(mode==='litre') { cost=calculations.litreCost;sale=Number(litreSale)||0;unitType='كيلو';finalBaseUnit='لتر';factor=1; }
    if(sale<=0){setError('يرجى إدخال سعر بيع صحيح أكبر من صفر');return false;}
    const qty=Number(quantity)||0;
    if(!Number.isFinite(qty)||qty<0){setError('الكمية المتوفرة غير صالحة');return false;}

    const extraUnits=units.filter(u=>u.name.trim()&&Number(u.factor)>0&&Number(u.price)>0).map(u=>({name:u.name.trim(),factor:Number(u.factor),price:Number(u.price)}));
    db.insertProduct({
      store_id:storeId,name:name.trim(),barcode:barcode.trim(),unit_type:unitType,
      base_unit_name:finalBaseUnit,units_per_pack:unitsPerPack,packs_per_carton:packsPerCarton,
      base_units_per_sale_unit:factor,category:category==='بدون تصنيف'?undefined:category,
      cost_price:cost,sale_price:sale,quantity:convertSaleUnitsToBaseUnits(qty,factor),
      min_stock:Number(minStock)||0,sku:sku.trim()||undefined,storage_location:location.trim()||undefined,
      additional_sale_units:extraUnits,is_active:1,
    });
    if(addAnother){reset();setNotice('تم الحفظ. يمكنك إضافة صنف آخر');window.setTimeout(()=>setNotice(''),3000);}else{onNavigate('inventory');}
    return true;
  };

  const inputClass=`w-full rounded-xl border px-3 py-3 text-sm ${theme.inputBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-700/30`;
  const moneyInput=(value:string,onChange:(v:string)=>void,placeholder:string) => <div className="relative"><input type="number" min="0" step="0.01" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} pl-14`}/><span className="absolute left-3 top-3 text-xs font-bold text-gray-500">ر.ي</span></div>;

  const profitBox=(cost:number,sale:number,label:string) => (cost>0||sale>0)?<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900"><b>{label}: </b>{cost>0?`التكلفة ${cost.toFixed(2)} ر.ي • `:''}{sale>0?`الربح ${(sale-cost).toFixed(2)} ر.ي`:'أكمل بيانات السعر'}</div>:null;

  return <div className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/60 ${isDarkMode?'':''}`}>
    <div className={`flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] border-t shadow-2xl ${theme.cardBg} ${theme.borderColor}`}>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-700 p-2.5 text-white"><Calculator className="h-5 w-5"/></div><div><h2 className="text-base font-black">إضافة صنف جديد للمخزن</h2><p className={`mt-0.5 text-xs ${theme.textSecondary}`}>أدخل البيانات بسهولة – تُحسب تكلفة الحبة والربح تلقائياً</p></div></div>
        <button onClick={()=>onNavigate('inventory')} aria-label="إغلاق" className="rounded-full p-2 hover:bg-gray-500/10"><X className="h-5 w-5"/></button>
      </div>

      <form onSubmit={e=>{e.preventDefault();save(false);}} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
          {notice&&<div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{notice}</div>}

          <section className="space-y-4">
            <div><label className="mb-2 block text-sm font-bold">1. اسم الصنف *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: حليب مراعي 1 لتر أو بهارات مشكلة" className={inputClass}/><p className={`mt-1.5 text-[11px] ${theme.textSecondary}`}>الاسم الواضح الذي سيظهر في الفاتورة ونقطة البيع.</p></div>
            <div><label className="mb-2 block text-sm font-bold">2. الباركود *</label><input value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="امسح الباركود بالكاميرا أو اضغط توليد" className={`${inputClass} font-mono`}/><div className="mt-2 flex gap-2"><button type="button" onClick={generateBarcode} className="flex-1 rounded-xl border border-emerald-700 px-3 py-2.5 text-xs font-bold">توليد تلقائي</button><button type="button" onClick={()=>setScanner(true)} className="flex-1 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1"><Scan className="h-4 w-4"/>مسح بالكاميرا</button></div><p className={`mt-1.5 text-[11px] ${theme.textSecondary}`}>امسح باركود العلبة بالكاميرا أو اضغط «توليد تلقائي» إذا لم يكن للصنف باركود مطبوع.</p></div>
          </section>

          <section className="space-y-3">
            <div><h3 className="text-sm font-black">حاسبة الشراء والربح التلقائية</h3><p className={`mt-1 text-[11px] ${theme.textSecondary}`}>اختر الطريقة التي اشتريت بها الصنف وسنحسب الباقي لك.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([['piece','اشتريت بالحبة'],['carton','اشتريت بالكرتون'],['gram','اشتريت بالجرام'],['litre','اشتريت باللتر']] as [BuyMode,string][]).map(([v,label])=> <button type="button" key={v} onClick={()=>setMode(v)} className={`rounded-xl border px-2 py-3 text-xs font-bold ${mode===v?'bg-emerald-700 text-white border-emerald-700':'hover:bg-gray-500/10'}`}>{label}</button>)}
            </div>

            {mode==='piece'&&<div className="space-y-3 rounded-2xl border p-4"><div><label className="mb-1 block text-xs font-bold">سعر شراء الحبة الواحدة</label>{moneyInput(pieceCost,setPieceCost,'مثال: 100')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>سعر شراء القطعة الواحدة من المورد لحساب صافي ربحك بدقة.</p></div><div><label className="mb-1 block text-xs font-bold">سعر البيع للزبون للحبة</label>{moneyInput(pieceSale,setPieceSale,'مثال: 150')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>السعر الذي ستبيع به الحبة الواحدة للزبون في نقطة البيع.</p></div>{profitBox(calculations.pieceProfit===0?Number(pieceCost)||0:Number(pieceCost)||0,Number(pieceSale)||0,'ملخص الربح للحبة')}</div>}

            {mode==='carton'&&<div className="space-y-3 rounded-2xl border p-4"><div><label className="mb-1 block text-xs font-bold">سعر شراء الكرتون الإجمالي</label>{moneyInput(cartonCost,setCartonCost,'مثال: 2400')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>أدخل المبلغ الإجمالي الذي اشتريت به الكرتون الواحد من المورد.</p></div><div><label className="mb-2 block text-xs font-bold">عدد الحبات داخل الكرتون</label><div className="mb-2 flex gap-2">{[48,24,12,6].map(n=><button type="button" key={n} onClick={()=>setPiecesPerCarton(String(n))} className={`rounded-lg border px-3 py-2 text-xs font-bold ${piecesPerCarton===String(n)?'bg-emerald-700 text-white':''}`}>{n}</button>)}</div><input type="number" min="1" value={piecesPerCarton} onChange={e=>setPiecesPerCarton(e.target.value)} placeholder="عدد آخر" className={inputClass}/><p className={`mt-1 text-[11px] ${theme.textSecondary}`}>كم حبة أو قطعة داخل الكرتون؟ ستُحسب تكلفة الحبة الواحدة تلقائياً.</p></div><div><label className="mb-1 block text-xs font-bold">سعر بيع الحبة للزبون</label>{moneyInput(cartonPieceSale,setCartonPieceSale,'مثال: 130')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>سعر بيع القطعة الواحدة عند البيع بالحبة.</p></div><div><label className="mb-1 block text-xs font-bold">سعر بيع الكرتون للزبون (اختياري)</label>{moneyInput(cartonSale,setCartonSale,'مثال: 3000')}</div>{calculations.cartonUnitCost>0&&profitBox(calculations.cartonUnitCost,Number(cartonPieceSale)||0,'ملخص تكلفة وربح الحبة')}</div>}

            {mode==='gram'&&<div className="space-y-3 rounded-2xl border p-4"><div><label className="mb-1 block text-xs font-bold">سعر الشراء الإجمالي للكمية أو الوزن</label>{moneyInput(weightPurchase,setWeightPurchase,'مثال: 2500')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>المبلغ الإجمالي الذي دفعتَه للعبوة أو الشوالة.</p></div><div><label className="mb-1 block text-xs font-bold">الوزن الإجمالي بالجرام</label><input type="number" min="1" value={weightGrams} onChange={e=>setWeightGrams(e.target.value)} placeholder="مثال: 1000" className={inputClass}/></div><div><label className="mb-1 block text-xs font-bold">سعر بيع الجرام الواحد للزبون</label>{moneyInput(gramSale,setGramSale,'مثال: 5')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>يتم حساب تكلفة الجرام في الخلفية تلقائياً.</p></div>{calculations.gramCost>0&&profitBox(calculations.gramCost,Number(gramSale)||0,'ملخص تكلفة وربح الجرام')}</div>}

            {mode==='litre'&&<div className="space-y-3 rounded-2xl border p-4"><div><label className="mb-1 block text-xs font-bold">سعر شراء العبوة أو الجالون الإجمالي</label>{moneyInput(litrePurchase,setLitrePurchase,'مثال: 12000')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>أدخل المبلغ الإجمالي للعبوة أو الجالون.</p></div><div><label className="mb-1 block text-xs font-bold">السعة الكلية باللتر</label><input type="number" min="0.1" step="0.1" value={litres} onChange={e=>setLitres(e.target.value)} placeholder="مثال: 20" className={inputClass}/></div><div><label className="mb-1 block text-xs font-bold">سعر بيع اللتر الواحد للزبون</label>{moneyInput(litreSale,setLitreSale,'مثال: 700')}<p className={`mt-1 text-[11px] ${theme.textSecondary}`}>يتم حساب تكلفة اللتر في الخلفية تلقائياً.</p></div>{calculations.litreCost>0&&profitBox(calculations.litreCost,Number(litreSale)||0,'ملخص تكلفة وربح اللتر')}</div>}
          </section>

          <section className="space-y-3"><label className="block text-sm font-bold">4. الكمية المتوفرة حالياً</label><input type="number" min="0" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0" className={inputClass}/><p className={`text-[11px] ${theme.textSecondary}`}>أدخل إجمالي الكمية الموجودة في المحل الآن بناءً على وحدة القياس المتاحة.</p></section>

          <section className="rounded-2xl border overflow-hidden"><button type="button" onClick={()=>setExtraOpen(v=>!v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold">خيارات إضافية (التصنيف، الوحدة الأساسية، حد التنبيه)<ChevronDown className={`h-4 w-4 transition ${extraOpen?'rotate-180':''}`}/></button>{extraOpen&&<div className="grid gap-3 border-t p-4 sm:grid-cols-2"><label className="text-xs font-bold">التصنيف<select value={category} onChange={e=>setCategory(e.target.value)} className={`${inputClass} mt-1`}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="text-xs font-bold">الوحدة الأساسية<select value={baseUnit} onChange={e=>setBaseUnit(e.target.value)} className={`${inputClass} mt-1`}><option>حبة</option><option>جرام</option><option>لتر</option></select></label><label className="text-xs font-bold">حد التنبيه عند النقص<input type="number" min="0" value={minStock} onChange={e=>setMinStock(e.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-xs font-bold">SKU / رمز المنتج<input value={sku} onChange={e=>setSku(e.target.value)} placeholder="مثال: MILK-001" className={`${inputClass} mt-1`}/></label><label className="text-xs font-bold sm:col-span-2">موقع التخزين (الرف / الممر)<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="مثال: رف أ - الممر 3" className={`${inputClass} mt-1`}/></label></div>}</section>

          <section className="space-y-3"><h3 className="text-sm font-black">وحدات البيع الإضافية</h3>{units.map((u,i)=><div key={i} className="grid grid-cols-[1fr_70px_90px_32px] gap-2 items-end"><input value={u.name} onChange={e=>setUnits(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="باكيت" className={inputClass}/><input type="number" value={u.factor} onChange={e=>setUnits(v=>v.map((x,j)=>j===i?{...x,factor:e.target.value}:x))} placeholder="عامل" className={inputClass}/><input type="number" value={u.price} onChange={e=>setUnits(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))} placeholder="السعر" className={inputClass}/><button type="button" onClick={()=>setUnits(v=>v.filter((_,j)=>j!==i))} className="mb-2 text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}<button type="button" onClick={()=>setUnits(v=>[...v,{name:'',factor:'',price:''}])} className="w-full rounded-xl border border-dashed py-3 text-xs font-bold flex items-center justify-center gap-1"><Plus className="h-4 w-4"/>إضافة وحدة</button></section>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t px-5 py-3 shadow-[0_-8px_20px_rgba(0,0,0,.04)]"><button type="button" onClick={()=>onNavigate('inventory')} className="rounded-xl border px-2 py-3 text-xs font-bold">إلغاء</button><button type="button" onClick={()=>save(true)} className="rounded-xl border border-emerald-700 px-2 py-3 text-xs font-bold">حفظ وإضافة آخر</button><button type="submit" className="rounded-xl bg-emerald-700 px-2 py-3 text-xs font-bold text-white">حفظ الصنف</button></div>
      </form>
    </div>
    <BarcodeScannerModal storeId={storeId} isOpen={scanner} onClose={()=>setScanner(false)} onBarcodeDetected={code=>{setBarcode(code);setScanner(false);}}/>
  </div>;
};
