import { useEffect, useRef, useState } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RosterMember } from '@/hooks/useRoster';
import type { Shift } from '@/hooks/useShifts';
import {
  HOUR_COUNT, HOUR_HEIGHT, START_HOUR, atMinutes, blockGeometry, colorForWorker, formatMinutes,
  layoutOverlaps,
} from '@/lib/schedule';

/** Hold this long on touch before a drag begins, so a swipe still scrolls. */
const LONG_PRESS_MS = 400;
/** Moving further than this during the hold means the user meant to scroll. */
const MOVE_TOLERANCE_PX = 10;
/** Below this many columns the grid fills the screen instead of scrolling. */
const MULTI_DAY_MIN_WIDTH = 980;

interface ScheduleWeekProps {
  /** Any number of days — 7 for the desktop week, 1 for the phone view. */
  days: Date[];
  shifts: Shift[];
  roster: RosterMember[];
  /** null when this login has no roster entry — dragging is then disabled. */
  myWorkerId: string | null;
  canManageOthers: boolean;
  /** Who a drag creates a shift for. */
  targetWorkerId: string | null;
  onCreate: (startsAt: Date, endsAt: Date) => void;
  onSelectShift: (shift: Shift) => void;
}

interface DragState {
  dayIndex: number;
  anchorHour: number;
  currentHour: number;
  /** Set when the gesture began on top of an existing block. */
  originShiftId: string | null;
}

interface PendingPress {
  timer: number;
  dayIndex: number;
  hour: number;
  x: number;
  y: number;
  pointerId: number;
  originShiftId: string | null;
}

