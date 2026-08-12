import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

/**
 * Password recovery, both halves in one page.
 *
 * Supabase's recovery email links back here with tokens in the URL, which the
 * client exchanges for a session automatically. So:
 *   - arriving with a session  -> set a new password
 *   - arriving without one     -> ask for a reset link
 *
 * That means the same URL works as the "Forgot password?" destination and as
 * the redirect target configured in Supabase.
 */

const emailSchema = z.string().email('Please enter a valid email address');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

type Phase = 'checking' | 'request' | 'set' | 'done';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    // Supabase strips the tokens from the URL once it has consumed them, so
    // read any error out of it before that happens. An expired or already-used
    // link comes back as error_description rather than a session.
    const params = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search,
    );
    const urlError = params.get('error_description') ?? params.get('error');

    // A PKCE-style link arrives as ?code=... and needs an explicit exchange.
    const code = new URLSearchParams(window.location.search).get('code');

    const settle = async () => {
      if (urlError) {
        if (cancelled) return;
        setLinkError(urlError.replace(/\+/g, ' '));
        setPhase('request');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !cancelled) {
          setLinkError('That reset link has expired or has already been used.');
          setPhase('request');
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setPhase(session ? 'set' : 'request');
    };

    // Fires when the recovery token is consumed. Covers the case where the
    // session lands after this effect has already run.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !cancelled) {
        setLinkError(null);
        setPhase('set');
      }
    });

    settle();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setErrors({ email: parsed.error.errors[0].message });
      return;
    }
    setErrors({});
    setSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not send reset email',
        description: error.message,
      });
      return;
    }

    // Deliberately not reporting whether the address exists — that would let
    // anyone test which emails have accounts.
    setSent(true);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = passwordSchema.safeParse(password);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) nextErrors.password = parsed.error.errors[0].message;
    if (password !== confirm) nextErrors.confirm = 'Passwords do not match';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      // The recovery session is short-lived; if it lapsed mid-form, say so
      // rather than showing a raw API message.
      const expired = /session|jwt|token/i.test(error.message);
      if (expired) {
        setLinkError('Your reset link expired before the password was saved. Request a new one.');
        setPhase('request');
        return;
      }
      toast({ variant: 'destructive', title: 'Could not update password', description: error.message });
      return;
    }

    setPhase('done');
  };

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );

  if (phase === 'checking') {
    return shell(
      <CardContent className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </CardContent>,
    );
  }

  if (phase === 'done') {
    return shell(
      <>
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <CardTitle className="text-2xl font-bold">Password updated</CardTitle>
          <CardDescription>You're signed in with your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate('/dashboard')}>
            Continue to Shop Manager
          </Button>
        </CardContent>
      </>,
    );
  }

  if (phase === 'set') {
    return shell(
      <>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
          <CardDescription>Enter it twice so we know it's right.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={saving}
              />
              {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save new password
            </Button>
          </form>
        </CardContent>
      </>,
    );
  }

  // phase === 'request'
  return shell(
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
        <CardDescription>
          We'll email you a link to choose a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkError && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm">{linkError}</p>
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/10 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm">
                If an account exists for <span className="font-medium">{email}</span>, a reset link is
                on its way. It expires in an hour.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter>
        <Link
          to="/auth"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </CardFooter>
    </>,
  );
}
