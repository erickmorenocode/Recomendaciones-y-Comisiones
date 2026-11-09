import { db, jsonBody, parseDate, route, unwrap } from '@/src/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = route<unknown>(async (req) => {
  const body = await jsonBody(req);
  const cycleStart = parseDate(body.cycleStart, 'La fecha de inicio del ciclo');
  unwrap(await db().from('app_settings').update({ cycle_start: cycleStart }).eq('id', 1).select().single());
  return { cycleStart };
});
