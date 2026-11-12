import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Who can sign in to Shop Manager and at what level.
// Uses the existing user_roles RLS (only admins can read all roles and change them).
// New sign-ups get a profile but no role (migration 20261111180000_staff_only_access),
// so they show here as "Waiting for approval" until an admin gives them access.

type AppRole = 'admin' | 'manager' | 'team';

const ROLE_INFO: Record<AppRole, { label: string; help: string }> = {
  team: { label: 'Team', help: 'Day-to-day screens: jobs, schedule, production, counter quotes, knowledge, training. No financials, customer list, or settings.' },
  manager: { label: 'Manager', help: 'Team access plus quotes, customers, messages, purchase orders, financials, integrations, settings, and approving InkSoft imports.' },
  admin: { label: 'Admin', help: 'Everything, including Team & Costs (wages) and changing who has access.' },
};
const RANK: Record<AppRole, number> = { team: 0, manager: 1, admin: 2 };

interface Login {
  user_id: string;
  /** null = signed up but not approved yet, so they can't see anything. */
  role: AppRole | null;
  row_ids: string[];
  name: string;
  signed_up: string | null;
}

function useLogins() {
  return useQuery({
    queryKey: ['team-access'],
    queryFn: async (): Promise<Login[]> => {
      const [{ data: roles, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
        supabase.from('user_roles').select('id, user_id, role'),
        supabase.from('profiles').select('user_id, full_name, created_at'),
      ]);
      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      const profileOf = (id: string) => profiles?.find((p) => p.user_id === id);
      const nameOf = (id: string) => profileOf(id)?.full_name?.trim() || 'No name on profile';
      const byUser = new Map<string, Login>();
      for (const r of roles ?? []) {
        const existing = byUser.get(r.user_id);
        const role = r.role as AppRole;
        if (!existing) {
          byUser.set(r.user_id, { user_id: r.user_id, role, row_ids: [r.id], name: nameOf(r.user_id), signed_up: null });
        } else {
          existing.row_ids.push(r.id);
          if (existing.role && RANK[role] > RANK[existing.role]) existing.role = role; // same rule as sign-in: highest role wins
        }
      }
      // Everyone with a profile but no role is waiting for approval.
      for (const p of profiles ?? []) {
        if (!byUser.has(p.user_id)) {
          byUser.set(p.user_id, { user_id: p.user_id, role: null, row_ids: [], name: nameOf(p.user_id), signed_up: p.created_at });
        }
      }
      const rank = (l: Login) => (l.role ? RANK[l.role] : -1);
      return [...byUser.values()].sort((a, b) =>
        Number(b.role === null) - Number(a.role === null) || rank(b) - rank(a) || a.name.localeCompare(b.name));
    },
  });
}

export function AccessSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: logins, isLoading, error } = useLogins();
  const [confirm, setConfirm] = useState<{ login: Login; role: AppRole } | null>(null);

  const pendingCount = (logins ?? []).filter((l) => l.role === null).length;

  const setRole = useMutation({
    mutationFn: async ({ login, role }: { login: Login; role: AppRole }) => {
      if (login.user_id === user?.id) throw new Error('You can’t change your own access.');
      if (login.row_ids.length === 0) {
        // Approving a new sign-up: give them their first role.
        const { error } = await supabase.from('user_roles').insert({ user_id: login.user_id, role });
        if (error) throw new Error(error.message);
        return;
      }
      const [keep, ...extra] = login.row_ids;
      const { error: e1 } = await supabase.from('user_roles').update({ role }).eq('id', keep);
      if (e1) throw new Error(e1.message);
      if (extra.length) {
        const { error: e2 } = await supabase.from('user_roles').delete().in('id', extra);
        if (e2) throw new Error(e2.message);
      }
    },
    onSuccess: (_r, { login, role }) => {
      qc.invalidateQueries({ queryKey: ['team-access'] });
      toast.success(
        login.role === null
          ? `${login.name} can now sign in as ${ROLE_INFO[role].label}.`
          : `${login.name} is now ${ROLE_INFO[role].label}. It applies the next time they open Shop Manager.`,
      );
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Logins & Access</CardTitle>
        <CardDescription>
          Everyone who can sign in to Shop Manager. New sign-ups can’t see anything until you give them access here.
          You can’t change your own access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          {(Object.keys(ROLE_INFO) as AppRole[]).map((r) => (
            <div key={r} className="rounded-md border p-2">
              <div className="font-semibold">{ROLE_INFO[r].label}</div>
              <div className="text-muted-foreground">{ROLE_INFO[r].help}</div>
            </div>
          ))}
        </div>

        {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {pendingCount > 0 && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {pendingCount === 1 ? '1 person is' : `${pendingCount} people are`} waiting for approval. Only give access to
            people you know work at the shop.
          </p>
        )}

        <div className="divide-y rounded-md border">
          {(logins ?? []).map((l) => {
            const isMe = l.user_id === user?.id;
            return (
              <div key={l.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.name}</span>
                  {isMe && <Badge variant="outline" className="ml-2 font-normal">You</Badge>}
                  {l.role === null && (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      Waiting for approval{l.signed_up ? ` · signed up ${new Date(l.signed_up).toLocaleDateString()}` : ''}
                    </Badge>
                  )}
                </div>
                <Select
                  value={l.role ?? undefined}
                  disabled={isMe || setRole.isPending}
                  onValueChange={(v) => setConfirm({ login: l, role: v as AppRole })}
                >
                  <SelectTrigger className="h-8 w-36" aria-label={`Access for ${l.name}`}>
                    <SelectValue placeholder="Give access…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_INFO) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_INFO[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.login.role
                ? `Change ${confirm.login.name} from ${ROLE_INFO[confirm.login.role].label} to ${ROLE_INFO[confirm.role].label}?`
                : `Give ${confirm?.login.name} ${confirm ? ROLE_INFO[confirm.role].label : ''} access?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && ROLE_INFO[confirm.role].help}
              {confirm?.role === 'admin' && ' Admins can also change everyone else’s access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirm) setRole.mutate(confirm); }}
              disabled={setRole.isPending}
            >
              {confirm?.login.role ? 'Change access' : 'Give access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
