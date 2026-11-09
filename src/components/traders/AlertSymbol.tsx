import { TriangleAlert } from 'lucide-react';
import { infringedRule, RISK_EVENT_INFO, SANCTIONS } from '../../lib/risk';
import type { AlertNote } from '../../lib/types';
import { HoverPopover } from './HoverPopover';

/** The warning triangle. Hovering it states which rule of the Manual was infringed. */
export function AlertSymbol({ notes, footer, focusable = true }: { notes: AlertNote[]; footer?: string; focusable?: boolean }) {
  return (
    <HoverPopover
      focusable={focusable}
      triggerLabel="Regla infringida"
      triggerClassName="inline-flex shrink-0 cursor-help rounded p-0.5 text-danger focus:outline-none focus-visible:ring-1 focus-visible:ring-danger"
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
      <TriangleAlert size={14} />
    </HoverPopover>
  );
}
