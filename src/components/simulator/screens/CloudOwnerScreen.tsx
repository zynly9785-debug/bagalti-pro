import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Search, Store, Clock, Check, Ban, Plus, MessageSquare, Bell, Copy, Megaphone } from 'lucide-react';
import { supabase } from '../../../supabaseClient.ts';
import { formatCurrency, validatePackageInput } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import {
  CloudNotificationError,
  NOTIFICATION_RELAY_PREFIX,
  STORE_NOTIFICATIONS_SETUP_SQL,
  extractCloudErrorInfo,
  isNotificationRelayPackage,
  sendCloudBroadcastNotification,
  sendCloudStoreNotification,
} from '../../../services/notificationsService.ts';

type CloudStore = {
  id: string;
  store_name: string;
  owner_name: string;
  phone: string;
  governorate: string;
  district: string;
  neighborhood: string;
  status: 'active' | 'suspended';
  subscription_end: string;
  subscription_price: number;
  suspension_reason: string | null;
  created_at: string;
};
type CloudPackage = { id: string; name: string; duration_days: number; price: number; description: string; is_active: boolean };
type StoreFilter = 'all' | 'active' | 'expired' | 'suspended' | 'soon';

export const CloudOwnerScreen: React.FC<{ onNavigate: (screen: string, params?: Record<string, unknown>) => void }> = ({
  onNavigate,
}) => {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'stores' | 'packages'>('stores');
  const [stores, setStores] = useState<CloudStore[]>([]);
  const [packages, setPackages] = useState<CloudPackage[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');

  const [editing, setEditing] = useState<CloudStore | null>(null);
  const [days, setDays] = useState('30');
  const [price, setPrice] = useState('0');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [mode, setMode] = useState<'reset' | 'append'>('reset');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const [resetTarget, setResetTarget] = useState<CloudStore | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  const [messageTarget, setMessageTarget] = useState<CloudStore | null>(null);
  const [msgTitle, setMsgTitle] = useState('رسالة من إدارة بقالتي برو');
  const [msgBody, setMsgBody] = useState('');

  const [remindTarget, setRemindTarget] = useState<CloudStore | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('إعلان هام من إدارة بقالتي برو');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [modalError, setModalError] = useState('');
  const [needsSqlSetup, setNeedsSqlSetup] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const [pkgName, setPkgName] = useState('');
  const [pkgDays, setPkgDays] = useState('30');
  const [pkgPrice, setPkgPrice] = useState('0');
  const [pkgDesc, setPkgDesc] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    if (!supabase) {
      setError('إعداد الاتصال السحابي غير مكتمل.');
      setLoading(false);
      return;
    }
    try {
      const [s, p] = await Promise.all([
        supabase
          .from('stores')
          .select('id,store_name,owner_name,phone,governorate,district,neighborhood,status,subscription_end,subscription_price,suspension_reason,created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('subscription_packages')
          .select('id,name,duration_days,price,description,is_active')
          .not('name', 'like', `${NOTIFICATION_RELAY_PREFIX}%`)
          .order('created_at', { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      setStores((s.data || []) as CloudStore[]);
      setPackages(((p.data || []) as CloudPackage[]).filter((pkg) => !isNotificationRelayPackage(pkg)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات الإدارة. تحقق من حساب مالك التطبيق.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const left = (end: string) => {
    const expiry = Date.parse(end);
    return Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : 0;
  };

  const filtered = useMemo(
    () =>
      stores.filter((s) => {
        const q = `${s.store_name} ${s.owner_name} ${s.phone}`.toLowerCase().includes(query.trim().toLowerCase());
        const d = left(s.subscription_end);
        const matchesFilter =
          storeFilter === 'all' ||
          (storeFilter === 'active' && s.status === 'active' && d > 0) ||
          (storeFilter === 'expired' && s.status === 'active' && d <= 0) ||
          (storeFilter === 'suspended' && s.status === 'suspended') ||
          (storeFilter === 'soon' && s.status === 'active' && d > 0 && d <= 10);
        return q && matchesFilter;
      }),
    [stores, query, storeFilter],
  );

  const openEdit = (s: CloudStore, forceActiveReset = false) => {
    setEditing(s);
    setDays(String(forceActiveReset ? 30 : Math.max(1, left(s.subscription_end))));
    setPrice(String(s.subscription_price || 0));
    setStatus(forceActiveReset ? 'active' : s.status);
    setMode('reset');
    setReason(s.suspension_reason || '');
    setNote('');
    setError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editing) return;
    const d = Number(days),
      amount = Number(price);
    if (!Number.isInteger(d) || d < 1 || d > 36500) {
      setError('أدخل مدة من 1 إلى 36500 يوماً.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('السعر يجب أن يكون رقماً غير سالب.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const base = mode === 'reset' ? Date.now() : Math.max(Date.now(), new Date(editing.subscription_end).getTime());
      const end = new Date(base + d * 86400000).toISOString();
      const action =
        status === 'suspended' ? 'suspended' : editing.status === 'suspended' ? 'unsuspended' : mode === 'reset' ? 'reset' : 'extended';
      const { error: e } = await supabase.rpc('admin_update_store_subscription', {
        p_store_id: editing.id,
        p_subscription_end: end,
        p_subscription_price: amount,
        p_status: status,
        p_suspension_reason: status === 'suspended' ? reason.trim() || 'إيقاف إداري' : null,
        p_action: action,
        p_note: note.trim(),
      });
      if (e) throw e;
      setEditing(null);
      setNotice('تم حفظ الاشتراك وتسجيل التغيير في سجل الإدارة.');
      window.setTimeout(() => setNotice(''), 3500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الاشتراك.');
    } finally {
      setBusy(false);
    }
  };

  const addPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const d = Number(pkgDays),
      p = Number(pkgPrice),
      v = validatePackageInput(pkgName, d, p);
    if (!v.isValid) {
      setError(v.error || 'بيانات الباقة غير صحيحة.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: e } = await supabase
        .from('subscription_packages')
        .insert({ name: pkgName.trim(), duration_days: d, price: p, description: pkgDesc.trim(), is_active: true });
      if (e) throw e;
      setPkgName('');
      setPkgDays('30');
      setPkgPrice('0');
      setPkgDesc('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إضافة الباقة.');
    } finally {
      setBusy(false);
    }
  };

  const togglePackage = async (p: CloudPackage) => {
    if (!supabase) return;
    setBusy(true);
    const { error: e } = await supabase.from('subscription_packages').update({ is_active: !p.is_active }).eq('id', p.id);
    if (e) setError(e.message);
    else await load();
    setBusy(false);
  };

  const resetMerchantPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !resetTarget) return;
    if (resetPassword.length < 8 || resetPassword.length > 72) {
      setError('كلمة المرور الجديدة يجب أن تكون بين 8 و 72 حرفاً.');
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('admin-reset-store-password', {
        body: { store_id: resetTarget.id, password: resetPassword },
      });
      if (invokeErr) {
        let detailedMsg = '';
        const ctx = (invokeErr as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        if (ctx && typeof ctx.json === 'function') {
          const parsed = await ctx.json().catch(() => null);
          if (parsed?.error) detailedMsg = String(parsed.error);
        }
        throw new Error(detailedMsg || invokeErr.message || 'تعذر منح كلمة المرور الجديدة.');
      }
      if (!data?.ok) throw new Error(data?.error || 'لم تؤكد الخدمة نجاح تغيير كلمة المرور.');
      const targetName = resetTarget.store_name;
      setResetTarget(null);
      setResetPassword('');
      setConfirmResetPassword('');
      setNotice(`تم منح كلمة مرور مؤقتة لمتجر "${targetName}". أبلغ التاجر بها ليتمكن من الدخول وتغييرها من الإعدادات.`);
      window.setTimeout(() => setNotice(''), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور. تحقق من صلاحية مالك التطبيق والاتصال.');
    } finally {
      setBusy(false);
    }
  };

  const quickToggle = async (s: CloudStore) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    try {
      const next = s.status === 'active' ? 'suspended' : 'active';
      const { error: e } = await supabase.rpc('admin_update_store_subscription', {
        p_store_id: s.id,
        p_subscription_end: s.subscription_end,
        p_subscription_price: s.subscription_price,
        p_status: next,
        p_suspension_reason: next === 'suspended' ? 'إيقاف سريع من إدارة المنصة' : null,
        p_action: next === 'suspended' ? 'suspended' : 'unsuspended',
        p_note: 'تغيير سريع من بطاقة المتجر',
      });
      if (e) throw e;
      setNotice(next === 'active' ? `تم إلغاء إيقاف ${s.store_name} وتفعيله.` : `تم إيقاف ${s.store_name}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تغيير حالة المتجر');
    } finally {
      setBusy(false);
    }
  };

  const sendCloudNotification = async (
    target: CloudStore,
    title: string,
    message: string,
    kind: 'message' | 'reminder' = 'message',
  ): Promise<boolean> => {
    setBusy(true);
    setError('');
    setModalError('');
    setNeedsSqlSetup(false);
    setSqlCopied(false);
    try {
      await sendCloudStoreNotification({
        cloudStoreId: target.id,
        storePhone: target.phone,
        title,
        message,
        kind,
        sender: 'إدارة بقالتي برو',
      });
      setNotice(`تم إرسال الرسالة إلى "${target.store_name}" بنجاح.`);
      window.setTimeout(() => setNotice(''), 4000);
      return true;
    } catch (err) {
      const msg =
        err instanceof CloudNotificationError
          ? err.message
          : extractCloudErrorInfo(err).message || 'تعذر إرسال الرسالة سحابياً.';
      setModalError(msg);
      setError(msg);
      if (err instanceof CloudNotificationError && err.needsMigrationSql) {
        setNeedsSqlSetup(true);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastBody.trim()) return;
    setBusy(true);
    setError('');
    setModalError('');
    setNeedsSqlSetup(false);
    setSqlCopied(false);
    try {
      const result = await sendCloudBroadcastNotification({
        stores: stores.map((s) => ({ id: s.id, phone: s.phone })),
        title: broadcastTitle.trim() || 'إعلان هام من إدارة بقالتي برو',
        message: broadcastBody.trim(),
        kind: 'message',
        sender: 'إدارة بقالتي برو',
      });
      setBroadcastOpen(false);
      setBroadcastBody('');
      setNotice(`تم إرسال الرسالة الجماعية بنجاح إلى جميع مستخدمي بقالتي برو (${result.sentCount} متجر).`);
      window.setTimeout(() => setNotice(''), 5000);
    } catch (err) {
      const msg =
        err instanceof CloudNotificationError
          ? err.message
          : extractCloudErrorInfo(err).message || 'تعذر إرسال الرسالة الجماعية سحابياً.';
      setModalError(msg);
      setError(msg);
      if (err instanceof CloudNotificationError && err.needsMigrationSql) {
        setNeedsSqlSetup(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopySqlSetup = async () => {
    try {
      await navigator.clipboard.writeText(STORE_NOTIFICATIONS_SETUP_SQL);
      setSqlCopied(true);
    } catch {
      setSqlCopied(false);
    }
  };

  const active = stores.filter((s) => s.status === 'active' && left(s.subscription_end) > 0).length;
  const suspended = stores.filter((s) => s.status === 'suspended').length;

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary}`}>
      <header className="bg-[#0B3D2E] text-white p-3 flex items-center justify-between border-b border-[#C9A961]/40">
        <button onClick={() => onNavigate('login')} aria-label="عودة">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="text-center">
          <b className="text-sm">إدارة المنصة والاشتراكات</b>
          <p className="text-[10px] text-emerald-100">مالك التطبيق • إدارة سحابية</p>
        </div>
        <button onClick={() => void load()} aria-label="تحديث">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="p-3 flex-1 overflow-y-auto space-y-3">
        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            [stores.length, 'كل المتاجر'],
            [active, 'نشطة'],
            [suspended, 'موقوفة'],
          ].map(([n, l]) => (
            <div key={String(l)} className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2`}>
              <b className="block text-lg">{n}</b>
              <span className="text-[10px]">{l}</span>
            </div>
          ))}
        </section>

        <div className="flex gap-2">
          <button onClick={() => setTab('stores')} className={`flex-1 rounded-xl py-2 text-xs font-bold ${tab === 'stores' ? 'bg-[#0B3D2E] text-white' : 'bg-white border text-gray-700'}`}>
            <Store className="inline w-4 h-4 ml-1" />
            المتاجر
          </button>
          <button onClick={() => setTab('packages')} className={`flex-1 rounded-xl py-2 text-xs font-bold ${tab === 'packages' ? 'bg-[#0B3D2E] text-white' : 'bg-white border text-gray-700'}`}>
            باقات الاشتراك
          </button>
        </div>

        {notice && <p className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-xl text-xs">{notice}</p>}
        {error && (
          <p role="alert" className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-xl text-xs break-words">
            {error}
          </p>
        )}

        {loading ? (
          <div className="text-center p-6 text-xs">جارٍ تحميل البيانات السحابية…</div>
        ) : tab === 'stores' ? (
          <>
            <button
              type="button"
              onClick={() => {
                setModalError('');
                setNeedsSqlSetup(false);
                setSqlCopied(false);
                setBroadcastTitle('إعلان هام من إدارة بقالتي برو');
                setBroadcastBody('');
                setBroadcastOpen(true);
              }}
              className="w-full rounded-2xl bg-gradient-to-l from-[#0B3D2E] to-[#145943] text-white border border-[#C9A961]/70 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
            >
              <Megaphone className="w-4 h-4 text-[#C9A961] shrink-0" />
              <span>إرسال رسالة جماعية لكل مستخدمي بقالتي برو ({stores.length})</span>
            </button>

            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث باسم المتجر أو المالك أو الهاتف" className={`w-full rounded-xl border ${theme.borderColor} ${theme.inputBg} pr-9 p-2.5 text-xs`} />
            </div>

            <div className="flex gap-1.5 overflow-x-auto text-[10px]">
              {(
                [
                  ['all', 'الكل'],
                  ['active', 'النشطة'],
                  ['expired', 'المنتهية اشتراكاتها'],
                  ['suspended', 'الموقوفة'],
                  ['soon', 'قريبة الانتهاء (≤ 10 أيام)'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setStoreFilter(id)} className={`whitespace-nowrap rounded-lg border px-3 py-2 font-bold ${storeFilter === id ? 'bg-[#0B3D2E] text-white' : 'bg-white text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {filtered.map((s) => {
              const daysLeft = left(s.subscription_end);
              const isExpired = s.status === 'active' && daysLeft <= 0;
              return (
                <article key={s.id} className={`${theme.cardBg} border ${theme.borderColor} rounded-2xl p-3 space-y-2`}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <b className="text-sm">{s.store_name}</b>
                      <p className="text-[11px] opacity-70">
                        {s.owner_name} · {s.phone}
                      </p>
                      <p className="text-[10px] opacity-60">{[s.governorate, s.district, s.neighborhood].filter(Boolean).join('، ')}</p>
                    </div>
                    <span className={`h-fit text-[10px] px-2 py-1 rounded-full ${s.status === 'active' ? (isExpired ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') : 'bg-red-100 text-red-800'}`}>
                      {s.status === 'active' ? (isExpired ? 'منتهي الاشتراك' : 'نشط') : 'موقوف'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <span>بدء الاشتراك: {new Date(s.created_at).toLocaleDateString('ar-YE')}</span>
                    <span>انتهاء الاشتراك: {new Date(s.subscription_end).toLocaleDateString('ar-YE')}</span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="flex gap-1 items-center">
                      <Clock className="w-3.5 h-3.5" />
                      {daysLeft} يوم متبقٍ
                    </span>
                    <span>{formatCurrency(Number(s.subscription_price))}</span>
                  </div>

                  {s.suspension_reason && <p className="text-[10px] text-red-700">سبب الإيقاف: {s.suspension_reason}</p>}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void quickToggle(s)}
                      className={`rounded-xl py-2 text-xs font-bold ${
                        s.status === 'active' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {s.status === 'active' ? 'إيقاف المستخدم' : 'إلغاء إيقاف المستخدم'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalError('');
                        setNeedsSqlSetup(false);
                        setSqlCopied(false);
                        setRemindTarget(s);
                      }}
                      className="rounded-xl border border-amber-400 bg-amber-50 text-amber-900 py-2 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>تذكير</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalError('');
                        setNeedsSqlSetup(false);
                        setSqlCopied(false);
                        setMessageTarget(s);
                        setMsgTitle('رسالة من إدارة بقالتي برو');
                        setMsgBody('');
                      }}
                      className="rounded-xl border border-[#0B3D2E] bg-emerald-50 text-[#0B3D2E] py-2 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>إرسال رسالة للمستخدم</span>
                    </button>

                    <button onClick={() => openEdit(s, isExpired)} className="bg-[#0B3D2E] text-white rounded-xl py-2 text-xs font-bold">
                      {isExpired ? 'تفعيل الاشتراك' : 'تعديل الاشتراك'}
                    </button>

                    <button
                      onClick={() => {
                        setResetTarget(s);
                        setResetPassword('');
                        setConfirmResetPassword('');
                        setError('');
                      }}
                      className="col-span-2 bg-amber-100 text-amber-950 rounded-xl py-2 text-xs font-bold"
                    >
                      منح كلمة مرور جديدة
                    </button>
                  </div>
                </article>
              );
            })}
            {!filtered.length && <p className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-4 text-center text-xs`}>لا توجد متاجر مطابقة.</p>}
          </>
        ) : (
          <>
            <form onSubmit={addPackage} className={`${theme.cardBg} border ${theme.borderColor} rounded-2xl p-3 space-y-2`}>
              <b className="text-xs">إضافة باقة اشتراك</b>
              <input required value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder="اسم الباقة" className={`w-full border rounded-lg p-2 text-xs ${theme.inputBg}`} />
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" min="1" max="36500" value={pkgDays} onChange={(e) => setPkgDays(e.target.value)} placeholder="المدة بالأيام" className={`border rounded-lg p-2 text-xs ${theme.inputBg}`} />
                <input required type="number" min="0" step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} placeholder="السعر" className={`border rounded-lg p-2 text-xs ${theme.inputBg}`} />
              </div>
              <input value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} placeholder="وصف اختياري" className={`w-full border rounded-lg p-2 text-xs ${theme.inputBg}`} />
              <button disabled={busy} className="w-full bg-[#0B3D2E] text-white rounded-xl py-2 text-xs">
                <Plus className="inline w-4 h-4 ml-1" />
                حفظ الباقة
              </button>
            </form>
            {packages.map((p) => (
              <div key={p.id} className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-3 flex justify-between items-center gap-2`}>
                <div>
                  <b className="text-xs">{p.name}</b>
                  <p className="text-[10px] opacity-70">
                    {p.duration_days} يوم · {formatCurrency(Number(p.price))}
                  </p>
                  {p.description && <p className="text-[10px] opacity-60">{p.description}</p>}
                </div>
                <button disabled={busy} onClick={() => void togglePackage(p)} className={`px-3 py-1.5 rounded-lg text-[10px] ${p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  {p.is_active ? (
                    <>
                      <Check className="inline w-3 h-3 ml-1" />
                      مفعلة
                    </>
                  ) : (
                    <>
                      <Ban className="inline w-3 h-3 ml-1" />
                      معطلة
                    </>
                  )}
                </button>
              </div>
            ))}
          </>
        )}
      </main>

      {/* Modal: Send Reminder (in-app + WhatsApp link, no window.open) */}
      {remindTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 space-y-3 text-gray-900">
            <div className="flex justify-between items-center">
              <b className="text-sm">تذكير متجر: {remindTarget.store_name}</b>
              <button type="button" onClick={() => setRemindTarget(null)} aria-label="إغلاق">
                ×
              </button>
            </div>
            <p className="text-xs text-gray-600">اختر إرسال إشعار داخل التطبيق لهذا المتجر أو فتح محادثة واتساب للتذكير بالتجديد.</p>
            {modalError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-[11px] space-y-2">
                <p className="break-words font-semibold">{modalError}</p>
                {needsSqlSetup && (
                  <button
                    type="button"
                    onClick={() => void handleCopySqlSetup()}
                    className="w-full rounded-lg bg-red-700 text-white py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{sqlCopied ? 'تم نسخ كود SQL — نفّذه في Supabase SQL Editor' : 'نسخ كود تهيئة جدول الرسائل (SQL)'}</span>
                  </button>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const d = left(remindTarget.subscription_end);
                  const ok = await sendCloudNotification(
                    remindTarget,
                    'تذكير قرب انتهاء الاشتراك',
                    `مرحباً ${remindTarget.owner_name}، اشتراك متجر ${remindTarget.store_name} ${d > 0 ? `متبقي له ${d} يوماً` : 'منتهي حالياً'}، يرجى التجديد للاستمرار في استخدام بقالتي برو.`,
                    'reminder',
                  );
                  if (ok) setRemindTarget(null);
                }}
                className="w-full bg-[#0B3D2E] text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-60"
              >
                {busy ? 'جارٍ الإرسال…' : 'إرسال إشعار داخل التطبيق الآن'}
              </button>
              <a
                href={`https://wa.me/${String(remindTarget.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `مرحباً ${remindTarget.owner_name}، اشتراك متجر ${remindTarget.store_name} ${left(remindTarget.subscription_end) > 0 ? `متبقي له ${left(remindTarget.subscription_end)} يوماً` : 'منتهي حالياً'}، يرجى التجديد للاستمرار في استخدام بقالتي برو.`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#25D366] text-white rounded-xl py-2.5 text-xs font-bold text-center"
              >
                إرسال عبر واتساب
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Broadcast Message to All Users */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={handleSendBroadcast} className="w-full max-w-sm rounded-2xl bg-white p-4 space-y-3 text-gray-900">
            <div className="flex justify-between items-center">
              <b className="text-sm flex items-center gap-1.5 text-[#0B3D2E]">
                <Megaphone className="w-4 h-4 text-[#C9A961]" />
                <span>إرسال رسالة جماعية لكل المستخدمين</span>
              </b>
              <button type="button" onClick={() => setBroadcastOpen(false)} aria-label="إغلاق">
                ×
              </button>
            </div>
            <p className="text-[11px] text-gray-600 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
              ستصل هذه الرسالة إلى قسم «رسائل إدارة التطبيق» لدى جميع مستخدمي بقالتي برو ({stores.length} متجر مسجل).
            </p>
            {modalError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-[11px] space-y-2">
                <p className="break-words font-semibold">{modalError}</p>
                {needsSqlSetup && (
                  <button
                    type="button"
                    onClick={() => void handleCopySqlSetup()}
                    className="w-full rounded-lg bg-red-700 text-white py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{sqlCopied ? 'تم نسخ كود SQL — نفّذه في Supabase SQL Editor' : 'نسخ كود تهيئة جدول الرسائل (SQL)'}</span>
                  </button>
                )}
              </div>
            )}
            <input
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full border rounded-lg p-2 text-xs"
              required
              placeholder="عنوان الرسالة الجماعية"
            />
            <textarea
              rows={4}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              className="w-full border rounded-lg p-2 text-xs"
              required
              placeholder="اكتب نص الرسالة التي ستصل لجميع مستخدمي بقالتي برو..."
            />
            <div className="flex gap-2">
              <button disabled={busy} className="flex-1 bg-[#0B3D2E] text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-60">
                {busy ? 'جارٍ الإرسال للجميع…' : 'إرسال للجميع الآن'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBroadcastOpen(false)}
                className="px-4 border border-gray-300 rounded-xl py-2.5 text-xs font-bold text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Send Private Message */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!msgBody.trim()) return;
              const ok = await sendCloudNotification(
                messageTarget,
                msgTitle.trim() || 'إشعار إداري',
                msgBody.trim(),
                'message',
              );
              if (ok) {
                setMessageTarget(null);
                setMsgBody('');
              }
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-4 space-y-3 text-gray-900"
          >
            <div className="flex justify-between items-center">
              <b className="text-sm">إرسال رسالة خاصة إلى {messageTarget.store_name}</b>
              <button type="button" onClick={() => setMessageTarget(null)} aria-label="إغلاق">
                ×
              </button>
            </div>
            {modalError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-[11px] space-y-2">
                <p className="break-words font-semibold">{modalError}</p>
                {needsSqlSetup && (
                  <button
                    type="button"
                    onClick={() => void handleCopySqlSetup()}
                    className="w-full rounded-lg bg-red-700 text-white py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{sqlCopied ? 'تم نسخ كود SQL — نفّذه في Supabase SQL Editor' : 'نسخ كود تهيئة جدول الرسائل (SQL)'}</span>
                  </button>
                )}
              </div>
            )}
            <input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} className="w-full border rounded-lg p-2 text-xs" required placeholder="العنوان" />
            <textarea rows={3} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} className="w-full border rounded-lg p-2 text-xs" required placeholder="نص الرسالة..." />
            <div className="flex gap-2">
              <button disabled={busy} className="flex-1 bg-[#0B3D2E] text-white rounded-xl py-2.5 text-xs font-bold disabled:opacity-60">
                {busy ? 'جارٍ الإرسال…' : 'إرسال للمستخدم فقط'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMessageTarget(null)}
                className="px-4 border border-gray-300 rounded-xl py-2.5 text-xs font-bold text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={save} className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 space-y-3 text-gray-900">
            <div className="flex justify-between">
              <b className="text-sm">اشتراك {editing.store_name}</b>
              <button type="button" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>
            <label className="block text-xs">
              الأيام
              <input required type="number" min="1" max="36500" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
            </label>
            <label className="block text-xs">
              احتساب المدة
              <select value={mode} onChange={(e) => setMode(e.target.value as 'reset' | 'append')} className="mt-1 w-full border rounded-lg p-2">
                <option value="reset">بدء المدة من اليوم</option>
                <option value="append">إضافة فوق الرصيد الحالي</option>
              </select>
            </label>
            <label className="block text-xs">
              السعر
              <input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
            </label>
            <label className="block text-xs">
              الحالة
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')} className="mt-1 w-full border rounded-lg p-2">
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
              </select>
            </label>
            {status === 'suspended' && (
              <label className="block text-xs">
                سبب الإيقاف
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
              </label>
            )}
            <label className="block text-xs">
              ملاحظة سجل الإدارة
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
            </label>
            {error && (
              <p role="alert" className="text-xs text-red-700">
                {error}
              </p>
            )}
            <button disabled={busy} className="w-full bg-[#0B3D2E] text-white rounded-xl py-2.5 text-xs font-bold">
              {busy ? 'جارٍ الحفظ…' : 'حفظ الاشتراك وتسجيله'}
            </button>
          </form>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={resetMerchantPassword} className="w-full max-w-sm rounded-2xl bg-white p-4 space-y-3 text-gray-900">
            <div className="flex justify-between items-center">
              <b className="text-sm">إعادة تعيين كلمة مرور {resetTarget.store_name}</b>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword('');
                  setConfirmResetPassword('');
                  setError('');
                }}
                aria-label="إلغاء"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-600">ستتغير كلمة مرور حساب المتجر في Supabase. أبلغ صاحب المتجر بكلمة المرور عبر قناة خاصة وآمنة.</p>
            <label className="block text-xs">
              كلمة المرور الجديدة
              <input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
            </label>
            <label className="block text-xs">
              تأكيد كلمة المرور
              <input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
            </label>
            {error && (
              <p role="alert" className="text-xs text-red-700">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword('');
                  setConfirmResetPassword('');
                  setError('');
                }}
                className="rounded-xl border py-2 text-xs font-bold"
              >
                رفض / إلغاء
              </button>
              <button type="submit" disabled={busy} className="rounded-xl bg-[#0B3D2E] py-2 text-xs font-bold text-white">
                {busy ? 'جارٍ التغيير…' : 'تأكيد منح كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
