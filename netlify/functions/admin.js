import { getAuthUser, unauthorized, json, supabase } from './_shared/auth.js';

const ADMIN_EMAIL = 'ccwhaley@gmail.com';

async function isAdmin(user) {
  if (user.email === ADMIN_EMAIL) return true;
  const { data } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).single();
  return data?.is_admin === true;
}

export async function handler(event) {
  const user = await getAuthUser(event);
  if (!user) return unauthorized();
  if (!(await isAdmin(user))) return json({ error: 'Admin access required' }, 403);

  // GET — list all users with profiles and weekly usage
  if (event.httpMethod === 'GET') {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: usage } = await supabase
      .from('api_usage')
      .select('user_id, input_tokens, output_tokens')
      .gte('created_at', weekAgo);

    const users = (profiles || []).map(p => {
      const userUsage = (usage || []).filter(u => u.user_id === p.id);
      const weeklyTokens = userUsage.reduce((sum, u) => sum + (u.input_tokens || 0) + (u.output_tokens || 0), 0);
      return { ...p, weekly_tokens: weeklyTokens };
    });

    return json({ users });
  }

  // PATCH — enable/disable user
  if (event.httpMethod === 'PATCH') {
    const { user_id, is_disabled } = JSON.parse(event.body);
    if (!user_id) return json({ error: 'user_id required' }, 400);

    const { error } = await supabase
      .from('user_profiles')
      .update({ is_disabled })
      .eq('id', user_id);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  // POST — admin actions (reset password)
  if (event.httpMethod === 'POST') {
    const { action, email } = JSON.parse(event.body);

    if (action === 'reset-password') {
      if (!email) return json({ error: 'email required' }, 400);
      const { error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  }

  return json({ error: 'Method not allowed' }, 405);
}
