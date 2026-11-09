import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const inputClass =
  'w-full rounded-lg bg-bg border border-border px-3 py-2 text-sm [color-scheme:light] focus:outline-none focus:border-accent';

export const primaryButton =
  'rounded-lg bg-accent text-bg px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed';

export const secondaryButton =
  'rounded-lg border border-border px-3 py-2 text-xs text-ink/70 hover:text-ink transition-colors';

export const rowAction = 'inline-flex p-1 rounded text-ink/60 hover:text-accent transition-colors';

const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sharesFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

export const money = (value: number) => moneyFormat.format(value).replace('-', '−');
export const quantity = (value: number) => sharesFormat.format(value);

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-ink/60">{label}</span>
      {children}
    </label>
  );
}

export function SignedMoney({ value }: { value: number }) {
  return (
    <span className={cn(value < 0 && 'text-danger', value > 0 && 'text-accent')}>
      {value > 0 ? '+' : ''}
      {money(value)}
    </span>
  );
}

export function SignedPercent({ value }: { value: number }) {
  return (
    <span className={cn(value < 0 && 'text-danger', value > 0 && 'text-accent')}>
      {value > 0 ? '+' : ''}
      {money(value)}%
    </span>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-xl p-4 sm:p-6 space-y-4">
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-accent">{title}</h3>
      {children}
    </section>
  );
}

export function Th({ children, right = false }: { children?: ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink/60 font-normal align-bottom whitespace-nowrap',
        right ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, right = false, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn('px-3 py-2 align-top leading-relaxed', right && 'text-right font-mono whitespace-nowrap', className)}>
      {children}
    </td>
  );
}

export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="sticky top-28 z-40 rounded-lg border border-danger bg-surface px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
