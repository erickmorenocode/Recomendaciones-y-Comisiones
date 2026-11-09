// Server only: values one cycle's positions at each of its cuts.
import {
  computeCycle,
  cycleSchedule,
  isInCycle,
  isOpenOn,
  type CutInput,
  type CutResult,
  type CycleResult,
  type EnginePosition,
} from './commissions';
import { getClosePrices } from './market';

export interface StoredCut {
  cycle_start: string;
  calculation: CutResult;
}

export const frozenCuts = (stored: StoredCut[], cycleStart: string) =>
  stored.filter((cut) => cut.cycle_start === cycleStart).map((cut) => cut.calculation);

export async function computeCohort(
  positions: EnginePosition[],
  cycleStart: string,
  today: string,
  frozen: CutResult[],
  livePrices: Record<string, number>,
): Promise<CycleResult> {
  const cohort = positions.filter((p) => isInCycle(p.buyDate, cycleStart));
  const cuts: CutInput[] = await Promise.all(
    cycleSchedule(cycleStart, today, cohort).map(async (cut) => ({
      ...cut,
      prices:
        cut.kind === 'projection'
          ? livePrices
          : frozen.some((f) => f.date === cut.date)
            ? {}
            : await getClosePrices(cohort.filter((p) => isOpenOn(p, cut.date)).map((p) => p.ticker), cut.date),
    })),
  );
  return computeCycle(positions, cycleStart, cuts, frozen);
}
