import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Download,
  Image as ImageIcon,
  Palette,
  ExternalLink,
  Calendar,
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

const PREVIEWABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif']);

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

export default function ArtworkLibrary() {
  const [search, setSearch] = useState('');

  const { data: artworks = [], isLoading } = useQuery({
    queryKey: ['artwork-library'],
    queryFn: async () => {
      // Get all quote line items that have an image_url
      const { data: lineItems, error: liError } = await supabase
        .from('quote_line_items')
        .select(`
          id,
          image_url,
          description,
          style_number,
          service_type,
          color,
          created_at,
          quote_id
        `)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false });

      if (liError) throw liError;
      if (!lineItems || lineItems.length === 0) return [];

      // Get the associated quotes for customer info
      const quoteIds = [...new Set(lineItems.map((li) => li.quote_id))];
      const { data: quotes, error: qError } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, customer_email')
        .in('id', quoteIds);

      if (qError) throw qError;

      const quoteMap = new Map(
        (quotes ?? []).map((q) => [q.id, q])
      );

      return lineItems
        .filter((li) => li.image_url)
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

  const handleDownload = async (url: string, customerName: string) => {
    const safeName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const pathPart = url.split('/').pop()?.split('?')[0] || 'artwork.png';
    const extension = pathPart.includes('.') ? pathPart.split('.').pop() : 'png';
    const filename = `${safeName}_artwork.${extension}`;

    toast.info('Downloading...');

    try {
      const { data, error } = await supabase.functions.invoke('download-artwork', {
        body: { url, filename },
      });

      if (error) throw error;

      // data is the raw blob from the edge function
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success('Download started!');
    } catch {
      toast.error('Download failed — opening in new tab instead');
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="h-6 w-6" />
          Artwork Library
        </h1>
        <p className="text-muted-foreground">
          All customer artwork from quote submissions — {artworks.length} file{artworks.length !== 1 ? 's' : ''}
        </p>
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
          {filtered.map((art) => (
            <Card key={art.id} className="overflow-hidden group">
              <div className="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
                <img
                  src={art.image_url}
                  alt={`Artwork for ${art.customer_name}`}
                  className="max-h-full max-w-full object-contain p-3"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDownload(art.image_url, art.customer_name)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(art.image_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
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
          ))}
        </div>
      )}
    </div>
  );
}
