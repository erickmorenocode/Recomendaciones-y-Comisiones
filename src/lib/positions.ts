// Server only: shared access to position rows for the API routes.
import { ApiError, db, unwrap } from './api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadPosition(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'Posición no encontrada');
  const { data, error } = await db().from('positions').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    console.error(error.message);
    throw new ApiError(500, 'Error de base de datos');
  }
  if (!data) throw new ApiError(404, 'Posición no encontrada');
  return data;
}

export async function savePosition(id: string, changes: Record<string, unknown>) {
  unwrap(await db().from('positions').update(changes).eq('id', id).is('deleted_at', null).select('id').single());
}
