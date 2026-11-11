// Every expected figure comes from the worked examples in the scheme document.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMonths,
  computeCycle,
  cycleSchedule,
  effectiveLimit,
  incentiveRateFor,
  isInCycle,
  isValidBaseLimit,
  maxPositionUsd,
  realizedReturn,
  withinOperatorLimit,
  withinPositionLimit,
  type CutInput,
  type EnginePosition,
} from './commissions.ts';
import { allOpenInLoss, breachesPortfolioLoss, breachesPositionLoss, isBlocked, portfolioLossRate, positionFaultGrade } from './risk.ts';

const START = '2026-01-01';
const C1 = '2026-07-01';
const C2 = '2027-01-01';
const SOLD_S1 = '2026-03-15';
const SOLD_S2 = '2026-10-15';

const cut = (label: string, date: string, prices: Record<string, number> = {}): CutInput => ({
  label,
  date,
  kind: 'final',
  prices,
});

// 100 shares at 100 = USD 10,000 per company, USD 100,000 in total.
function company(ticker: string, sale?: [string, number]): EnginePosition {
  return {
    ticker,
    buyDate: START,
    buyPrice: 100,
    shares: 100,
    sellDate: sale?.[0] ?? null,
    sellPrice: sale?.[1] ?? null,
  };
}

// One sold and one open USD 50,000 leg: base USD 100,000, threshold USD 10,000.
function singleCut(realized: number, open: number) {
  const positions: EnginePosition[] = [
    { ticker: 'SOLD', buyDate: START, buyPrice: 100, shares: 500, sellDate: SOLD_S1, sellPrice: 100 + realized / 500 },
    { ticker: 'OPEN', buyDate: START, buyPrice: 100, shares: 500, sellDate: null, sellPrice: null },
  ];
  const { cuts } = computeCycle(positions, START, [cut('C1', C1, { OPEN: 100 + open / 500 })]);
  return cuts[0];
}

const C1_OPEN_PRICES = { C: 88, D: 82, E: 90, F: 92, G: 95, H: 103, I: 105, J: 112 };

describe('section 3: losses', () => {
  const rows: Array<[number, number, number, number, number]> = [
    // realized, open, retention, definitive discount, total affected
    [-8000, 0, 0, 0, 0],
    [-4000, -8000, 2400, 0, 2400],
    [-10000, -2000, 400, 2000, 2400],
    [-15000, 0, 0, 3000, 3000],
    [-12000, -13000, 2600, 2400, 5000],
    [-11000, 3000, 0, 2200, 2200],
  ];
  for (const [realized, open, retention, discount, total] of rows) {
    it(`realized ${realized}, open ${open}`, () => {
      const result = singleCut(realized, open);
      assert.equal(result.retention, retention);
      assert.equal(result.discountCum, discount);
      assert.equal(result.totalAffected, total);
    });
  }
});

describe('section 3: gains', () => {
  const rows: Array<[number, number, number, number]> = [
    // eligible realized, open, participation, pending
    [6000, 3000, 1200, 0],
    [8000, -5000, 600, 5000],
    [8000, -12000, 0, 8000],
    [-2000, 7000, 0, 0],
  ];
  for (const [realized, open, participation, pending] of rows) {
    it(`realized ${realized}, open ${open}`, () => {
      const result = singleCut(realized, open);
      assert.equal(result.participation, participation);
      assert.equal(result.pendingAfter, pending);
    });
  }

  it('each semester pays independently', () => {
    const positions: EnginePosition[] = [
      { ticker: 'A', buyDate: START, buyPrice: 100, shares: 500, sellDate: SOLD_S1, sellPrice: 112 },
      { ticker: 'B', buyDate: START, buyPrice: 100, shares: 500, sellDate: SOLD_S2, sellPrice: 116 },
    ];
    const { cuts } = computeCycle(positions, START, [cut('C1', C1, { B: 106 }), cut('C2', C2)]);
    assert.equal(cuts[0].participation, 1200);
    assert.equal(cuts[1].participation, 1600);
    assert.equal(cuts[1].net, 2800);
  });
});

