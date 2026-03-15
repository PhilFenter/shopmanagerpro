import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, CloudUpload, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY || '';

export function DropboxSync() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'dropbox_connected')
      .maybeSingle();
    setIsConnected(data?.value === true || data?.value === 'true');
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Listen for OAuth callback message from popup
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === 'dropbox-oauth-code' && event.data.code) {
        setIsConnecting(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await supabase.functions.invoke('dropbox-oauth-callback', {
            body: { code: event.data.code },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });

          if (res.error) throw res.error;

          toast.success('Dropbox connected successfully!');
          setIsConnected(true);
        } catch (err: any) {
          console.error('Dropbox connect error:', err);
          toast.error(err.message || 'Failed to connect Dropbox');
        } finally {
          setIsConnecting(false);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleConnect = () => {
    // We need the app key. Try fetching from business_settings first.
    fetchAppKeyAndAuthorize();
  };

  const fetchAppKeyAndAuthorize = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'dropbox_app_key')
      .maybeSingle();

    const appKey = data?.value as string || DROPBOX_APP_KEY;

    if (!appKey) {
      toast.error('Dropbox App Key not configured. Contact your administrator.');
      return;
    }

    const redirectUri = `${window.location.origin}/dropbox-callback`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline`;

    // Open in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(authUrl, 'dropbox-auth', `width=${width},height=${height},left=${left},top=${top}`);

    toast.info('Complete the authorization in the popup window, then paste the code below.');
    setIsConnecting(true);
    // Show code input
    setShowCodeInput(true);
  };

  const [showCodeInput, setShowCodeInput] = useState(false);
  const [authCode, setAuthCode] = useState('');

  const handleSubmitCode = async () => {
    if (!authCode.trim()) {
      toast.error('Please paste the authorization code');
      return;
    }

    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('dropbox-oauth-callback', {
        body: { code: authCode.trim() },
      });

      if (res.error) {
        throw new Error(res.error.message || 'Failed to connect');
      }
      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      toast.success('Dropbox connected successfully!');
      setIsConnected(true);
      setShowCodeInput(false);
      setAuthCode('');
    } catch (err: any) {
      console.error('Dropbox connect error:', err);
      toast.error(err.message || 'Failed to connect Dropbox');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const { error } = await supabase
      .from('business_settings')
      .upsert(
        { key: 'dropbox_connected', value: false as any },
        { onConflict: 'key' }
      );

    if (!error) {
      setIsConnected(false);
      toast.success('Dropbox disconnected');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CloudUpload className="h-5 w-5" />
              Dropbox
            </CardTitle>
            <CardDescription>
              Auto-sync artwork files to your Dropbox for design software access
            </CardDescription>
          </div>
          {isConnected !== null && (
            <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
              {isConnected ? (
                <><CheckCircle className="h-3 w-3" /> Connected</>
              ) : (
                <><XCircle className="h-3 w-3" /> Not Connected</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCodeInput ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              After authorizing in the Dropbox popup, paste the code you receive here:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Paste authorization code here..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button onClick={handleSubmitCode} disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : 'Submit'}
              </Button>
              <Button variant="outline" onClick={() => { setShowCodeInput(false); setIsConnecting(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : isConnected ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {isConnecting ? 'Connecting...' : 'Connect Dropbox'}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Artwork files are automatically uploaded to customer folders in your Dropbox when quotes are submitted.
        </p>
      </CardContent>
    </Card>
  );
}
