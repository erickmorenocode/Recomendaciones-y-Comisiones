import { ApiError, db, jsonBody, parsePastDate, parsePositive, parseTraderId, route, unwrap } from '@/src/lib/api';
import { getQuote } from '@/src/lib/market';
import { assertNotBlocked, assertWithinOperatorLimit } from '@/src/lib/positions';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const POST = route<Context>(async (req, { params }) => {
  const traderId = parseTraderId((await params).id);
  const body = await jsonBody(req);

  const symbol = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
  if (!symbol) throw new ApiError(400, 'Selecciona una empresa');
  const buyPrice = parsePositive(body.buyPrice, 'El precio de compra');
  const shares = parsePositive(body.shares, 'El número de acciones');
  const buyDate = parsePastDate(body.buyDate, 'La fecha de compra');
  await assertNotBlocked(traderId);
  await assertWithinOperatorLimit(traderId, { buyDate, buyPrice, shares });

  // Name and currency always come from Yahoo Finance, never from the client.
  const quote = await getQuote(symbol);
  if (!quote) throw new ApiError(400, `Yahoo Finance no devolvió datos para ${symbol}`);
  if (quote.currency !== 'USD') {
    throw new ApiError(400, `${symbol} cotiza en ${quote.currency ?? 'otra moneda'}; el esquema se calcula en USD`);
  }

  return unwrap(
    await db()
      .from('positions')
      .insert({
        trader_id: traderId,
        ticker: quote.symbol,
        company_name: quote.name,
        buy_price: buyPrice,
        shares,
        buy_date: buyDate,
      })
      .select('id')
      .single(),
  );
});