describe('section 4: portfolio with semiannual cuts', () => {
  const soldInS1 = [company('A', [SOLD_S1, 58]), company('B', [SOLD_S1, 64])];

  it('losses stay retained and the retention replaces the previous one', () => {
    const positions = [
      ...soldInS1,
      company('C', [SOLD_S2, 78]),
      company('D'),
      company('E'),
      company('F'),
      company('G'),
      company('H', [SOLD_S2, 103]),
      company('I', [SOLD_S2, 105]),
      company('J', [SOLD_S2, 112]),
    ];
    const { cuts } = computeCycle(positions, START, [
      cut('C1', C1, C1_OPEN_PRICES),
      cut('C2', C2, { D: 82, E: 90, F: 92, G: 95 }),
    ]);

    assert.equal(cuts[0].threshold, 10000);
    assert.equal(cuts[0].realizedCum, -7800);
    assert.equal(cuts[0].openResult, -3300);
    assert.equal(cuts[0].marketResult, -11100);
    assert.equal(cuts[0].participation, 0);
    assert.equal(cuts[0].discountCum, 0);
    assert.equal(cuts[0].retention, 2220);
    assert.equal(cuts[0].cutBalance, -2220);

    assert.equal(cuts[1].realizedCum, -8000);
    assert.equal(cuts[1].openResult, -4100);
    assert.equal(cuts[1].marketResult, -12100);
    assert.equal(cuts[1].semesterRealized, -200);
    assert.equal(cuts[1].participation, 0);
    assert.equal(cuts[1].retention, 2420);
    assert.equal(cuts[1].net, -2420);
  });

  it('alternative cut 2: recovery releases the retention and pays 800', () => {
    const positions = [
      ...soldInS1,
      company('C'),
      company('D'),
      company('E'),
      company('F'),
      company('G'),
      company('H', [SOLD_S2, 125]),
      company('I'),
      company('J', [SOLD_S2, 115]),
    ];
    const { cuts } = computeCycle(positions, START, [
      cut('C1', C1, C1_OPEN_PRICES),
      cut('C2', C2, { C: 110, D: 112, E: 115, F: 108, G: 110, I: 135 }),
    ]);

    assert.equal(cuts[1].realizedCum, -3800);
    assert.equal(cuts[1].openResult, 9000);
    assert.equal(cuts[1].marketResult, 5200);
    assert.equal(cuts[1].participation, 800);
    assert.equal(cuts[1].retention, 0);
    assert.equal(cuts[1].cutBalance, 800);
    assert.equal(cuts[1].net, 800);
  });
});

describe('section 5: winners sold first', () => {
  const winners = [company('H', [SOLD_S1, 103]), company('I', [SOLD_S1, 105]), company('J', [SOLD_S1, 112])];
  const c1 = cut('C1', C1, { A: 58, B: 64, C: 88, D: 82, E: 90, F: 92, G: 95 });

  it('cut 1 retains and leaves the realized gain pending', () => {
    const losers = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t) => company(t));
    const { cuts } = computeCycle([...winners, ...losers], START, [c1]);
    assert.equal(cuts[0].realizedCum, 2000);
    assert.equal(cuts[0].marketResult, -11100);
    assert.equal(cuts[0].participation, 0);
    assert.equal(cuts[0].retention, 2220);
    assert.equal(cuts[0].pendingAfter, 2000);
  });

  it('cut 2a: the losers are sold and the charge becomes definitive', () => {
    const sales: Array<[string, number]> = [['A', 58], ['B', 64], ['C', 78], ['D', 82], ['E', 90], ['F', 92], ['G', 95]];
    const losers = sales.map(([t, price]) => company(t, [SOLD_S2, price]));
    const { cuts } = computeCycle([...winners, ...losers], START, [c1, cut('C2', C2)]);
    assert.equal(cuts[1].realizedCum, -12100);
    assert.equal(cuts[1].marketResult, -12100);
    assert.equal(cuts[1].participation, 0);
    assert.equal(cuts[1].retention, 0);
    assert.equal(cuts[1].discountCum, 2420);
    assert.equal(cuts[1].net, -2420);
  });

  it('cut 2b: the losers recover and the pending gain is paid', () => {
    const losers = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t) => company(t, [SOLD_S2, 100]));
    const { cuts } = computeCycle([...winners, ...losers], START, [c1, cut('C2', C2)]);
    assert.equal(cuts[1].marketResult, 2000);
    assert.equal(cuts[1].participation, 400);
    assert.equal(cuts[1].retention, 0);
    assert.equal(cuts[1].discountCum, 0);
    assert.equal(cuts[1].net, 400);
  });
});

describe('section 7: maximum per operator', () => {
  const buy = (usd: number, buyDate = START) => ({ buyDate, buyPrice: usd, shares: 1 });

  it('accepts exactly USD 200,000 and rejects one dollar more', () => {
    assert.equal(withinOperatorLimit([buy(150000)], buy(50000), START), true);
    assert.equal(withinOperatorLimit([buy(150000)], buy(50001), START), false);
  });

  it('counts sold positions, since the base does not shrink', () => {
    const sold = { ...buy(190000), sellDate: SOLD_S1, sellPrice: 1 };
    assert.equal(withinOperatorLimit([sold], buy(20000), START), false);
  });

  it('ignores purchases outside the cycle', () => {
    assert.equal(withinOperatorLimit([buy(190000, '2025-12-31')], buy(20000), START), true);
    assert.equal(withinOperatorLimit([buy(190000)], buy(20000, '2025-12-31'), START), true);
  });
});

