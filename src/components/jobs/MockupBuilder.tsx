import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  Upload, Save, RotateCw, ZoomIn, ZoomOut, Trash2, Loader2,
  Star, Send, Image as ImageIcon, Undo, FlipHorizontal,
} from 'lucide-react';
import { useMockups, JobMockup } from '@/hooks/useMockups';
import { useJobPhotos } from '@/hooks/useJobPhotos';
import { useJobGarments } from '@/hooks/useJobGarments';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Placement presets: x%, y% of canvas
const PLACEMENT_PRESETS: Record<string, { x: number; y: number; scale: number }> = {
  'Left Chest': { x: 0.35, y: 0.32, scale: 0.15 },
  'Full Front': { x: 0.5, y: 0.45, scale: 0.45 },
  'Full Back': { x: 0.5, y: 0.45, scale: 0.45 },
  'Back Yoke': { x: 0.5, y: 0.25, scale: 0.3 },
  'Left Sleeve': { x: 0.2, y: 0.35, scale: 0.12 },
  'Right Sleeve': { x: 0.8, y: 0.35, scale: 0.12 },
  'Custom': { x: 0.5, y: 0.5, scale: 0.3 },
};

interface MockupBuilderProps {
  jobId: string;
  customerEmail?: string | null;
  customerName?: string;
  orderNumber?: string | null;
}