export function ScheduleWeek({
  days, shifts, roster, myWorkerId, canManageOthers, targetWorkerId,
  onCreate, onSelectShift,
}: ScheduleWeekProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // A touch drag has begun and the page must stop scrolling. Held in a ref
  // because the listener below is attached once and reads it at event time.
  const dragArmed = useRef(false);
  const pendingPress = useRef<PendingPress | null>(null);

  const nameById = new Map(roster.map((r) => [r.id, r.name]));
  const canDrag = !!targetWorkerId;
  const gridTemplate = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const minWidth = days.length > 1 ? MULTI_DAY_MIN_WIDTH : undefined;

  /**
   * Stops the page scrolling once a touch drag is armed.
   *
   * `touch-action` can't do this: it's evaluated when the gesture starts, so
   * flipping it after the long-press has elapsed has no effect on the gesture
   * already in progress. preventDefault on touchmove does work — but only from
   * a non-passive listener, and React's onTouchMove is always passive. Hence
   * the manual addEventListener.
   *
   * This only fires while a drag is armed, so ordinary swipes scroll and pan
   * normally the rest of the time.
   */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragArmed.current) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const clearPending = () => {
    if (pendingPress.current) {
      window.clearTimeout(pendingPress.current.timer);
      pendingPress.current = null;
    }
  };

  useEffect(() => clearPending, []);

  /** Which hour row a pointer is over, clamped to the grid. */
  const hourFromPointer = (dayIndex: number, clientY: number) => {
    const el = columnRefs.current[dayIndex];
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const raw = Math.floor((clientY - rect.top) / HOUR_HEIGHT);
    return Math.max(0, Math.min(HOUR_COUNT - 1, raw));
  };

  const beginDrag = (
    el: HTMLElement, pointerId: number, dayIndex: number, hour: number,
    originShiftId: string | null,
  ) => {
    dragArmed.current = true;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; the drag still works without capture.
    }
    setDrag({ dayIndex, anchorHour: hour, currentHour: hour, originShiftId });
  };

  const handlePointerDown = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;

    // A press that starts on a block is remembered but no longer refused. If it
    // turns out to be a stationary click it opens that shift; if it turns into
    // a drag it paints hours like anywhere else. Refusing outright made every
    // hour someone else had claimed into a dead zone you couldn't schedule over.
    const blockEl = (e.target as HTMLElement).closest<HTMLElement>('[data-shift-block]');
    const originShiftId = blockEl?.dataset.shiftId ?? null;

    const hour = hourFromPointer(dayIndex, e.clientY);

    if (e.pointerType === 'touch') {
      // Wait for a deliberate hold. A quick swipe is a scroll, not a shift.
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      const timer = window.setTimeout(() => {
        pendingPress.current = null;
        navigator.vibrate?.(10);
        beginDrag(el, pointerId, dayIndex, hour, originShiftId);
      }, LONG_PRESS_MS);
      pendingPress.current = {
        timer, dayIndex, hour, x: e.clientX, y: e.clientY, pointerId, originShiftId,
      };
      return;
    }

    beginDrag(e.currentTarget, e.pointerId, dayIndex, hour, originShiftId);
  };

  const handlePointerMove = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const pending = pendingPress.current;
    if (pending) {
      const moved = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
      if (moved > MOVE_TOLERANCE_PX) clearPending();
      return;
    }

    if (!drag || drag.dayIndex !== dayIndex) return;
    const hour = hourFromPointer(dayIndex, e.clientY);
    if (hour !== drag.currentHour) setDrag({ ...drag, currentHour: hour });
  };

  const endGesture = () => {
    clearPending();
    dragArmed.current = false;
  };

  const handlePointerUp = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const hadDrag = drag && drag.dayIndex === dayIndex;
    endGesture();
    if (!hadDrag) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may never have been taken; nothing to release.
    }

    const first = Math.min(drag!.anchorHour, drag!.currentHour);
    const last = Math.max(drag!.anchorHour, drag!.currentHour);
    const stationary = first === last;

    setDrag(null);

    // A press that neither moved nor left the block it started on is a click on
    // that shift, so open it. Anything else is a paint.
    if (stationary && drag!.originShiftId) {
      const target = shifts.find((s) => s.id === drag!.originShiftId);
      if (target && (target.worker_id === myWorkerId || canManageOthers)) {
        onSelectShift(target);
      }
      return;
    }

    // A drag ending on the row it started is still a one-hour shift, so a
    // click (or a hold-and-release) is a valid way to add a single hour.
    onCreate(
      atMinutes(days[dayIndex], (START_HOUR + first) * 60),
      atMinutes(days[dayIndex], (START_HOUR + last + 1) * 60),
    );
  };

  const handlePointerCancel = () => {
    endGesture();
    setDrag(null);
  };

  return (
    <div ref={scrollerRef} className="overflow-x-auto">
      <div style={{ minWidth }}>
        {/* Day headers */}
        <div className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
          {/* Spacer above the hour gutter. Sticky so it covers day headers
              scrolling underneath it. */}
          <div className="sticky left-0 z-20 bg-card" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'px-2 py-2 text-center border-l',
                isToday(day) && 'bg-primary/5',
              )}
            >
              <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
              <div className={cn('text-sm font-semibold', isToday(day) && 'text-primary')}>
                {format(day, 'MMM d')}
              </div>
            </div>
          ))}
        </div>

        {/* Hour grid.
            Both the label column and the day columns are single full-height
            boxes with their contents positioned absolutely from the same
            origin, rather than two parallel stacks of 12 divs. Stacked cells
            can drift apart by a pixel per row, which compounds into a visible
            offset by 6pm. One origin makes misalignment impossible. */}
        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          {/* Hour labels. Frozen so the times stay readable while panning a
              multi-day grid sideways on a tablet. */}
          <div
            className="sticky left-0 z-20 bg-card"
            style={{ height: HOUR_COUNT * HOUR_HEIGHT }}
          >
            {Array.from({ length: HOUR_COUNT }, (_, i) => (
              <div
                key={i}
                className="absolute right-0 pr-2 text-right text-xs leading-none text-muted-foreground"
                style={{ top: i * HOUR_HEIGHT + 4 }}
              >
                {formatMinutes((START_HOUR + i) * 60)}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const dayShifts = shifts.filter((s) => isSameDay(new Date(s.starts_at), day));
            const dragging = drag?.dayIndex === dayIndex ? drag : null;
            const dragFirst = dragging ? Math.min(dragging.anchorHour, dragging.currentHour) : 0;
            const dragLast = dragging ? Math.max(dragging.anchorHour, dragging.currentHour) : 0;

            return (
              <div
                key={day.toISOString()}
                ref={(el) => (columnRefs.current[dayIndex] = el)}
                className={cn(
                  'relative border-b border-l',
                  canDrag ? 'cursor-crosshair' : 'cursor-not-allowed',
                  isToday(day) && 'bg-primary/5',
                )}
                style={{
                  height: HOUR_COUNT * HOUR_HEIGHT,
                  // Hour lines painted as a background rather than 12 bordered
                  // divs, so the rows cannot round differently from the labels.
                  backgroundImage:
                    `repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`,
                  // Deliberately no touch-action here. Blocking it stops the
                  // page and the grid scrolling by touch at all; the long-press
                  // gesture plus the non-passive touchmove listener above give
                  // the same protection only once a drag actually starts.
                }}
                onPointerDown={handlePointerDown(dayIndex)}
                onPointerMove={handlePointerMove(dayIndex)}
                onPointerUp={handlePointerUp(dayIndex)}
                onPointerCancel={handlePointerCancel}
              >
                {/* Live drag preview */}
                {dragging && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded border-2 border-primary bg-primary/20"
                    style={{
                      top: dragFirst * HOUR_HEIGHT,
                      height: (dragLast - dragFirst + 1) * HOUR_HEIGHT,
                    }}
                  />
                )}

                {layoutOverlaps(
                  dayShifts,
                  (s) => new Date(s.starts_at).getTime(),
                  (s) => new Date(s.ends_at).getTime(),
                ).map(({ item: shift, lane, laneCount }) => {
                  const start = new Date(shift.starts_at);
                  const end = new Date(shift.ends_at);
                  const { top, height } = blockGeometry(start, end);
                  const color = colorForWorker(shift.worker_id);
                  const mine = shift.worker_id === myWorkerId;
                  const editable = mine || canManageOthers;
                  const name = nameById.get(shift.worker_id) ?? 'Unknown';

                  // Once a few people share the hour there isn't room for the
                  // times as well, so the block keeps the name and the rest
                  // moves to the tooltip and the detail dialog.
                  const narrow = laneCount > 2;

                  return (
                    <button
                      key={shift.id}
                      data-shift-block
                      data-shift-id={shift.id}
                      type="button"
                      // Deliberately not `disabled`. Browsers don't dispatch
                      // pointer events on disabled controls and they don't
                      // bubble, so every coworker's block became a region a
                      // team member physically could not start a drag in —
                      // which admins never saw, because nothing is disabled for
                      // them. Selection is handled by the column's pointerup;
                      // this handler exists so the block is still reachable by
                      // keyboard.
                      aria-disabled={!editable}
                      tabIndex={editable ? 0 : -1}
                      onKeyDown={(e) => {
                        if (!editable) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectShift(shift);
                        }
                      }}
                      title={`${name} · ${format(start, 'h:mm a')}–${format(end, 'h:mm a')}${shift.note ? ` · ${shift.note}` : ''}`}
                      aria-label={`${name}, ${format(start, 'h:mm a')} to ${format(end, 'h:mm a')} on ${format(start, 'EEEE MMMM d')}${editable ? '. Edit' : ''}`}
                      className={cn(
                        'absolute overflow-hidden rounded text-left leading-tight text-white',
                        'border-l-4 transition-opacity',
                        narrow ? 'px-0.5 text-[10px]' : 'px-1.5 text-[11px]',
                        editable ? 'hover:opacity-90' : 'cursor-default opacity-80',
                      )}
                      style={{
                        top,
                        height,
                        // Lanes split the column; the 2px inset keeps adjacent
                        // people visually separate.
                        left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                        width: `calc(${(1 / laneCount) * 100}% - 4px)`,
                        backgroundColor: color.bg,
                        borderLeftColor: color.border,
                      }}
                    >
                      <span className="block truncate font-semibold">{name}</span>
                      {height >= 32 && !narrow && (
                        <span className="block truncate opacity-90">
                          {format(start, 'h:mm')}–{format(end, 'h:mm a')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
