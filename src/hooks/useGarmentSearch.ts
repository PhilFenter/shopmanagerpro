import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProductCatalog, CatalogItem } from './useProductCatalog';
import { useToast } from './use-toast';

export interface GarmentSearchResult {
  source: 'catalog' | 'sanmar' | 'ss_activewear';
  style_number: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  colors: string[];
  sizes: string[];
  piece_price: number;
  case_price: number;
  image_url?: string;
}

export function useGarmentSearch() {
  const [results, setResults] = useState<GarmentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { searchCatalog } = useProductCatalog();
  const { toast } = useToast();

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const allResults: GarmentSearchResult[] = [];

    try {
      // 1. Local catalog search first (instant)
      const catalogItems = await searchCatalog(query);
      if (catalogItems.length > 0) {
        // Group by style_number + supplier
        const grouped = new Map<string, CatalogItem[]>();
        for (const item of catalogItems) {
          const key = `${item.style_number}|${item.supplier}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(item);
        }

        for (const [, items] of grouped) {
          const first = items[0];
          const colors = [...new Set(items.map(i => i.color_group).filter(Boolean) as string[])];
          const sizes = [...new Set(items.flatMap(i => i.size_range?.split(', ') || []).filter(Boolean))];
          
          allResults.push({
            source: first.supplier === 'sanmar' ? 'sanmar' : first.supplier === 'ss_activewear' ? 'ss_activewear' : 'catalog',
            style_number: first.style_number,
            description: first.description,
            brand: first.brand,
            category: first.category,
            colors,
            sizes,
            piece_price: first.piece_price,
            case_price: first.case_price,
          });
        }
      }

      // 2. If no local results, try SanMar API
      if (allResults.length === 0) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session) {
            const sanmarResp = await supabase.functions.invoke('sanmar-api', {
              body: { action: 'getProductInfo', styleNumber: query.toUpperCase().trim() },
            });

            if (sanmarResp.data?.success && sanmarResp.data?.items?.length > 0) {
              const items = sanmarResp.data.items;
              const first = items[0];
              const colors = [...new Set(items.map((i: any) => i.color).filter(Boolean))] as string[];
              const sizes = [...new Set(items.map((i: any) => i.size).filter(Boolean))] as string[];
              // Find the first image URL from any item
              const imageUrl = items.find((i: any) => i.thumbnailImage)?.thumbnailImage || undefined;
              
              allResults.push({
                source: 'sanmar',
                style_number: first.style || query.toUpperCase(),
                description: first.title || first.description,
                brand: first.brandName,
                category: first.category,
                colors,
                sizes,
                piece_price: 0, // Will be fetched with pricing action
                case_price: 0,
                image_url: imageUrl,
              });

              // Also fetch pricing
              try {
                const pricingResp = await supabase.functions.invoke('sanmar-api', {
                  body: { action: 'getPricing', styleNumber: query.toUpperCase().trim() },
                });
                if (pricingResp.data?.success && pricingResp.data?.pricing?.length > 0) {
                  const pricing = pricingResp.data.pricing;
                  // Use the first pricing entry as representative
                  allResults[allResults.length - 1].piece_price = pricing[0].piecePrice || pricing[0].myPrice || 0;
                  allResults[allResults.length - 1].case_price = pricing[0].casePrice || 0;
                }
              } catch { /* pricing is optional */ }
            }
          }
        } catch (e) {
          console.log('SanMar search failed, trying S&S:', e);
        }
      }

      // 3. If still no results, try S&S Activewear
      if (allResults.length === 0) {
        try {
          const ssResp = await supabase.functions.invoke('ss-activewear-api', {
            body: { action: 'getProducts', styleNumber: query.toUpperCase().trim() },
          });

          if (ssResp.data?.success && ssResp.data?.products?.length > 0) {
            const products = ssResp.data.products;
            const styleInfo = ssResp.data.styleInfo;
            const colors = [...new Set(products.map((p: any) => p.colorName || p.color1).filter(Boolean))] as string[];
            const sizes = [...new Set(products.map((p: any) => p.sizeName || p.size).filter(Boolean))] as string[];
            
            allResults.push({
              source: 'ss_activewear',
              style_number: styleInfo?.partNumber || styleInfo?.styleName || query.toUpperCase(),
              description: styleInfo?.title || styleInfo?.styleName || products[0]?.title,
              brand: styleInfo?.brandName || products[0]?.brandName,
              category: styleInfo?.categoryName || null,
              colors,
              sizes,
              piece_price: parseFloat(products[0]?.customerPrice || products[0]?.piecePrice) || 0,
              case_price: parseFloat(products[0]?.casePrice) || 0,
              image_url: products[0]?.colorFrontImage || products[0]?.styleImage || undefined,
            });
          }
        } catch (e) {
          console.log('S&S search failed:', e);
        }
      }
    } catch (error) {
      console.error('Garment search error:', error);
      toast({
        variant: 'destructive',
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setResults(allResults);
    setIsSearching(false);
  }, [searchCatalog, toast]);

  return { results, isSearching, search, clearResults: () => setResults([]) };
}
