import { useState } from 'react';
import { useDTFRecipes, FABRIC_TYPES, PRESSURE_OPTIONS, PEEL_OPTIONS, DTFRecipe } from '@/hooks/useDTFRecipes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Trash2, Save, Thermometer } from 'lucide-react';

export default function DTF() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useDTFRecipes();
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<DTFRecipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DTF Transfers</h1>
          <p className="text-muted-foreground">Heat press settings by fabric type</p>
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
            <Thermometer className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No recipes yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first DTF heat press recipe
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
                    {FABRIC_TYPES.find(f => f.value === recipe.fabric_type)?.label || recipe.fabric_type}
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
                    <span className="text-muted-foreground">Temp:</span>{' '}
                    <span className="font-mono">{recipe.press_temp ?? '—'}°F</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>{' '}
                    <span className="font-mono">{recipe.press_time ?? '—'}s</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pressure:</span>{' '}
                    <span className="capitalize">{recipe.press_pressure ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peel:</span>{' '}
                    <span className="capitalize">{recipe.peel_type ?? '—'}</span>
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
  recipe: DTFRecipe | null;
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<DTFRecipe>) => Promise<any>;
  onUpdate: (data: Partial<DTFRecipe> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isNew: boolean;
}

function RecipeEditor({ recipe, open, onClose, onCreate, onUpdate, onDelete, isNew }: RecipeEditorProps) {
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [fabricType, setFabricType] = useState('cotton');
  const [temp, setTemp] = useState(320);
  const [time, setTime] = useState(15);
  const [pressure, setPressure] = useState('medium');
  const [peel, setPeel] = useState('warm');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when recipe changes
  useState(() => {
    if (recipe) {
      setName(recipe.name);
      setCustomerName(recipe.customer_name || '');
      setFabricType(recipe.fabric_type);
      setTemp(recipe.press_temp ?? 320);
      setTime(recipe.press_time ?? 15);
      setPressure(recipe.press_pressure ?? 'medium');
      setPeel(recipe.peel_type ?? 'warm');
      setNotes(recipe.notes || '');
    } else {
      setName('');
      setCustomerName('');
      setFabricType('cotton');
      setTemp(320);
      setTime(15);
      setPressure('medium');
      setPeel('warm');
      setNotes('');
    }
  });

  // Auto-fill defaults when fabric type changes
  const handleFabricChange = (value: string) => {
    setFabricType(value);
    const fabric = FABRIC_TYPES.find(f => f.value === value);
    if (fabric && !recipe) {
      setTemp(fabric.defaults.temp);
      setTime(fabric.defaults.time);
      setPressure(fabric.defaults.pressure);
      setPeel(fabric.defaults.peel);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      const data = {
        name: name.trim(),
        customer_name: customerName.trim() || null,
        fabric_type: fabricType,
        press_temp: temp,
        press_time: time,
        press_pressure: pressure,
        peel_type: peel,
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
                placeholder="e.g., Standard Cotton Tee"
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
              <Label>Fabric Type</Label>
              <Select value={fabricType} onValueChange={handleFabricChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FABRIC_TYPES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Press Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Heat Press Settings
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Temperature (°F)</Label>
                <Input
                  type="number"
                  value={temp}
                  onChange={(e) => setTemp(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time (seconds)</Label>
                <Input
                  type="number"
                  value={time}
                  onChange={(e) => setTime(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pressure</Label>
                <Select value={pressure} onValueChange={setPressure}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESSURE_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Peel Type</Label>
                <Select value={peel} onValueChange={setPeel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEEL_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
