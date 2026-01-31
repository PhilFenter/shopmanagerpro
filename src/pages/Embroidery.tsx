import { useState, useEffect } from 'react';
import { useEmbroideryRecipes, EmbroideryRecipe, NeedleSetup } from '@/hooks/useEmbroideryRecipes';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, Trash2, Save, Scissors, RotateCcw, Camera, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Item types and their placements
const ITEM_TYPES = [
  { value: 'hat', label: 'Hat/Cap' },
  { value: 'shirt', label: 'Shirt' },
  { value: 'polo', label: 'Polo' },
  { value: 'jacket', label: 'Jacket' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'bag', label: 'Bag' },
  { value: 'other', label: 'Other' },
];

const PLACEMENTS: Record<string, string[]> = {
  hat: ['Center', 'Left Panel', 'Right Panel', 'Back', 'Side Left', 'Side Right'],
  shirt: ['Left Chest', 'Right Chest', 'Center', 'Full Back', 'Upper Back', 'Sleeve'],
  polo: ['Left Chest', 'Right Chest', 'Center', 'Full Back', 'Upper Back', 'Sleeve'],
  jacket: ['Left Chest', 'Right Chest', 'Center', 'Full Back', 'Upper Back', 'Sleeve'],
  hoodie: ['Left Chest', 'Right Chest', 'Center', 'Full Back', 'Upper Back', 'Sleeve', 'Hood'],
  bag: ['Front Center', 'Front Pocket', 'Side'],
  other: ['Custom'],
};

const HOOP_SIZES = [
  { brand: 'Barudan', name: '12mm', size: '12mm', type: 'flat' },
  { brand: 'Barudan', name: '15mm', size: '15mm', type: 'flat' },
  { brand: 'Barudan', name: 'Cap Hoop', size: 'Cap', type: 'cap' },
  { brand: 'Mighty Hoop', name: '5.5"', size: '5.5 inch', type: 'flat' },
  { brand: 'Mighty Hoop', name: '12x15"', size: '12x15 inch', type: 'flat' },
  { brand: 'HoopTech', name: 'Pocket', size: 'Pocket', type: 'pocket' },
  { brand: 'HoopTech', name: 'Hat Back', size: 'Hat Back', type: 'cap' },
];

const BACKING_TYPES = ['Tearaway', 'Cutaway', 'No-Show Mesh', 'Water Soluble', 'Sticky Back'];

const THREAD_WEIGHTS = ['40', '60'];
const THREAD_BRANDS = ['Madeira', 'Gutermann', 'Isacord', 'Robison-Anton', 'Other'];

interface PhotoSlot {
  location: string;
  file: File | null;
  preview: string;
}

