// Server only: the once-a-day job. Safe to re-run: every alert and cut is written at most once.
import { db, todayUtc, unwrap } from './api';
import { frozenCuts, type StoredCut } from './cohorts';
import {
  computeCycle,
  cycleEnd,
  cycleSchedule,
  isInCycle,
  isOpenOn,
  type CutInput,
  type CutResult,
  type EnginePosition,
} from './commissions';
import { getClosePrices } from './market';
import {
  ALL_IN_LOSS_GRADE,
  allOpenInLoss,
  breachesPortfolioLoss,
  breachesPositionLoss,
  PORTFOLIO_GRADE,
  portfolioLossRate,
  positionFaultGrade,
  positionLossRate,
} from './risk';

interface DailyPosition extends EnginePosition {
  id: string;
  traderId: number;
}

interface AlertInput {
  trader_id: number;
  position_id: string | null;
  ticker: string | null;
  cycle_start: string;
  event: string;
  event_date: string;
  detail: string;
  proposed_grade: number;
  dedupe_key: string;
}

type KnownAlert = Pick<AlertInput, 'trader_id' | 'position_id' | 'cycle_start' | 'event' | 'dedupe_key'> & { status: string };

export interface DailySummary {
  alerts: number;
  cuts: number;
  cycleRolled: boolean;
  incomplete: string[];
}

const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

function previousDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

async function saveCut(
  traderId: number,
  cycleStart: string,
  cutNumber: number,
  result: CutResult,
  cohort: DailyPosition[],
  prices: Record<string, number>,
) {
  const client = db();
  const inserted = await client
    .from('commission_cuts')
    .insert({
      trader_id: traderId,
      cycle_start: cycleStart,
      cut_number: cutNumber,
      cut_date: result.date,
      commission: result.participation,
      retention: result.retention,
      definitive_discount: result.discountCum,
      calculation: result,
    })
    .select('id')
    .single();
  const id = unwrap(inserted).id as string;

  const snapshot = cohort
    .filter((p) => p.buyDate <= result.date)
    .map((p) => {
      const open = isOpenOn(p, result.date);
      return {
        cut_id: id,
        position_id: p.id,
        ticker: p.ticker,
        buy_date: p.buyDate,
        buy_price: p.buyPrice,
        shares: p.shares,
        exit_or_market_price: open ? prices[p.ticker] : p.sellPrice,
        price_source: open ? 'mercado' : 'venta',
      };
    });
  const { error } = await client.from('commission_cut_positions').insert(snapshot);
  if (error) {
    await client.from('commission_cuts').delete().eq('id', id);
    throw new Error(`Could not save the cut positions: ${error.message}`);
  }
}

