import { useState, useEffect } from 'react';
import { useScreenPrintRecipes, ScreenPrintRecipe } from '@/hooks/useScreenPrintRecipes';
import { useJobs } from '@/hooks/useJobs';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, Search, Trash2, Save, Printer, Star, RotateCcw, Clock, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ProductionPhotos, { PhotoSlot } from '@/components/production/ProductionPhotos';
import { SavedJobDetailSheet } from '@/components/production/SavedJobDetailSheet';
import { JobPicker } from '@/components/jobs/JobPicker';

// Types for position settings
type EquipmentType = 'printhead' | 'flash' | 'stampinator' | 'empty';

interface PrintHeadSettings {
  pantone: string;
  airPressure: number | null;
  printSpeed: number | null;
  floodSpeed: number | null;
  squeegeeAngle: number | null;
  floodAngle: number | null;
  squeegeeHeight: number | null;
  floodHeight: number | null;
  active: boolean;
}

interface FlashSettings {
  flashTemp: number | null;
  flashTime: number | null;
  flashHeight: number | null;
  flashActive: boolean;
}

interface StampSettings {
  stampPressure: number | null;
  stampTime: number | null;
  stampTemp: number | null;
  stampActive: boolean;
}

interface PositionData {
  equipmentType: EquipmentType;
  printhead?: PrintHeadSettings;
  flash?: FlashSettings;
  stampinator?: StampSettings;
}

interface EnvironmentSettings {
  shopTemp: number | null;
  platenTemp: number | null;
  dryerTemp1: number | null;
  dryerTemp2: number | null;
  beltSpeed: number | null;
}

// PhotoSlot is now imported from ProductionPhotos

// Default settings
const defaultPrintHead: PrintHeadSettings = {
  pantone: '',
  airPressure: 40,
  printSpeed: 8,
  floodSpeed: 6,
  squeegeeAngle: 15,
  floodAngle: 10,
  squeegeeHeight: 5,
  floodHeight: 3,
  active: false,
};

const defaultFlash: FlashSettings = {
  flashTemp: 200,
  flashTime: 3,
  flashHeight: 2,
  flashActive: false,
};

const defaultStamp: StampSettings = {
  stampPressure: 80,
  stampTime: 2,
  stampTemp: 350,
  stampActive: false,
};

// Position labels
const getPositionLabel = (pos: number): string => {
  if (pos === 2) return `Position ${pos} (Flash Station)`;
  if (pos === 11) return `Position ${pos} (Open Station)`;
  return `Position ${pos}`;
};

const getDefaultEquipment = (pos: number): EquipmentType => {
  if (pos === 2) return 'flash';
  if (pos === 3) return 'stampinator';
  if (pos === 11) return 'empty';
  return 'printhead';
};

