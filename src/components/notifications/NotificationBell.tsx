import { useState, useEffect } from "react";
import { Bell, BellOff, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleEnablePush = async () => {
    if (!user) return;
    const res = await subscribeToPush(user.id);
    setPermission(getNotificationPermission());
    if (res.ok) toast({ title: "Push notifications enabled" });
    else toast({ variant: "destructive", title: "Couldn't enable", description: res.reason });
  };

  const handleDisablePush = async () => {
    await unsubscribeFromPush();
    setPermission(getNotificationPermission());
    toast({ title: "Push notifications disabled" });
  };

  const handleClick = (n: typeof notifications[0]) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {permission !== "granted" && permission !== "unsupported" && isPushSupported() && (
          <div className="border-b bg-muted/40 p-3 text-xs">
            <p className="mb-2 text-muted-foreground">
              Get instant alerts on your phone or desktop when handoffs come in.
            </p>
            <Button size="sm" className="h-7 text-xs w-full" onClick={handleEnablePush}>
              <Bell className="mr-1 h-3 w-3" />
              Enable push notifications
            </Button>
          </div>
        )}

        {permission === "granted" && (
          <div className="border-b bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-success" /> Push enabled on this device
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleDisablePush}
            >
              <BellOff className="mr-1 h-3 w-3" />
              Disable
            </Button>
          </div>
        )}

        {permission === "denied" && (
          <div className="border-b bg-destructive/10 p-3 text-xs text-muted-foreground">
            Push is blocked in your browser settings. Re-enable notifications for this site to
            receive alerts.
          </div>
        )}

        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-accent/50 transition-colors",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
