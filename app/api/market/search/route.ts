import { route } from '@/src/lib/api';
import { searchCompanies } from '@/src/lib/market';

export const dynamic = 'force-dynamic';

export const GET = route<unknown>(async (req) => {
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  return { results: query.length >= 1 ? await searchCompanies(query) : [] };
});
