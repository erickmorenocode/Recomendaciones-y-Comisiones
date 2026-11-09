/**
 * Risk rules from section 7 of the Manual.
 * Pure functions, no imports: runs in the server, the browser and node:test.
 */

export const POSITION_LOSS_RATE = 0.2;
export const PORTFOLIO_LOSS_RATE = 0.4;

export type RiskEvent = 'posicion_20' | 'portafolio_40' | 'corte_todo_perdida';
export type AlertStatus = 'pendiente' | 'confirmada' | 'descartada';

export const PORTFOLIO_GRADE = 2;
export const ALL_IN_LOSS_GRADE = 3;
export const BLOCKING_GRADE = 2;

export interface RiskPosition {
  ticker: string;
  buyPrice: number;
  shares: number;
  sellPrice: number | null;
}

const lossRate = (loss: number, base: number) => Math.round((loss / base) * 1e6) / 1e6;

export const positionLossRate = (buyPrice: number, close: number) => lossRate(buyPrice - close, buyPrice);

/** Event 3: "pierde más del 20%", so exactly 20% does not count. */
export const breachesPositionLoss = (buyPrice: number, close: number) => positionLossRate(buyPrice, close) > POSITION_LOSS_RATE;

/** Share of the recommended capital lost at market, or null when an open position has no price. */
export function portfolioLossRate(positions: RiskPosition[], prices: Record<string, number>): number | null {
  if (positions.length === 0) return null;
  let base = 0;
  let result = 0;
  for (const p of positions) {
    const exit = p.sellPrice ?? prices[p.ticker];
    if (exit == null) return null;
    base += p.buyPrice * p.shares;
    result += (exit - p.buyPrice) * p.shares;
  }
  return lossRate(-result, base);
}

/** Event 4: "supera el 40%", so exactly 40% does not count. */
export const breachesPortfolioLoss = (rate: number | null) => rate !== null && rate > PORTFOLIO_LOSS_RATE;

/** Event 5: every position still open on the cut date is below its purchase price. */
export const allOpenInLoss = (open: RiskPosition[], prices: Record<string, number>) =>
  open.length > 0 && open.every((p) => prices[p.ticker] != null && prices[p.ticker] < p.buyPrice);

/** Event 3a: a repeated first-grade fault within the cycle rises to second grade. */
export const positionFaultGrade = (earlierFaultsInCycle: number) => (earlierFaultsInCycle > 0 ? 2 : 1);

/** Blocked while a confirmed fault of second grade or higher has not been lifted. */
export function isBlocked(alerts: Array<{ status: string; proposed_grade: number; block_lifted_at: string | null }>): boolean {
  return alerts.some((a) => a.status === 'confirmada' && a.proposed_grade >= BLOCKING_GRADE && a.block_lifted_at === null);
}