export function MockupBuilder({ jobId, customerEmail, customerName, orderNumber }: MockupBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const garmentImageRef = useRef<FabricImage | null>(null);
  const artworkImageRef = useRef<FabricImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mockups, isLoading: mockupsLoading, saveMockup, setApprovalVersion, deleteMockup } = useMockups(jobId);
  const { photos } = useJobPhotos(jobId);
  const { garments } = useJobGarments(jobId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>('');
  const [placement, setPlacement] = useState('Full Front');
  const [artworkScale, setArtworkScale] = useState(100);
  const [artworkRotation, setArtworkRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingApproval, setIsSendingApproval] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  const CANVAS_W = 500;
  const CANVAS_H = 600;

  // Initialize fabric canvas
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    // Small delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
      }
      const canvas = new FabricCanvas(canvasRef.current!, {
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: '#f5f5f5',
        selection: true,
      });
      fabricRef.current = canvas;
      setCanvasReady(true);
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setCanvasReady(false);
      garmentImageRef.current = null;
      artworkImageRef.current = null;
    };
  }, [open]);

  // Load garment image when selection changes
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;

    // Remove old garment image
    if (garmentImageRef.current) {
      canvas.remove(garmentImageRef.current);
      garmentImageRef.current = null;
    }

    const garment = garments.find(g => g.id === selectedGarmentId);
    const imageUrl = garment ? (garment as any).image_url : null;
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const fabricImg = new FabricImage(img);
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height) * 0.9;
      fabricImg.set({
        scaleX: scale,
        scaleY: scale,
        left: (CANVAS_W - img.width * scale) / 2,
        top: (CANVAS_H - img.height * scale) / 2,
        selectable: false,
        evented: false,
        hasControls: false,
      });
      canvas.insertAt(0, fabricImg);
      garmentImageRef.current = fabricImg;
      canvas.renderAll();
    };
    img.src = imageUrl;
  }, [selectedGarmentId, garments, canvasReady]);

  // Auto-select first garment with image
  useEffect(() => {
    if (garments.length > 0 && !selectedGarmentId) {
      const withImage = garments.find(g => (g as any).image_url);
      if (withImage) setSelectedGarmentId(withImage.id);
    }
  }, [garments, selectedGarmentId]);

  const loadArtworkFromFile = useCallback((file: File) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Remove old artwork
        if (artworkImageRef.current) {
          canvas.remove(artworkImageRef.current);
        }
        const fabricImg = new FabricImage(img);
        const preset = PLACEMENT_PRESETS[placement] || PLACEMENT_PRESETS['Custom'];
        const maxDim = Math.min(CANVAS_W, CANVAS_H) * preset.scale;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);

        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          left: CANVAS_W * preset.x,
          top: CANVAS_H * preset.y,
          originX: 'center',
          originY: 'center',
          cornerColor: 'hsl(var(--primary))',
          cornerStyle: 'circle',
          transparentCorners: false,
          borderColor: 'hsl(var(--primary))',
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
  }, [placement]);

  const loadArtworkFromUrl = useCallback((url: string) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (artworkImageRef.current) {
        canvas.remove(artworkImageRef.current);
      }
      const fabricImg = new FabricImage(img);
      const preset = PLACEMENT_PRESETS[placement] || PLACEMENT_PRESETS['Custom'];
      const maxDim = Math.min(CANVAS_W, CANVAS_H) * preset.scale;
      const scale = Math.min(maxDim / img.width, maxDim / img.height);

      fabricImg.set({
        scaleX: scale,
        scaleY: scale,
        left: CANVAS_W * preset.x,
        top: CANVAS_H * preset.y,
        originX: 'center',
        originY: 'center',
        cornerColor: 'hsl(var(--primary))',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: 'hsl(var(--primary))',
      });
      canvas.add(fabricImg);
      canvas.setActiveObject(fabricImg);
      artworkImageRef.current = fabricImg;
      setArtworkScale(100);
      setArtworkRotation(0);
      canvas.renderAll();
    };
    img.src = url;
  }, [placement]);

  // Update artwork scale/rotation
  useEffect(() => {
    if (!artworkImageRef.current || !fabricRef.current) return;
    const art = artworkImageRef.current;
    const baseScaleX = art.getOriginalSize().width ? (art.width! * art.scaleX!) / art.getOriginalSize().width : art.scaleX!;
    // We apply scale factor relative to initial
    art.set({ angle: artworkRotation });
    fabricRef.current.renderAll();
  }, [artworkRotation]);

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
      // Deselect all to remove selection handles from render
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();

      const dataUrl = fabricRef.current.toDataURL({ format: 'png', multiplier: 2 });
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();

      await saveMockup.mutateAsync({
        jobId,
        garmentId: selectedGarmentId || undefined,
        imageBlob: blob,
        placement,
        canvasState: fabricRef.current.toJSON(),
      });
    } catch (e) {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendApproval = async (mockup: JobMockup) => {
    if (!customerEmail) {
      toast({ variant: 'destructive', title: 'No customer email on file' });
      return;
    }
    setIsSendingApproval(true);
    try {
      const { error } = await supabase.functions.invoke('send-mockup-email', {
        body: {
          jobId,
          mockupId: mockup.id,
          storagePath: mockup.storage_path,
          customerEmail,
          customerName: customerName || 'Customer',
          orderNumber: orderNumber || undefined,
        },
      });
      if (error) throw error;
      toast({ title: 'Mockup sent for approval', description: `Email sent to ${customerEmail}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to send', description: e.message });
    } finally {
      setIsSendingApproval(false);
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
              <ImageIcon className="h-4 w-4 mr-1" />
              Create Mockup
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mockup Builder</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              {/* Canvas */}
              <div className="flex flex-col items-center gap-3">
                <div className="border rounded-lg overflow-hidden bg-muted/30 inline-block">
                  <canvas ref={canvasRef} />
                </div>

                {/* Canvas controls */}
                <div className="flex flex-wrap gap-2 justify-center">
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadArtworkFromFile(file);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Controls sidebar */}
              <div className="space-y-4">
                {/* Garment selection */}
                {garments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Garment</Label>
                    <Select value={selectedGarmentId} onValueChange={setSelectedGarmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select garment" />
                      </SelectTrigger>
                      <SelectContent>
                        {garments.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.style || g.description || 'Item'} {g.color ? `— ${g.color}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Placement preset */}
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <Select value={placement} onValueChange={setPlacement}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(PLACEMENT_PRESETS).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Scale slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Scale</Label>
                    <span className="text-xs text-muted-foreground">{artworkScale}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
                    <Slider
                      value={[artworkScale]}
                      onValueChange={handleScaleChange}
                      min={10}
                      max={300}
                      step={5}
                      className="flex-1"
                    />
                    <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>

                {/* Rotation slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rotation</Label>
                    <span className="text-xs text-muted-foreground">{artworkRotation}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <Slider
                      value={[artworkRotation]}
                      onValueChange={(v) => setArtworkRotation(v[0])}
                      min={-180}
                      max={180}
                      step={1}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Job photos for artwork selection */}
                {photos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Use Job Photo as Artwork</Label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                      {photos.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => p.url && loadArtworkFromUrl(p.url)}
                          className="aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        >
                          <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save */}
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Mockup</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mockup Gallery / Version History */}
      {mockupsLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : mockups.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No mockups yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mockups.map((m) => (
            <div key={m.id} className="relative group rounded-lg border overflow-hidden bg-muted/20">
              <img src={m.url} alt={m.filename} className="w-full aspect-square object-contain" />
              <div className="absolute top-1 left-1 flex gap-1">
                <Badge variant="secondary" className="text-[10px] py-0">
                  v{m.version_number}
                </Badge>
                {m.is_approval_version && (
                  <Badge variant="default" className="text-[10px] py-0">
                    <Star className="h-2.5 w-2.5 mr-0.5" /> Approved
                  </Badge>
                )}
              </div>
              {/* Hover controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={() => setApprovalVersion.mutate(m.id)}
                  title="Set as approval version"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
                {customerEmail && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={() => handleSendApproval(m)}
                    disabled={isSendingApproval}
                    title="Send for approval"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7"
                  onClick={() => deleteMockup.mutate({ id: m.id, storagePath: m.storage_path })}
                  title="Delete mockup"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
