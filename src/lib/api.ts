import { NextResponse, type NextRequest } from 'next/server';
import { isAuthConfigured, isValidSessionToken, SESSION_COOKIE } from './session';
import { supabaseAdmin } from './supabase';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

/** Wraps a route handler with the shared-password session check and error handling. */
export function route<Context>(handler: (req: NextRequest, context: Context) => Promise<unknown>) {
  return async (req: NextRequest, context: Context) => {
    try {
      if (!isAuthConfigured()) throw new ApiError(503, 'Falta configurar APP_PASSWORD y SESSION_SECRET');
      if (!isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value)) throw new ApiError(401, 'Sesión no válida');
      const result = await handler(req, context);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function db() {
  if (!supabaseAdmin) throw new ApiError(503, 'Falta configurar las claves de Supabase');
  return supabaseAdmin;
}

export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error || data === null) {
    if (error) console.error(error.message);
    throw new ApiError(500, 'Error de base de datos');
  }
  return data;
}

export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (typeof body !== 'object' || body === null) throw new ApiError(400, 'Solicitud no válida');
  return body as Record<string, unknown>;
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function parseDate(value: unknown, field: string): string {
  const valid =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid) throw new ApiError(400, `${field} no es una fecha válida`);
  return value as string;
}

export function parsePastDate(value: unknown, field: string): string {
  const date = parseDate(value, field);
  if (date > todayUtc()) throw new ApiError(400, `${field} no puede ser futura`);
  return date;
}

export function parsePositive(value: unknown, field: string): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
    throw new ApiError(400, `${field} debe ser un número mayor que 0`);
  }
  return number;
}

export function parseTraderId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 11) throw new ApiError(404, 'Trader no encontrado');
  return id;
}

export function assertSaleAfterBuy(buyDate: string, sellDate: string) {
  if (sellDate < buyDate) throw new ApiError(400, 'La fecha de venta no puede ser anterior a la de compra');
}
