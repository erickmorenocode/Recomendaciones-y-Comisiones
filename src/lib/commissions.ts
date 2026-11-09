/**
 * Commission engine for the scheme described in the Manual tab.
 * Pure functions, no imports: runs in the server, the browser and node:test.
 *
 * Rules applied at each cut, in the order of section 6 of the scheme:
 * - Market loss >= threshold: 20% of it is charged to the operator.
 * - Realized loss >= threshold: 20% of it becomes a definitive discount.
 * - Retention is whatever part of the market charge the discount does not cover.
 * - Participation is 20% of the eligible realized gain, capped by the market gain.
 */

export const THRESHOLD_RATE = 0.1;
export const SHARE_RATE = 0.2;
export const CYCLE_MONTHS = 12;
export const CUT_MONTHS = [6, 12];

export interface EnginePosition {
  ticker: string;
  buyDate: string;
  buyPrice: number;
  shares: number;
  sellDate: string | null;
  sellPrice: number | null;
}

export interface CutInput {
  label: string;
  date: string;
  kind: 'final' | 'projection';
  /** Price per ticker on `date`, for positions still open on that date. */
  prices: Record<string, number>;
}

export interface CutResult {
  label: string;
  date: string;
  kind: 'final' | 'projection';
  baseCapital: number;
  threshold: number;
  realizedCum: number;
  openResult: number;
  marketResult: number;
  semesterRealized: number;
  pendingBefore: number;
  participation: number;
  pendingAfter: number;
  discountCum: number;
  retention: number;
  totalAffected: number;
  cutBalance: number;
  paidTotal: number;
  discountTotal: number;
  net: number;
}

export interface CycleResult {
  cuts: CutResult[];
  /** Set when a price is missing: that cut and the later ones are not calculated. */
  incomplete: { label: string; missing: string[] } | null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m + months, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

export const cycleEnd = (cycleStart: string) => addMonths(cycleStart, CYCLE_MONTHS);

export const isInCycle = (buyDate: string, cycleStart: string) =>
  buyDate >= cycleStart && buyDate <= cycleEnd(cycleStart);

export const positionCost = (p: Pick<EnginePosition, 'buyPrice' | 'shares'>) => round2(p.buyPrice * p.shares);

export const isOpenOn = (p: EnginePosition, date: string) =>
  p.buyDate <= date && (p.sellDate === null || p.sellDate > date);

export interface ScheduledCut {
  label: string;
  date: string;
  kind: 'final' | 'projection';
}

/**
 * A cut is final once its date has passed, so its closing price exists.
 * The projection values the cycle at today's price until the cycle ends.
 */
export function cycleSchedule(cycleStart: string, today: string): ScheduledCut[] {
  const cuts = CUT_MONTHS.map((months, i) => ({
    label: `Corte ${i + 1} (mes ${months})`,
    date: addMonths(cycleStart, months),
  }));
  const schedule: ScheduledCut[] = cuts
    .filter((cut) => cut.date < today)
    .map((cut) => ({ ...cut, kind: 'final' as const }));
  if (schedule.length < cuts.length && cycleStart <= today) {
    schedule.push({ label: 'Proyección a hoy', date: today, kind: 'projection' });
  }
  return schedule;
}

export function computeCycle(positions: EnginePosition[], cycleStart: string, cuts: CutInput[]): CycleResult {
  const scoped = positions.filter((p) => isInCycle(p.buyDate, cycleStart));
  const results: CutResult[] = [];

  let previousDate: string | null = null;
  let pending = 0;
  let discountCum = 0;
  let paidTotal = 0;

  for (const cut of cuts) {
    const held = scoped.filter((p) => p.buyDate <= cut.date);
    const sold = held.filter((p) => !isOpenOn(p, cut.date));
    const open = held.filter((p) => isOpenOn(p, cut.date));

    const missing = [...new Set(open.filter((p) => cut.prices[p.ticker] == null).map((p) => p.ticker))];
    if (missing.length > 0) return { cuts: results, incomplete: { label: cut.label, missing } };

    const realizedOf = (p: EnginePosition) => (p.sellPrice! - p.buyPrice) * p.shares;
    const since = previousDate;

    const baseCapital = round2(held.reduce((sum, p) => sum + p.buyPrice * p.shares, 0));
    const threshold = round2(baseCapital * THRESHOLD_RATE);
    const realizedCum = round2(sold.reduce((sum, p) => sum + realizedOf(p), 0));
    const openResult = round2(open.reduce((sum, p) => sum + (cut.prices[p.ticker] - p.buyPrice) * p.shares, 0));
    const marketResult = round2(realizedCum + openResult);
    const semesterRealized = round2(
      sold.filter((p) => since === null || p.sellDate! > since).reduce((sum, p) => sum + realizedOf(p), 0),
    );

    const pendingBefore = pending;
    const eligible = round2(pendingBefore + semesterRealized);
    const paidGain = Math.max(0, Math.min(eligible, marketResult));
    const participation = round2(paidGain * SHARE_RATE);
    const pendingAfter = Math.max(0, round2(eligible - paidGain));

    const marketLoss = Math.max(0, -marketResult);
    const realizedLoss = Math.max(0, -realizedCum);
    const reached = (loss: number) => threshold > 0 && loss >= threshold;

    const discountNow = reached(realizedLoss) ? round2(realizedLoss * SHARE_RATE) : 0;
    const discountIncrement = Math.max(0, round2(discountNow - discountCum));
    const nextDiscountCum = round2(discountCum + discountIncrement);
    const marketCharge = reached(marketLoss) ? round2(marketLoss * SHARE_RATE) : 0;
    const retention = Math.max(0, round2(marketCharge - nextDiscountCum));

    const nextPaidTotal = round2(paidTotal + participation);

    results.push({
      label: cut.label,
      date: cut.date,
      kind: cut.kind,
      baseCapital,
      threshold,
      realizedCum,
      openResult,
      marketResult,
      semesterRealized,
      pendingBefore,
      participation,
      pendingAfter,
      discountCum: nextDiscountCum,
      retention,
      totalAffected: round2(nextDiscountCum + retention),
      cutBalance: round2(participation - discountIncrement - retention),
      paidTotal: nextPaidTotal,
      discountTotal: nextDiscountCum,
      net: round2(nextPaidTotal - nextDiscountCum - retention),
    });

    previousDate = cut.date;
    pending = pendingAfter;
    discountCum = nextDiscountCum;
    paidTotal = nextPaidTotal;
  }

  return { cuts: results, incomplete: null };
}
