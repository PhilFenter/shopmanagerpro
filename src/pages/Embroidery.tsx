import { useState } from 'react';
import { useEmbroideryRecipes, EmbroideryRecipe, NeedleSetup } from '@/hooks/useEmbroideryRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Trash2, Save, Scissors } from 'lucide-react';

const HOOP_SIZES = ['4x4', '5x7', '6x10', '8x12', 'Cap', 'Hat Side', 'Custom'];
const PLACEMENTS = ['Left Chest', 'Right Chest', 'Full Back', 'Upper Back', 'Cap Front', 'Cap Side', 'Sleeve', 'Custom'];

export default function Embroidery() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useEmbroideryRecipes();
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<EmbroideryRecipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Embroidery</h1>
          <p className="text-muted-foreground">Barudan 15-needle setup and recipes</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Recipe
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scissors className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No recipes yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first embroidery recipe
            </p>
            <Button className="mt-4" onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Recipe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <Card 
              key={recipe.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {recipe.hoop_size && <Badge variant="outline">{recipe.hoop_size}</Badge>}
                  {recipe.placement && <Badge variant="secondary">{recipe.placement}</Badge>}
                </div>
                <CardTitle className="text-lg">{recipe.name}</CardTitle>
                {recipe.customer_name && (
                  <CardDescription>{recipe.customer_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {recipe.stitch_count && (
                    <div>
                      <span className="text-muted-foreground">Stitches:</span>{' '}
                      <span className="font-mono">{recipe.stitch_count.toLocaleString()}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Needles:</span>{' '}
                    <span className="font-mono">{recipe.needle_setup?.length || 0} assigned</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recipe Editor Sheet */}
      <RecipeEditor
        recipe={selectedRecipe}
        open={!!selectedRecipe || isCreating}
        onClose={() => {
          setSelectedRecipe(null);
          setIsCreating(false);
        }}
        onCreate={createRecipe.mutateAsync}
        onUpdate={updateRecipe.mutateAsync}
        onDelete={deleteRecipe.mutateAsync}
        isNew={isCreating}
      />
    </div>
  );
}

interface RecipeEditorProps {
  recipe: EmbroideryRecipe | null;
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<EmbroideryRecipe>) => Promise<any>;
  onUpdate: (data: Partial<EmbroideryRecipe> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isNew: boolean;
}

function RecipeEditor({ recipe, open, onClose, onCreate, onUpdate, onDelete, isNew }: RecipeEditorProps) {
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [hoopSize, setHoopSize] = useState('');
  const [placement, setPlacement] = useState('');
  const [stitchCount, setStitchCount] = useState<number | undefined>();
  const [designFile, setDesignFile] = useState('');
  const [needleSetup, setNeedleSetup] = useState<NeedleSetup[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when recipe changes
  useState(() => {
    if (recipe) {
      setName(recipe.name);
      setCustomerName(recipe.customer_name || '');
      setHoopSize(recipe.hoop_size || '');
      setPlacement(recipe.placement || '');
      setStitchCount(recipe.stitch_count ?? undefined);
      setDesignFile(recipe.design_file || '');
      setNeedleSetup(recipe.needle_setup || []);
      setNotes(recipe.notes || '');
    } else {
      setName('');
      setCustomerName('');
      setHoopSize('');
      setPlacement('');
      setStitchCount(undefined);
      setDesignFile('');
      setNeedleSetup([]);
      setNotes('');
    }
  });

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      const data = {
        name: name.trim(),
        customer_name: customerName.trim() || null,
        hoop_size: hoopSize || null,
        placement: placement || null,
        stitch_count: stitchCount,
        design_file: designFile.trim() || null,
        needle_setup: needleSetup,
        notes: notes.trim() || null,
      };

      if (recipe) {
        await onUpdate({ id: recipe.id, ...data });
      } else {
        await onCreate(data);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    if (confirm('Delete this recipe?')) {
      await onDelete(recipe.id);
      onClose();
    }
  };

  const updateNeedle = (position: number, field: 'thread_color' | 'thread_number', value: string) => {
    setNeedleSetup(prev => {
      const existing = prev.find(n => n.position === position);
      if (existing) {
        return prev.map(n => n.position === position ? { ...n, [field]: value } : n);
      }
      return [...prev, { position, thread_color: '', thread_number: '', [field]: value }];
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? 'New Recipe' : 'Edit Recipe'}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Recipe Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Company Logo - Left Chest"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Customer</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hoop Size</Label>
                <Select value={hoopSize} onValueChange={setHoopSize}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOP_SIZES.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placement</Label>
                <Select value={placement} onValueChange={setPlacement}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stitch Count</Label>
                <Input
                  type="number"
                  value={stitchCount ?? ''}
                  onChange={(e) => setStitchCount(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="12500"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Design File</Label>
                <Input
                  value={designFile}
                  onChange={(e) => setDesignFile(e.target.value)}
                  placeholder="filename.dst"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 15-Needle Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Needle Setup (Madeira Thread)
            </h4>
            
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((pos) => {
                const needle = needleSetup.find(n => n.position === pos);
                return (
                  <div key={pos} className="p-2 rounded border bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Needle {pos}
                    </div>
                    <Input
                      value={needle?.thread_color || ''}
                      onChange={(e) => updateNeedle(pos, 'thread_color', e.target.value)}
                      placeholder="Color"
                      className="h-7 text-xs mb-1"
                    />
                    <Input
                      value={needle?.thread_number || ''}
                      onChange={(e) => updateNeedle(pos, 'thread_number', e.target.value)}
                      placeholder="#"
                      className="h-7 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special handling, tips, etc."
              className="mt-1 resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {recipe && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button className="flex-1" onClick={handleSave} disabled={!name.trim() || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Recipe
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