describe('section 7: maximum per position', () => {
  it('accepts exactly USD 40,000 and rejects anything above it', () => {
    assert.equal(withinPositionLimit({ buyDate: START, buyPrice: 40000, shares: 1 }), true);
    assert.equal(withinPositionLimit({ buyDate: START, buyPrice: 40000.01, shares: 1 }), false);
  });
});

describe('limits per trader and incentive', () => {
  const buy = (usd: number) => ({ buyDate: START, buyPrice: usd, shares: 1 });
  const closed = (buyPrice: number, sellPrice: number | null) => ({ buyDate: START, buyPrice, shares: 1, sellPrice });

  it('applies each trader limit and 20% of it per position', () => {
    assert.equal(withinOperatorLimit([buy(900)], buy(100), START, 1000), true);
    assert.equal(withinOperatorLimit([buy(900)], buy(101), START, 1000), false);
    assert.equal(maxPositionUsd(1000), 200);
    assert.equal(withinPositionLimit(buy(200), 1000), true);
    assert.equal(withinPositionLimit(buy(200.01), 1000), false);
  });

  it('the base limit must be between 25,000 and 300,000', () => {
    assert.equal(isValidBaseLimit(25000), true);
    assert.equal(isValidBaseLimit(300000), true);
    assert.equal(isValidBaseLimit(24999.99), false);
    assert.equal(isValidBaseLimit(300000.01), false);
    assert.equal(isValidBaseLimit(Number.NaN), false);
  });

  it('the incentive multiplies the base limit, without compounding', () => {
    assert.equal(effectiveLimit(200000, 0), 200000);
    assert.equal(effectiveLimit(200000, 0.2), 240000);
    assert.equal(effectiveLimit(200000, 0.5), 300000);
  });

  it('tiers need a return above 15% and above 30%', () => {
    assert.equal(incentiveRateFor(0.15), 0);
    assert.equal(incentiveRateFor(0.150001), 0.2);
    assert.equal(incentiveRateFor(0.3), 0.2);
    assert.equal(incentiveRateFor(0.300001), 0.5);
  });

  it('return is realized gain over everything recommended, open positions included', () => {
    assert.equal(realizedReturn([closed(100, 150), closed(100, null)], START), 0.25);
    assert.equal(realizedReturn([closed(100, 50)], START), -0.5);
    assert.equal(realizedReturn([{ ...closed(100, 200), buyDate: '2025-12-31' }], START), 0);
    assert.equal(realizedReturn([closed(100, 200)], null), 0);
  });
});

describe('section 7: faults', () => {
  const risk = (ticker: string, buyPrice: number, sellPrice: number | null = null) => ({ ticker, buyPrice, shares: 100, sellPrice });

  it('event 3 needs a loss above 20%, not exactly 20%', () => {
    assert.equal(breachesPositionLoss(100, 80), false);
    assert.equal(breachesPositionLoss(100, 79.99), true);
    assert.equal(breachesPositionLoss(50, 40), false);
  });

  it('event 3a: a repeated fault rises to second grade', () => {
    assert.equal(positionFaultGrade(0), 1);
    assert.equal(positionFaultGrade(1), 2);
  });

  it('event 4 counts sold and open positions and needs more than 40%', () => {
    const exactly = portfolioLossRate([risk('A', 100, 50), risk('B', 100)], { B: 70 });
    assert.equal(exactly, 0.4);
    assert.equal(breachesPortfolioLoss(exactly), false);
    assert.equal(breachesPortfolioLoss(portfolioLossRate([risk('A', 100, 50), risk('B', 100)], { B: 69 })), true);
  });

  it('event 4 is not assessed when a price is missing', () => {
    assert.equal(portfolioLossRate([risk('A', 100)], {}), null);
    assert.equal(breachesPortfolioLoss(null), false);
  });

  it('event 5 needs every open position in loss', () => {
    assert.equal(allOpenInLoss([risk('A', 100), risk('B', 100)], { A: 90, B: 99 }), true);
    assert.equal(allOpenInLoss([risk('A', 100), risk('B', 100)], { A: 90, B: 100 }), false);
    assert.equal(allOpenInLoss([], {}), false);
  });

  it('only a confirmed fault of second grade or higher blocks, until it is lifted', () => {
    const fault = (status: string, proposed_grade: number, block_lifted_at: string | null = null) => ({ status, proposed_grade, block_lifted_at });
    assert.equal(isBlocked([fault('confirmada', 1)]), false);
    assert.equal(isBlocked([fault('pendiente', 2)]), false);
    assert.equal(isBlocked([fault('confirmada', 2)]), true);
    assert.equal(isBlocked([fault('confirmada', 3, '2027-01-01')]), false);
  });
});

