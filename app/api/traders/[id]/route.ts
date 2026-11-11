import { ApiError, db, jsonBody, parseTraderId, route, todayUtc, unwrap } from '@/src/lib/api';
import { computeCohort, frozenCuts, type StoredCut } from '@/src/lib/cohorts';
import {
  cycleEnd,
  effectiveLimit,
  incentiveRateFor,
  isInCycle,
  maxPositionUsd,
  positionCost,
  realizedReturn,
  type EnginePosition,
} from '@/src/lib/commissions';
import { getLivePrices } from '@/src/lib/market';
import { BLOCKING_GRADE, isBlocked } from '@/src/lib/risk';
import type { TraderDetail } from '@/src/lib/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route<Context>(async (_req, { params }): Promise<TraderDetail> => {
  const id = parseTraderId((await params).id);
  const client = db();
  const [trader, settings, positionRows, cutRows, alertRows] = await Promise.all([
    client.from('traders').select('id, name, max_recommended, incentive_rate').eq('id', id).single(),
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('*').eq('trader_id', id).is('deleted_at', null).order('buy_date', { ascending: false }),
    client.from('commission_cuts').select('cycle_start, calculation').eq('trader_id', id),
    client.from('risk_alerts').select('*').eq('trader_id', id).order('created_at', { ascending: false }),
  ]);
  const { name, max_recommended: baseLimit, incentive_rate: incentiveRate } = unwrap(trader);
  const cycleStart = unwrap(settings).cycle_start as string | null;
  const rows = unwrap(positionRows);

  const positions = rows.map((row) => ({
    id: row.id as string,
    companyName: row.company_name as string,
    ticker: row.ticker as string,
    buyDate: row.buy_date as string,
    buyPrice: row.buy_price as number,
    shares: row.shares as number,
    sellDate: row.sell_date as string | null,
    sellPrice: row.sell_price as number | null,
    hasReport: Boolean(row.report_path),
  }));

  const openTickers = positions.filter((p) => p.sellDate === null).map((p) => p.ticker);
  const livePrices = await getLivePrices(openTickers);

  const inCycle = (p: EnginePosition) => cycleStart === null || isInCycle(p.buyDate, cycleStart);
  const today = todayUtc();
  const storedCuts = unwrap(cutRows) as StoredCut[];
  const pastCycles = [...new Set(storedCuts.map((cut) => cut.cycle_start))].filter((start) => start !== cycleStart);

  const commissions = cycleStart ? await computeCohort(positions, cycleStart, today, frozenCuts(storedCuts, cycleStart), livePrices) : null;
  const carried = await Promise.all(
    pastCycles.map(async (start) => ({
      cycleStart: start,
      commissions: await computeCohort(positions, start, today, frozenCuts(storedCuts, start), livePrices),
    })),
  );
  const alerts = unwrap(alertRows);
  const returnRate = realizedReturn(positions, cycleStart);
  const limit = effectiveLimit(baseLimit, incentiveRate);

  return {
    id,
    name,
    cycleStart,
    cycleEnd: cycleStart ? cycleEnd(cycleStart) : null,
    totalRecommended: positions.filter(inCycle).reduce((sum, p) => sum + positionCost(p), 0),
    commissions,
    carried,
    limit: {
      base: baseLimit,
      incentiveRate,
      effective: limit,
      maxPosition: maxPositionUsd(limit),
      realizedReturn: returnRate,
      earnedRate: incentiveRateFor(returnRate),
    },
    blocked: isBlocked(alerts),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      positionId: alert.position_id,
      ticker: alert.ticker,
      event: alert.event,
      eventDate: alert.event_date,
      detail: alert.detail,
      proposedGrade: alert.proposed_grade,
      status: alert.status,
      blockActive: alert.status === 'confirmada' && alert.proposed_grade >= BLOCKING_GRADE && alert.block_lifted_at === null,
    })),
    positions: positions.map((p) => {
      const marketPrice = p.sellDate === null ? (livePrices[p.ticker] ?? null) : null;
      const exitPrice = p.sellPrice ?? marketPrice;
      return {
        ...p,
        total: positionCost(p),
        marketPrice,
        result: exitPrice === null ? null : Math.round((exitPrice - p.buyPrice) * p.shares * 100) / 100,
        inCycle: inCycle(p) || pastCycles.some((start) => isInCycle(p.buyDate, start)),
      };
    }),
  };
});

export const PATCH = route<Context>(async (req, { params }) => {
  const id = parseTraderId((await params).id);
  const body = await jsonBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) throw new ApiError(400, 'El nombre debe tener entre 1 y 80 caracteres');
  unwrap(await db().from('traders').update({ name }).eq('id', id).select().single());
  return { name };
});
