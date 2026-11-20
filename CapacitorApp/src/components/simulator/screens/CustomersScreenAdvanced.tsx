import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, UserPlus, Phone, CreditCard, FileText, RotateCcw, Share2, Edit2, Archive, Trash2, CalendarClock, Merge, MessageCircle, Plus } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Customer } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface Props { storeId: number; onNavigate: (screen: string, params?: Record<string, unknown>) => void; }

type Filter = 'all' | 'debtor' | 'clear' | 'overdue' | 'soon' | 'limit' | 'regular' | 'archived';

export const CustomersScreenAdvanced: React.FC<Props> = ({ storeId, onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'debt' | 'late' | 'new' | 'purchase' | 'payment' | 'name'>('debt');
  const [modal, setModal] = useState<'add' | 'edit' | 'pay' | 'freeInvoice' | 'plan' | 'communication' | 'merge' | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ name:'', phone:'', phone2:'', address:'', notes:'', credit:'50000', term:'30', opening:'0', category:'جديد', image:'' });
  const [payment, setPayment] = useState({ amount:'', method:'نقداً' as 'نقداً'|'تحويل بنكي'|'محفظة إلكترونية'|'أخرى', reference:'', notes:'', date:'' });
  const [plan, setPlan] = useState({ title:'جدول سداد', count:'2', amount:'', firstDate:'' });
  const [communication, setCommunication] = useState({ method:'واتساب' as 'واتساب'|'اتصال'|'رسالة'|'زيارة', subject:'تذكير بالسداد', amount:'', promise:false, expected:'', followUp:'', notes:'' });
  const [mergeTarget, setMergeTarget] = useState('');
  const [freeInvoice, setFreeInvoice] = useState({ note:'', amount:'', date:new Date().toISOString().slice(0,10), idempotencyKey:'' });

  const load = () => setCustomers(db.getCustomers(storeId));
  useEffect(load, [storeId]);
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 3500); };

  const today = new Date();
  const soonLimit = new Date(today); soonLimit.setDate(today.getDate() + 7);
  const isOverdue = (c: Customer) => Boolean(c.next_due_at && new Date(c.next_due_at) < today && c.total_debt > 0);
  const isSoon = (c: Customer) => Boolean(c.next_due_at && c.total_debt > 0 && new Date(c.next_due_at) >= today && new Date(c.next_due_at) <= soonLimit);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers.filter(c => {
      if (filter === 'debtor') return c.total_debt > 0;
      if (filter === 'clear') return c.total_debt <= 0;
      if (filter === 'overdue') return isOverdue(c);
      if (filter === 'soon') return isSoon(c);
      if (filter === 'limit') return c.total_debt > (c.credit_limit || 50000);
      if (filter === 'regular') return c.category === 'منتظم' || c.category === 'مميز';
      if (filter === 'archived') return c.status === 'archived' || c.status === 'suspended';
      return c.status !== 'archived';
    });
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      String(c.id).includes(q) ||
      String(c.total_debt).includes(q) ||
      db.getCustomerSales(storeId, c.id).some(sale =>
        String(sale.id).includes(q) || (sale.notes || '').toLowerCase().includes(q),
      ),
    );
    return [...list].sort((a,b) => {
      if (sort === 'debt') return b.total_debt-a.total_debt;
      if (sort === 'late') return (a.next_due_at || '9999').localeCompare(b.next_due_at || '9999');
      if (sort === 'new') return (b.registered_at || '').localeCompare(a.registered_at || '');
      if (sort === 'purchase') return (b.last_purchase_at || '').localeCompare(a.last_purchase_at || '');
      if (sort === 'payment') return (b.last_payment_at || '').localeCompare(a.last_payment_at || '');
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [customers, query, filter, sort, storeId]);

  const collected = customers.reduce((n,c) => n + (db.getCustomerPayments(storeId,c.id).reduce((sum,p) => sum+p.amount,0)),0);
  const totalDebt = customers.reduce((n,c)=>n+c.total_debt,0);
  const overdueDebt = customers.filter(isOverdue).reduce((n,c)=>n+c.total_debt,0);
  const soonDebt = customers.filter(isSoon).reduce((n,c)=>n+c.total_debt,0);
  const troubled = customers.filter(c=>c.total_debt>(c.credit_limit||50000)||isOverdue(c)).length;

  const resetForm = () => setForm({ name:'', phone:'', phone2:'', address:'', notes:'', credit:'50000', term:'30', opening:'0', category:'جديد', image:'' });
  const openAdd = () => { resetForm(); setModal('add'); };
  const openEdit = (c: Customer) => { setSelected(c); setForm({ name:c.name, phone:c.phone||'', phone2:c.phone_secondary||'', address:c.address||'', notes:c.notes||'', credit:String(c.credit_limit||50000), term:String(c.payment_term_days||30), opening:String(c.opening_balance||0), category:c.category||'جديد', image:c.image_url||'' }); setModal('edit'); };
  const createCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.insertCustomer(storeId, form.name, form.phone, Number(form.opening)||0, { phone_secondary:form.phone2, address:form.address, notes:form.notes, image_url:form.image, credit_limit:Number(form.credit)||50000, payment_term_days:Number(form.term)||30, category:form.category as Customer['category'] });
      setModal(null); resetForm(); load(); notify('تم حفظ العميل بنجاح');
    } catch (error) { notify(error instanceof Error ? error.message : 'تعذر حفظ العميل'); }
  };

  const saveEdit = (e: React.FormEvent) => { e.preventDefault(); if(!selected) return; try { db.updateCustomer(storeId,selected.id,{ name:form.name.trim(), phone:form.phone.trim(), phone_secondary:form.phone2.trim(), address:form.address.trim(), notes:form.notes.trim(), credit_limit:Number(form.credit)||50000, payment_term_days:Number(form.term)||30, category:form.category as Customer['category'], image_url:form.image }); setModal(null); load(); notify('تم تعديل بيانات العميل'); } catch(error){notify(error instanceof Error?error.message:'تعذر التعديل');} };

  const openPay = (c:Customer) => { setSelected(c); setPayment({amount:'',method:'نقداً',reference:'',notes:'',date:new Date().toISOString().slice(0,10)}); setModal('pay'); };
  const confirmPay = () => { if(!selected) return; try { const amount=Number(payment.amount); db.payCustomerDebt(storeId,selected.id,amount,{method:payment.method,reference:payment.reference,notes:payment.notes,date:payment.date,idempotencyKey:`RCPT-${Date.now()}-${selected.id}-${Math.round(amount*100)}`}); setModal(null); load(); notify('تم تأكيد السداد وإنشاء سند قبض'); } catch(error){notify(error instanceof Error?error.message:'تعذر تسجيل السداد');} };

  const openStatement = (c:Customer) => onNavigate('statement',{customerId:c.id,customerName:c.name,customerPhone:c.phone,totalDebt:c.total_debt});
  const openFreeInvoice = (c:Customer) => {
    setSelected(c);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `FREE-${Date.now()}-${c.id}-${Math.random().toString(36).slice(2)}`;
    setFreeInvoice({ note:'', amount:'', date:new Date().toISOString().slice(0,10), idempotencyKey });
    setModal('freeInvoice');
  };
  const confirmFreeInvoice = () => {
    if (!selected) return;
    try {
      if (!freeInvoice.note.trim()) throw new Error('أدخل ملاحظة توضح سبب الفاتورة');
      const sale = db.insertFreeCustomerInvoice(storeId, selected.id, {
        description: freeInvoice.note,
        totalAmount: Number(freeInvoice.amount),
        date: freeInvoice.date,
        idempotencyKey: freeInvoice.idempotencyKey,
      });
      setModal(null);
      load();
      notify(`تم إنشاء فاتورة حرة رقم ${sale.id} للعميل ${selected.name}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذر إنشاء الفاتورة الحرة');
    }
  };
  const openWhatsApp = (c:Customer) => { const text=`السلام عليكم ${c.name}، مذكركم بمديونية قدرها ${formatCurrency(c.total_debt)}. متجرنا يقدّر تعاملكم.`; window.open(`https://wa.me/${String(c.phone).replace(/[^0-9]/g,'')}?text=${encodeURIComponent(text)}`,'_blank'); };
  const callCustomer = (c:Customer) => { if(c.phone) window.location.href=`tel:${c.phone}`; else notify('العميل لا يملك رقم هاتف'); };

  const archive = (c:Customer) => { db.archiveCustomer(storeId,c.id); load(); notify('تم أرشفة العميل دون حذف سجلاته'); };
  const remove = (c:Customer) => { try { db.deleteCustomerSafely(storeId,c.id); load(); notify('تم حذف العميل'); } catch(error){notify(error instanceof Error?error.message:'تعذر الحذف');} };

  const createPlan = () => { if(!selected) return; try { const total=Number(plan.amount); const count=Math.max(1,Number(plan.count)||1); if(total<=0||!plan.firstDate) throw new Error('أدخل إجمالي الجدول وتاريخ أول دفعة'); const start=new Date(plan.firstDate); const items=[]; for(let i=0;i<count;i++){const d=new Date(start); d.setDate(start.getDate()+i*Math.max(1,Math.round((selected.payment_term_days||30)/count))); items.push({amount:Number((total/count).toFixed(2)),dueDate:d.toISOString().slice(0,10)});} db.createCustomerPaymentPlan(storeId,{customerId:selected.id,title:plan.title,installments:items}); setModal(null); notify('تم إنشاء جدول السداد'); } catch(error){notify(error instanceof Error?error.message:'تعذر إنشاء الجدول');} };

  const saveCommunication = () => { if(!selected) return; db.addCustomerCommunication(storeId,{store_id:storeId,customer_id:selected.id,date:new Date().toISOString(),method:communication.method,subject:communication.subject,amount_discussed:Number(communication.amount)||0,promise_to_pay:communication.promise,expected_payment_date:communication.expected||undefined,follow_up_at:communication.followUp||undefined,notes:communication.notes}); setModal(null); notify('تم تسجيل سجل التواصل'); };

  const mergeCustomer = () => { if(!selected) return; try { db.mergeCustomers(storeId,selected.id,Number(mergeTarget),'دمج حسابات من شاشة العملاء'); load(); setModal(null); notify('تم دمج الحسابات ونقل السجلات للحساب الأساسي'); } catch(error){notify(error instanceof Error?error.message:'تعذر دمج الحسابات');} };

  const cards=[['إجمالي العملاء',customers.length],['إجمالي الديون',formatCurrency(totalDebt)],['ديون قريبة',formatCurrency(soonDebt)],['ديون متأخرة',formatCurrency(overdueDebt)],['المحصل',formatCurrency(collected)],['المتعثرون',troubled]];

  return <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden`}>
    <div className="bg-[#0B3D2E] text-white p-3 flex items-center justify-between">
      <div className="flex items-center gap-2"><button onClick={()=>onNavigate('dashboard')} className="p-1"><ArrowRight/></button><h2 className="font-bold">إدارة العملاء والديون</h2></div>
      <button onClick={openAdd} className="flex items-center gap-1 bg-[#C9A961] text-[#0B3D2E] px-3 py-2 rounded-xl font-bold text-xs"><UserPlus className="w-4 h-4"/> إضافة عميل</button>
    </div>

    <div className="grid grid-cols-3 gap-2 p-3">{cards.map(([label,value])=><div key={String(label)} className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}><p className="text-[9px] text-gray-500">{label}</p><p className="font-bold text-xs mt-1">{value}</p></div>)}</div>

    <div className={`px-3 pb-2 space-y-2 ${theme.cardBg}`}>
      <div className="relative"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث بالاسم، الهاتف، رقم العميل، الفاتورة أو المبلغ" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 pr-9 text-xs`}/><Search className="w-4 h-4 absolute right-3 top-2.5 text-gray-400"/></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px]">
        {([['all','الكل'],['debtor','مدينون'],['clear','لهم رصيد صفر'],['overdue','متأخرون'],['soon','قريبون'],['limit','تجاوزوا الحد'],['regular','منتظمون'],['archived','الموقوفون']] as [Filter,string][]).map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={`whitespace-nowrap px-2 py-1.5 rounded-lg border ${filter===v?'bg-[#0B3D2E] text-white border-[#C9A961]':theme.borderColor}`}>{l}</button>)}
      </div>
      <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-2 py-1.5 text-xs`}><option value="debt">أعلى مديونية</option><option value="late">الأكثر تأخراً</option><option value="new">أحدث العملاء</option><option value="purchase">آخر شراء</option><option value="payment">آخر سداد</option><option value="name">الترتيب الأبجدي</option></select>
    </div>

    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-24">
      {filtered.length===0 && <div className="text-center py-16 text-gray-400 text-xs">لا توجد نتائج مطابقة</div>}
      {filtered.map(c=>{const limit=c.credit_limit||50000; const available=Math.max(0,limit-c.total_debt); const status=isOverdue(c)?'متأخر':isSoon(c)?'قريب الاستحقاق':c.status==='suspended'?'موقوف':c.status==='archived'?'مؤرشف':c.total_debt>limit?'تجاوز الحد':'نشط'; const unpaid=db.getCustomerSales(storeId,c.id).filter(s=>s.remaining_amount>0).length;
        return <div key={c.id} className={`${theme.cardBg} rounded-2xl border ${theme.borderColor} p-3`}>
          <div className="flex justify-between"><div><button onClick={()=>openStatement(c)} className="font-bold text-sm hover:text-[#C9A961]">{c.name}</button><p className="text-[10px] text-gray-500 flex gap-1 mt-1"><Phone className="w-3 h-3"/> {c.phone||'بدون هاتف'} • #{c.id}</p><p className="text-[10px] mt-1 text-[#C9A961]">الحالة: {status}</p></div><div className="text-left"><p className="text-[9px] text-gray-500">الرصيد</p><p className="font-bold text-sm text-red-700">{formatCurrency(c.total_debt)}</p><p className="text-[9px] text-gray-500">فواتير غير مسددة: {unpaid}</p></div></div>
          <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]"><span>الحد الائتماني: {formatCurrency(limit)}</span><span>المتاح: {formatCurrency(available)}</span><span>آخر شراء: {c.last_purchase_at?.slice(0,10)||'-'}</span><span>آخر سداد: {c.last_payment_at?.slice(0,10)||'-'}</span><span>السداد القادم: {c.next_due_at||'-'}</span><span>تصنيف: {c.category||'جديد'}</span></div>
          <div className="grid grid-cols-4 gap-1.5 mt-3 text-[9px]">
            <button onClick={()=>openStatement(c)} className="py-2 rounded-lg border border-blue-300 text-blue-600"><FileText className="w-3 h-3 inline"/> كشف حساب تراكمي</button>
            <button onClick={()=>openFreeInvoice(c)} className="py-2 rounded-lg border border-purple-300 text-purple-700"><Plus className="w-3 h-3 inline"/> إضافة فاتورة حرة</button>
            <button onClick={()=>openPay(c)} className="py-2 rounded-lg border border-emerald-300 text-emerald-700"><CreditCard className="w-3 h-3 inline"/> سداد</button>
            <button onClick={()=>openEdit(c)} className="py-2 rounded-lg border border-amber-300 text-amber-700"><Edit2 className="w-3 h-3 inline"/> تعديل</button>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-1.5 text-[9px]">
            <button onClick={()=>openWhatsApp(c)} className="py-1.5 rounded-lg bg-emerald-50 text-emerald-700">واتساب</button>
            <button onClick={()=>callCustomer(c)} className="py-1.5 rounded-lg bg-blue-50 text-blue-700">اتصال</button>
            <button onClick={()=>{setSelected(c);setCommunication({method:'واتساب',subject:'تذكير بالسداد',amount:String(c.total_debt),promise:false,expected:'',followUp:'',notes:''});setModal('communication');}} className="py-1.5 rounded-lg bg-amber-50 text-amber-700">تواصل</button>
            <button onClick={()=>{setSelected(c);setPlan({title:'جدول سداد',count:'2',amount:String(c.total_debt),firstDate:new Date().toISOString().slice(0,10)});setModal('plan');}} className="py-1.5 rounded-lg bg-sky-50 text-sky-700"><CalendarClock className="w-3 h-3 inline"/> جدول</button>
            <button onClick={()=>{setSelected(c);setMergeTarget('');setModal('merge');}} className="py-1.5 rounded-lg bg-gray-100 text-gray-700"><Merge className="w-3 h-3 inline"/> دمج</button>
          </div>
          <div className="flex gap-3 mt-2 text-[9px] justify-end"><button onClick={()=>archive(c)} className="text-gray-500 flex gap-1"><Archive className="w-3 h-3"/> أرشفة</button><button onClick={()=>remove(c)} className="text-red-600 flex gap-1"><Trash2 className="w-3 h-3"/> حذف آمن</button></div>
        </div>;
      })}
    </div>

    {modal && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className={`${theme.cardBg} w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl p-4 border ${theme.borderColor}`}>
      {(modal==='add'||modal==='edit')&&<form onSubmit={modal==='add'?createCustomer:saveEdit} className="space-y-2"><h3 className="font-bold">{modal==='add'?'إضافة عميل':'تعديل العميل'}</h3><input required placeholder="اسم العميل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input placeholder="الهاتف الأساسي" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input placeholder="هاتف إضافي" value={form.phone2} onChange={e=>setForm({...form,phone2:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input placeholder="العنوان" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><textarea placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><div className="grid grid-cols-2 gap-2"><input type="number" placeholder="الحد الائتماني" value={form.credit} onChange={e=>setForm({...form,credit:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="number" placeholder="مدة السداد أيام" value={form.term} onChange={e=>setForm({...form,term:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/></div>{modal==='add'&&<input type="number" placeholder="الرصيد الافتتاحي" value={form.opening} onChange={e=>setForm({...form,opening:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/>}<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}><option>جديد</option><option>منتظم</option><option>مميز</option><option>متأخر</option><option>متعثر</option><option>موقوف</option></select><div className="flex gap-2"><button className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-lg text-xs">حفظ</button><button type="button" onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></form>}
      {modal==='pay'&&selected&&<div className="space-y-2"><h3 className="font-bold">تسجيل سداد — {selected.name}</h3><p className="text-xs">الرصيد: {formatCurrency(selected.total_debt)}</p><input type="number" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} placeholder="المبلغ" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="date" value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><select value={payment.method} onChange={e=>setPayment({...payment,method:e.target.value as typeof payment.method})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}><option>نقداً</option><option>تحويل بنكي</option><option>محفظة إلكترونية</option><option>أخرى</option></select><input value={payment.reference} onChange={e=>setPayment({...payment,reference:e.target.value})} placeholder="رقم مرجع التحويل" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><textarea value={payment.notes} onChange={e=>setPayment({...payment,notes:e.target.value})} placeholder="ملاحظات" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><div className="flex gap-2"><button onClick={confirmPay} className="flex-1 bg-emerald-700 text-white py-2 rounded-lg text-xs">تأكيد السداد وسند القبض</button><button onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></div>}
      {modal==='freeInvoice'&&selected&&<div className="space-y-2"><h3 className="font-bold">إضافة فاتورة حرة — {selected.name}</h3><p className="text-[10px] text-gray-500">ستُسجل القيمة ديناً على حساب العميل وتظهر في كشفه التراكمي.</p><textarea required value={freeInvoice.note} onChange={e=>setFreeInvoice({...freeInvoice,note:e.target.value})} placeholder="ملاحظة أو سبب الفاتورة *" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input required type="number" min="0.01" step="0.01" value={freeInvoice.amount} onChange={e=>setFreeInvoice({...freeInvoice,amount:e.target.value})} placeholder="قيمة الفاتورة *" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="date" value={freeInvoice.date} onChange={e=>setFreeInvoice({...freeInvoice,date:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><div className="flex gap-2"><button onClick={confirmFreeInvoice} disabled={!freeInvoice.amount || !freeInvoice.note.trim()} className="flex-1 bg-purple-700 text-white py-2 rounded-lg text-xs disabled:opacity-50">حفظ وإضافة إلى حساب العميل</button><button onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></div>}
      {modal==='plan'&&selected&&<div className="space-y-2"><h3 className="font-bold">إنشاء جدول سداد — {selected.name}</h3><input value={plan.title} onChange={e=>setPlan({...plan,title:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="number" value={plan.amount} onChange={e=>setPlan({...plan,amount:e.target.value})} placeholder="إجمالي الدين" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="number" value={plan.count} onChange={e=>setPlan({...plan,count:e.target.value})} placeholder="عدد الدفعات" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="date" value={plan.firstDate} onChange={e=>setPlan({...plan,firstDate:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><div className="flex gap-2"><button onClick={createPlan} className="flex-1 bg-sky-700 text-white py-2 rounded-lg text-xs">إنشاء الجدول</button><button onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></div>}
      {modal==='communication'&&selected&&<div className="space-y-2"><h3 className="font-bold">سجل التواصل — {selected.name}</h3><select value={communication.method} onChange={e=>setCommunication({...communication,method:e.target.value as typeof communication.method})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}><option>واتساب</option><option>اتصال</option><option>رسالة</option><option>زيارة</option></select><input value={communication.subject} onChange={e=>setCommunication({...communication,subject:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="number" value={communication.amount} onChange={e=>setCommunication({...communication,amount:e.target.value})} placeholder="المبلغ محل النقاش" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><label className="flex gap-2 text-xs"><input type="checkbox" checked={communication.promise} onChange={e=>setCommunication({...communication,promise:e.target.checked})}/> وعد بالسداد</label><input type="date" value={communication.expected} onChange={e=>setCommunication({...communication,expected:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><input type="datetime-local" value={communication.followUp} onChange={e=>setCommunication({...communication,followUp:e.target.value})} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><textarea value={communication.notes} onChange={e=>setCommunication({...communication,notes:e.target.value})} placeholder="ملاحظات" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}/><div className="flex gap-2"><button onClick={saveCommunication} className="flex-1 bg-amber-700 text-white py-2 rounded-lg text-xs">حفظ السجل</button><button onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></div>}
      {modal==='merge'&&selected&&<div className="space-y-2"><h3 className="font-bold">دمج حسابات العميل</h3><p className="text-xs">الحساب الأساسي: {selected.name}</p><select value={mergeTarget} onChange={e=>setMergeTarget(e.target.value)} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg p-2 text-xs`}><option value="">اختر الحساب المراد دمجه</option>{customers.filter(c=>c.id!==selected.id&&c.status!=='archived').map(c=><option key={c.id} value={c.id}>{c.name} — {formatCurrency(c.total_debt)}</option>)}</select><div className="flex gap-2"><button onClick={mergeCustomer} disabled={!mergeTarget} className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-lg text-xs disabled:opacity-50">تأكيد الدمج الآمن</button><button onClick={()=>setModal(null)} className={`flex-1 border ${theme.borderColor} py-2 rounded-lg text-xs`}>إلغاء</button></div></div>}
    </div></div>}
    {toast&&<div role="status" className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-xs px-4 py-2 rounded-xl">{toast}</div>}
  </div>;
};
