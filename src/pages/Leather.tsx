import { useState } from 'react';
import { useLeatherRecipes, LEATHER_MATERIALS, LeatherRecipe } from '@/hooks/useLeatherRecipes';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Plus, Loader2, Search, Trash2, Save, Zap, RotateCcw, Camera, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ProductionPhotos, { PhotoSlot } from '@/components/production/ProductionPhotos';
import { SavedJobDetailSheet } from '@/components/production/SavedJobDetailSheet';
import { JobPicker } from '@/components/jobs/JobPicker';

// Extended material options from old code
const LEATHER_COLORS = ['OG Chestnut', 'Fancy Chestnut', 'Hand Stained Brown', 'Black'];
const LEATHERETTE_COLORS = [
  'Black/Silver', 'Brown/Gold', 'Navy/Silver', 'Red/Gold', 'Burgundy/Gold',
  'Forest Green/Gold', 'Gray/Silver', 'Charcoal/Silver', 'Tan/Brown',
  'Royal Blue/Silver', 'Dark Brown/Gold', 'Natural', 'White', 'Cream',
];
const CUSTOM_MATERIALS = ['Barn Wood', 'Cork', 'Acrylic', 'Metal'];

const PATCH_DIMENSIONS = [
  { value: '2x2', label: '2" x 2"' },
  { value: '2.5x2.5', label: '2.5" x 2.5"' },
  { value: '3x2', label: '3" x 2"' },
  { value: '3x3', label: '3" x 3"' },
  { value: '4x2', label: '4" x 2"' },
  { value: 'custom', label: 'Custom' },
];

const PATCH_SHAPES = ['Rectangle', 'Square', 'Oval', 'Circle', 'Custom'];
const ATTACHMENT_METHODS = ['Heat Press', 'Sew On', 'Adhesive Back', 'Velcro'];

