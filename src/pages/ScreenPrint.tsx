import { useState } from 'react';
import { useScreenPrintRecipes, ScreenPrintRecipe, PlatenSetup, InkColor } from '@/hooks/useScreenPrintRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Search, Trash2, Save, Printer, Star } from 'lucide-react';

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

export default function ScreenPrint() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useScreenPrintRecipes();
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<ScreenPrintRecipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Screen Print</h1>
          <p className="text-muted-foreground">ROQ P14XL auto press setup and recipes</p>
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
            <Printer className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No recipes yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first screen print recipe
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
                  <Badge variant={recipe.print_type === 'multi_rotation' ? 'default' : 'outline'}>
                    {recipe.print_type === 'multi_rotation' ? 'Multi-Rotation' : 'Single'}
                  </Badge>
                  {recipe.quality_rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: recipe.quality_rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                      ))}
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg">{recipe.name}</CardTitle>
                {recipe.customer_name && (
                  <CardDescription>{recipe.customer_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Flash:</span>{' '}
                    <span className="font-mono">{recipe.flash_temp ?? '—'}°F / {recipe.flash_time ?? '—'}s</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cure:</span>{' '}
                    <span className="font-mono">{recipe.cure_temp ?? '—'}°F / {recipe.cure_time ?? '—'}s</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Colors:</span>{' '}
                    <span>{recipe.ink_colors?.length ?? 0}</span>
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
  recipe: ScreenPrintRecipe | null;
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<ScreenPrintRecipe>) => Promise<any>;
  onUpdate: (data: Partial<ScreenPrintRecipe> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isNew: boolean;
}

function RecipeEditor({ recipe, open, onClose, onCreate, onUpdate, onDelete, isNew }: RecipeEditorProps) {
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [printType, setPrintType] = useState<'single' | 'multi_rotation'>('single');
  const [platenSetup, setPlatenSetup] = useState<PlatenSetup[]>([]);
  const [inkColors, setInkColors] = useState<InkColor[]>([]);
  const [flashTemp, setFlashTemp] = useState<number | undefined>();
  const [flashTime, setFlashTime] = useState<number | undefined>();
  const [cureTemp, setCureTemp] = useState<number | undefined>();
  const [cureTime, setCureTime] = useState<number | undefined>();
  const [qualityRating, setQualityRating] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when recipe changes
  useState(() => {
    if (recipe) {
      setName(recipe.name);
      setCustomerName(recipe.customer_name || '');
      setPrintType(recipe.print_type);
      setPlatenSetup(recipe.platen_setup || []);
      setInkColors(recipe.ink_colors || []);
      setFlashTemp(recipe.flash_temp ?? undefined);
      setFlashTime(recipe.flash_time ?? undefined);
      setCureTemp(recipe.cure_temp ?? undefined);
      setCureTime(recipe.cure_time ?? undefined);
      setQualityRating(recipe.quality_rating ?? undefined);
      setNotes(recipe.notes || '');
    } else {
      setName('');
      setCustomerName('');
      setPrintType('single');
      setPlatenSetup([]);
      setInkColors([]);
      setFlashTemp(undefined);
      setFlashTime(undefined);
      setCureTemp(undefined);
      setCureTime(undefined);
      setQualityRating(undefined);
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
        print_type: printType,
        platen_setup: platenSetup,
        ink_colors: inkColors,
        flash_temp: flashTemp,
        flash_time: flashTime,
        cure_temp: cureTemp,
        cure_time: cureTime,
        quality_rating: qualityRating,
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

  const togglePlaten = (position: number) => {
    setPlatenSetup(prev => {
      const existing = prev.find(p => p.position === position);
      if (existing) {
        return prev.map(p => p.position === position ? { ...p, active: !p.active } : p);
      }
      return [...prev, { position, active: true }];
    });
  };

  const addInkColor = () => {
    setInkColors(prev => [...prev, { color: '', type: 'Plastisol', mesh: 110 }]);
  };

  const updateInkColor = (index: number, field: keyof InkColor, value: string | number) => {
    setInkColors(prev => prev.map((ink, i) => i === index ? { ...ink, [field]: value } : ink));
  };

  const removeInkColor = (index: number) => {
    setInkColors(prev => prev.filter((_, i) => i !== index));
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
                placeholder="e.g., Team Jerseys - 3 Color"
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

            <div className="flex items-center justify-between">
              <Label>Multi-Rotation Print</Label>
              <Switch
                checked={printType === 'multi_rotation'}
                onCheckedChange={(checked) => setPrintType(checked ? 'multi_rotation' : 'single')}
              />
            </div>
          </div>

          <Tabs defaultValue="platens" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="platens">Platens</TabsTrigger>
              <TabsTrigger value="inks">Inks</TabsTrigger>
              <TabsTrigger value="temps">Temps</TabsTrigger>
            </TabsList>

            <TabsContent value="platens" className="space-y-3">
              <p className="text-sm text-muted-foreground">12-position platen layout (click to toggle active)</p>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((pos) => {
                  const platen = platenSetup.find(p => p.position === pos);
                  const isActive = platen?.active ?? false;
                  return (
                    <button
                      key={pos}
                      onClick={() => togglePlaten(pos)}
                      className={`p-3 rounded border text-center transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-muted/30 hover:bg-muted'
                      }`}
                    >
                      <div className="text-lg font-bold">{pos}</div>
                      <div className="text-xs">{isActive ? 'Active' : 'Off'}</div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="inks" className="space-y-3">
              {inkColors.map((ink, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Color</Label>
                    <Input
                      value={ink.color}
                      onChange={(e) => updateInkColor(i, 'color', e.target.value)}
                      placeholder="White"
                      className="mt-1"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Mesh</Label>
                    <Input
                      type="number"
                      value={ink.mesh}
                      onChange={(e) => updateInkColor(i, 'mesh', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeInkColor(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addInkColor}>
                <Plus className="mr-2 h-3 w-3" />
                Add Color
              </Button>
            </TabsContent>

            <TabsContent value="temps" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Flash Temp (°F)</Label>
                  <Input
                    type="number"
                    value={flashTemp ?? ''}
                    onChange={(e) => setFlashTemp(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Flash Time (s)</Label>
                  <Input
                    type="number"
                    value={flashTime ?? ''}
                    onChange={(e) => setFlashTime(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cure Temp (°F)</Label>
                  <Input
                    type="number"
                    value={cureTemp ?? ''}
                    onChange={(e) => setCureTemp(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cure Time (s)</Label>
                  <Input
                    type="number"
                    value={cureTime ?? ''}
                    onChange={(e) => setCureTime(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Quality Rating</Label>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setQualityRating(star)}
                      className="p-1"
                    >
                      <Star 
                        className={`h-6 w-6 ${
                          (qualityRating ?? 0) >= star 
                            ? 'fill-primary text-primary' 
                            : 'text-muted-foreground'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
