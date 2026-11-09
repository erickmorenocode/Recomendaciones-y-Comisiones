import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../lib/apiClient';
import type { AnalystRatings } from '../../lib/types';
import { HoverPopover } from './HoverPopover';

type Result = AnalystRatings | null | 'loading' | 'error';

const ROWS: Array<{ key: keyof AnalystRatings; label: string; bar: string }> = [
  { key: 'strongBuy', label: 'Compra fuerte', bar: 'bg-accent' },
  { key: 'buy', label: 'Compra', bar: 'bg-accent/60' },
  { key: 'hold', label: 'Mantener', bar: 'bg-ink/30' },
  { key: 'sell', label: 'Venta', bar: 'bg-danger/60' },
  { key: 'strongSell', label: 'Venta fuerte', bar: 'bg-danger' },
];

const ratingsCache = new Map<string, Promise<AnalystRatings | null>>();

function loadRatings(symbol: string) {
  let request = ratingsCache.get(symbol);
  if (!request) {
    request = api<{ ratings: AnalystRatings | null }>(`/api/market/ratings?symbol=${encodeURIComponent(symbol)}`).then(
      (response) => response.ratings,
    );
    request.catch(() => ratingsCache.delete(symbol));
    ratingsCache.set(symbol, request);
  }
  return request;
}

function RatingsBody({ result }: { result: Result }) {
  if (result === 'loading') return <p className="text-ink/60">Cargando recomendaciones...</p>;
  if (result === 'error') return <p className="text-danger">No se pudieron cargar las recomendaciones.</p>;
  if (result === null) return <p className="text-ink/60">Sin recomendaciones de analistas disponibles.</p>;

  const total = ROWS.reduce((sum, row) => sum + result[row.key], 0);
  return (
    <>
      <ul className="space-y-1.5">
        {ROWS.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0">{row.label}</span>
            <span className="flex-1 h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <span className={`block h-full rounded-full ${row.bar}`} style={{ width: `${(result[row.key] / total) * 100}%` }} />
            </span>
            <span className="w-6 shrink-0 text-right font-mono">{result[row.key]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-ink/60">{total} analistas · Mes actual · Yahoo Finance</p>
    </>
  );
}

function RatingsPanel({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<Result>('loading');

  useEffect(() => {
    let active = true;
    loadRatings(symbol).then(
      (ratings) => active && setResult(ratings),
      () => active && setResult('error'),
    );
    return () => {
      active = false;
    };
  }, [symbol]);

  return (
    <>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-accent">Analistas · {symbol}</p>
      <RatingsBody result={result} />
    </>
  );
}

/** Shows analyst recommendations for `symbol` while the wrapped company name is hovered or focused. */
export function AnalystRatingsHover({ symbol, children }: { symbol: string; children: ReactNode }) {
  return (
    <HoverPopover
      triggerClassName="block w-fit cursor-help text-ink/60 underline decoration-dotted decoration-ink/30 underline-offset-2 hover:text-accent focus:outline-none focus-visible:text-accent"
      content={<RatingsPanel symbol={symbol} />}
    >
      {children}
    </HoverPopover>
  );
}
