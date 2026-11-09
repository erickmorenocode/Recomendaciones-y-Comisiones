import { useEffect, useId, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/apiClient';
import type { AnalystRatings } from '../../lib/types';

type Result = AnalystRatings | null | 'loading' | 'error';

const ROWS: Array<{ key: keyof AnalystRatings; label: string; bar: string }> = [
  { key: 'strongBuy', label: 'Compra fuerte', bar: 'bg-accent' },
  { key: 'buy', label: 'Compra', bar: 'bg-accent/60' },
  { key: 'hold', label: 'Mantener', bar: 'bg-ink/30' },
  { key: 'sell', label: 'Venta', bar: 'bg-danger/60' },
  { key: 'strongSell', label: 'Venta fuerte', bar: 'bg-danger' },
];

const POPOVER_WIDTH = 224;
const POPOVER_HEIGHT = 176;
const GAP = 6;

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

function popoverPosition(anchor: DOMRect): CSSProperties {
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - 8));
  return anchor.bottom + POPOVER_HEIGHT + GAP > window.innerHeight
    ? { left, bottom: window.innerHeight - anchor.top + GAP }
    : { left, top: anchor.bottom + GAP };
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

/** Shows analyst recommendations for `symbol` while the wrapped company name is hovered or focused. */
export function AnalystRatingsHover({ symbol, children }: { symbol: string; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [result, setResult] = useState<Result>('loading');
  const tooltipId = useId();
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setResult('loading');
    loadRatings(symbol).then(
      (ratings) => active && setResult(ratings),
      () => active && setResult('error'),
    );

    const close = () => setAnchor(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      active = false;
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, symbol]);

  const show = (event: SyntheticEvent<HTMLElement>) => setAnchor(event.currentTarget.getBoundingClientRect());
  const hide = () => setAnchor(null);

  return (
    <>
      <span
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        className="block w-fit cursor-help text-ink/60 underline decoration-dotted decoration-ink/30 underline-offset-2 hover:text-accent focus:outline-none focus-visible:text-accent"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {anchor &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={popoverPosition(anchor)}
            className="fixed z-[60] w-56 rounded-lg border border-border bg-surface p-3 text-xs text-ink shadow-lg pointer-events-none"
          >
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-accent">Analistas · {symbol}</p>
            <RatingsBody result={result} />
          </div>,
          document.body,
        )}
    </>
  );
}
