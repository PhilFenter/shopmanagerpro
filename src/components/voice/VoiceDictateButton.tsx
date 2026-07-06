import { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type VoiceFieldSpec = {
  name: string;
  kind: 'number' | 'string' | 'enum' | 'boolean';
  label?: string;
  min?: number;
  max?: number;
  options?: string[];
  current?: unknown;
  hint?: string;
};

interface Props {
  type: 'dtf' | 'screen_print' | 'embroidery' | 'leather';
  fields: VoiceFieldSpec[];
  onApply: (updates: Record<string, unknown>, notes: string, transcript: string) => void;
  label?: string;
  iconOnly?: boolean;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  for (const m of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export function VoiceDictateButton({ type, fields, onApply, label = 'Voice fill' }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => void handleStop(rec.mimeType || mime || 'audio/webm');
      rec.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Microphone unavailable',
        description: (err as Error).message,
      });
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    stopStream();
    setState('processing');
  }

  async function handleStop(mime: string) {
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size < 1500) {
        toast({ title: 'Recording too short', description: 'Try again and speak a bit longer.' });
        setState('idle');
        return;
      }
      const audioBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke('voice-recipe-parse', {
        body: { audioBase64, mimeType: mime, type, fields },
      });
      if (error) throw error;
      const updates = (data?.updates ?? {}) as Record<string, unknown>;
      const notes = String(data?.notes ?? '');
      const transcript = String(data?.transcript ?? '');
      const applied = Object.keys(updates).length;
      onApply(updates, notes, transcript);
      toast({
        title: applied || notes ? 'Voice applied' : 'Nothing to apply',
        description:
          (applied ? `${applied} field${applied === 1 ? '' : 's'} updated. ` : '') +
          (notes ? 'Notes appended.' : transcript ? `Heard: "${transcript.slice(0, 80)}"` : ''),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Voice parse failed',
        description: (err as Error).message,
      });
    } finally {
      setState('idle');
    }
  }

  if (state === 'recording') {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={stop} className="gap-2">
        <Square className="h-4 w-4 fill-current" />
        Stop ({elapsed}s)
      </Button>
    );
  }
  if (state === 'processing') {
    return (
      <Button type="button" variant="secondary" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Transcribing…
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={start} className="gap-2">
      <Mic className="h-4 w-4" />
      {label}
    </Button>
  );
}
