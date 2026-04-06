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

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders() };
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) return json({ error: 'APOLLO_API_KEY not set' }, 500);

  const user = await getAuthUser(event);
  const body = JSON.parse(event.body);
  const { action } = body;

  // SEARCH: Find recruiter/HR contacts at a company (free, no credits)
  if (action === 'search') {
    const { company, domain } = body;
    try {
      const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
        body: JSON.stringify({
          organization_name: company,
          q_organization_domains: domain || undefined,
          person_titles: ['recruiter', 'talent acquisition', 'hiring manager', 'HR manager', 'people operations', 'technical recruiter'],
          per_page: 5,
          page: 1,
        }),
      });
      const data = await res.json();
      const contacts = (data.people || []).map(p => ({
        name: [p.first_name, p.last_name].filter(Boolean).join(' '),
        firstName: p.first_name,
        lastName: p.last_name,
        title: p.title,
        linkedinUrl: p.linkedin_url,
        apolloId: p.id,
        organization: p.organization?.name,
      }));
      return json({ contacts });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  // ENRICH: Get verified email for a specific person (uses credits)
  if (action === 'enrich') {
    const { firstName, lastName, company, domain, linkedinUrl, apolloId } = body;
    try {
      const reqBody = {};
      if (apolloId) reqBody.id = apolloId;
      if (firstName) reqBody.first_name = firstName;
      if (lastName) reqBody.last_name = lastName;
      if (company) reqBody.organization_name = company;
      if (domain) reqBody.domain = domain;
      if (linkedinUrl) reqBody.linkedin_url = linkedinUrl;

      const res = await fetch(`${APOLLO_BASE}/people/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      const person = data.person || {};
      return json({
        email: person.email || null,
        emailStatus: person.email_status || null,
        name: [person.first_name, person.last_name].filter(Boolean).join(' '),
        title: person.title,
        linkedinUrl: person.linkedin_url,
        photoUrl: person.photo_url,
      });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  return json({ error: 'Unknown action. Use "search" or "enrich".' }, 400);
}
