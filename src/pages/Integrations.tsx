import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { PrintavoSync } from '@/components/integrations/PrintavoSync';
import { ShopifySync } from '@/components/integrations/ShopifySync';
import { DropboxSync } from '@/components/integrations/DropboxSync';

import { NotificationSettings } from '@/components/integrations/NotificationSettings';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { Plug } from 'lucide-react';

export default function Integrations() {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasFinancialAccess(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Plug className="h-6 w-6" />
          Integrations
        </h1>
        <p className="text-muted-foreground">
          Connect external services to import orders and sync data
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PrintavoSync />
        <ShopifySync />
        <DropboxSync />
        <DropboxSync />
      </div>

      <NotificationSettings />
    </div>
  );
}