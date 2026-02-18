import { format } from 'date-fns';
import { Mail, MessageSquare, StickyNote, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CustomerMessage } from '@/hooks/useCustomerMessages';

interface MessageThreadProps {
  messages: CustomerMessage[];
  isLoading?: boolean;
}

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  internal_note: StickyNote,
};

const channelColors: Record<string, string> = {
  email: 'text-blue-500',
  sms: 'text-green-500',
  internal_note: 'text-amber-500',
};

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading messages...</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Mail className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const Icon = channelIcons[msg.channel] || Mail;
        const isNote = msg.channel === 'internal_note';
        const isOutbound = msg.direction === 'outbound';

        return (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg border p-3',
              isNote && 'bg-accent/30 border-dashed',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', channelColors[msg.channel])} />
                <Badge variant="outline" className="text-xs capitalize">
                  {msg.channel.replace('_', ' ')}
                </Badge>
                {!isNote && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {isOutbound ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                    {isOutbound ? 'Sent' : 'Received'}
                    {msg.recipient && ` to ${msg.recipient}`}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {msg.subject && (
              <p className="font-medium text-sm mt-2">{msg.subject}</p>
            )}
            <p className="text-sm mt-1 whitespace-pre-wrap">{msg.body}</p>
          </div>
        );
      })}
    </div>
  );
}
