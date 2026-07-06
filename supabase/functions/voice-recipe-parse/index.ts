// Voice recipe parser: transcribes audio via Lovable AI STT, then extracts
// structured field updates + notes via Gemini. Returns { transcript, updates, notes }.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface FieldSpec {
  name: string;
  kind: 'number' | 'string' | 'enum' | 'boolean';
  label?: string;
  min?: number;
  max?: number;
  options?: string[];
  current?: unknown;
  hint?: string;
}

interface Payload {
  audioBase64: string;
  mimeType: string;
  type: 'dtf' | 'screen_print' | 'embroidery' | 'leather';
  fields: FieldSpec[];
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extToName(mime: string): string {
  const bare = (mime || '').split(';')[0];
  const map: Record<string, string> = {
    'audio/webm': 'recording.webm',
    'audio/mp4': 'recording.mp4',
    'audio/mpeg': 'recording.mp3',
    'audio/mp3': 'recording.mp3',
    'audio/wav': 'recording.wav',
    'audio/wave': 'recording.wav',
    'audio/x-wav': 'recording.wav',
    'audio/ogg': 'recording.ogg',
  };
  return map[bare] || 'recording.webm';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.audioBase64 || !body?.type || !Array.isArray(body.fields)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Transcribe
    const audioBytes = b64ToBytes(body.audioBase64);
    const audioBlob = new Blob([audioBytes], { type: body.mimeType || 'audio/webm' });
    const fd = new FormData();
    fd.append('model', 'openai/gpt-4o-mini-transcribe');
    fd.append('file', audioBlob, extToName(body.mimeType));

    const sttRes = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Transcription failed: ${sttRes.status} ${t}` }), {
        status: sttRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sttJson = await sttRes.json();
    const transcript: string = sttJson.text ?? '';

    if (!transcript.trim()) {
      return new Response(JSON.stringify({ transcript: '', updates: {}, notes: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Parse transcript into structured updates
    const fieldDescriptors = body.fields
      .map((f) => {
        const parts = [`- "${f.name}" (${f.kind})`];
        if (f.label) parts.push(`label: ${f.label}`);
        if (f.kind === 'enum' && f.options) parts.push(`options: ${f.options.join(' | ')}`);
        if (f.kind === 'number') {
          if (f.min != null) parts.push(`min: ${f.min}`);
          if (f.max != null) parts.push(`max: ${f.max}`);
        }
        if (f.hint) parts.push(f.hint);
        return parts.join('; ');
      })
      .join('\n');

    const systemPrompt = `You extract screen-print / DTF / embroidery / leather production recipe parameters from a shop operator's spoken notes. Be GENEROUS in matching — operators speak in shorthand.
Process type: ${body.type}.
Available fields (only use these exact names):
${fieldDescriptors}

Rules:
- Extract every field the operator plausibly stated, even if wording is loose. Only omit if truly ambiguous.
- Numbers: parse spoken numerals ("three twenty" -> 320, "two seventy two" -> 272). Respect min/max; clamp silently. If a number is stated near a field keyword (e.g. "272 mesh", "60 psi", "12 seconds"), assign it to that field.
- Enum: match by SUBSTRING or number match, case-insensitive. Example: "272 mesh" -> "Newman 272"; "eco 230" -> "Eco 230"; "print head" or "printhead" -> "printhead". Pick the closest option.
- String fields (like pantone/color): accept ANY spoken value verbatim ("base white", "PMS 186 red", "safety orange"). Do not require a specific format.
- Booleans: on/off, yes/no, enable/disable, active/inactive.
- ALWAYS populate "notes" with a cleaned-up version of the full transcript so the operator has a record — even if you extracted fields. Trim filler ("um", "so", "we're gonna").
- If truly nothing is parseable, still put the transcript in "notes".
- Return strict JSON: {"updates": {...}, "notes": "..."}`;

    const chatRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcript: """${transcript}"""` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!chatRes.ok) {
      const t = await chatRes.text().catch(() => '');
      return new Response(
        JSON.stringify({ transcript, updates: {}, notes: '', error: `Parse failed: ${chatRes.status} ${t}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const chatJson = await chatRes.json();
    const raw = chatJson.choices?.[0]?.message?.content ?? '{}';
    let parsed: { updates?: Record<string, unknown>; notes?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return new Response(
      JSON.stringify({
        transcript,
        updates: parsed.updates ?? {},
        notes: parsed.notes ?? '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
