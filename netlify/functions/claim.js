import { getAuthUser, unauthorized, json, supabase } from './_shared/auth.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getAuthUser(event);
  if (!user) return unauthorized();

  const { prospect_id, action } = JSON.parse(event.body);
  if (!prospect_id) return json({ error: 'prospect_id required' }, 400);

  if (action === 'unclaim') {
    const { data, error } = await supabase.rpc('unclaim_prospect', {
      p_prospect_id: prospect_id,
      p_user_id: user.id,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ success: data });
  }

  // Default: claim
  const { data, error } = await supabase.rpc('claim_prospect', {
    p_prospect_id: prospect_id,
    p_user_id: user.id,
  });

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'Prospect already claimed by another user' }, 409);
  return json({ success: true });
}
