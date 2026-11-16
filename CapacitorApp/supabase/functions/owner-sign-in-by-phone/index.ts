import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\s().-]/g, '');
  let digits: string;
  if (compact.startsWith('+')) digits = compact.slice(1).replace(/\D/g, '');
  else if (compact.startsWith('00')) digits = compact.slice(2).replace(/\D/g, '');
  else {
    digits = compact.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `967${digits.slice(1)}`;
    else if (!digits.startsWith('967')) digits = `967${digits}`;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'الخدمة غير مهيأة.' });

  let input: { phone?: unknown; password?: unknown };
  try { input = await request.json(); } catch { return json(400, { error: 'تعذر التحقق من بيانات الدخول.' }); }
  const phone = normalizePhone(input.phone);
  const password = typeof input.password === 'string' ? input.password : '';
  if (!phone || password.length < 1 || password.length > 128) return json(400, { error: 'تعذر تسجيل الدخول. تحقق من الرقم وكلمة المرور.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin
    .from('profiles').select('user_id,platform_role').eq('phone', phone).maybeSingle();
  if (profileError || !profile || profile.platform_role !== 'platform_owner') {
    return json(401, { error: 'تعذر تسجيل الدخول. تحقق من رقم الهاتف وكلمة المرور.' });
  }

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
  const email = userResult.user?.email;
  if (userError || !email) return json(401, { error: 'تعذر تسجيل الدخول. تحقق من رقم الهاتف وكلمة المرور.' });

  // Delegate password checking and sign-in throttling to Supabase Auth.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authResult, error: authError } = await authClient.auth.signInWithPassword({ email, password });
  if (authError || !authResult.user || authResult.user.id !== profile.user_id || !authResult.session) {
    return json(401, { error: 'تعذر تسجيل الدخول. تحقق من رقم الهاتف وكلمة المرور.' });
  }
  return json(200, {
    access_token: authResult.session.access_token,
    refresh_token: authResult.session.refresh_token,
    token_type: authResult.session.token_type,
    expires_in: authResult.session.expires_in,
    expires_at: authResult.session.expires_at,
  });
});
