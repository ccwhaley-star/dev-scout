import { getAuthUser, unauthorized, json, supabase } from './_shared/auth.js';

export async function handler(event) {
  const user = await getAuthUser(event);
  if (!user) return unauthorized();

  // GET — dashboard stats
  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.rawQuery || '');
    const view = params.get('view');

    if (view === 'team') {
      // Team overview: all users' stats
      const { data: events } = await supabase
        .from('outreach_events')
        .select('user_id, event_type, created_at');

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url');

      const { data: seqs } = await supabase
        .from('sequences')
        .select('user_id, step');

      const team = (profiles || []).map(p => {
        const userEvents = (events || []).filter(e => e.user_id === p.id);
        const userSeqs = (seqs || []).filter(s => s.user_id === p.id);
        return {
          ...p,
          sent: userEvents.filter(e => e.event_type === 'sent').length,
          replied: userEvents.filter(e => e.event_type === 'replied').length,
          active: userSeqs.filter(s => s.step === 'ready' || s.step === 'sent').length,
        };
      });

      return json({ team });
    }

    // Default: current user's stats
    const { data: events } = await supabase
      .from('outreach_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const sent = (events || []).filter(e => e.event_type === 'sent').length;
    const replied = (events || []).filter(e => e.event_type === 'replied').length;
    const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

    const { count: prospectsScanned } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .eq('scanned_by', user.id);

    const { data: seqs } = await supabase
      .from('sequences')
      .select('step')
      .eq('user_id', user.id);

    const activeSequences = (seqs || []).filter(s => s.step === 'ready' || s.step === 'sent').length;

    // This week's usage
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: usage } = await supabase
      .from('api_usage')
      .select('input_tokens, output_tokens, action')
      .eq('user_id', user.id)
      .gte('created_at', weekAgo);

    const weeklyTokens = (usage || []).reduce((sum, u) => sum + (u.input_tokens || 0) + (u.output_tokens || 0), 0);

    return json({
      sent,
      replied,
      responseRate,
      prospectsScanned: prospectsScanned || 0,
      activeSequences,
      weeklyTokens,
      recentEvents: (events || []).slice(0, 20),
    });
  }

  // POST — log an outreach event
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('outreach_events')
      .insert({
        user_id: user.id,
        prospect_id: body.prospect_id,
        sequence_id: body.sequence_id,
        event_type: body.event_type,
        email_type: body.email_type,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  return json({ error: 'Method not allowed' }, 405);
}
