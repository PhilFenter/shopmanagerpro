import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, Path } from 'fabric';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import {
  Upload, Save, Trash2, Loader2, Image as ImageIcon,
  FlipHorizontal, Send, Camera,
} from 'lucide-react';
import { useQuoteMockups, QuoteMockup } from '@/hooks/useQuoteMockups';
import { QuoteLineItem } from '@/hooks/useQuotes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const PLACEMENT_PRESETS: Record<string, { x: number; y: number; scale: number }> = {
  'Left Chest': { x: 0.35, y: 0.32, scale: 0.15 },
  'Full Front': { x: 0.5, y: 0.45, scale: 0.45 },
  'Full Back': { x: 0.5, y: 0.45, scale: 0.45 },
  'Back Yoke': { x: 0.5, y: 0.25, scale: 0.3 },
  'Left Sleeve': { x: 0.2, y: 0.35, scale: 0.12 },
  'Right Sleeve': { x: 0.8, y: 0.35, scale: 0.12 },
  'Custom': { x: 0.5, y: 0.5, scale: 0.3 },
};

interface QuoteMockupBuilderProps {
  quoteId: string;
  lineItems: QuoteLineItem[];
  customerEmail?: string | null;
  customerName?: string;
}

function LineItemThumb({ imageUrl }: { imageUrl: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (imageUrl.startsWith('http')) {
      setSrc(imageUrl);
    } else {
      supabase.storage.from('job-photos').createSignedUrl(imageUrl, 3600)
        .then(({ data }) => setSrc(data?.signedUrl || ''));
    }
  }, [imageUrl]);
  if (!src) return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  return <img src={src} alt="" className="h-full w-full object-contain" />;
}