// Laser presets from old code
const LASER_PRESETS: Record<string, { power: number; speed: number; frequency: number; passes: number; zOffset: number; airAssist: boolean }> = {
  'thick-chestnut': { power: 65, speed: 18, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'leatherette-grey-black': { power: 45, speed: 30, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'og-chestnut-heat': { power: 70, speed: 15, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'alcantara': { power: 40, speed: 35, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'genuine-grey': { power: 50, speed: 25, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'black-leather': { power: 60, speed: 20, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'leatherette-black-gold': { power: 45, speed: 30, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'og-chestnut-dark': { power: 75, speed: 12, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
  'hand-stained-dark': { power: 55, speed: 22, frequency: 1000, passes: 1, zOffset: 0, airAssist: true },
};

// PhotoSlot is now imported from ProductionPhotos

interface MaterialItem {
  id: number;
  type: string;
  quantity: string;
}

export default function Leather() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useLeatherRecipes();
  const { jobs } = useJobs();
  const [activeTab, setActiveTab] = useState<'new-job' | 'saved' | 'materials'>('new-job');
  const [search, setSearch] = useState('');
  const [viewingRecipe, setViewingRecipe] = useState<LeatherRecipe | null>(null);

  // Job form state
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [jobId, setJobId] = useState(() => 'LP-' + Date.now().toString().slice(-6));
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hatStyle, setHatStyle] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [designFile, setDesignFile] = useState('');

  // Materials list
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [newMaterialType, setNewMaterialType] = useState('');
  const [newMaterialQty, setNewMaterialQty] = useState('');

  // Dimensions & shape
  const [dimensions, setDimensions] = useState('');
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [shape, setShape] = useState('');
  const [attachmentMethod, setAttachmentMethod] = useState('');

  // Laser settings
  const [laserPreset, setLaserPreset] = useState('');
  const [power, setPower] = useState(50);
  const [speed, setSpeed] = useState(25);
  const [frequency, setFrequency] = useState(1000);
  const [passes, setPasses] = useState(1);
  const [zOffset, setZOffset] = useState(0);
  const [airAssist, setAirAssist] = useState(true);

  // Other
  const [sampleApproved, setSampleApproved] = useState(false);
  const [notes, setNotes] = useState('');
  const [costPerPiece, setCostPerPiece] = useState<number | null>(null);

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { location: '', file: null, preview: '' },
    { location: '', file: null, preview: '' },
    { location: '', file: null, preview: '' },
    { location: '', file: null, preview: '' },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Filter saved recipes
  const filteredRecipes = recipes.filter(r =>
    !search || 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Add material
  const addMaterial = () => {
    if (!newMaterialType.trim()) return;
    setMaterials(prev => [...prev, { 
      id: Date.now(), 
      type: newMaterialType, 
      quantity: newMaterialQty 
    }]);
    setNewMaterialType('');
    setNewMaterialQty('');
  };

  // Remove material
  const removeMaterial = (id: number) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // Load laser preset
  const loadPreset = (preset: string) => {
    setLaserPreset(preset);
    const settings = LASER_PRESETS[preset];
    if (settings) {
      setPower(settings.power);
      setSpeed(settings.speed);
      setFrequency(settings.frequency);
      setPasses(settings.passes);
      setZOffset(settings.zOffset);
      setAirAssist(settings.airAssist);
    }
  };

  // Photo handling is now managed by ProductionPhotos component

  // Clear form
  const clearForm = () => {
    setLinkedJobId(null);
    setJobId('LP-' + Date.now().toString().slice(-6));
    setCustomer('');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setHatStyle('');
    setQuantity(1);
    setDesignFile('');
    setMaterials([]);
    setNewMaterialType('');
    setNewMaterialQty('');
    setDimensions('');
    setCustomWidth(null);
    setCustomHeight(null);
    setShape('');
    setAttachmentMethod('');
    setLaserPreset('');
    setPower(50);
    setSpeed(25);
    setFrequency(1000);
    setPasses(1);
    setZOffset(0);
    setAirAssist(true);
    setSampleApproved(false);
    setNotes('');
    setCostPerPiece(null);
    setPhotos([
      { location: '', file: null, preview: '' },
      { location: '', file: null, preview: '' },
      { location: '', file: null, preview: '' },
      { location: '', file: null, preview: '' },
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
      // Determine material type for database
      const materialType = materials.length > 0 ? materials[0].type : 'custom';

      const recipeData: any = {
        name: customer + ' - ' + (hatStyle || 'Leather Patch'),
        customer_name: customer,
        job_id: linkedJobId,
        material_type: materialType,
        laser_power: power,
        laser_speed: speed,
        laser_frequency: frequency,
        passes: passes,
        patch_width: dimensions === 'custom' ? customWidth : parseFloat(dimensions?.split('x')[0] || '0'),
        patch_height: dimensions === 'custom' ? customHeight : parseFloat(dimensions?.split('x')[1] || '0'),
        material_cost_per_piece: costPerPiece,
        notes: `Shape: ${shape}\nAttachment: ${attachmentMethod}\nPreset: ${laserPreset}\nZ-Offset: ${zOffset}\nAir Assist: ${airAssist ? 'On' : 'Off'}\nMaterials: ${materials.map(m => m.type + (m.quantity ? ` (${m.quantity})` : '')).join(', ')}\n\n${notes}`,
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

  // Load recipe
  const loadRecipe = (recipe: LeatherRecipe) => {
    setLinkedJobId(recipe.job_id);
    setJobId(recipe.id.slice(0, 10) + '-REORDER');
    setCustomer(recipe.customer_name || '');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setPower(recipe.laser_power || 50);
    setSpeed(recipe.laser_speed || 25);
    setFrequency(recipe.laser_frequency || 1000);
    setPasses(recipe.passes || 1);
    setCostPerPiece(recipe.material_cost_per_piece);
    setNotes(recipe.notes || '');
    setEditingRecipeId(recipe.id);

    // Set dimensions
    if (recipe.patch_width && recipe.patch_height) {
      const preset = PATCH_DIMENSIONS.find(d => 
        d.value === `${recipe.patch_width}x${recipe.patch_height}`
      );
      if (preset) {
        setDimensions(preset.value);
      } else {
        setDimensions('custom');
        setCustomWidth(recipe.patch_width);
        setCustomHeight(recipe.patch_height);
      }
    }

    setActiveTab('new-job');
  };

  // Delete recipe
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved job?')) return;
    await deleteRecipe.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leather Patches</h1>
          <p className="text-muted-foreground">Trotec Laser Settings & Recipes</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="new-job">New Job</TabsTrigger>
          <TabsTrigger value="saved">Saved Jobs</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
        </TabsList>

        {/* NEW JOB TAB */}
        <TabsContent value="new-job" className="space-y-6">
          {/* Job Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <JobPicker
                value={linkedJobId}
                onChange={(id, info) => {
                  setLinkedJobId(id);
                  if (info) {
                    setCustomer(info.customer);
                    if (info.orderNumber) setJobId(`LP-${info.orderNumber}`);
                  }
                }}
              />
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
                  <Label>Hat Style:</Label>
                  <Input
                    value={hatStyle}
                    onChange={(e) => setHatStyle(e.target.value)}
                    placeholder="e.g., Richardson 112"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
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
                  <Label>Design File:</Label>
                  <Input
                    value={designFile}
                    onChange={(e) => setDesignFile(e.target.value)}
                    placeholder="filename.ai"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cost per Piece ($):</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={costPerPiece ?? ''}
                    onChange={(e) => setCostPerPiece(e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.75"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Material list */}
              {materials.length > 0 && (
                <div className="space-y-2">
                  {materials.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <span className="font-medium">{m.type}</span>
                        {m.quantity && <span className="text-muted-foreground ml-2">({m.quantity})</span>}
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => removeMaterial(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add material */}
              <div className="flex gap-2">
                <Select value={newMaterialType} onValueChange={setNewMaterialType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select material..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Leather</SelectLabel>
                      {LEATHER_COLORS.map((c) => (
                        <SelectItem key={c} value={`Leather - ${c}`}>{c}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Leatherette</SelectLabel>
                      {LEATHERETTE_COLORS.map((c) => (
                        <SelectItem key={c} value={`Leatherette - ${c}`}>{c}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Custom</SelectLabel>
                      {CUSTOM_MATERIALS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  value={newMaterialQty}
                  onChange={(e) => setNewMaterialQty(e.target.value)}
                  placeholder="Qty"
                  className="w-24"
                />
                <Button onClick={addMaterial}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dimensions & Shape */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Patch Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Dimensions:</Label>
                  <Select value={dimensions} onValueChange={setDimensions}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {PATCH_DIMENSIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {dimensions === 'custom' && (
                  <>
                    <div>
                      <Label>Width (in):</Label>
                      <Input
                        type="number"
                        step="0.125"
                        value={customWidth ?? ''}
                        onChange={(e) => setCustomWidth(e.target.value ? parseFloat(e.target.value) : null)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Height (in):</Label>
                      <Input
                        type="number"
                        step="0.125"
                        value={customHeight ?? ''}
                        onChange={(e) => setCustomHeight(e.target.value ? parseFloat(e.target.value) : null)}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label>Shape:</Label>
                  <Select value={shape} onValueChange={setShape}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select shape" />
                    </SelectTrigger>
                    <SelectContent>
                      {PATCH_SHAPES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Attachment Method:</Label>
                  <Select value={attachmentMethod} onValueChange={setAttachmentMethod}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTACHMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Laser Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Trotec Laser Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preset selector */}
              <div>
                <Label>Load Preset:</Label>
                <Select value={laserPreset} onValueChange={loadPreset}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(LASER_PRESETS).map(key => (
                      <SelectItem key={key} value={key}>
                        {key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Power slider */}
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

              {/* Speed slider */}
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

              {/* Other settings */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Frequency (Hz):</Label>
                  <Input
                    type="number"
                    value={frequency}
                    onChange={(e) => setFrequency(parseInt(e.target.value) || 1000)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Passes:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={passes}
                    onChange={(e) => setPasses(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Z-Offset:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={zOffset}
                    onChange={(e) => setZOffset(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Air Assist:</Label>
                  <Select value={airAssist ? 'on' : 'off'} onValueChange={(v) => setAirAssist(v === 'on')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on">On</SelectItem>
                      <SelectItem value="off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Approval */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Production Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Sample Approved:</Label>
                <Button
                  type="button"
                  variant={sampleApproved ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSampleApproved(!sampleApproved)}
                >
                  {sampleApproved ? '✓ Yes' : 'No'}
                </Button>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Production notes, special handling..."
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
            jobId={linkedJobId || undefined}
            customerEmail={linkedJobId ? jobs.find(j => j.id === linkedJobId)?.customer_email : undefined}
            customerName={customer || undefined}
            orderNumber={linkedJobId ? jobs.find(j => j.id === linkedJobId)?.order_number : undefined}
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
                <Zap className="h-12 w-12 text-muted-foreground/50" />
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
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRecipes.map((recipe) => (
                  <Card 
                    key={recipe.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setViewingRecipe(recipe)}
                  >
                    <CardHeader className="pb-2">
                      <Badge variant="outline">
                        {LEATHER_MATERIALS.find(m => m.value === recipe.material_type)?.label || recipe.material_type}
                      </Badge>
                      <CardTitle className="text-lg">{recipe.name}</CardTitle>
                      {recipe.customer_name && (
                        <p className="text-sm text-muted-foreground">{recipe.customer_name}</p>
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
                      <div className="text-xs text-muted-foreground mt-2">
                        {format(new Date(recipe.updated_at), 'MMM d, yyyy')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <SavedJobDetailSheet
                open={!!viewingRecipe}
                onOpenChange={(open) => !open && setViewingRecipe(null)}
                title={viewingRecipe?.name || ''}
                subtitle={viewingRecipe?.customer_name}
                jobId={viewingRecipe?.job_id}
                badges={viewingRecipe ? [{ label: LEATHER_MATERIALS.find(m => m.value === viewingRecipe.material_type)?.label || viewingRecipe.material_type }] : []}
                sections={viewingRecipe ? [
                  {
                    title: 'Laser Settings',
                    fields: [
                      { label: 'Power', value: viewingRecipe.laser_power ? `${viewingRecipe.laser_power}%` : null, mono: true },
                      { label: 'Speed', value: viewingRecipe.laser_speed ? `${viewingRecipe.laser_speed}%` : null, mono: true },
                      { label: 'Frequency', value: viewingRecipe.laser_frequency ? `${viewingRecipe.laser_frequency} Hz` : null, mono: true },
                      { label: 'Passes', value: viewingRecipe.passes, mono: true },
                    ],
                  },
                  {
                    title: 'Patch Details',
                    fields: [
                      { label: 'Width', value: viewingRecipe.patch_width ? `${viewingRecipe.patch_width}"` : null },
                      { label: 'Height', value: viewingRecipe.patch_height ? `${viewingRecipe.patch_height}"` : null },
                      { label: 'Cost/Piece', value: viewingRecipe.material_cost_per_piece ? `$${viewingRecipe.material_cost_per_piece.toFixed(2)}` : null },
                    ],
                  },
                ] : []}
                notes={viewingRecipe?.notes}
                updatedAt={viewingRecipe?.updated_at}
                onLoadForReorder={() => viewingRecipe && loadRecipe(viewingRecipe)}
                onDelete={() => viewingRecipe && handleDelete(viewingRecipe.id)}
              />
            </>
          )}
        </TabsContent>

        {/* MATERIALS TAB */}
        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Genuine Leather</h4>
                  <div className="flex flex-wrap gap-2">
                    {LEATHER_COLORS.map(c => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Leatherette</h4>
                  <div className="flex flex-wrap gap-2">
                    {LEATHERETTE_COLORS.map(c => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Custom Materials</h4>
                  <div className="flex flex-wrap gap-2">
                    {CUSTOM_MATERIALS.map(c => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
