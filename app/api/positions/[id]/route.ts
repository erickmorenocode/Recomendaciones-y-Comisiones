import { ApiError, assertSaleAfterBuy, db, jsonBody, parsePastDate, parsePositive, route, unwrap } from '@/src/lib/api';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPosition(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'Posición no encontrada');
  const { data, error } = await db().from('positions').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    console.error(error.message);
    throw new ApiError(500, 'Error de base de datos');
  }
  if (!data) throw new ApiError(404, 'Posición no encontrada');
  return data;
}

async function savePosition(id: string, changes: Record<string, unknown>) {
  unwrap(await db().from('positions').update(changes).eq('id', id).is('deleted_at', null).select('id').single());
}

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
