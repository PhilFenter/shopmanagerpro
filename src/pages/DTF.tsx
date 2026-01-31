import { useState, useEffect } from 'react';
import { useDTFRecipes, FABRIC_TYPES, PRESSURE_OPTIONS, PEEL_OPTIONS, DTFRecipe } from '@/hooks/useDTFRecipes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Plus, Loader2, Search, Trash2, Save, Thermometer, RotateCcw, Clock, Gauge, Flame, Camera, X, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ProductionPhotos, { PhotoSlot } from '@/components/production/ProductionPhotos';
import { JobPicker } from '@/components/jobs/JobPicker';

// Garment types for DTF
const GARMENT_TYPES = [
  'T-Shirt',
  'Hoodie',
  'Sweatshirt',
  'Tank Top',
  'Long Sleeve',
  'Polo',
  'Jacket',
  'Bag/Tote',
  'Hat/Cap',
  'Other',
];

// Transfer sizes
const TRANSFER_SIZES = [
  { value: 'gang_sheet', label: 'Gang Sheet (22x24)' },
  { value: 'left_chest', label: 'Left Chest (4x4)' },
  { value: 'full_front', label: 'Full Front (12x12)' },
  { value: 'full_back', label: 'Full Back (12x14)' },
  { value: 'sleeve', label: 'Sleeve (3x10)' },
  { value: 'pocket', label: 'Pocket (3x3)' },
  { value: 'oversized', label: 'Oversized (14x16)' },
  { value: 'custom', label: 'Custom Size' },
];

