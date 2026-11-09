// Server only: shared access to position rows for the API routes.
import { ApiError, db, unwrap } from './api';
import { MAX_POSITION_USD, MAX_RECOMMENDED_USD, withinOperatorLimit, withinPositionLimit, type EnginePosition } from './commissions';
import { isBlocked } from './risk';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadPosition(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'Posición no encontrada');
  const { data, error } = await db().from('positions').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    console.error(error.message);
    throw new ApiError(500, 'Error de base de datos');
  }
  if (!data) throw new ApiError(404, 'Posición no encontrada');
  return data;
}

export async function assertWithinOperatorLimit(
  traderId: number,
  candidate: Pick<EnginePosition, 'buyDate' | 'buyPrice' | 'shares'>,
  excludeId?: string,
) {
  if (!withinPositionLimit(candidate)) {
    throw new ApiError(400, `Una posición no puede superar USD ${MAX_POSITION_USD.toLocaleString('en-US')}, el 20% del máximo por operador`);
  }
  const client = db();
  const [settings, rows] = await Promise.all([
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('id, buy_date, buy_price, shares').eq('trader_id', traderId).is('deleted_at', null),
  ]);
  const existing = unwrap(rows)
    .filter((row) => row.id !== excludeId)
    .map((row) => ({ buyDate: row.buy_date as string, buyPrice: row.buy_price as number, shares: row.shares as number }));
  if (!withinOperatorLimit(existing, candidate, unwrap(settings).cycle_start as string | null)) {
    throw new ApiError(400, `Supera el máximo de USD ${MAX_RECOMMENDED_USD.toLocaleString('en-US')} recomendados por operador`);
  }
}

export async function assertNotBlocked(traderId: number) {
  const alerts = unwrap(await db().from('risk_alerts').select('status, proposed_grade, block_lifted_at').eq('trader_id', traderId));
  if (isBlocked(alerts)) throw new ApiError(403, 'Operador bloqueado: no puede abrir nuevas recomendaciones');
}

export async function savePosition(id: string, changes: Record<string, unknown>) {
  unwrap(await db().from('positions').update(changes).eq('id', id).is('deleted_at', null).select('id').single());
}
