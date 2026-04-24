export type HandoffDept =
  | 'embroidery'
  | 'screen_print'
  | 'dtf'
  | 'leather'
  | 'patch'
  | 'art'
  | 'front_office'
  | 'production'
  | 'shipping';

export type HandoffStatus = 'pending' | 'acknowledged' | 'completed';

export const HANDOFF_DEPTS: { value: HandoffDept; label: string; emoji: string }[] = [
  { value: 'embroidery', label: 'Embroidery', emoji: '🧵' },
  { value: 'screen_print', label: 'Screen Print', emoji: '🖨️' },
  { value: 'dtf', label: 'DTF', emoji: '🔥' },
  { value: 'leather', label: 'Leather', emoji: '🪵' },
  { value: 'patch', label: 'Patch', emoji: '🩹' },
  { value: 'art', label: 'Art', emoji: '🎨' },
  { value: 'front_office', label: 'Front Office', emoji: '🏢' },
  { value: 'production', label: 'Production', emoji: '⚙️' },
  { value: 'shipping', label: 'Shipping', emoji: '📦' },
];

export const DEPT_LABEL: Record<HandoffDept, string> = Object.fromEntries(
  HANDOFF_DEPTS.map(d => [d.value, d.label])
) as Record<HandoffDept, string>;

export const DEPT_EMOJI: Record<HandoffDept, string> = Object.fromEntries(
  HANDOFF_DEPTS.map(d => [d.value, d.emoji])
) as Record<HandoffDept, string>;

export const STATUS_LABEL: Record<HandoffStatus, string> = {
  pending: 'New',
  acknowledged: 'In Progress',
  completed: 'Done',
};
