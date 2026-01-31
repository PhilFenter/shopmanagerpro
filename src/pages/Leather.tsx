import { useState } from 'react';
import { useLeatherRecipes, LEATHER_MATERIALS, LeatherRecipe } from '@/hooks/useLeatherRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Trash2, Save, Zap } from 'lucide-react';

export default function Leather() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useLeatherRecipes();
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<LeatherRecipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leather Patches</h1>
          <p className="text-muted-foreground">Trotec laser settings and recipes</p>
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
            <Zap className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No recipes yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first leather patch recipe
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
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {LEATHER_MATERIALS.find(m => m.value === recipe.material_type)?.label || recipe.material_type}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{recipe.name}</CardTitle>
                {recipe.customer_name && (
                  <CardDescription>{recipe.customer_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Power:</span>{' '}
                    <span className="font-mono">{recipe.laser_power ?? '—'}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Speed:</span>{' '}
                    <span className="font-mono">{recipe.laser_speed ?? '—'}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Freq:</span>{' '}
                    <span className="font-mono">{recipe.laser_frequency ?? '—'} Hz</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Passes:</span>{' '}
                    <span className="font-mono">{recipe.passes}</span>
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
  recipe: LeatherRecipe | null;
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<LeatherRecipe>) => Promise<any>;
  onUpdate: (data: Partial<LeatherRecipe> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isNew: boolean;
}

function RecipeEditor({ recipe, open, onClose, onCreate, onUpdate, onDelete, isNew }: RecipeEditorProps) {
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [materialType, setMaterialType] = useState('chestnut_natural');
  const [power, setPower] = useState(50);
  const [speed, setSpeed] = useState(50);
  const [frequency, setFrequency] = useState(1000);
  const [passes, setPasses] = useState(1);
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [costPerPiece, setCostPerPiece] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when recipe changes
  useState(() => {
    if (recipe) {
      setName(recipe.name);
      setCustomerName(recipe.customer_name || '');
      setMaterialType(recipe.material_type);
      setPower(recipe.laser_power ?? 50);
      setSpeed(recipe.laser_speed ?? 50);
      setFrequency(recipe.laser_frequency ?? 1000);
      setPasses(recipe.passes);
      setWidth(recipe.patch_width ?? undefined);
      setHeight(recipe.patch_height ?? undefined);
      setCostPerPiece(recipe.material_cost_per_piece ?? undefined);
      setNotes(recipe.notes || '');
    } else {
      setName('');
      setCustomerName('');
      setMaterialType('chestnut_natural');
      setPower(50);
      setSpeed(50);
      setFrequency(1000);
      setPasses(1);
      setWidth(undefined);
      setHeight(undefined);
      setCostPerPiece(undefined);
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
        material_type: materialType,
        laser_power: power,
        laser_speed: speed,
        laser_frequency: frequency,
        passes,
        patch_width: width,
        patch_height: height,
        material_cost_per_piece: costPerPiece,
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
                placeholder="e.g., Hat Patch - Dark Burn"
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

            <div>
              <Label>Material Type</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEATHER_MATERIALS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Laser Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Laser Settings
            </h4>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <Label>Power</Label>
                <span className="font-mono">{power}%</span>
              </div>
              <Slider
                value={[power]}
                onValueChange={([v]) => setPower(v)}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <Label>Speed</Label>
                <span className="font-mono">{speed}%</span>
              </div>
              <Slider
                value={[speed]}
                onValueChange={([v]) => setSpeed(v)}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency (Hz)</Label>
                <Input
                  type="number"
                  value={frequency}
                  onChange={(e) => setFrequency(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Passes</Label>
                <Input
                  type="number"
                  min={1}
                  value={passes}
                  onChange={(e) => setPasses(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Dimensions & Cost */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Dimensions & Cost</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Width (in)</Label>
                <Input
                  type="number"
                  step="0.125"
                  value={width ?? ''}
                  onChange={(e) => setWidth(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="2.5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Height (in)</Label>
                <Input
                  type="number"
                  step="0.125"
                  value={height ?? ''}
                  onChange={(e) => setHeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="2.5"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Material Cost/Piece ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={costPerPiece ?? ''}
                onChange={(e) => setCostPerPiece(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.75"
                className="mt-1"
              />
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
