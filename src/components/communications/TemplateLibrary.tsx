import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useMessageTemplates, type MessageTemplate } from '@/hooks/useMessageTemplates';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Mail, MessageSquare, FileText } from 'lucide-react';

export function TemplateLibrary() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useMessageTemplates();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'general', subject: '', body: '', channel: 'email' });

  const resetForm = () => setForm({ name: '', category: 'general', subject: '', body: '', channel: 'email' });

  const handleCreate = async () => {
    await createTemplate.mutateAsync({ ...form, created_by: user?.id });
    resetForm();
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editTemplate) return;
    await updateTemplate.mutateAsync({ id: editTemplate.id, ...form });
    setEditTemplate(null);
    resetForm();
  };

  const openEdit = (t: MessageTemplate) => {
    setForm({ name: t.name, category: t.category, subject: t.subject || '', body: t.body, channel: t.channel });
    setEditTemplate(t);
  };

  const categories = [...new Set(templates.map(t => t.category))];

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Message Templates</h2>
          <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        )}
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat.replace('_', ' ')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.filter(t => t.category === cat).map(t => (
              <Card key={t.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {t.channel === 'email' ? <Mail className="h-3 w-3 mr-1" /> : t.channel === 'sms' ? <MessageSquare className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                      {t.channel}
                    </Badge>
                  </div>
                  {t.subject && <CardDescription className="text-xs">{t.subject}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3">{t.body}</p>
                  {isAdmin && (
                    <div className="flex gap-1 mt-3">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editTemplate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditTemplate(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>Create reusable message templates for common communications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order_update">Order Update</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="relationship">Relationship</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.channel !== 'sms' && (
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject line" />
              </div>
            )}
            <div>
              <Label>Body</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} placeholder="Use {{customer_name}} and {{order_number}} as variables" />
              <p className="text-xs text-muted-foreground mt-1">Variables: {"{{customer_name}}"}, {"{{order_number}}"}, {"{{stage}}"}</p>
            </div>
            <Button onClick={editTemplate ? handleUpdate : handleCreate} disabled={!form.name || !form.body} className="w-full">
              {editTemplate ? 'Update' : 'Create'} Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
