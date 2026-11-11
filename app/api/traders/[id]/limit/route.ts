import { ApiError, db, jsonBody, parsePositive, parseTraderId, route, unwrap } from '@/src/lib/api';
import { MAX_BASE_LIMIT_USD, MIN_BASE_LIMIT_USD, incentiveRateFor, isValidBaseLimit, realizedReturn } from '@/src/lib/commissions';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = route<Context>(async (req, { params }) => {
  const id = parseTraderId((await params).id);
  const body = await jsonBody(req);
  const client = db();

  if (body.action === 'set') {
    const amount = parsePositive(body.amount, 'El monto máximo');
    if (!isValidBaseLimit(amount)) {
      const usd = (value: number) => value.toLocaleString('en-US');
      throw new ApiError(400, `El monto máximo debe estar entre USD ${usd(MIN_BASE_LIMIT_USD)} y USD ${usd(MAX_BASE_LIMIT_USD)}`);
    }
    unwrap(await client.from('traders').update({ max_recommended: amount }).eq('id', id).select('id').single());
    return;
  }

  if (body.action === 'apply_incentive') {
    const [trader, settings, rows] = await Promise.all([
      client.from('traders').select('incentive_rate').eq('id', id).single(),
      client.from('app_settings').select('cycle_start').eq('id', 1).single(),
      client.from('positions').select('buy_date, buy_price, shares, sell_price').eq('trader_id', id).is('deleted_at', null),
    ]);
    const positions = unwrap(rows).map((row) => ({
      buyDate: row.buy_date as string,
      buyPrice: row.buy_price as number,
      shares: row.shares as number,
      sellPrice: row.sell_price as number | null,
    }));
    const earned = incentiveRateFor(realizedReturn(positions, unwrap(settings).cycle_start as string | null));
    if (earned <= (unwrap(trader).incentive_rate as number)) throw new ApiError(409, 'Este operador no tiene un incentivo por aplicar');
    unwrap(await client.from('traders').update({ incentive_rate: earned }).eq('id', id).select('id').single());
    return;
  }

  throw new ApiError(400, 'Acción no válida');
});