export default function Embroidery() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useEmbroideryRecipes();
  const { teamMembers } = useTeamMembers();
  const [activeTab, setActiveTab] = useState<'new-job' | 'saved' | 'inventory' | 'hoops'>('new-job');
  const [search, setSearch] = useState('');

  // Job form state
  const [jobId, setJobId] = useState(() => 'EMB-' + Date.now().toString().slice(-6));
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [designFile, setDesignFile] = useState('');
  const [itemType, setItemType] = useState('');
  const [placement, setPlacement] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [stitchCount, setStitchCount] = useState<number | null>(null);
  const [speed, setSpeed] = useState(800);
  const [hoopType, setHoopType] = useState('');
  const [backing, setBacking] = useState('');
  const [notes, setNotes] = useState('');

  // 15-needle setup
  const [needles, setNeedles] = useState<Record<number, { color: string; number: string; weight: string }>>(() => {
    const initial: Record<number, { color: string; number: string; weight: string }> = {};
    for (let i = 1; i <= 15; i++) {
      initial[i] = { color: '', number: '', weight: '40' };
    }
    return initial;
  });

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { location: 'Product', file: null, preview: '' },
    { location: 'Setup', file: null, preview: '' },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Filter saved recipes
  const filteredRecipes = recipes.filter(r =>
    !search || 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Update needle
  const updateNeedle = (pos: number, field: 'color' | 'number' | 'weight', value: string) => {
    setNeedles(prev => ({
      ...prev,
      [pos]: { ...prev[pos], [field]: value }
    }));
  };

  // Handle photo upload
  const handlePhotoUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotos(prev => prev.map((p, i) => 
        i === index ? { ...p, file, preview: e.target?.result as string } : p
      ));
    };
    reader.readAsDataURL(file);
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.map((p, i) => 
      i === index ? { ...p, file: null, preview: '' } : p
    ));
  };

  // Clear form
  const clearForm = () => {
    setJobId('EMB-' + Date.now().toString().slice(-6));
    setCustomer('');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setDesignFile('');
    setItemType('');
    setPlacement('');
    setQuantity(1);
    setStitchCount(null);
    setSpeed(800);
    setHoopType('');
    setBacking('');
    setNotes('');
    
    const initial: Record<number, { color: string; number: string; weight: string }> = {};
    for (let i = 1; i <= 15; i++) {
      initial[i] = { color: '', number: '', weight: '40' };
    }
    setNeedles(initial);
    
    setPhotos([
      { location: 'Product', file: null, preview: '' },
      { location: 'Setup', file: null, preview: '' },
    ]);
    setEditingRecipeId(null);
  };

  // Save job
  const handleSave = async () => {
    if (!customer.trim()) {
      alert('Please enter customer name');
      return;
    }

    setIsSaving(true);
    try {
      // Build needle setup from form
      const needleSetup: NeedleSetup[] = Object.entries(needles)
        .filter(([_, data]) => data.color || data.number)
        .map(([pos, data]) => ({
          position: parseInt(pos),
          thread_color: data.color,
          thread_number: data.number,
        }));

      const recipeData: any = {
        name: customer + ' - ' + (placement || itemType || 'Embroidery'),
        customer_name: customer,
        needle_setup: needleSetup,
        hoop_size: hoopType,
        placement: placement,
        stitch_count: stitchCount,
        design_file: designFile,
        notes: `Item: ${itemType}\nBacking: ${backing}\nSpeed: ${speed}\nQuantity: ${quantity}\n\n${notes}`,
      };

      if (editingRecipeId) {
        await updateRecipe.mutateAsync({ id: editingRecipeId, ...recipeData });
      } else {
        await createRecipe.mutateAsync(recipeData);
      }
      
      clearForm();
      setActiveTab('saved');
    } finally {
      setIsSaving(false);
    }
  };

  // Load recipe for reorder
  const loadRecipe = (recipe: EmbroideryRecipe) => {
    setJobId(recipe.id.slice(0, 10) + '-REORDER');
    setCustomer(recipe.customer_name || '');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setDesignFile(recipe.design_file || '');
    setPlacement(recipe.placement || '');
    setStitchCount(recipe.stitch_count);
    setHoopType(recipe.hoop_size || '');
    setNotes(recipe.notes || '');
    setEditingRecipeId(recipe.id);

    // Load needle setup
    const newNeedles: Record<number, { color: string; number: string; weight: string }> = {};
    for (let i = 1; i <= 15; i++) {
      const saved = recipe.needle_setup?.find(n => n.position === i);
      newNeedles[i] = {
        color: saved?.thread_color || '',
        number: saved?.thread_number || '',
        weight: '40',
      };
    }
    setNeedles(newNeedles);

    setActiveTab('new-job');
  };

  // Delete recipe
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved job?')) return;
    await deleteRecipe.mutateAsync(id);
  };

  // Count assigned needles
  const assignedNeedles = Object.values(needles).filter(n => n.color || n.number).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Embroidery</h1>
          <p className="text-muted-foreground">Barudan 15-Needle Setup & Recipes</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="new-job">New Job</TabsTrigger>
          <TabsTrigger value="saved">Saved Jobs</TabsTrigger>
          <TabsTrigger value="inventory">Thread Inventory</TabsTrigger>
          <TabsTrigger value="hoops">Hoops</TabsTrigger>
        </TabsList>

        {/* NEW JOB TAB */}
        <TabsContent value="new-job" className="space-y-6">
          {/* Job Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Job ID:</Label>
                  <Input value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Customer Name: *</Label>
                  <Input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Enter customer name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Order Date:</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Design File:</Label>
                  <Input
                    value={designFile}
                    onChange={(e) => setDesignFile(e.target.value)}
                    placeholder="filename.dst"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item & Placement */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Item & Placement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Item Type:</Label>
                  <Select value={itemType} onValueChange={(v) => { setItemType(v); setPlacement(''); }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Stitch Count:</Label>
                  <Input
                    type="number"
                    value={stitchCount ?? ''}
                    onChange={(e) => setStitchCount(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="12500"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Speed (SPM):</Label>
                  <Input
                    type="number"
                    value={speed}
                    onChange={(e) => setSpeed(parseInt(e.target.value) || 800)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Placement Options */}
              {itemType && PLACEMENTS[itemType] && (
                <div>
                  <Label className="mb-2 block">Placement:</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PLACEMENTS[itemType].map(p => (
                      <Button
                        key={p}
                        type="button"
                        variant={placement === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPlacement(p)}
                        className="text-xs"
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Hoop Type:</Label>
                  <Select value={hoopType} onValueChange={setHoopType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select hoop" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOOP_SIZES.map(h => (
                        <SelectItem key={h.name} value={h.name}>
                          {h.brand} {h.name} ({h.size})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Backing:</Label>
                  <Select value={backing} onValueChange={setBacking}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select backing" />
                    </SelectTrigger>
                    <SelectContent>
                      {BACKING_TYPES.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 15-Needle Setup */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                15-Needle Thread Setup (Madeira)
                <Badge variant="secondary" className="ml-2">{assignedNeedles} assigned</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 15 }, (_, i) => i + 1).map(pos => {
                  const needle = needles[pos];
                  const hasData = needle.color || needle.number;
                  return (
                    <div
                      key={pos}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-colors',
                        hasData ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-muted'
                      )}
                    >
                      <div className="text-xs font-bold text-muted-foreground mb-2">
                        Needle {pos}
                      </div>
                      <Input
                        value={needle.number}
                        onChange={(e) => updateNeedle(pos, 'number', e.target.value)}
                        placeholder="Thread #"
                        className="h-8 text-xs mb-1"
                      />
                      <Input
                        value={needle.color}
                        onChange={(e) => updateNeedle(pos, 'color', e.target.value)}
                        placeholder="Color name"
                        className="h-8 text-xs mb-1"
                      />
                      <Select
                        value={needle.weight}
                        onValueChange={(v) => updateNeedle(pos, 'weight', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THREAD_WEIGHTS.map(w => (
                            <SelectItem key={w} value={w}>{w}wt</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Production Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special handling instructions, tips for next run..."
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Photos - Mobile Friendly Camera Buttons */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Production Photos
              </CardTitle>
              <p className="text-sm text-muted-foreground">Tap camera to take photos directly</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2">
                {photos.map((photo, index) => (
                  <div key={index} className="space-y-2">
                    <Label className="text-sm font-medium">{photo.location} Photo</Label>
                    <div className="relative border-2 border-dashed rounded-xl aspect-video flex items-center justify-center bg-muted/30 overflow-hidden">
                      {photo.preview ? (
                        <>
                          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-full shadow-lg active:scale-95 transition-transform"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-3 cursor-pointer w-full h-full active:bg-primary/10 transition-colors rounded-xl touch-manipulation">
                          <div className="p-4 rounded-full bg-primary/10 border-2 border-primary/30">
                            <Camera className="h-10 w-10 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">Tap to Capture</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(index, e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
        <TabsContent value="saved" className="space-y-4">
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
                <Scissors className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No saved jobs yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a job and save it
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
                <Card key={recipe.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {recipe.hoop_size && <Badge variant="outline">{recipe.hoop_size}</Badge>}
                      {recipe.placement && <Badge variant="secondary">{recipe.placement}</Badge>}
                    </div>
                    <CardTitle className="text-lg">{recipe.name}</CardTitle>
                    {recipe.customer_name && (
                      <p className="text-sm text-muted-foreground">{recipe.customer_name}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1 mb-4">
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
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(recipe.updated_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => loadRecipe(recipe)}>
                        Load for Reorder
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(recipe.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* THREAD INVENTORY TAB */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Thread Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Thread inventory tracking coming soon.</p>
                <p className="text-sm mt-2">Track Madeira thread stock levels, spool counts, and reorder alerts.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOOPS TAB */}
        <TabsContent value="hoops" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Hoops</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {HOOP_SIZES.map((hoop, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5"
                  >
                    <div className="font-bold text-primary">{hoop.brand} {hoop.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">Size: {hoop.size}</div>
                    <div className="text-xs text-muted-foreground">Type: {hoop.type}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
