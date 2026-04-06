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

function json(data, status = 200) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...corsHeaders() }, body: JSON.stringify(data) };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Auth is optional for messages — allows unauthenticated local dev
  const user = await getAuthUser(event);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: { message: 'ANTHROPIC_API_KEY not set' } }, 500);

  const action = event.headers['x-devscout-action'] || 'unknown';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: event.body,
    });

    const data = await response.json();

    // Track usage if authenticated
    if (data.usage && user) {
      try {
        await supabase.from('api_usage').insert({
          user_id: user.id,
          action,
          model: data.model || '',
          input_tokens: data.usage.input_tokens || 0,
          output_tokens: data.usage.output_tokens || 0,
        });
      } catch (e) {
        // Don't fail the request if usage tracking fails
        console.error('Usage tracking error:', e);
      }
    }

    if (!response.ok) return json(data, response.status);
    return json(data);
  } catch (err) {
    return json({ error: { message: err.message } }, 500);
  }
}
