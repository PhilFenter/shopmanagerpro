import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { PrintavoSync } from '@/components/integrations/PrintavoSync';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { Plug } from 'lucide-react';

export default function Integrations() {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasFinancialAccess(role)) {
    return <Navigate to="/" replace />;
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
        
        {/* Placeholder for Shopify - coming soon */}
        <div className="rounded-lg border border-dashed p-6 flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Plug className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Shopify</h3>
          <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
