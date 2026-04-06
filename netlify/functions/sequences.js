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
  const user = await getAuthUser(event);
  if (!user) return unauthorized();

  // GET — load all sequences
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // POST — create a sequence
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('sequences')
      .upsert({
        prospect_id: body.prospect_id,
        user_id: user.id,
        step: body.step || 'researching',
        research: body.research || '',
        emails: body.emails || [],
        active_email: body.active_email || 0,
        notes: body.notes || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'prospect_id' })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // PATCH — update a sequence
  if (event.httpMethod === 'PATCH') {
    const id = event.path.split('/').pop();
    const updates = JSON.parse(event.body);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('sequences')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // DELETE — delete a sequence
  if (event.httpMethod === 'DELETE') {
    const id = event.path.split('/').pop();
    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
