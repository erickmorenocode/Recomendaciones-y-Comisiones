// Server only: shared access to position rows for the API routes.
import { ApiError, db, unwrap } from './api';
import { effectiveLimit, maxPositionUsd, withinOperatorLimit, withinPositionLimit, type EnginePosition } from './commissions';
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
  const client = db();
  const [trader, settings, rows] = await Promise.all([
    client.from('traders').select('max_recommended, incentive_rate').eq('id', traderId).single(),
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('id, buy_date, buy_price, shares').eq('trader_id', traderId).is('deleted_at', null),
  ]);
  const { max_recommended: base, incentive_rate: incentive } = unwrap(trader);
  const limit = effectiveLimit(base as number, incentive as number);
  const usd = (value: number) => value.toLocaleString('en-US');
  if (!withinPositionLimit(candidate, limit)) {
    throw new ApiError(400, `Una posición no puede superar USD ${usd(maxPositionUsd(limit))}, el 20% del límite de este operador`);
  }

  const existing = unwrap(rows)
    .filter((row) => row.id !== excludeId)
    .map((row) => ({ buyDate: row.buy_date as string, buyPrice: row.buy_price as number, shares: row.shares as number }));
  if (!withinOperatorLimit(existing, candidate, unwrap(settings).cycle_start as string | null, limit)) {
    throw new ApiError(400, `Supera el límite de USD ${usd(limit)} recomendados de este operador`);
  }
}

/** A company held open by another trader cannot be recommended again. */
export async function assertCompanyFree(traderId: number, ticker: string) {
  const client = db();
  const [positions, traders] = await Promise.all([
    client
      .from('positions')
      .select('trader_id, buy_price')
      .eq('ticker', ticker)
      .neq('trader_id', traderId)
      .is('sell_date', null)
      .is('deleted_at', null)
      .order('buy_date'),
    client.from('traders').select('id, name'),
  ]);
  const held = unwrap(positions);
  if (held.length === 0) return;
  const names = new Map(unwrap(traders).map((trader) => [trader.id as number, trader.name as string]));
  const who = held
    .map((row) => `${names.get(row.trader_id as number) ?? `Trader ${row.trader_id}`} a USD ${(row.buy_price as number).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
    .join(', ');
  throw new ApiError(409, `${ticker} ya está recomendada por ${who}. No se puede registrar la compra`);
}

export async function assertNotBlocked(traderId: number) {
  const alerts = unwrap(await db().from('risk_alerts').select('status, proposed_grade, block_lifted_at').eq('trader_id', traderId));
  if (isBlocked(alerts)) throw new ApiError(403, 'Operador bloqueado: no puede abrir nuevas recomendaciones');
}

export async function savePosition(id: string, changes: Record<string, unknown>) {
  unwrap(await db().from('positions').update(changes).eq('id', id).is('deleted_at', null).select('id').single());
}
