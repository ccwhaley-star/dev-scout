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

  // GET — list all prospects with claimer info
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('prospects')
      .select('*, claimer:user_profiles!claimed_by(full_name, avatar_url), scanner:user_profiles!scanned_by(full_name)')
      .order('match_score', { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // POST — upsert prospects after a scan
  if (event.httpMethod === 'POST') {
    const { prospects } = JSON.parse(event.body);
    if (!Array.isArray(prospects)) return json({ error: 'prospects array required' }, 400);

    const results = [];
    for (const p of prospects) {
      const row = {
        company: p.company,
        industry: p.industry,
        size: p.size,
        size_source: p.sizeSource,
        location: p.location,
        roles: p.roles || [],
        source: p.source,
        posted: p.posted,
        match_score: p.matchScore,
        raw_match_score: p.rawMatchScore,
        raw_nearshore_score: p.rawNearshoreScore,
        nearshore_score: p.nearshoreScore,
        nearshore_signals: p.nearshoreSignals || [],
        notes: p.notes || '',
        linkedin_url: p.linkedinUrl,
        indeed_url: p.indeedUrl,
        ziprecruiter_url: p.ziprecruiterUrl,
        builtin_url: p.builtinUrl,
        dice_url: p.diceUrl,
        recruiter_name: p.recruiter?.name,
        recruiter_title: p.recruiter?.title,
        recruiter_email: p.recruiter?.email,
        recruiter_linkedin_url: p.recruiter?.linkedinUrl,
        recruiter_photo_url: p.recruiter?.photoUrl,
        connection_status: p.connectionStatus || {},
        company_relationship: p.companyRelationship,
        recruiter_relationship: p.recruiterRelationship,
        scanned_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // Upsert by company name — don't overwrite claimed_by
      const { data, error } = await supabase
        .from('prospects')
        .upsert(row, { onConflict: 'company_lower', ignoreDuplicates: false })
        .select()
        .single();

      if (!error && data) results.push(data);
    }

    return json({ inserted: results.length, prospects: results });
  }

  // DELETE — remove a prospect
  if (event.httpMethod === 'DELETE') {
    const id = event.path.split('/').pop();
    const { error } = await supabase
      .from('prospects')
      .delete()
      .eq('id', id)
      .or(`claimed_by.is.null,claimed_by.eq.${user.id}`);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
