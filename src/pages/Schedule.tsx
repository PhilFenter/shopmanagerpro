import { useMemo, useState } from 'react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { Loader2, ChevronLeft, ChevronRight, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useRoster, useMyWorkerId } from '@/hooks/useRoster';
import { useShifts, type Shift } from '@/hooks/useShifts';
import { ScheduleWeek } from '@/components/schedule/ScheduleWeek';
import { ShiftEditor } from '@/components/schedule/ShiftEditor';
import { colorForWorker } from '@/lib/schedule';

export default function Schedule() {
  const { role } = useAuth();
  const canManageOthers = role === 'admin' || role === 'manager';

  // The window is rolling: it opens on the current week and the next one, and
  // the arrows step a full fortnight so the two halves never straddle awkwardly.
  const [windowStart, setWindowStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const windowEnd = useMemo(() => addDays(windowStart, 14), [windowStart]);

  const { roster, activeRoster, isLoading: rosterLoading } = useRoster();
  const { myWorkerId, isLoading: myWorkerLoading } = useMyWorkerId();
  const { shifts, isLoading: shiftsLoading, createShift, updateShift, deleteShift } =
    useShifts(windowStart, windowEnd);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editorDay, setEditorDay] = useState<Date>(new Date());
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null);

  // Managers may schedule for someone else; everyone else is always themselves.
  const targetWorkerId = canManageOthers ? (schedulingFor ?? myWorkerId) : myWorkerId;

  const isLoading = rosterLoading || myWorkerLoading || shiftsLoading;

  const handleCreate = (startsAt: Date, endsAt: Date) => {
    if (!targetWorkerId) return;
    createShift.mutate({
      worker_id: targetWorkerId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });
  };

  const handleSave = (values: {
    workerId: string; startsAt: Date; endsAt: Date; note: string | null;
  }) => {
    const payload = {
      worker_id: values.workerId,
      starts_at: values.startsAt.toISOString(),
      ends_at: values.endsAt.toISOString(),
      note: values.note,
    };
    if (editingShift) {
      updateShift.mutate({ id: editingShift.id, ...payload }, {
        onSuccess: () => setEditorOpen(false),
      });
    } else {
      createShift.mutate(payload, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const openNewShift = () => {
    setEditingShift(null);
    setEditorDay(new Date());
    setEditorOpen(true);
  };

  const openExistingShift = (shift: Shift) => {
    setEditingShift(shift);
    setEditorDay(new Date(shift.starts_at));
    setEditorOpen(true);
  };

  // Who actually has hours in this window — used for the legend, so it doesn't
  // list the entire roster when two people are working.
  const scheduledWorkerIds = useMemo(
    () => Array.from(new Set(shifts.map((s) => s.worker_id))),
    [shifts],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rangeLabel = `${format(windowStart, 'MMM d')} – ${format(addDays(windowStart, 13), 'MMM d, yyyy')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Two weeks at a time. Drag on a day to add your hours.</p>
        </div>
        <Button onClick={openNewShift} disabled={!targetWorkerId}>
          <Plus className="mr-2 h-4 w-4" />
          Add shift
        </Button>
      </div>

      {!myWorkerId && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium">Your login isn’t linked to a roster entry yet.</p>
            <p className="text-muted-foreground">
              You can see everyone’s schedule, but you can’t add your own hours until an admin links
              your account on the Team page.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous two weeks"
            onClick={() => setWindowStart((d) => addWeeks(d, -2))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[190px] text-center text-sm font-medium">{rangeLabel}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next two weeks"
            onClick={() => setWindowStart((d) => addWeeks(d, 2))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWindowStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          >
            Today
          </Button>
        </div>

        {canManageOthers && (
          <div className="flex items-center gap-2">
            <Label htmlFor="scheduling-for" className="whitespace-nowrap text-sm text-muted-foreground">
              Scheduling for
            </Label>
            <Select
              value={schedulingFor ?? myWorkerId ?? ''}
              onValueChange={(v) => setSchedulingFor(v)}
            >
              <SelectTrigger id="scheduling-for" className="w-[190px]">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {activeRoster.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.id === myWorkerId ? `${r.name} (me)` : r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {scheduledWorkerIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {scheduledWorkerIds.map((id) => {
            const color = colorForWorker(id);
            const name = roster.find((r) => r.id === id)?.name ?? 'Unknown';
            return (
              <span key={id} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: color.bg, borderLeft: `3px solid ${color.border}` }}
                />
                {name}
              </span>
            );
          })}
        </div>
      )}

      {[0, 1].map((weekOffset) => {
        const weekStart = addWeeks(windowStart, weekOffset);
        return (
          <Card key={weekStart.toISOString()}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Week of {format(weekStart, 'MMMM d')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <ScheduleWeek
                weekStart={weekStart}
                shifts={shifts}
                roster={roster}
                myWorkerId={myWorkerId}
                canManageOthers={canManageOthers}
                targetWorkerId={targetWorkerId}
                onCreate={handleCreate}
                onSelectShift={openExistingShift}
              />
            </CardContent>
          </Card>
        );
      })}

      <ShiftEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        shift={editingShift}
        day={editorDay}
        roster={roster}
        canPickWorker={canManageOthers}
        defaultWorkerId={targetWorkerId}
        onSave={handleSave}
        onDelete={(id) => {
          deleteShift.mutate(id, { onSuccess: () => setEditorOpen(false) });
        }}
        isSaving={createShift.isPending || updateShift.isPending}
      />
    </div>
  );
}
