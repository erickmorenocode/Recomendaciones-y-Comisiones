import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runDailyCheck } from '@/src/lib/dailyRun';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sha256 = (value: string) => createHash('sha256').update(value).digest();

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; there is no user session here.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Falta configurar CRON_SECRET' }, { status: 503 });
  if (!timingSafeEqual(sha256(req.headers.get('authorization') ?? ''), sha256(`Bearer ${secret}`))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDailyCheck());
  } catch (error) {
    console.error('Daily check failed:', error);
    return NextResponse.json({ error: 'La revisión diaria falló' }, { status: 500 });
  }
}
