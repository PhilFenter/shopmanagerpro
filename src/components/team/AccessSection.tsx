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
// Uses the existing user_roles RLS (only admins can read all roles and change them), so no database change is needed.

type AppRole = 'admin' | 'manager' | 'team';

const ROLE_INFO: Record<AppRole, { label: string; help: string }> = {
  team: { label: 'Team', help: 'Day-to-day screens: jobs, schedule, production, counter quotes, knowledge, training. No financials, customer list, or settings.' },
  manager: { label: 'Manager', help: 'Team access plus quotes, customers, messages, purchase orders, financials, integrations, settings, and approving InkSoft imports.' },
  admin: { label: 'Admin', help: 'Everything, including Team & Costs (wages) and changing who has access.' },
};
const RANK: Record<AppRole, number> = { team: 0, manager: 1, admin: 2 };

interface Login {
  user_id: string;
  role: AppRole;
  row_ids: string[];
  name: string;
}

function useLogins() {
  return useQuery({
    queryKey: ['team-access'],
    queryFn: async (): Promise<Login[]> => {
      const [{ data: roles, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
        supabase.from('user_roles').select('id, user_id, role'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      const byUser = new Map<string, Login>();
      for (const r of roles ?? []) {
        const existing = byUser.get(r.user_id);
        const role = r.role as AppRole;
        if (!existing) {
          const name = profiles?.find((p) => p.user_id === r.user_id)?.full_name?.trim() || 'No name on profile';
          byUser.set(r.user_id, { user_id: r.user_id, role, row_ids: [r.id], name });
        } else {
          existing.row_ids.push(r.id);
          if (RANK[role] > RANK[existing.role]) existing.role = role; // same rule as sign-in: highest role wins
        }
      }
      return [...byUser.values()].sort((a, b) => RANK[b.role] - RANK[a.role] || a.name.localeCompare(b.name));
    },
  });
}

export function AccessSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: logins, isLoading, error } = useLogins();
  const [confirm, setConfirm] = useState<{ login: Login; role: AppRole } | null>(null);

  const setRole = useMutation({
    mutationFn: async ({ login, role }: { login: Login; role: AppRole }) => {
      if (login.user_id === user?.id) throw new Error('You can’t change your own access.');
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
      toast.success(`${login.name} is now ${ROLE_INFO[role].label}. It applies the next time they open Shop Manager.`);
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Logins & Access</CardTitle>
        <CardDescription>
          Everyone who can sign in to Shop Manager. New sign-ups start as Team. You can’t change your own access.
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

        <div className="divide-y rounded-md border">
          {(logins ?? []).map((l) => {
            const isMe = l.user_id === user?.id;
            return (
              <div key={l.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.name}</span>
                  {isMe && <Badge variant="outline" className="ml-2 font-normal">You</Badge>}
                </div>
                <Select
                  value={l.role}
                  disabled={isMe || setRole.isPending}
                  onValueChange={(v) => setConfirm({ login: l, role: v as AppRole })}
                >
                  <SelectTrigger className="h-8 w-36" aria-label={`Access for ${l.name}`}><SelectValue /></SelectTrigger>
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
              Change {confirm?.login.name} from {confirm && ROLE_INFO[confirm.login.role].label} to {confirm && ROLE_INFO[confirm.role].label}?
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
              Change access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
