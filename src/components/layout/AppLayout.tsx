import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRolePreview } from '@/hooks/useRolePreview';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  LayoutDashboard,
  Briefcase,
  Shirt,
  Printer,
  Flame,
  Scissors,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Plug,
  Eye,
  
  ListTodo,
  UserCheck,
  MessagesSquare,
  Palette,
  Warehouse,
  FileText,
  BookOpen,
  Package,
  ClipboardCheck,
  GraduationCap,
  Inbox,
} from 'lucide-react';
import { useHandoffs } from '@/hooks/useHandoffs';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Action Items', href: '/action-items', icon: ListTodo },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { name: 'My Training', href: '/training', icon: GraduationCap },
  { name: 'Skills & Credentials', href: '/skills', icon: ClipboardCheck },
  { name: 'Artwork', href: '/artwork', icon: Palette },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Handoffs', href: '/handoffs', icon: Inbox },
  
  { 
    name: 'Production',
    icon: Printer,
    children: [
      { name: 'Embroidery', href: '/embroidery', icon: Shirt },
      { name: 'Screen Print', href: '/screen-print', icon: Printer },
      { name: 'DTF', href: '/dtf', icon: Flame },
      { name: 'Leather', href: '/leather', icon: Scissors },
    ],
  },
];

// Admin-only navigation items
const adminNavigation = [
  { name: 'Team', href: '/team', icon: Users },
];

// Financial access navigation (admin or manager)
const financialNavigation = [
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: Package },
  { name: 'Customers', href: '/customers', icon: UserCheck },
  { name: 'Messages', href: '/messages', icon: MessagesSquare },
  { name: 'Financials', href: '/financials', icon: DollarSign },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productionExpanded, setProductionExpanded] = useState(false);
  const { user, signOut, role } = useAuth();
  const { isPreviewingAsTeam, togglePreview } = useRolePreview();
  const location = useLocation();
  const navigate = useNavigate();
  const { handoffs } = useHandoffs();
  const unreadHandoffs = handoffs.filter(h => h.status !== 'completed').length;

  // When previewing as team, treat role as 'team' for UI purposes
  const effectiveRole = (role === 'admin' && isPreviewingAsTeam) ? 'team' : role;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (href: string) => location.pathname === href;

  const NavItem = ({ item, mobile = false }: { item: typeof navigation[0]; mobile?: boolean }) => {
    const hasChildren = 'children' in item && item.children;
    
    if (hasChildren) {
      return (
        <div>
          <button
            onClick={() => setProductionExpanded(!productionExpanded)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              productionExpanded && 'bg-accent/50'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
            <ChevronRight className={cn('ml-auto h-4 w-4 transition-transform', productionExpanded && 'rotate-90')} />
          </button>
          {productionExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={() => mobile && setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive(child.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        to={item.href!}
        onClick={() => mobile && setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive(item.href!)
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span className="flex-1">{item.name}</span>
        {item.href === '/handoffs' && unreadHandoffs > 0 && (
          <Badge variant="secondary" className="ml-auto">{unreadHandoffs}</Badge>
        )}
      </Link>
    );
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Printer className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Shop Manager</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => (
          <NavItem key={item.name} item={item} mobile={mobile} />
        ))}
        
        {(effectiveRole === 'admin' || effectiveRole === 'manager') && (
          <>
            <div className="my-4 border-t" />
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
              {effectiveRole === 'admin' ? 'Admin' : 'Management'}
            </p>
            {effectiveRole === 'admin' && adminNavigation.map((item) => (
              <NavItem key={item.name} item={item} mobile={mobile} />
            ))}
            {financialNavigation.map((item) => (
              <NavItem key={item.name} item={item} mobile={mobile} />
            ))}
          </>
        )}
        
        {/* Admin Preview Toggle */}
        {role === 'admin' && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="preview-toggle" className="text-sm cursor-pointer flex-1">
                Employee View
              </Label>
              <Switch
                id="preview-toggle"
                checked={isPreviewingAsTeam}
                onCheckedChange={togglePreview}
              />
            </div>
            {isPreviewingAsTeam && (
              <p className="px-3 mt-1 text-xs text-warning">
                Viewing as employee
              </p>
            )}
          </div>
        )}
      </nav>
      
      <div className="border-t p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {effectiveRole || 'team'}{isPreviewingAsTeam ? ' (preview)' : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-card shadow-xl">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-72 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <span className="text-lg font-bold">Shop Manager</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Link to="/handoffs" className="relative">
              <Button variant="ghost" size="icon">
                <Inbox className="h-5 w-5" />
              </Button>
              {unreadHandoffs > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
                  {unreadHandoffs}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