/** Draw a simple blank t-shirt outline on the canvas as a placeholder */
function drawBlankShirtPlaceholder(canvas: FabricCanvas, w: number, h: number) {
  canvas.backgroundColor = '#ffffff';
  const shirtPath = `
    M ${w * 0.25} ${h * 0.15}
    L ${w * 0.1} ${h * 0.3}
    L ${w * 0.2} ${h * 0.35}
    L ${w * 0.2} ${h * 0.85}
    L ${w * 0.8} ${h * 0.85}
    L ${w * 0.8} ${h * 0.35}
    L ${w * 0.9} ${h * 0.3}
    L ${w * 0.75} ${h * 0.15}
    Q ${w * 0.6} ${h * 0.22} ${w * 0.5} ${h * 0.22}
    Q ${w * 0.4} ${h * 0.22} ${w * 0.25} ${h * 0.15}
    Z
  `;
  try {
    const shirt = new Path(shirtPath, {
      fill: '#f0f0f0',
      stroke: '#d4d4d4',
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    canvas.add(shirt);
  } catch {
    // fallback: just white background
  }
  canvas.renderAll();
}

export function QuoteMockupBuilder({ quoteId, lineItems, customerEmail, customerName }: QuoteMockupBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const garmentImageRef = useRef<FabricImage | null>(null);
  const artworkImageRef = useRef<FabricImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const garmentFileInputRef = useRef<HTMLInputElement>(null);

  const { mockups, saveMockup, deleteMockup } = useQuoteMockups(quoteId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState('');
  const [placement, setPlacement] = useState('Full Front');
  const [artworkScale, setArtworkScale] = useState(100);
  const [artworkRotation, setArtworkRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [manualGarmentUrl, setManualGarmentUrl] = useState<string | null>(null);

  // Compute canvas size dynamically based on available space
  const [canvasSize, setCanvasSize] = useState({ w: 700, h: 840 });

  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      // Leave room for sidebars (220 + 300) + padding
      const availW = Math.min(window.innerWidth - 580, 900);
      const availH = window.innerHeight - 180;
      // Maintain 5:6 aspect ratio
      const w = Math.max(400, Math.min(availW, availH * (5 / 6)));
      const h = w * (6 / 5);
      setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [open]);

  const CANVAS_W = canvasSize.w;
  const CANVAS_H = canvasSize.h;

  // Initialize fabric canvas — recreate when size changes
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const timeout = setTimeout(() => {
      if (fabricRef.current) fabricRef.current.dispose();
      const canvas = new FabricCanvas(canvasRef.current!, {
        width: CANVAS_W, height: CANVAS_H, backgroundColor: '#f5f5f5', selection: true,
      });
      fabricRef.current = canvas;
      garmentImageRef.current = null;
      artworkImageRef.current = null;
      setCanvasReady(true);
    }, 100);
    return () => {
      clearTimeout(timeout);
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
      setCanvasReady(false);
      garmentImageRef.current = null;
      artworkImageRef.current = null;
    };
  }, [open, CANVAS_W, CANVAS_H]);

  // Load garment/line-item image OR manual upload OR placeholder
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;
    if (garmentImageRef.current) { canvas.remove(garmentImageRef.current); garmentImageRef.current = null; }

    // Determine image source: manual upload > line item image_url > placeholder
    const li = lineItems.find(l => l.id === selectedLineItemId);
    const rawUrl = manualGarmentUrl || li?.image_url;

    if (!rawUrl) {
      // Draw a placeholder shirt outline
      drawBlankShirtPlaceholder(canvas, CANVAS_W, CANVAS_H);
      return;
    }

    const loadImage = async () => {
      let imageUrl = rawUrl;
      if (!rawUrl.startsWith('http') && !rawUrl.startsWith('data:')) {
        const { data } = await supabase.storage.from('job-photos').createSignedUrl(rawUrl, 3600);
        imageUrl = data?.signedUrl || '';
      }
      if (!imageUrl) {
        drawBlankShirtPlaceholder(canvas, CANVAS_W, CANVAS_H);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const fabricImg = new FabricImage(img);
        const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height) * 0.9;
        fabricImg.set({
          scaleX: scale, scaleY: scale,
          left: (CANVAS_W - img.width * scale) / 2, top: (CANVAS_H - img.height * scale) / 2,
          selectable: false, evented: false, hasControls: false,
        });
        canvas.insertAt(0, fabricImg);
        garmentImageRef.current = fabricImg;
        canvas.renderAll();
      };
      img.onerror = () => {
        drawBlankShirtPlaceholder(canvas, CANVAS_W, CANVAS_H);
      };
      img.src = imageUrl;
    };
    loadImage();
  }, [selectedLineItemId, lineItems, canvasReady, manualGarmentUrl, CANVAS_W, CANVAS_H]);

  useEffect(() => {
    if (lineItems.length > 0 && !selectedLineItemId) {
      const withImage = lineItems.find(l => l.image_url);
      setSelectedLineItemId(withImage?.id || lineItems[0].id);
    }
  }, [lineItems, selectedLineItemId]);

  const loadArtworkFromFile = useCallback((file: File) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (artworkImageRef.current) canvas.remove(artworkImageRef.current);
        const fabricImg = new FabricImage(img);
        const preset = PLACEMENT_PRESETS[placement] || PLACEMENT_PRESETS['Custom'];
        const maxDim = Math.min(CANVAS_W, CANVAS_H) * preset.scale;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        fabricImg.set({
          scaleX: scale, scaleY: scale,
          left: CANVAS_W * preset.x, top: CANVAS_H * preset.y,
          originX: 'center', originY: 'center',
          cornerColor: 'hsl(var(--primary))', cornerStyle: 'circle',
          transparentCorners: false, borderColor: 'hsl(var(--primary))',
        });
        canvas.add(fabricImg);
        canvas.setActiveObject(fabricImg);
        artworkImageRef.current = fabricImg;
        setArtworkScale(100);
        setArtworkRotation(0);
        canvas.renderAll();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [placement, CANVAS_W, CANVAS_H]);

  const handleUploadGarmentImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setManualGarmentUrl(e.target?.result as string);
      toast({ title: 'Garment image loaded' });
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleScaleChange = (value: number[]) => {
    setArtworkScale(value[0]);
    if (!artworkImageRef.current || !fabricRef.current) return;
    const art = artworkImageRef.current;
    const factor = value[0] / 100;
    const preset = PLACEMENT_PRESETS[placement] || PLACEMENT_PRESETS['Custom'];
    const maxDim = Math.min(CANVAS_W, CANVAS_H) * preset.scale;
    const origW = art.getOriginalSize().width;
    const origH = art.getOriginalSize().height;
    const baseScale = Math.min(maxDim / origW, maxDim / origH);
    art.set({ scaleX: baseScale * factor, scaleY: baseScale * factor });
    fabricRef.current.renderAll();
  };

  const handleFlip = () => {
    if (!artworkImageRef.current || !fabricRef.current) return;
    artworkImageRef.current.set({ flipX: !artworkImageRef.current.flipX });
    fabricRef.current.renderAll();
  };

  const handleRemoveArtwork = () => {
    if (!artworkImageRef.current || !fabricRef.current) return;
    fabricRef.current.remove(artworkImageRef.current);
    artworkImageRef.current = null;
    fabricRef.current.renderAll();
  };

  const handleSave = async () => {
    if (!fabricRef.current) return;
    setIsSaving(true);
    try {
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
      const dataUrl = fabricRef.current.toDataURL({ format: 'png', multiplier: 2 });
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      await saveMockup.mutateAsync({ quoteId, imageBlob: blob, placement, canvasState: fabricRef.current.toJSON() });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendApproval = async (mockup: QuoteMockup) => {
    if (!customerEmail) {
      toast({ variant: 'destructive', title: 'No customer email on file' });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('send-mockup-email', {
        body: {
          quoteId, mockupId: mockup.id, storagePath: mockup.storage_path,
          customerEmail, customerName: customerName || 'Customer',
        },
      });
      if (error) throw error;
      toast({ title: 'Mockup sent for approval', description: `Email sent to ${customerEmail}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to send', description: e.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4" />
          Mockups
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <ImageIcon className="h-4 w-4 mr-1" /> Create Mockup
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-none p-0 [&>button]:z-50 [&>button]:top-4 [&>button]:right-4">
            <DialogDescription className="sr-only">
              Build mockups by placing artwork on garment images
            </DialogDescription>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <DialogTitle className="text-lg font-bold">Mockup Builder</DialogTitle>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-4 px-6 pb-6 h-[calc(100vh-73px)] overflow-hidden">
              {/* Left: Line items */}
              <div className="hidden lg:block space-y-2 border-r pr-4 overflow-y-auto">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Line Items</Label>
                {lineItems.length > 0 ? lineItems.map(li => (
                  <button
                    key={li.id}
                    type="button"
                    onClick={() => { setSelectedLineItemId(li.id); setManualGarmentUrl(null); }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md border p-2 text-left transition-colors",
                      li.id === selectedLineItemId ? "border-primary bg-primary/10" : "hover:bg-muted/40"
                    )}
                  >
                    <div className="h-12 w-12 rounded border overflow-hidden bg-muted/20 flex-shrink-0 flex items-center justify-center">
                      {li.image_url ? <LineItemThumb imageUrl={li.image_url} /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{li.style_number || 'Custom'}</p>
                      {li.color && <p className="text-[10px] text-muted-foreground truncate">{li.color}</p>}
                      <p className="text-[10px] text-muted-foreground">Qty: {li.quantity}</p>
                    </div>
                  </button>
                )) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No line items added</p>
                )}
              </div>

              {/* Center: Canvas */}
              <div ref={canvasContainerRef} className="flex flex-col items-center justify-center gap-3 overflow-hidden">
                <div className="border rounded-lg overflow-hidden bg-muted/30 inline-block shadow-sm">
                  <canvas ref={canvasRef} />
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => garmentFileInputRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-1" /> Upload Blank
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Upload Artwork
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFlip} disabled={!artworkImageRef.current}>
                    <FlipHorizontal className="h-4 w-4 mr-1" /> Flip
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRemoveArtwork} disabled={!artworkImageRef.current}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove Art
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) loadArtworkFromFile(f); e.target.value = ''; }} />
                <input ref={garmentFileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadGarmentImage(f); e.target.value = ''; }} />
              </div>

              {/* Right: Controls */}
              <div className="space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <Select value={placement} onValueChange={setPlacement}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(PLACEMENT_PRESETS).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scale: {artworkScale}%</Label>
                  <Slider value={[artworkScale]} onValueChange={handleScaleChange} min={10} max={300} step={5} />
                </div>
                <div className="space-y-2">
                  <Label>Rotation: {artworkRotation}°</Label>
                  <Slider value={[artworkRotation]} onValueChange={(v) => {
                    setArtworkRotation(v[0]);
                    if (artworkImageRef.current && fabricRef.current) {
                      artworkImageRef.current.set({ angle: v[0] });
                      fabricRef.current.renderAll();
                    }
                  }} min={0} max={360} step={1} />
                </div>

                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use "Upload Blank" to load a garment photo (front/back of a shirt). Then use "Upload Artwork" to place your design on top.
                  </p>
                </div>

                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-1" /> Save Mockup</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Saved mockups grid */}
      {mockups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mockups.map(m => (
            <div key={m.id} className="relative group border rounded-lg overflow-hidden bg-muted/20">
              {m.url && <img src={m.url} alt={m.filename} className="w-full aspect-[5/6] object-contain" />}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <Badge variant="secondary" className="text-xs">v{m.version_number}</Badge>
                {m.placement && <Badge variant="outline" className="text-xs">{m.placement}</Badge>}
                <div className="flex gap-1">
                  {customerEmail && (
                    <Button size="sm" variant="secondary" onClick={() => handleSendApproval(m)}>
                      <Send className="h-3 w-3 mr-1" /> Send
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteMockup.mutate({ id: m.id, storagePath: m.storage_path })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
