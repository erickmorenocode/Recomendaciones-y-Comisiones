import { db, route, unwrap } from '@/src/lib/api';
import { isInCycle, positionCost } from '@/src/lib/commissions';
import type { TradersResponse } from '@/src/lib/types';

export const dynamic = 'force-dynamic';

export const GET = route<unknown>(async (): Promise<TradersResponse> => {
  const client = db();
  const [traders, settings, positions] = await Promise.all([
    client.from('traders').select('id, name').order('id'),
    client.from('app_settings').select('cycle_start').eq('id', 1).single(),
    client.from('positions').select('trader_id, buy_price, shares, buy_date, sell_date').is('deleted_at', null),
  ]);
  const cycleStart = unwrap(settings).cycle_start as string | null;
  const rows = unwrap(positions);

  return {
    cycleStart,
    traders: unwrap(traders).map((trader) => {
      const own = rows.filter(
        (p) => p.trader_id === trader.id && (cycleStart === null || isInCycle(p.buy_date, cycleStart)),
      );
      return {
        id: trader.id,
        name: trader.name,
        totalRecommended: own.reduce(
          (sum, p) => sum + positionCost({ buyPrice: p.buy_price, shares: p.shares }),
          0,
        ),
        openPositions: own.filter((p) => p.sell_date === null).length,
      };
    }),
  };
});