export default function DTF() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useDTFRecipes();
  const [activeTab, setActiveTab] = useState<'new-job' | 'saved'>('new-job');
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  // Job form state
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState(() => 'DTF-' + Date.now().toString().slice(-6));
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [garmentType, setGarmentType] = useState('');
  const [garmentColor, setGarmentColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Fabric & Transfer settings
  const [fabricType, setFabricType] = useState('cotton');
  const [transferSize, setTransferSize] = useState('');
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);

  // Press settings
  const [pressTemp, setPressTemp] = useState(320);
  const [pressTime, setPressTime] = useState(15);
  const [pressure, setPressure] = useState('medium');
  const [peelType, setPeelType] = useState('warm');

  // Pre-press & cover sheet
  const [prePress, setPrePress] = useState(true);
  const [prePressTime, setPrePressTime] = useState(3);
  const [coverSheet, setCoverSheet] = useState(true);
  const [secondPress, setSecondPress] = useState(false);
  const [secondPressTime, setSecondPressTime] = useState(5);

  // Quality & notes
  const [qualityRating, setQualityRating] = useState(0);
  const [notes, setNotes] = useState('');

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { location: 'Transfer', file: null, preview: '' },
    { location: 'Placement', file: null, preview: '' },
    { location: 'After Press', file: null, preview: '' },
    { location: 'Final Product', file: null, preview: '' },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Filter saved recipes
  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Load fabric defaults
  const loadFabricDefaults = (value: string) => {
    setFabricType(value);
    const fabric = FABRIC_TYPES.find((f) => f.value === value);
    if (fabric) {
      setPressTemp(fabric.defaults.temp);
      setPressTime(fabric.defaults.time);
      setPressure(fabric.defaults.pressure);
      setPeelType(fabric.defaults.peel);
    }
  };

  // Clear form
  const clearForm = () => {
    setLinkedJobId(null);
    setRecipeName('DTF-' + Date.now().toString().slice(-6));
    setCustomer('');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setGarmentType('');
    setGarmentColor('');
    setQuantity(1);
    setFabricType('cotton');
    setTransferSize('');
    setCustomWidth(null);
    setCustomHeight(null);
    loadFabricDefaults('cotton');
    setPrePress(true);
    setPrePressTime(3);
    setCoverSheet(true);
    setSecondPress(false);
    setSecondPressTime(5);
    setQualityRating(0);
    setNotes('');
    setPhotos([
      { location: 'Transfer', file: null, preview: '' },
      { location: 'Placement', file: null, preview: '' },
      { location: 'After Press', file: null, preview: '' },
      { location: 'Final Product', file: null, preview: '' },
    ]);
    setEditingRecipeId(null);
  };

  // Load recipe for editing
  const loadRecipe = (recipe: DTFRecipe) => {
    setEditingRecipeId(recipe.id);
    setLinkedJobId(recipe.job_id);
    setRecipeName(recipe.name);
    setCustomer(recipe.customer_name || '');
    setFabricType(recipe.fabric_type);
    setPressTemp(recipe.press_temp ?? 320);
    setPressTime(recipe.press_time ?? 15);
    setPressure(recipe.press_pressure ?? 'medium');
    setPeelType(recipe.peel_type ?? 'warm');
    setNotes(recipe.notes || '');
    setActiveTab('new-job');
  };

  // Save recipe
  const handleSave = async () => {
    if (!recipeName.trim()) return;

    setIsSaving(true);
    try {
      const data = {
        name: recipeName.trim(),
        customer_name: customer.trim() || null,
        fabric_type: fabricType,
        press_temp: pressTemp,
        press_time: pressTime,
        press_pressure: pressure,
        peel_type: peelType,
        notes: notes.trim() || null,
        job_id: linkedJobId,
      };

      if (editingRecipeId) {
        await updateRecipe.mutateAsync({ id: editingRecipeId, ...data });
      } else {
        await createRecipe.mutateAsync(data);
      }
      clearForm();
    } finally {
      setIsSaving(false);
    }
  };

  // Delete recipe
  const handleDelete = async (id: string) => {
    if (confirm('Delete this job setup?')) {
      await deleteRecipe.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DTF Transfers</h1>
          <p className="text-muted-foreground">Heat press settings by fabric type</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new-job">
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Search className="mr-2 h-4 w-4" />
            Saved Jobs
          </TabsTrigger>
        </TabsList>

        {/* NEW JOB TAB */}
        <TabsContent value="new-job" className="space-y-6 pt-4">
          {/* Job Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Link */}
              <JobPicker
                value={linkedJobId}
                onChange={(id, info) => {
                  setLinkedJobId(id);
                  if (info) {
                    setCustomer(info.customer);
                    if (info.orderNumber) setRecipeName(`DTF-${info.orderNumber}`);
                  }
                }}
              />
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Recipe Name</Label>
                  <Input
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="DTF-001"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Customer</Label>
                  <Input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Customer name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Garment Type</Label>
                  <Select value={garmentType} onValueChange={setGarmentType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select garment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GARMENT_TYPES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Garment Color</Label>
                  <Input
                    value={garmentColor}
                    onChange={(e) => setGarmentColor(e.target.value)}
                    placeholder="e.g., Black, Navy"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Transfer Size</Label>
                  <Select value={transferSize} onValueChange={setTransferSize}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select size..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_SIZES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {transferSize === 'custom' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Width (inches)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={customWidth ?? ''}
                      onChange={(e) => setCustomWidth(parseFloat(e.target.value) || null)}
                      placeholder="Width"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Height (inches)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={customHeight ?? ''}
                      onChange={(e) => setCustomHeight(parseFloat(e.target.value) || null)}
                      placeholder="Height"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fabric Type & Press Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Press Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fabric Type Quick Select */}
              <div>
                <Label className="mb-3 block">Fabric Type (auto-fills settings)</Label>
                <div className="flex flex-wrap gap-2">
                  {FABRIC_TYPES.map((f) => (
                    <Button
                      key={f.value}
                      type="button"
                      variant={fabricType === f.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => loadFabricDefaults(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Temperature Slider */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <Label className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Temperature
                  </Label>
                  <span className="font-mono text-lg font-bold">{pressTemp}°F</span>
                </div>
                <Slider
                  value={[pressTemp]}
                  onValueChange={([v]) => setPressTemp(v)}
                  min={250}
                  max={400}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>250°F</span>
                  <span>400°F</span>
                </div>
              </div>

              {/* Time Slider */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Press Time
                  </Label>
                  <span className="font-mono text-lg font-bold">{pressTime}s</span>
                </div>
                <Slider
                  value={[pressTime]}
                  onValueChange={([v]) => setPressTime(v)}
                  min={5}
                  max={30}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>5s</span>
                  <span>30s</span>
                </div>
              </div>

              {/* Pressure & Peel */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4" />
                    Pressure
                  </Label>
                  <div className="flex gap-2">
                    {PRESSURE_OPTIONS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={pressure === p ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 capitalize"
                        onClick={() => setPressure(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Peel Type</Label>
                  <div className="flex gap-2">
                    {PEEL_OPTIONS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={peelType === p ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 capitalize"
                        onClick={() => setPeelType(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                {/* Pre-Press */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Pre-Press</Label>
                    <Button
                      type="button"
                      variant={prePress ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrePress(!prePress)}
                    >
                      {prePress ? 'On' : 'Off'}
                    </Button>
                  </div>
                  {prePress && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Label className="text-sm text-muted-foreground">Duration:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={prePressTime}
                        onChange={(e) => setPrePressTime(parseInt(e.target.value) || 3)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  )}
                </div>

                {/* Cover Sheet */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Cover Sheet</Label>
                    <Button
                      type="button"
                      variant={coverSheet ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCoverSheet(!coverSheet)}
                    >
                      {coverSheet ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use protective sheet during press
                  </p>
                </div>

                {/* Second Press */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">2nd Press</Label>
                    <Button
                      type="button"
                      variant={secondPress ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSecondPress(!secondPress)}
                    >
                      {secondPress ? 'On' : 'Off'}
                    </Button>
                  </div>
                  {secondPress && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Label className="text-sm text-muted-foreground">Duration:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={15}
                        value={secondPressTime}
                        onChange={(e) => setSecondPressTime(parseInt(e.target.value) || 5)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quality Rating & Notes */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quality & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Quality Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setQualityRating(star === qualityRating ? 0 : star)}
                      className="text-2xl transition-transform active:scale-90"
                    >
                      {star <= qualityRating ? (
                        <Star className="h-8 w-8 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <Star className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Production notes, special handling, wash instructions..."
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Production Photos */}
          <ProductionPhotos
            photos={photos}
            onPhotosChange={setPhotos}
            slots={4}
            fixedLabels={['Transfer', 'Placement', 'After Press', 'Final Product']}
          />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={clearForm}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Form
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {editingRecipeId ? 'Update Job' : 'Save Job'}
            </Button>
          </div>
        </TabsContent>

        {/* SAVED JOBS TAB */}
        <TabsContent value="saved" className="space-y-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Thermometer className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No saved jobs yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a job setup and save it
                </p>
                <Button className="mt-4" onClick={() => setActiveTab('new-job')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecipes.map((recipe) => (
                <Card
                  key={recipe.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => loadRecipe(recipe)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {FABRIC_TYPES.find((f) => f.value === recipe.fabric_type)?.label ||
                          recipe.fabric_type}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(recipe.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <CardTitle className="text-lg">{recipe.name}</CardTitle>
                    {recipe.customer_name && (
                      <p className="text-sm text-muted-foreground">{recipe.customer_name}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-500" />
                        <span className="font-mono">{recipe.press_temp ?? '—'}°F</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-500" />
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
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(recipe.updated_at), 'MMM d, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
