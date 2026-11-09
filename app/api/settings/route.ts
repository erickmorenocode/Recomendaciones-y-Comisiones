import { ApiError, db, jsonBody, parseDate, route, unwrap } from '@/src/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = route<unknown>(async (req) => {
  const body = await jsonBody(req);
  const cycleStart = parseDate(body.cycleStart, 'La fecha de inicio del ciclo');
  const client = db();
  const settings = await client.from('app_settings').select('cycle_start').eq('id', 1).single();
  const current = unwrap(settings).cycle_start as string | null;
  if (current) {
    const { count, error } = await client.from('commission_cuts').select('id', { count: 'exact', head: true }).eq('cycle_start', current);
    if (error) throw new ApiError(500, 'Error de base de datos');
    if (count) throw new ApiError(409, 'El ciclo ya tiene cortes registrados: su fecha de inicio no se puede cambiar');
  }
  unwrap(await client.from('app_settings').update({ cycle_start: cycleStart }).eq('id', 1).select().single());
  return { cycleStart };
});
