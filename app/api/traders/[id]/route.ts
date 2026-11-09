import { ApiError, db, jsonBody, parseTraderId, route, todayUtc, unwrap } from '@/src/lib/api';
import {
  computeCycle,
  cycleEnd,
  cycleSchedule,
  isInCycle,
  isOpenOn,
  positionCost,
  type CutInput,
  type EnginePosition,
} from '@/src/lib/commissions';
import { getClosePrices, getLivePrices } from '@/src/lib/market';
import type { TraderDetail } from '@/src/lib/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route<Context>(async (_req, { params }): Promise<TraderDetail> => {
  const id = parseTraderId((await params).id);
  const client = db();
  const [trader, settings, positionRows] = await Promise.all([
    client.from('traders').select('id, name').eq('id', id).single(),
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('*').eq('trader_id', id).is('deleted_at', null).order('buy_date', { ascending: false }),
  ]);
  const { name } = unwrap(trader);
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
  let commissions: TraderDetail['commissions'] = null;

  if (cycleStart) {
    const today = todayUtc();
    const scoped = positions.filter(inCycle);
    const cuts: CutInput[] = await Promise.all(
      cycleSchedule(cycleStart, today).map(async (cut) => ({
        ...cut,
        prices:
          cut.kind === 'projection'
            ? livePrices
            : await getClosePrices(scoped.filter((p) => isOpenOn(p, cut.date)).map((p) => p.ticker), cut.date),
      })),
    );
    commissions = computeCycle(positions, cycleStart, cuts);
  }

  return {
    id,
    name,
    cycleStart,
    cycleEnd: cycleStart ? cycleEnd(cycleStart) : null,
    totalRecommended: positions.filter(inCycle).reduce((sum, p) => sum + positionCost(p), 0),
    commissions,
    positions: positions.map((p) => {
      const marketPrice = p.sellDate === null ? (livePrices[p.ticker] ?? null) : null;
      const exitPrice = p.sellPrice ?? marketPrice;
      return {
        ...p,
        total: positionCost(p),
        marketPrice,
        result: exitPrice === null ? null : Math.round((exitPrice - p.buyPrice) * p.shares * 100) / 100,
        inCycle: inCycle(p),
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
