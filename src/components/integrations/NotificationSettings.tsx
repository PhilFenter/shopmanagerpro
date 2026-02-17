import { useState } from 'react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { STAGE_LABELS, STAGE_ICONS, STAGE_ORDER, FINAL_STAGES } from '@/hooks/useJobStages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, ChevronDown, Save, Loader2, Plus, Trash2, Pencil, X } from 'lucide-react';

export function NotificationSettings() {
  const { settings, isLoading, updateSetting, addSetting, deleteSetting } = useNotificationSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState('');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [newLabel, setNewLabel] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Customer Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = (id: string, currentValue: boolean) => {
    updateSetting.mutate({ id, notify_customer: !currentValue });
  };

  const handleSaveTemplate = (id: string) => {
    updateSetting.mutate({ id, email_template: editTemplate });
    setEditingId(null);
  };

  const handleEditStart = (id: string, template: string | null) => {
    setEditingId(id);
    setEditTemplate(template || '');
  };

  const handleSaveLabel = (id: string) => {
    updateSetting.mutate({ id, custom_label: editLabel });
    setEditingLabelId(null);
  };

  const handleSaveSubject = (id: string) => {
    updateSetting.mutate({ id, email_subject: editSubject });
    setEditingSubjectId(null);
  };

  const handleAdd = () => {
    if (!newStage || !newLabel.trim()) return;
    addSetting.mutate({ stage: newStage, custom_label: newLabel.trim() });
    setNewStage('');
    setNewLabel('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    deleteSetting.mutate(id);
  };

  const allStages = [...STAGE_ORDER, ...FINAL_STAGES];
  const enabledCount = settings.filter(s => s.notify_customer).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Customer Notifications
            </CardTitle>
            <CardDescription>
              Automatically email Shopify and Printavo customers when their order reaches key stages
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{enabledCount} active</Badge>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          Use <code className="bg-muted px-1 rounded text-xs">{`{{customer_name}}`}</code>, <code className="bg-muted px-1 rounded text-xs">{`{{order_number}}`}</code>, and <code className="bg-muted px-1 rounded text-xs">{`{{stage}}`}</code> as template variables. Click the title or subject to rename them.
        </p>

        {showAddForm && (
          <div className="flex gap-2 items-end rounded-lg border p-3 bg-muted/30 mb-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">Stage trigger</label>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {allStages.map(s => (
                    <SelectItem key={s} value={s}>
                      {STAGE_ICONS[s]} {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">Display name</label>
              <Input
                className="h-9"
                placeholder="e.g. Payment Received"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!newStage || !newLabel.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {settings.map((setting) => {
          const stageKey = setting.stage as keyof typeof STAGE_LABELS;
          const defaultLabel = STAGE_LABELS[stageKey] || setting.stage;
          const displayLabel = setting.custom_label || defaultLabel;
          const icon = STAGE_ICONS[stageKey] || '📋';
          const isEditing = editingId === setting.id;
          const isEditingLabel = editingLabelId === setting.id;
          const isEditingSubject = editingSubjectId === setting.id;

          return (
            <Collapsible key={setting.id}>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1">
                    {isEditingLabel ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          className="h-7 text-sm w-48"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel(setting.id)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveLabel(setting.id)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLabelId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium text-sm group/label">
                        {displayLabel}
                        <button
                          className="ml-1 opacity-0 group-hover/label:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLabelId(setting.id);
                            setEditLabel(displayLabel);
                          }}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground inline" />
                        </button>
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {setting.is_custom && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(setting.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Switch
                    checked={setting.notify_customer}
                    onCheckedChange={() => handleToggle(setting.id, setting.notify_customer)}
                    className="ml-1"
                  />
                </div>
              </div>
              <CollapsibleContent className="px-3 pb-3 pt-2">
                <div className="space-y-3 ml-8">
                  {/* Email subject */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email Subject</label>
                    {isEditingSubject ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          className="h-8 text-sm flex-1"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveSubject(setting.id)}
                          placeholder={`Order #{{order_number}} Update: ${displayLabel}`}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handleSaveSubject(setting.id)} disabled={updateSetting.isPending}>
                          <Save className="h-3 w-3 mr-1" />Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSubjectId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {setting.email_subject || `Order #{{order_number}} Update: ${displayLabel}`}
                        </p>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                          setEditingSubjectId(setting.id);
                          setEditSubject(setting.email_subject || '');
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Email body template */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email Body</label>
                    {isEditing ? (
                      <div className="space-y-2 mt-1">
                        <Textarea
                          value={editTemplate}
                          onChange={(e) => setEditTemplate(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveTemplate(setting.id)}
                            disabled={updateSetting.isPending}
                          >
                            {updateSetting.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {setting.email_template || 'No template set'}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => handleEditStart(setting.id, setting.email_template)}
                        >
                          Edit template
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
