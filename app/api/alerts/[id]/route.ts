import { ApiError, db, jsonBody, route, unwrap } from '@/src/lib/api';
import { UUID } from '@/src/lib/positions';
import { BLOCKING_GRADE } from '@/src/lib/risk';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = route<Context>(async (req, { params }) => {
  const { id } = await params;
  if (!UUID.test(id)) throw new ApiError(404, 'Alerta no encontrada');
  const { action } = await jsonBody(req);

  const client = db();
  const { data: alert, error } = await client.from('risk_alerts').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error(error.message);
    throw new ApiError(500, 'Error de base de datos');
  }
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');

  const now = new Date().toISOString();
  let changes: Record<string, unknown>;
  if (action === 'confirm' || action === 'dismiss') {
    if (alert.status !== 'pendiente') throw new ApiError(409, 'Esta alerta ya fue resuelta');
    changes = { status: action === 'confirm' ? 'confirmada' : 'descartada', resolved_at: now };
  } else if (action === 'lift') {
    if (alert.status !== 'confirmada' || alert.proposed_grade < BLOCKING_GRADE || alert.block_lifted_at) {
      throw new ApiError(409, 'Esta falta no tiene un bloqueo activo');
    }
    changes = { block_lifted_at: now };
  } else {
    throw new ApiError(400, 'Acción no válida');
  }

  unwrap(await client.from('risk_alerts').update(changes).eq('id', id).select('id').single());
});
