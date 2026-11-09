import { ApiError, route } from '@/src/lib/api';
import { getAnalystRatings } from '@/src/lib/market';

export const dynamic = 'force-dynamic';

export const GET = route<unknown>(async (req) => {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (!/^[A-Z0-9.^=-]{1,15}$/.test(symbol)) throw new ApiError(400, 'Símbolo no válido');
  return { ratings: await getAnalystRatings(symbol) };
});
