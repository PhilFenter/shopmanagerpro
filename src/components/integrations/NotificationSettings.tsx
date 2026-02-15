import { useState } from 'react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { STAGE_LABELS, STAGE_ICONS } from '@/hooks/useJobStages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bell, ChevronDown, Save, Loader2 } from 'lucide-react';

export function NotificationSettings() {
  const { settings, isLoading, updateSetting } = useNotificationSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState('');

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
          <Badge variant="secondary">{enabledCount} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          Use <code className="bg-muted px-1 rounded text-xs">{`{{customer_name}}`}</code> and <code className="bg-muted px-1 rounded text-xs">{`{{order_number}}`}</code> as template variables.
        </p>

        {settings.map((setting) => {
          const stageKey = setting.stage as keyof typeof STAGE_LABELS;
          const label = STAGE_LABELS[stageKey] || setting.stage;
          const icon = STAGE_ICONS[stageKey] || '📋';
          const isEditing = editingId === setting.id;

          return (
            <Collapsible key={setting.id}>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1">
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={setting.notify_customer}
                    onCheckedChange={() => handleToggle(setting.id, setting.notify_customer)}
                    className="ml-3"
                  />
                </div>
              </div>
              <CollapsibleContent className="px-3 pb-3 pt-2">
                <div className="space-y-2 ml-8">
                  {isEditing ? (
                    <>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {setting.email_template || 'No template set'}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditStart(setting.id, setting.email_template)}
                      >
                        Edit template
                      </Button>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
