import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { useCustomerMessages } from '@/hooks/useCustomerMessages';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageThread } from '@/components/communications/MessageThread';
import { TemplateLibrary } from '@/components/communications/TemplateLibrary';
import { CustomerDetailSheet } from '@/components/communications/CustomerDetailSheet';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, MessageSquare, StickyNote, MessagesSquare } from 'lucide-react';
import type { Customer } from '@/hooks/useCustomers';

export default function Messages() {
  const { role, loading } = useAuth();
  const { messages, isLoading: messagesLoading } = useCustomerMessages();
  const { customers } = useCustomers();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Group messages by customer
  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

  const filteredMessages = useMemo(() => {
    let filtered = messages;
    if (channelFilter !== 'all') {
      filtered = filtered.filter(m => m.channel === channelFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(m => {
        const customer = m.customer_id ? customerMap.get(m.customer_id) : null;
        return (
          m.body.toLowerCase().includes(s) ||
          m.subject?.toLowerCase().includes(s) ||
          m.recipient?.toLowerCase().includes(s) ||
          customer?.name.toLowerCase().includes(s)
        );
      });
    }
    return filtered;
  }, [messages, channelFilter, search, customerMap]);

  // Conversations grouped by customer
  const conversations = useMemo(() => {
    const map = new Map<string, { customer: Customer; messages: typeof messages; lastMessage: string }>();
    for (const msg of messages) {
      if (!msg.customer_id) continue;
      const customer = customerMap.get(msg.customer_id);
      if (!customer) continue;
      if (!map.has(msg.customer_id)) {
        map.set(msg.customer_id, { customer, messages: [], lastMessage: msg.created_at });
      }
      map.get(msg.customer_id)!.messages.push(msg);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime());
  }, [messages, customerMap]);

  const stats = useMemo(() => ({
    emails: messages.filter(m => m.channel === 'email').length,
    sms: messages.filter(m => m.channel === 'sms').length,
    notes: messages.filter(m => m.channel === 'internal_note').length,
  }), [messages]);

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!hasFinancialAccess(role)) return <Navigate to="/dashboard" replace />;

  // (moved above early returns)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Customer communications, templates, and internal notes</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Emails</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
            <StickyNote className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notes}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="all">All Messages</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          {messagesLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessagesSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No conversations yet</p>
                <p className="text-sm text-muted-foreground">Send a message from a customer profile to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {conversations
                .filter(c => !search.trim() || c.customer.name.toLowerCase().includes(search.toLowerCase()))
                .map(({ customer, messages: msgs }) => (
                  <Card 
                    key={customer.id} 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{customer.name}</p>
                          <Badge variant="outline" className="text-xs">{msgs.length} msgs</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {msgs[0]?.body.slice(0, 80)}...
                        </p>
                      </div>
                      <div className="flex gap-1 ml-3">
                        {msgs.some(m => m.channel === 'email') && <Mail className="h-3.5 w-3.5 text-blue-500" />}
                        {msgs.some(m => m.channel === 'sms') && <MessageSquare className="h-3.5 w-3.5 text-green-500" />}
                        {msgs.some(m => m.channel === 'internal_note') && <StickyNote className="h-3.5 w-3.5 text-amber-500" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-1">
              {['all', 'email', 'sms', 'internal_note'].map(ch => (
                <Badge
                  key={ch}
                  variant={channelFilter === ch ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setChannelFilter(ch)}
                >
                  {ch === 'all' ? 'All' : ch.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
          <MessageThread messages={filteredMessages} isLoading={messagesLoading} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateLibrary />
        </TabsContent>
      </Tabs>

      <CustomerDetailSheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
    </div>
  );
}
