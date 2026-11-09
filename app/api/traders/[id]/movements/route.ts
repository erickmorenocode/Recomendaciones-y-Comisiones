import { db, parseTraderId, route, unwrap } from '@/src/lib/api';
import type { Movement } from '@/src/lib/types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const PAGE_SIZE = 1000;

// Includes cycle changes (no trader), since they affect every profile's calculation.
export const GET = route<Context>(async (_req, { params }) => {
  const id = parseTraderId((await params).id);
  const movements: Movement[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = unwrap(
      await db()
        .from('movements')
        .select('id, created_at, action, ticker, before, after')
        .or(`trader_id.eq.${id},trader_id.is.null`)
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ) as Movement[];
    movements.push(...page);
    if (page.length < PAGE_SIZE) return { movements };
  }
});
