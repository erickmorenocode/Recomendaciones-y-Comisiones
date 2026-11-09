import { useEffect, useId, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';

const GAP = 6;
const MARGIN = 8;

function popoverPosition(anchor: DOMRect, width: number, estimatedHeight: number): CSSProperties {
  const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - width - MARGIN));
  return anchor.bottom + estimatedHeight + GAP > window.innerHeight
    ? { left, width, bottom: window.innerHeight - anchor.top + GAP }
    : { left, width, top: anchor.bottom + GAP };
}

interface HoverPopoverProps {
  children: ReactNode;
  /** Mounted only while open, so it can load its data on demand. */
  content: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  width?: number;
  estimatedHeight?: number;
  /** Set to false when the trigger sits inside another control, such as a button. */
  focusable?: boolean;
}

/** Shows `content` while the trigger is hovered or focused. Portaled so scrolling tables cannot clip it. */
export function HoverPopover({
  children,
  content,
  triggerClassName,
  triggerLabel,
  width = 224,
  estimatedHeight = 176,
  focusable = true,
}: HoverPopoverProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const tooltipId = useId();
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const show = (event: SyntheticEvent<HTMLElement>) => setAnchor(event.currentTarget.getBoundingClientRect());
  const hide = () => setAnchor(null);

  return (
    <>
      <span
        tabIndex={focusable ? 0 : undefined}
        aria-label={triggerLabel}
        aria-describedby={open ? tooltipId : undefined}
        className={triggerClassName}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={focusable ? show : undefined}
        onBlur={focusable ? hide : undefined}
      >
        {children}
      </span>
      {anchor &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={popoverPosition(anchor, width, estimatedHeight)}
            className="fixed z-[60] rounded-lg border border-border bg-surface p-3 text-xs text-ink shadow-lg pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
