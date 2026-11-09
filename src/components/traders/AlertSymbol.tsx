import { TriangleAlert } from 'lucide-react';
import { infringedRule, RISK_EVENT_INFO, SANCTIONS } from '../../lib/risk';
import type { AlertNote } from '../../lib/types';
import { HoverPopover } from './HoverPopover';

const GRADE_FILL: Record<number, string> = {
  1: 'fill-grade-1',
  2: 'fill-grade-2',
  3: 'fill-grade-3',
};

/** The warning triangle, colored by its most severe fault. Hovering it states which rule of the Manual was infringed. */
export function AlertSymbol({ notes, footer, focusable = true }: { notes: AlertNote[]; footer?: string; focusable?: boolean }) {
  const worstGrade = Math.max(...notes.map((note) => note.proposedGrade));

  return (
    <HoverPopover
      focusable={focusable}
      triggerLabel="Regla infringida"
      triggerClassName="inline-flex shrink-0 cursor-help rounded p-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      width={300}
      estimatedHeight={80 + notes.length * 110}
      content={
        <>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-danger">Regla infringida · Manual, sección 7</p>
          <ul className="space-y-3">
            {notes.map((note, index) => (
              <li key={index} className="space-y-0.5">
                <p className="font-semibold">
                  {note.ticker ? `${note.ticker}: ` : ''}
                  {infringedRule(note.event, note.proposedGrade)}
                </p>
                <p className="text-ink/70">{note.detail}</p>
                <p className="text-ink/70">
                  Falta de grado {note.proposedGrade}: {SANCTIONS[note.proposedGrade]}. {RISK_EVENT_INFO[note.event].action}.
                </p>
              </li>
            ))}
          </ul>
          {footer && <p className="mt-2 text-[10px] text-ink/60">{footer}</p>}
        </>
      }
    >
      <TriangleAlert size={16} className={GRADE_FILL[worstGrade]} />
    </HoverPopover>
  );
}
