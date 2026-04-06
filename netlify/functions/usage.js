import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-devscout-action',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  };
}

async function getAuthUser(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

function unauthorized() {
  return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'Unauthorized' }) };
}

function json(data, status = 200) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(data) };
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getAuthUser(event);
  if (!user) return unauthorized();

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: weeklyUsage } = await supabase
    .from('api_usage')
    .select('action, input_tokens, output_tokens')
    .eq('user_id', user.id)
    .gte('created_at', weekAgo);

  const { data: monthlyUsage } = await supabase
    .from('api_usage')
    .select('action, input_tokens, output_tokens')
    .eq('user_id', user.id)
    .gte('created_at', monthAgo);

  const summarize = (rows) => {
    const total = { input: 0, output: 0, calls: 0 };
    const byAction = {};
    for (const r of rows || []) {
      total.input += r.input_tokens || 0;
      total.output += r.output_tokens || 0;
      total.calls++;
      if (!byAction[r.action]) byAction[r.action] = { input: 0, output: 0, calls: 0 };
      byAction[r.action].input += r.input_tokens || 0;
      byAction[r.action].output += r.output_tokens || 0;
      byAction[r.action].calls++;
    }
    return { total, byAction };
  };

  return json({
    weekly: summarize(weeklyUsage),
    monthly: summarize(monthlyUsage),
  });
}
