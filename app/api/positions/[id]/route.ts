import { ApiError, assertSaleAfterBuy, jsonBody, parsePastDate, parsePositive, route } from '@/src/lib/api';
import { assertWithinOperatorLimit, loadPosition, savePosition } from '@/src/lib/positions';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = route<Context>(async (req, { params }) => {
  const { id } = await params;
  const current = await loadPosition(id);
  const body = await jsonBody(req);

  if (body.action === 'sell') {
    if (current.sell_date !== null) throw new ApiError(409, 'La posición ya está vendida');
    const sellPrice = parsePositive(body.sellPrice, 'El precio de venta');
    const sellDate = parsePastDate(body.sellDate, 'La fecha de venta');
    assertSaleAfterBuy(current.buy_date, sellDate);
    await savePosition(id, { sell_price: sellPrice, sell_date: sellDate });
    return;
  }

  if (body.action === 'unsell') {
    if (current.sell_date === null) throw new ApiError(409, 'La posición no está vendida');
    await savePosition(id, { sell_price: null, sell_date: null });
    return;
  }

  if (body.action === 'edit') {
    const changes: Record<string, unknown> = {
      buy_price: parsePositive(body.buyPrice, 'El precio de compra'),
      shares: parsePositive(body.shares, 'El número de acciones'),
      buy_date: parsePastDate(body.buyDate, 'La fecha de compra'),
    };
    if (current.sell_date !== null) {
      changes.sell_price = parsePositive(body.sellPrice, 'El precio de venta');
      changes.sell_date = parsePastDate(body.sellDate, 'La fecha de venta');
      assertSaleAfterBuy(changes.buy_date as string, changes.sell_date as string);
    }
    await assertWithinOperatorLimit(
      current.trader_id,
      { buyDate: changes.buy_date as string, buyPrice: changes.buy_price as number, shares: changes.shares as number },
      id,
    );
    await savePosition(id, changes);
    return;
  }

  throw new ApiError(400, 'Acción no válida');
});

// Soft delete: the row stays so its history keeps pointing at it.
export const DELETE = route<Context>(async (_req, { params }) => {
  const { id } = await params;
  await loadPosition(id);
  await savePosition(id, { deleted_at: new Date().toISOString() });
});
