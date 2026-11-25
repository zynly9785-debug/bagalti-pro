import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Authentication required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: 'Server configuration is incomplete' });

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Invalid session' });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin
    .from('profiles').select('platform_role').eq('user_id', authData.user.id).maybeSingle();
  if (profileError) return json(500, { error: 'Could not verify administrator role' });
  if (profile?.platform_role !== 'platform_owner') return json(403, { error: 'Platform owner permission required' });

  let payload: { store_id?: unknown; password?: unknown };
  try { payload = await request.json(); } catch { return json(400, { error: 'Invalid request body' }); }
  const storeId = typeof payload.store_id === 'string' ? payload.store_id : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)) {
    return json(400, { error: 'Invalid store identifier' });
  }
  if (password.length < 8 || password.length > 72) return json(400, { error: 'Password must be 8–72 characters' });

  const { data: store, error: storeError } = await admin
    .from('stores').select('id,owner_user_id').eq('id', storeId).maybeSingle();
  if (storeError) return json(500, { error: 'Could not load target store' });
  if (!store) return json(404, { error: 'Store not found' });

  const { data: targetAuthData } = await admin.auth.admin.getUserById(store.owner_user_id);
  const existingMeta = (targetAuthData?.user?.user_metadata && typeof targetAuthData.user.user_metadata === 'object')
    ? targetAuthData.user.user_metadata
    : {};

  const { error: updateError } = await admin.auth.admin.updateUserById(store.owner_user_id, {
    password,
    user_metadata: {
      ...existingMeta,
      must_change_password: true,
      password_reset_at: new Date().toISOString(),
    },
  });
  if (updateError) return json(400, { error: updateError.message || 'Password update failed' });

  const { error: auditError } = await admin.from('admin_security_events').insert({
    actor_user_id: authData.user.id,
    store_id: store.id,
    action: 'merchant_password_reset',
  });
  if (auditError) {
    console.error('password-reset audit insert failed', auditError.message);
    return json(200, { ok: true, audit_logged: false, warning: 'Password updated; audit logging unavailable' });
  }
  return json(200, { ok: true, audit_logged: true });
});
