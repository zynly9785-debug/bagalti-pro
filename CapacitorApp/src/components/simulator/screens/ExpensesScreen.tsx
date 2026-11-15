import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Edit3, FileText, Plus, Receipt, Search, Share2, Trash2, X } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Expense } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { shareTextEverywhere } from '../../../utils/nativeServices.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface ExpensesScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

const CATEGORIES = ['مشتريات بضاعة', 'إيجار', 'كهرباء وماء', 'رواتب وأجور', 'نقل وتوصيل', 'صيانة', 'اتصالات وإنترنت', 'رسوم حكومية', 'ضيافة', 'أخرى'];
const PAYMENT_METHODS = ['نقداً', 'تحويل بنكي', 'شبكة', 'آجل', 'أخرى'];
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ storeId, onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [items, setItems] = useState<Expense[]>(() => db.getExpenses(storeId));
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const refresh = () => setItems(db.getExpenses(storeId));
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || [item.category, item.payee, item.reference, item.notes].some((v) => (v || '').toLocaleLowerCase().includes(q));
      return matchesQuery && (!fromDate || item.date >= fromDate) && (!toDate || item.date <= toDate);
    });
  }, [items, search, fromDate, toDate]);
  const total = filtered.reduce((sum, item) => sum + item.amount, 0);

  const resetForm = () => {
    setEditing(null); setCategory(CATEGORIES[0]); setAmount(''); setDate(todayLocal());
    setPaymentMethod(PAYMENT_METHODS[0]); setPayee(''); setReference(''); setNotes(''); setError('');
  };
  const openCreate = () => { resetForm(); setIsFormOpen(true); };
  const openEdit = (item: Expense) => {
    setEditing(item); setCategory(item.category); setAmount(String(item.amount)); setDate(item.date);
    setPaymentMethod(item.payment_method); setPayee(item.payee || ''); setReference(item.reference || ''); setNotes(item.notes || ''); setError(''); setIsFormOpen(true);
  };
  const saveExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !date) { setError('أدخل مبلغاً موجباً وتاريخاً صحيحاً.'); return; }
    try {
      const payload = { category, amount: value, date, payment_method: paymentMethod, payee: payee.trim() || undefined, reference: reference.trim() || undefined, notes: notes.trim() || undefined };
      if (editing) db.updateExpense(storeId, editing.id, payload);
      else db.insertExpense({ ...payload, store_id: storeId });
      refresh(); setIsFormOpen(false); resetForm(); setNotice(editing ? 'تم تحديث المصروف.' : 'تم حفظ المصروف وإصدار إيصال له.');
      window.setTimeout(() => setNotice(''), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ المصروف.'); }
  };
  const removeExpense = (item: Expense) => {
    if (!window.confirm(`حذف مصروف ${formatCurrency(item.amount)} بتاريخ ${item.date}؟`)) return;
    db.deleteExpense(storeId, item.id); refresh(); setNotice('تم حذف سجل المصروف.');
    window.setTimeout(() => setNotice(''), 3000);
  };
  const receiptText = (item: Expense) => {
    const store = db.findUserById(storeId);
    return [
      `إيصال مصروف — ${store?.store_name || 'متجري'}`,
      `رقم الإيصال: EXP-${String(item.id).padStart(6, '0')}`,
      `التاريخ: ${item.date}`,
      `التصنيف: ${item.category}`,
      `المبلغ: ${formatCurrency(item.amount)}`,
      `طريقة الدفع: ${item.payment_method}`,
      item.payee ? `المستفيد/المورد: ${item.payee}` : '',
      item.reference ? `المرجع: ${item.reference}` : '',
      item.notes ? `ملاحظات: ${item.notes}` : '',
      '— صادر من تطبيق بقالتي برو',
    ].filter(Boolean).join('\n');
  };
  const shareExpense = async (item: Expense) => {
    try { await shareTextEverywhere(`إيصال مصروف EXP-${item.id}`, receiptText(item)); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setNotice('تعذرت المشاركة. تحقق من توفر تطبيق مشاركة.'); }
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative ${theme.screenBg} ${theme.textPrimary}`}>
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('dashboard')} className="p-1 hover:bg-white/10 rounded-full" aria-label="رجوع"><ArrowRight className="w-5 h-5" /></button>
          <div><h2 className="font-bold text-sm">مصروفات المتجر</h2><p className="text-[10px] text-emerald-200">تسجيل ومراجعة وإيصالات المصروفات</p></div>
        </div>
        <button onClick={openCreate} className="bg-[#C9A961] text-[#0B3D2E] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4"/>مصروف جديد</button>
      </div>
      {notice && <div className="bg-emerald-700 text-white p-2 text-xs text-center font-bold">{notice}</div>}
      <div className={`p-3 space-y-3 border-b ${theme.borderColor} ${theme.cardBg}`}>
        <div className="relative"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالتصنيف أو المورد أو المرجع..." className={`w-full rounded-xl px-3 py-2 text-xs border ${theme.inputBg} ${theme.textPrimary}`} /><Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" /></div>
        <div className="grid grid-cols-2 gap-2"><label className={`text-[10px] ${theme.textSecondary}`}>من تاريخ<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`mt-1 w-full rounded-xl p-2 text-xs border ${theme.inputBg} ${theme.textPrimary}`} /></label><label className={`text-[10px] ${theme.textSecondary}`}>إلى تاريخ<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`mt-1 w-full rounded-xl p-2 text-xs border ${theme.inputBg} ${theme.textPrimary}`} /></label></div>
        <div className={`rounded-xl px-3 py-2 flex items-center justify-between border ${isDarkMode ? 'bg-amber-950/30 border-amber-900' : 'bg-amber-50 border-amber-200'}`}><span className="text-xs font-bold">إجمالي المصروفات المعروضة ({filtered.length})</span><strong className="text-sm text-[#C9A961]">{formatCurrency(total)}</strong></div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 pb-20 space-y-2.5">
        {filtered.length === 0 ? <div className={`text-center py-12 text-xs ${theme.textMuted}`}><Receipt className="w-10 h-10 mx-auto mb-2 opacity-50"/><p>لا توجد مصروفات مطابقة.</p><button onClick={openCreate} className="mt-3 text-[#C9A961] font-bold">تسجيل أول مصروف</button></div> : filtered.map((item) => (
          <article key={item.id} className={`${theme.cardBg} rounded-2xl p-3 border ${theme.borderColor} space-y-2`}>
            <div className="flex justify-between gap-2"><div><h3 className="text-xs font-extrabold">{item.category}</h3><p className={`text-[10px] mt-1 ${theme.textSecondary}`}>{item.date} · {item.payment_method}{item.payee ? ` · ${item.payee}` : ''}</p>{item.reference && <p className={`text-[10px] ${theme.textMuted}`}>مرجع: {item.reference}</p>}</div><strong className="text-sm text-red-500 whitespace-nowrap">−{formatCurrency(item.amount)}</strong></div>
            {item.notes && <p className={`text-[10px] ${theme.textSecondary}`}>{item.notes}</p>}
            <div className={`grid grid-cols-3 gap-1.5 pt-2 border-t ${theme.borderColor}`}>
              <button onClick={() => shareExpense(item)} className="rounded-lg py-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold flex justify-center items-center gap-1"><Share2 className="w-3 h-3"/>مشاركة الإيصال</button>
              <button onClick={() => openEdit(item)} className="rounded-lg py-1.5 bg-amber-50 text-amber-900 text-[10px] font-bold flex justify-center items-center gap-1"><Edit3 className="w-3 h-3"/>تعديل</button>
              <button onClick={() => removeExpense(item)} className="rounded-lg py-1.5 bg-red-50 text-red-800 text-[10px] font-bold flex justify-center items-center gap-1"><Trash2 className="w-3 h-3"/>حذف</button>
            </div>
          </article>
        ))}
      </div>
      {isFormOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3"><div className={`${theme.cardBg} w-full max-w-sm rounded-3xl p-4 border-2 border-[#C9A961] max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b pb-2 mb-3"><h3 className="font-bold text-sm">{editing ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</h3><button onClick={() => { setIsFormOpen(false); resetForm(); }} aria-label="إغلاق"><X className="w-5 h-5"/></button></div>
        <form onSubmit={saveExpense} className="space-y-2.5">
          <label className={`block text-xs font-bold ${theme.textSecondary}`}>التصنيف<select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2"><label className={`text-xs font-bold ${theme.textSecondary}`}>المبلغ<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`} /></label><label className={`text-xs font-bold ${theme.textSecondary}`}>التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`} /></label></div>
          <label className={`block text-xs font-bold ${theme.textSecondary}`}>طريقة الدفع<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`}>{PAYMENT_METHODS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className={`block text-xs font-bold ${theme.textSecondary}`}>المستفيد أو المورد (اختياري)<input value={payee} onChange={(e) => setPayee(e.target.value)} className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`} /></label>
          <label className={`block text-xs font-bold ${theme.textSecondary}`}>رقم الفاتورة أو المرجع (اختياري)<input value={reference} onChange={(e) => setReference(e.target.value)} className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`} /></label>
          <label className={`block text-xs font-bold ${theme.textSecondary}`}>ملاحظات<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full rounded-xl p-2 border ${theme.inputBg} ${theme.textPrimary}`} /></label>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <div className="flex gap-2 pt-2"><button type="submit" className="flex-1 bg-[#0B3D2E] text-white rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4"/>حفظ وإصدار الإيصال</button><button type="button" onClick={() => { setIsFormOpen(false); resetForm(); }} className={`px-4 rounded-xl border ${theme.borderColor} text-xs font-bold`}>إلغاء</button></div>
        </form>
      </div></div>}
    </div>
  );
};
