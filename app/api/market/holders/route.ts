import { ApiError, db, parseTraderId, route, unwrap } from '@/src/lib/api';
import type { CompanyHolder } from '@/src/lib/types';

export const dynamic = 'force-dynamic';

// Who else holds a company open, so a trader can see it before recommending it.
export const GET = route<unknown>(async (req): Promise<{ holders: CompanyHolder[] }> => {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (!/^[A-Z0-9.^=-]{1,15}$/.test(symbol)) throw new ApiError(400, 'Símbolo no válido');
  const traderId = parseTraderId(req.nextUrl.searchParams.get('traderId') ?? '');

  const client = db();
  const [positions, traders] = await Promise.all([
    client
      .from('positions')
      .select('trader_id, buy_price, buy_date')
      .eq('ticker', symbol)
      .neq('trader_id', traderId)
      .is('sell_date', null)
      .is('deleted_at', null)
      .order('buy_date'),
    client.from('traders').select('id, name'),
  ]);
  const names = new Map(unwrap(traders).map((trader) => [trader.id as number, trader.name as string]));

  return {
    holders: unwrap(positions).map((row) => ({
      traderName: names.get(row.trader_id) ?? `Trader ${row.trader_id}`,
      buyPrice: row.buy_price as number,
      buyDate: row.buy_date as string,
    })),
  };
});
