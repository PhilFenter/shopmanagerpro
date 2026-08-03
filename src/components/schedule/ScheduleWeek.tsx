import { useRef, useState } from 'react';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RosterMember } from '@/hooks/useRoster';
import type { Shift } from '@/hooks/useShifts';
import {
  HOUR_COUNT, HOUR_HEIGHT, START_HOUR, atMinutes, blockGeometry, colorForWorker, formatMinutes,
} from '@/lib/schedule';

interface ScheduleWeekProps {
  weekStart: Date;
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
}

export function ScheduleWeek({
  weekStart, shifts, roster, myWorkerId, canManageOthers, targetWorkerId,
  onCreate, onSelectShift,
}: ScheduleWeekProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const nameById = new Map(roster.map((r) => [r.id, r.name]));
  const canDrag = !!targetWorkerId;

  /** Which hour row a pointer is over, clamped to the grid. */
  const hourFromPointer = (dayIndex: number, clientY: number) => {
    const el = columnRefs.current[dayIndex];
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const raw = Math.floor((clientY - rect.top) / HOUR_HEIGHT);
    return Math.max(0, Math.min(HOUR_COUNT - 1, raw));
  };

  const handlePointerDown = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    // Ignore anything starting on an existing block — that's a click to edit.
    if ((e.target as HTMLElement).closest('[data-shift-block]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const hour = hourFromPointer(dayIndex, e.clientY);
    setDrag({ dayIndex, anchorHour: hour, currentHour: hour });
  };

  const handlePointerMove = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    const hour = hourFromPointer(dayIndex, e.clientY);
    if (hour !== drag.currentHour) setDrag({ ...drag, currentHour: hour });
  };

  const handlePointerUp = (dayIndex: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const first = Math.min(drag.anchorHour, drag.currentHour);
    const last = Math.max(drag.anchorHour, drag.currentHour);
    const day = days[dayIndex];

    // A drag ending on the same row it started is still a one-hour shift, which
    // makes a plain click a valid way to add an hour.
    onCreate(
      atMinutes(day, (START_HOUR + first) * 60),
      atMinutes(day, (START_HOUR + last + 1) * 60),
    );
    setDrag(null);
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
          <div />
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
            can drift apart by a pixel per row — the day cells carry a border
            and the labels don't — which compounds into a visible offset by
            6pm. Anchoring everything to one origin makes misalignment
            impossible at any width. */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Hour labels */}
          <div className="relative" style={{ height: HOUR_COUNT * HOUR_HEIGHT }}>
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
                  // touch-none stops the browser scrolling the page mid-drag on
                  // a tablet, which is the primary device on the shop floor.
                  touchAction: 'none',
                }}
                onPointerDown={handlePointerDown(dayIndex)}
                onPointerMove={handlePointerMove(dayIndex)}
                onPointerUp={handlePointerUp(dayIndex)}
                onPointerCancel={() => setDrag(null)}
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

                {dayShifts.map((shift) => {
                  const start = new Date(shift.starts_at);
                  const end = new Date(shift.ends_at);
                  const { top, height } = blockGeometry(start, end);
                  const color = colorForWorker(shift.worker_id);
                  const mine = shift.worker_id === myWorkerId;
                  const editable = mine || canManageOthers;
                  const name = nameById.get(shift.worker_id) ?? 'Unknown';

                  return (
                    <button
                      key={shift.id}
                      data-shift-block
                      type="button"
                      disabled={!editable}
                      onClick={() => editable && onSelectShift(shift)}
                      title={`${name} · ${format(start, 'h:mm a')}–${format(end, 'h:mm a')}${shift.note ? ` · ${shift.note}` : ''}`}
                      aria-label={`${name}, ${format(start, 'h:mm a')} to ${format(end, 'h:mm a')} on ${format(start, 'EEEE MMMM d')}${editable ? '. Edit' : ''}`}
                      className={cn(
                        'absolute inset-x-1 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight text-white',
                        'border-l-4 transition-opacity',
                        editable ? 'hover:opacity-90' : 'cursor-default opacity-80',
                      )}
                      style={{
                        top, height,
                        backgroundColor: color.bg,
                        borderLeftColor: color.border,
                      }}
                    >
                      <span className="block truncate font-semibold">{name}</span>
                      {height >= 32 && (
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