export async function runDailyCheck(today = todayUtc()): Promise<DailySummary> {
  const client = db();
  const [settings, positionRows, cutRows, alertRows] = await Promise.all([
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('*').is('deleted_at', null).order('buy_date').order('id'),
    client.from('commission_cuts').select('trader_id, cycle_start, calculation'),
    client.from('risk_alerts').select('trader_id, position_id, cycle_start, event, status, dedupe_key'),
  ]);

  const summary: DailySummary = { alerts: 0, cuts: 0, cycleRolled: false, incomplete: [] };
  const cycleStart = unwrap(settings).cycle_start as string | null;
  if (!cycleStart) return summary;

  const positions: DailyPosition[] = unwrap(positionRows).map((row) => ({
    id: row.id,
    traderId: row.trader_id,
    ticker: row.ticker,
    buyDate: row.buy_date,
    buyPrice: row.buy_price,
    shares: row.shares,
    sellDate: row.sell_date,
    sellPrice: row.sell_price,
  }));
  const storedCuts = unwrap(cutRows) as Array<StoredCut & { trader_id: number }>;
  const alerts = unwrap(alertRows) as KnownAlert[];
  const traderIds = [...new Set(positions.map((p) => p.traderId))];

  async function addAlert(alert: AlertInput) {
    if (alerts.some((known) => known.dedupe_key === alert.dedupe_key)) return;
    unwrap(await client.from('risk_alerts').insert(alert).select('id').single());
    alerts.push({ ...alert, status: 'pendiente' });
    summary.alerts += 1;
  }

  // The job runs at 15:00 Ecuador time, before NYSE closes for part of the year.
  // The Manual measures on closing prices, so it uses the last complete session.
  const closeDate = previousDay(today);
  const open = positions.filter((p) => p.sellDate === null);
  const closes = await getClosePrices(open.map((p) => p.ticker), closeDate);

  // Events 3 and 3a: one position loses more than 20% of its purchase value,
  // at today's close or at the sale that closed it during this cycle.
  for (const p of positions.filter((row) => row.sellDate === null || isInCycle(row.buyDate, cycleStart))) {
    // A close from before the purchase says nothing about this position.
    if (p.sellDate === null && p.buyDate > closeDate) continue;
    const exitPrice = p.sellDate === null ? closes[p.ticker] : p.sellPrice;
    if (exitPrice == null || !breachesPositionLoss(p.buyPrice, exitPrice)) continue;
    const earlier = alerts.filter(
      (a) =>
        a.event === 'posicion_20' &&
        a.trader_id === p.traderId &&
        a.cycle_start === cycleStart &&
        a.position_id !== p.id &&
        a.status !== 'descartada',
    ).length;
    await addAlert({
      trader_id: p.traderId,
      position_id: p.id,
      ticker: p.ticker,
      cycle_start: cycleStart,
      event: 'posicion_20',
      event_date: p.sellDate ?? today,
      detail: `${p.sellDate ? 'Vendida con pérdida de' : 'Pierde'} ${percent(positionLossRate(p.buyPrice, exitPrice))}: compra ${p.buyPrice}, ${p.sellDate ? 'venta' : 'cierre'} ${exitPrice.toFixed(2)}`,
      proposed_grade: positionFaultGrade(earlier),
      dedupe_key: `posicion_20:${p.id}`,
    });
  }

  // Event 4: the portfolio loses more than 40% at market.
  for (const traderId of traderIds) {
    const cohort = positions.filter((p) => p.traderId === traderId && isInCycle(p.buyDate, cycleStart));
    const rate = portfolioLossRate(cohort, closes);
    if (rate === null || !breachesPortfolioLoss(rate)) continue;
    await addAlert({
      trader_id: traderId,
      position_id: null,
      ticker: null,
      cycle_start: cycleStart,
      event: 'portafolio_40',
      event_date: today,
      detail: `El portafolio pierde ${percent(rate)} a mercado`,
      proposed_grade: PORTFOLIO_GRADE,
      dedupe_key: `portafolio_40:${traderId}:${cycleStart}`,
    });
  }

  // Automatic cuts, for every cycle that still has cuts to close.
  const cycles = [...new Set([...storedCuts.map((cut) => cut.cycle_start), cycleStart])];
  for (const cycle of cycles) {
    for (const traderId of traderIds) {
      const own = positions.filter((p) => p.traderId === traderId);
      const cohort = own.filter((p) => isInCycle(p.buyDate, cycle));
      if (cohort.length === 0) continue;

      const frozen = frozenCuts(storedCuts.filter((cut) => cut.trader_id === traderId), cycle);
      const finals = cycleSchedule(cycle, today, cohort).filter((cut) => cut.kind === 'final');
      if (finals.every((cut) => frozen.some((f) => f.date === cut.date))) continue;

      const inputs: CutInput[] = await Promise.all(
        finals.map(async (cut) => ({
          ...cut,
          prices: frozen.some((f) => f.date === cut.date)
            ? {}
            : await getClosePrices(cohort.filter((p) => isOpenOn(p, cut.date)).map((p) => p.ticker), cut.date),
        })),
      );
      const result = computeCycle(own, cycle, inputs, frozen);
      if (result.incomplete) summary.incomplete.push(`Trader ${traderId}: ${result.incomplete.label}`);

      for (const [index, cut] of result.cuts.entries()) {
        if (frozen.some((f) => f.date === cut.date) || cut.baseCapital === 0) continue;
        await saveCut(traderId, cycle, index + 1, cut, cohort, inputs[index].prices);
        summary.cuts += 1;

        // Event 5: on a cut date, every open position is in loss.
        if (allOpenInLoss(cohort.filter((p) => isOpenOn(p, cut.date)), inputs[index].prices)) {
          await addAlert({
            trader_id: traderId,
            position_id: null,
            ticker: null,
            cycle_start: cycle,
            event: 'corte_todo_perdida',
            event_date: cut.date,
            detail: `Todas las posiciones abiertas están en pérdida en ${cut.label}`,
            proposed_grade: ALL_IN_LOSS_GRADE,
            dedupe_key: `corte_todo_perdida:${traderId}:${cut.date}`,
          });
        }
      }
    }
  }

  // The next cycle starts once the last cut of this one is safely recorded.
  if (cycleEnd(cycleStart) < today && summary.incomplete.length === 0) {
    unwrap(await client.from('app_settings').update({ cycle_start: cycleEnd(cycleStart) }).eq('id', 1).select('id').single());
    summary.cycleRolled = true;
  }

  return summary;
}