export default function ScreenPrint() {
  const { recipes, isLoading, createRecipe, updateRecipe, deleteRecipe } = useScreenPrintRecipes();
  const { jobs } = useJobs();
  const { teamMembers } = useTeamMembers();
  const [activeTab, setActiveTab] = useState<'setup' | 'saved'>('setup');
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('');
  const [viewingRecipe, setViewingRecipe] = useState<ScreenPrintRecipe | null>(null);

  // Job setup state
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [jobNumber, setJobNumber] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [operator, setOperator] = useState('');
  const [dateTime, setDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [printType, setPrintType] = useState<'single' | 'multi'>('single');
  const [rotations, setRotations] = useState(1);
  const [rotationData, setRotationData] = useState<Record<number, number[]>>({});
  
  // 12 position settings
  const [positions, setPositions] = useState<Record<number, PositionData>>(() => {
    const initial: Record<number, PositionData> = {};
    for (let i = 1; i <= 12; i++) {
      const equipment = getDefaultEquipment(i);
      initial[i] = {
        equipmentType: equipment,
        printhead: { ...defaultPrintHead },
        flash: { ...defaultFlash },
        stampinator: { ...defaultStamp },
      };
    }
    return initial;
  });

  // Environment settings
  const [environment, setEnvironment] = useState<EnvironmentSettings>({
    shopTemp: null,
    platenTemp: null,
    dryerTemp1: null,
    dryerTemp2: null,
    beltSpeed: null,
  });

  // Rating & notes
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

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
  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = !search || 
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesRating = !ratingFilter || r.quality_rating === parseInt(ratingFilter);
    return matchesSearch && matchesRating;
  });

  // Update position equipment type
  const updateEquipment = (pos: number, type: EquipmentType) => {
    setPositions(prev => ({
      ...prev,
      [pos]: { ...prev[pos], equipmentType: type }
    }));
  };

  // Update print head settings
  const updatePrintHead = (pos: number, field: keyof PrintHeadSettings, value: any) => {
    setPositions(prev => ({
      ...prev,
      [pos]: {
        ...prev[pos],
        printhead: { ...prev[pos].printhead!, [field]: value }
      }
    }));
  };

  // Update flash settings
  const updateFlash = (pos: number, field: keyof FlashSettings, value: any) => {
    setPositions(prev => ({
      ...prev,
      [pos]: {
        ...prev[pos],
        flash: { ...prev[pos].flash!, [field]: value }
      }
    }));
  };

  // Update stampinator settings
  const updateStamp = (pos: number, field: keyof StampSettings, value: any) => {
    setPositions(prev => ({
      ...prev,
      [pos]: {
        ...prev[pos],
        stampinator: { ...prev[pos].stampinator!, [field]: value }
      }
    }));
  };

  // Toggle rotation position
  const toggleRotationPosition = (rotation: number, position: number) => {
    setRotationData(prev => {
      const current = prev[rotation] || [];
      const exists = current.includes(position);
      return {
        ...prev,
        [rotation]: exists 
          ? current.filter(p => p !== position)
          : [...current, position]
      };
    });
  };

  // Photo handling is now managed by ProductionPhotos component

  // Clear all fields
  const clearAll = () => {
    if (!confirm('Clear all settings? This will reset all fields.')) return;
    
    setLinkedJobId(null);
    setJobNumber('');
    setJobDescription('');
    setOperator('');
    setDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setPrintType('single');
    setRotations(1);
    setRotationData({});
    
    const initial: Record<number, PositionData> = {};
    for (let i = 1; i <= 12; i++) {
      const equipment = getDefaultEquipment(i);
      initial[i] = {
        equipmentType: equipment,
        printhead: { ...defaultPrintHead },
        flash: { ...defaultFlash },
        stampinator: { ...defaultStamp },
      };
    }
    setPositions(initial);
    
    setEnvironment({ shopTemp: null, platenTemp: null, dryerTemp1: null, dryerTemp2: null, beltSpeed: null });
    setRating(0);
    setNotes('');
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
    if (!jobNumber.trim() && !jobDescription.trim()) {
      alert('Please enter a job number or description');
      return;
    }

    setIsSaving(true);
    try {
      const platenData = Object.entries(positions).map(([pos, data]) => ({
        position: parseInt(pos),
        active: data.equipmentType === 'printhead' ? data.printhead?.active : 
                data.equipmentType === 'flash' ? data.flash?.flashActive :
                data.equipmentType === 'stampinator' ? data.stampinator?.stampActive : false,
        equipment_type: data.equipmentType,
        settings: data.equipmentType === 'printhead' ? data.printhead :
                 data.equipmentType === 'flash' ? data.flash :
                 data.equipmentType === 'stampinator' ? data.stampinator : null,
      }));

      const recipeData: any = {
        name: jobNumber || jobDescription,
        customer_name: jobDescription || null,
        job_id: linkedJobId,
        print_type: printType === 'multi' ? 'multi_rotation' as const : 'single' as const,
        platen_setup: platenData,
        rotation_sequence: printType === 'multi' ? rotationData : null,
        squeegee_settings: JSON.stringify(environment),
        flash_temp: environment.dryerTemp1,
        flash_time: null,
        cure_temp: environment.dryerTemp2,
        cure_time: environment.beltSpeed,
        quality_rating: rating || null,
        notes: notes || null,
      };

      if (editingRecipeId) {
        await updateRecipe.mutateAsync({ id: editingRecipeId, ...recipeData });
      } else {
        await createRecipe.mutateAsync(recipeData);
      }
      
      clearAll();
      setActiveTab('saved');
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved job
  const loadRecipe = (recipe: ScreenPrintRecipe) => {
    setLinkedJobId(recipe.job_id);
    setJobNumber(recipe.name);
    setJobDescription(recipe.customer_name || '');
    setPrintType(recipe.print_type === 'multi_rotation' ? 'multi' : 'single');
    setRating(recipe.quality_rating || 0);
    setNotes(recipe.notes || '');
    setEditingRecipeId(recipe.id);

    // Parse platen setup
    if (recipe.platen_setup && Array.isArray(recipe.platen_setup)) {
      const newPositions: Record<number, PositionData> = {};
      for (let i = 1; i <= 12; i++) {
        const saved = recipe.platen_setup.find((p) => p.position === i);
        if (saved && saved.equipment_type) {
          newPositions[i] = {
            equipmentType: (saved.equipment_type as EquipmentType) || 'printhead',
            printhead: saved.equipment_type === 'printhead' ? saved.settings : { ...defaultPrintHead },
            flash: saved.equipment_type === 'flash' ? saved.settings : { ...defaultFlash },
            stampinator: saved.equipment_type === 'stampinator' ? saved.settings : { ...defaultStamp },
          };
        } else {
          newPositions[i] = {
            equipmentType: getDefaultEquipment(i),
            printhead: { ...defaultPrintHead },
            flash: { ...defaultFlash },
            stampinator: { ...defaultStamp },
          };
        }
      }
      setPositions(newPositions);
    }

    // Parse environment
    if (recipe.squeegee_settings) {
      try {
        const env = JSON.parse(recipe.squeegee_settings);
        setEnvironment(env);
      } catch {}
    }

    // Parse rotation data
    if (recipe.rotation_sequence) {
      setRotationData(recipe.rotation_sequence as Record<number, number[]>);
    }

    setActiveTab('setup');
  };

  // Delete recipe
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved job?')) return;
    await deleteRecipe.mutateAsync(id);
  };

  // Get background color for position card using semantic tokens
  const getPositionBg = (equipmentType: EquipmentType) => {
    switch (equipmentType) {
      case 'flash': return 'bg-accent/50 border-accent';
      case 'stampinator': return 'bg-secondary border-secondary';
      case 'empty': return 'bg-muted/30 border-muted';
      default: return 'bg-primary/5 border-primary/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ROQ Screen Print</h1>
          <p className="text-muted-foreground">P14XL Auto Press - 12 Position Setup</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'setup' | 'saved')}>
        <TabsList>
          <TabsTrigger value="setup">Job Setup</TabsTrigger>
          <TabsTrigger value="saved">Saved Jobs</TabsTrigger>
        </TabsList>

        {/* JOB SETUP TAB */}
        <TabsContent value="setup" className="space-y-6">
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
                    setJobDescription(info.customer);
                    if (info.orderNumber) setJobNumber(info.orderNumber);
                  }
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Printavo Job #:</Label>
                  <Input
                    value={jobNumber}
                    onChange={(e) => setJobNumber(e.target.value)}
                    placeholder="Enter job number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Job Description:</Label>
                  <Input
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Job description"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Operator:</Label>
                  <Select value={operator} onValueChange={setOperator}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || 'Unknown'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date/Time:</Label>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {format(new Date(dateTime), 'MM/dd/yyyy, hh:mm a')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Multi-Print Setup */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Multi-Print Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Number of Rotations:</Label>
                  <Select value={rotations.toString()} onValueChange={(v) => setRotations(parseInt(v))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Print Type:</Label>
                  <Select value={printType} onValueChange={(v) => setPrintType(v as 'single' | 'multi')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Print</SelectItem>
                      <SelectItem value="multi">Multi-Rotation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rotation checkboxes */}
              {printType === 'multi' && (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: rotations }, (_, r) => r + 1).map(rotation => (
                    <div key={rotation} className="p-3 rounded border bg-muted/30">
                      <div className="font-medium text-sm text-primary mb-2">Rotation {rotation}</div>
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(pos => (
                          <label key={pos} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={rotationData[rotation]?.includes(pos) || false}
                              onChange={() => toggleRotationPosition(rotation, pos)}
                              className="rounded"
                            />
                            {pos}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print Head Settings - 12 Positions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Print Head Settings</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(pos => {
                const position = positions[pos];
                return (
                  <Card key={pos} className={cn('transition-colors', getPositionBg(position.equipmentType))}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{getPositionLabel(pos)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Equipment Type */}
                      <div>
                        <Label className="text-xs">Equipment Type:</Label>
                        <Select 
                          value={position.equipmentType} 
                          onValueChange={(v) => updateEquipment(pos, v as EquipmentType)}
                        >
                          <SelectTrigger className="mt-1 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="printhead">Print Head</SelectItem>
                            <SelectItem value="flash">Flash Unit</SelectItem>
                            <SelectItem value="stampinator">Stampinator</SelectItem>
                            <SelectItem value="empty">Empty</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Print Head Settings */}
                      {position.equipmentType === 'printhead' && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Pantone Color:</Label>
                            <Input
                              value={position.printhead?.pantone || ''}
                              onChange={(e) => updatePrintHead(pos, 'pantone', e.target.value)}
                              placeholder="PMS 186 C"
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Air Pressure (PSI):</Label>
                              <Input
                                type="number"
                                value={position.printhead?.airPressure ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'airPressure', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Print Speed:</Label>
                              <Input
                                type="number"
                                value={position.printhead?.printSpeed ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'printSpeed', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Flood Speed:</Label>
                              <Input
                                type="number"
                                value={position.printhead?.floodSpeed ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'floodSpeed', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Squeegee Angle (°):</Label>
                              <Input
                                type="number"
                                value={position.printhead?.squeegeeAngle ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'squeegeeAngle', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Flood Bar Angle (°):</Label>
                              <Input
                                type="number"
                                value={position.printhead?.floodAngle ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'floodAngle', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Squeegee Height:</Label>
                              <Input
                                type="number"
                                value={position.printhead?.squeegeeHeight ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'squeegeeHeight', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Flood Bar Height:</Label>
                              <Input
                                type="number"
                                value={position.printhead?.floodHeight ?? ''}
                                onChange={(e) => updatePrintHead(pos, 'floodHeight', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Active:</Label>
                              <Select
                                value={position.printhead?.active ? 'yes' : 'no'}
                                onValueChange={(v) => updatePrintHead(pos, 'active', v === 'yes')}
                              >
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Flash Settings */}
                      {position.equipmentType === 'flash' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Flash Temperature (°C):</Label>
                              <Input
                                type="number"
                                value={position.flash?.flashTemp ?? ''}
                                onChange={(e) => updateFlash(pos, 'flashTemp', e.target.value ? parseInt(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Flash Time (seconds):</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={position.flash?.flashTime ?? ''}
                                onChange={(e) => updateFlash(pos, 'flashTime', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Flash Height:</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={position.flash?.flashHeight ?? ''}
                                onChange={(e) => updateFlash(pos, 'flashHeight', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Flash Active:</Label>
                              <Select
                                value={position.flash?.flashActive ? 'yes' : 'no'}
                                onValueChange={(v) => updateFlash(pos, 'flashActive', v === 'yes')}
                              >
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stampinator Settings */}
                      {position.equipmentType === 'stampinator' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Stamp Pressure (PSI):</Label>
                              <Input
                                type="number"
                                value={position.stampinator?.stampPressure ?? ''}
                                onChange={(e) => updateStamp(pos, 'stampPressure', e.target.value ? parseInt(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Stamp Time (seconds):</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={position.stampinator?.stampTime ?? ''}
                                onChange={(e) => updateStamp(pos, 'stampTime', e.target.value ? parseFloat(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Stamp Temperature (°F):</Label>
                              <Input
                                type="number"
                                value={position.stampinator?.stampTemp ?? ''}
                                onChange={(e) => updateStamp(pos, 'stampTemp', e.target.value ? parseInt(e.target.value) : null)}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Stamp Active:</Label>
                              <Select
                                value={position.stampinator?.stampActive ? 'yes' : 'no'}
                                onValueChange={(v) => updateStamp(pos, 'stampActive', v === 'yes')}
                              >
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Environment Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Environment & Dryer Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label>Shop Temp (°F):</Label>
                  <Input
                    type="number"
                    value={environment.shopTemp ?? ''}
                    onChange={(e) => setEnvironment(prev => ({ ...prev, shopTemp: e.target.value ? parseInt(e.target.value) : null }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Platen Temp (°F):</Label>
                  <Input
                    type="number"
                    value={environment.platenTemp ?? ''}
                    onChange={(e) => setEnvironment(prev => ({ ...prev, platenTemp: e.target.value ? parseInt(e.target.value) : null }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Dryer Temp 1 (°F):</Label>
                  <Input
                    type="number"
                    value={environment.dryerTemp1 ?? ''}
                    onChange={(e) => setEnvironment(prev => ({ ...prev, dryerTemp1: e.target.value ? parseInt(e.target.value) : null }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Dryer Temp 2 (°F):</Label>
                  <Input
                    type="number"
                    value={environment.dryerTemp2 ?? ''}
                    onChange={(e) => setEnvironment(prev => ({ ...prev, dryerTemp2: e.target.value ? parseInt(e.target.value) : null }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Belt Speed:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={environment.beltSpeed ?? ''}
                    onChange={(e) => setEnvironment(prev => ({ ...prev, beltSpeed: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quality Rating */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quality Rating & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Quality Rating:</Label>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 transition-colors"
                    >
                      <Star 
                        className={cn(
                          'h-8 w-8',
                          rating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/30'
                        )} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Production Notes:</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special handling, observations, tips for next run..."
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Production Photos */}
          <ProductionPhotos
            photos={photos}
            onPhotosChange={setPhotos}
            slots={4}
            jobId={linkedJobId || undefined}
            customerEmail={linkedJobId ? jobs.find(j => j.id === linkedJobId)?.customer_email : undefined}
            customerName={jobDescription || undefined}
            orderNumber={linkedJobId ? jobs.find(j => j.id === linkedJobId)?.order_number : undefined}
          />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={clearAll}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear All
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
          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={r.toString()}>
                    {'★'.repeat(r)}{'☆'.repeat(5-r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Saved Jobs List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Printer className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No saved jobs yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a job setup and save it
                </p>
                <Button className="mt-4" onClick={() => setActiveTab('setup')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job Setup
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {filteredRecipes.map((recipe) => (
                  <Card 
                    key={recipe.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setViewingRecipe(recipe)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <div className="font-semibold">{recipe.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {recipe.customer_name || 'No description'} | {format(new Date(recipe.updated_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                      <div className="text-primary">
                        {'★'.repeat(recipe.quality_rating || 0)}{'☆'.repeat(5 - (recipe.quality_rating || 0))}
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
                rating={viewingRecipe?.quality_rating}
                badges={viewingRecipe ? [{ label: viewingRecipe.print_type === 'multi_rotation' ? 'Multi-Rotation' : 'Single' }] : []}
                sections={viewingRecipe ? [
                  {
                    title: 'Print Settings',
                    fields: [
                      { label: 'Print Type', value: viewingRecipe.print_type === 'multi_rotation' ? 'Multi-Rotation' : 'Single' },
                      { label: 'Squeegee', value: viewingRecipe.squeegee_settings },
                      { label: 'Flash Temp', value: viewingRecipe.flash_temp ? `${viewingRecipe.flash_temp}°F` : null, mono: true },
                      { label: 'Flash Time', value: viewingRecipe.flash_time ? `${viewingRecipe.flash_time}s` : null, mono: true },
                      { label: 'Cure Temp', value: viewingRecipe.cure_temp ? `${viewingRecipe.cure_temp}°F` : null, mono: true },
                      { label: 'Cure Time', value: viewingRecipe.cure_time ? `${viewingRecipe.cure_time}s` : null, mono: true },
                    ],
                  },
                  ...(viewingRecipe.ink_colors && viewingRecipe.ink_colors.length > 0 ? [{
                    title: 'Ink Colors',
                    fields: viewingRecipe.ink_colors.map((ink, i) => ({
                      label: `Color ${i + 1}`,
                      value: `${ink.color} (${ink.type}, ${ink.mesh} mesh)`,
                    })),
                  }] : []),
                ] : []}
                notes={viewingRecipe?.notes}
                updatedAt={viewingRecipe?.updated_at}
                onLoadForReorder={() => viewingRecipe && loadRecipe(viewingRecipe)}
                onDelete={() => viewingRecipe && handleDelete(viewingRecipe.id)}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
