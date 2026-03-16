import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Download,
  Image as ImageIcon,
  Palette,
  ExternalLink,
  Calendar,
  CloudUpload,
  Check,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';

interface ArtworkItem {
  id: string;
  image_url: string;
  description: string | null;
  style_number: string | null;
  service_type: string;
  color: string | null;
  created_at: string;
  quote_id: string;
  quote_number: string | null;
  customer_name: string;
  customer_email: string | null;
}

const PREVIEWABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'pdf']);

const isPdfFile = (url: string) => getFileExtension(url) === 'pdf';

const getFileNameFromUrl = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'artwork');
  } catch {
    return 'artwork';
  }
};

const getFileExtension = (url: string) => {
  const fileName = getFileNameFromUrl(url);
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return (extension || '').toLowerCase();
};

const isStoredArtworkUrl = (url: string) =>
  url.includes('/storage/v1/object/public/quote-artwork/');

const isPreviewableArtwork = (url: string) =>
  isStoredArtworkUrl(url) && PREVIEWABLE_EXTENSIONS.has(getFileExtension(url));

const getStoragePath = (url: string) => {
  const match = url.match(/\/storage\/v1\/object\/public\/quote-artwork\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const SERVICE_LABELS: Record<string, string> = {
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  leather_patch: 'Leather Patch',
  uv_patch: 'UV Patch',
  heat_press_patch: 'Heat Press',
  woven_patch: 'Woven Patch',
  pvc_patch: 'PVC Patch',
  other: 'Other',
};

export default function ArtworkLibrary() {
  const [search, setSearch] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ArtworkItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetItem, setUploadTargetItem] = useState<ArtworkItem | null>(null);
  const queryClient = useQueryClient();

  const { data: artworks = [], isLoading } = useQuery({
    queryKey: ['artwork-library'],
    queryFn: async () => {
      const { data: lineItems, error: liError } = await supabase
        .from('quote_line_items')
        .select('id, image_url, description, style_number, service_type, color, created_at, quote_id')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false });

      if (liError) throw liError;
      if (!lineItems || lineItems.length === 0) return [];

      const quoteIds = [...new Set(lineItems.map((li) => li.quote_id))];
      const { data: quotes, error: qError } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, customer_email')
        .in('id', quoteIds);

      if (qError) throw qError;

      const quoteMap = new Map((quotes ?? []).map((q) => [q.id, q]));

      return lineItems
        .filter((li) => typeof li.image_url === 'string' && isStoredArtworkUrl(li.image_url))
        .map((li) => {
          const quote = quoteMap.get(li.quote_id);
          return {
            id: li.id,
            image_url: li.image_url!,
            description: li.description,
            style_number: li.style_number,
            service_type: li.service_type,
            color: li.color,
            created_at: li.created_at,
            quote_id: li.quote_id,
            quote_number: quote?.quote_number ?? null,
            customer_name: quote?.customer_name ?? 'Unknown',
            customer_email: quote?.customer_email ?? null,
          } as ArtworkItem;
        });
    },
  });

  const filtered = search
    ? artworks.filter(
        (a) =>
          a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          a.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
          a.description?.toLowerCase().includes(search.toLowerCase()) ||
          a.style_number?.toLowerCase().includes(search.toLowerCase())
      )
    : artworks;

  const handleDownload = async (art: ArtworkItem) => {
    const filename = getFileNameFromUrl(art.image_url);
    toast.info('Downloading original file...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Missing auth session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-artwork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: art.image_url, filename }),
      });

      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Artwork download failed:', error);
      toast.error('Could not download this file');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);

    try {
      // Remove file from storage
      const storagePath = getStoragePath(deleteTarget.image_url);
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('quote-artwork')
          .remove([storagePath]);
        if (storageError) {
          console.warn('Storage delete warning:', storageError);
        }
      }

      // Clear the image_url on the line item
      const { error: updateError } = await supabase
        .from('quote_line_items')
        .update({ image_url: null })
        .eq('id', deleteTarget.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['artwork-library'] });
      toast.success('Artwork deleted');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete artwork');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const handleUploadClick = (art: ArtworkItem) => {
    setUploadTargetItem(art);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetItem) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    setUploadingId(uploadTargetItem.id);

    try {
      const safeName = uploadTargetItem.customer_name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Unknown';
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
      const storagePath = `${safeName}/${crypto.randomUUID()}${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('quote-artwork')
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('quote-artwork')
        .getPublicUrl(storagePath);

      // Update the line item with the new URL
      const { error: updateError } = await supabase
        .from('quote_line_items')
        .update({ image_url: urlData.publicUrl })
        .eq('id', uploadTargetItem.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['artwork-library'] });
      toast.success(`Updated artwork: ${file.name}`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload artwork');
    } finally {
      setUploadingId(null);
      setUploadTargetItem(null);
    }
  };

  const handleSyncToDropbox = async (art: ArtworkItem) => {
    const filename = getFileNameFromUrl(art.image_url);
    setSyncingIds((prev) => new Set(prev).add(art.id));

    try {
      const { data, error } = await supabase.functions.invoke('sync-to-dropbox', {
        body: {
          artwork_url: art.image_url,
          customer_name: art.customer_name,
          filename,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSyncedIds((prev) => new Set(prev).add(art.id));
      toast.success(`Sent ${filename} to Dropbox → ${data.path}`);
    } catch (error) {
      console.error('Dropbox sync failed:', error);
      toast.error('Failed to sync to Dropbox');
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(art.id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    const unsyncedArt = filtered.filter((a) => !syncedIds.has(a.id));
    if (unsyncedArt.length === 0) {
      toast.info('All artwork already synced');
      return;
    }
    toast.info(`Syncing ${unsyncedArt.length} file(s) to Dropbox...`);
    for (const art of unsyncedArt) {
      await handleSyncToDropbox(art);
    }
    toast.success('All artwork synced to Dropbox!');
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.ai,.eps,.pdf,.svg,.cdr"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Artwork Library
          </h1>
          <p className="text-muted-foreground">
            All customer artwork from quote submissions — {artworks.length} file{artworks.length !== 1 ? 's' : ''}
          </p>
        </div>
        {artworks.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleSyncAll}>
            <CloudUpload className="h-4 w-4 mr-1" />
            Sync All to Dropbox
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer, quote number, or description..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading artwork...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {search ? 'No artwork matches your search' : 'No artwork uploaded yet'}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? 'Try a different search term'
              : 'Customer artwork will appear here when quotes include logo uploads'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((art) => {
            const canPreview = isPreviewableArtwork(art.image_url);
            const originalFilename = getFileNameFromUrl(art.image_url);
            const extension = getFileExtension(art.image_url).toUpperCase() || 'FILE';
            const isSyncing = syncingIds.has(art.id);
            const isSynced = syncedIds.has(art.id);
            const isDeleting = deletingId === art.id;
            const isUploading = uploadingId === art.id;

            return (
              <Card key={art.id} className="overflow-hidden group">
                <div className="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
                  {canPreview ? (
                    <img
                      src={art.image_url}
                      alt={`Artwork for ${art.customer_name}`}
                      className="max-h-full max-w-full object-contain p-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{extension}</p>
                      <p className="text-xs text-muted-foreground">Preview unavailable</p>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2">
                    <Button size="sm" onClick={() => handleDownload(art)}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUploadClick(art)}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant={isSynced ? 'secondary' : 'outline'}
                      onClick={() => handleSyncToDropbox(art)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSynced ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <CloudUpload className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(art.image_url, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(art)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <p className="font-medium text-sm truncate">{art.customer_name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {art.quote_number && (
                      <Badge variant="outline" className="text-xs">
                        {art.quote_number}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {SERVICE_LABELS[art.service_type] || art.service_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{originalFilename}</p>
                  {(art.description || art.style_number) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {art.description || art.style_number}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(art.created_at), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artwork</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the artwork file for{' '}
              <strong>{deleteTarget?.customer_name}</strong>
              {deleteTarget?.quote_number ? ` (${deleteTarget.quote_number})` : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
