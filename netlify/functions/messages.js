import { getAuthUser, unauthorized, json, supabase } from './_shared/auth.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getAuthUser(event);
  if (!user) return unauthorized();

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

    // Track usage
    if (data.usage) {
      await supabase.from('api_usage').insert({
        user_id: user.id,
        action,
        model: data.model || '',
        input_tokens: data.usage.input_tokens || 0,
        output_tokens: data.usage.output_tokens || 0,
      });
    }

    if (!response.ok) return json(data, response.status);
    return json(data);
  } catch (err) {
    return json({ error: { message: err.message } }, 500);
  }
}