describe('automatic cuts and carryover', () => {
  it('a recorded cut stays as it was, even if a sale is edited later', () => {
    const original = [company('A', [SOLD_S1, 120]), company('B')];
    const first = computeCycle(original, START, [cut('C1', C1, { B: 100 })]).cuts;
    assert.equal(first[0].participation, 400);

    const edited = [company('A', [SOLD_S1, 150]), company('B')];
    const { cuts } = computeCycle(edited, START, [cut('C1', C1), cut('C2', C2, { B: 100 })], first);
    assert.equal(cuts[0].participation, 400);
    assert.equal(cuts[1].paidTotal, 400);
  });

  it('pending gain and definitive discount carry from a recorded cut to the next', () => {
    const positions = [company('A', [SOLD_S1, 0]), company('B', [SOLD_S1, 0]), company('C')];
    const first = computeCycle(positions, START, [cut('C1', C1, { C: 100 })]).cuts;
    assert.equal(first[0].discountCum, 4000);
    const { cuts } = computeCycle(positions, START, [cut('C1', C1), cut('C2', C2, { C: 100 })], first);
    assert.equal(cuts[1].discountCum, 4000);
    assert.equal(cuts[1].net, -4000);
  });

  it('a cycle with open positions keeps its cuts after month 12', () => {
    const open = [company('D')];
    assert.deepEqual(
      cycleSchedule(START, '2027-08-01', open).map((c) => [c.label, c.kind]),
      [['Corte 1 (mes 6)', 'final'], ['Corte 2 (mes 12)', 'final'], ['Corte 3 (mes 18)', 'final'], ['Proyección a hoy', 'projection']],
    );
    assert.equal(cycleSchedule(START, '2027-08-01', [company('D', [SOLD_S2, 90])]).length, 2);
  });

  it('section 4: open losses carried past month 12 become definitive when sold', () => {
    const base = [company('A', [SOLD_S1, 58]), company('B', [SOLD_S1, 64]), company('C', [SOLD_S2, 78])];
    const gains = [company('H', [SOLD_S2, 103]), company('I', [SOLD_S2, 105]), company('J', [SOLD_S2, 112])];
    const later = '2027-03-01';
    const sold: Array<[string, number]> = [['D', 82], ['E', 90], ['F', 92], ['G', 95]];
    const positions = [...base, ...gains, ...sold.map(([t, price]) => company(t, [later, price]))];
    const { cuts } = computeCycle(positions, START, [cut('C1', C1, C1_OPEN_PRICES), cut('C2', C2, { D: 82, E: 90, F: 92, G: 95 }), cut('C3', '2027-07-01')]);
    assert.equal(cuts[2].baseCapital, 100000);
    assert.equal(cuts[2].realizedCum, -12100);
    assert.equal(cuts[2].retention, 0);
    assert.equal(cuts[2].discountCum, 2420);
    assert.equal(cuts[2].net, -2420);
  });

  it('the first day of the next cycle belongs to the next cycle', () => {
    assert.equal(isInCycle('2026-12-31', START), true);
    assert.equal(isInCycle('2027-01-01', START), false);
  });
});

describe('guards', () => {
  it('a missing price stops the calculation instead of assuming a value', () => {
    const result = computeCycle([company('A')], START, [cut('C1', C1)]);
    assert.deepEqual(result.cuts, []);
    assert.deepEqual(result.incomplete, { label: 'C1', missing: ['A'] });
  });

  it('positions bought outside the cycle are ignored', () => {
    const outside = { ...company('A'), buyDate: '2025-12-31' };
    const result = computeCycle([outside, company('B')], START, [cut('C1', C1, { B: 100 })]);
    assert.equal(result.cuts[0].baseCapital, 10000);
  });

  it('a definitive discount does not shrink if realized results improve', () => {
    const positions = [company('A', [SOLD_S1, 0]), company('B', [SOLD_S2, 170])];
    const { cuts } = computeCycle(positions, START, [cut('C1', C1, { B: 100 }), cut('C2', C2)]);
    assert.equal(cuts[0].discountCum, 2000);
    assert.equal(cuts[1].realizedCum, -3000);
    assert.equal(cuts[1].discountCum, 2000);
  });

  it('schedules final cuts and a projection until the cycle ends', () => {
    assert.deepEqual(cycleSchedule(START, '2026-05-01').map((c) => c.kind), ['projection']);
    assert.deepEqual(cycleSchedule(START, '2026-07-01').map((c) => c.kind), ['projection']);
    assert.deepEqual(cycleSchedule(START, '2026-07-02').map((c) => c.kind), ['final', 'projection']);
    assert.deepEqual(cycleSchedule(START, '2027-01-02').map((c) => c.kind), ['final', 'final']);
    assert.deepEqual(cycleSchedule(START, '2025-12-01'), []);
  });

  it('adds months clamping to the end of the month', () => {
    assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
    assert.equal(addMonths('2026-01-15', 12), '2027-01-15');
  });
});
