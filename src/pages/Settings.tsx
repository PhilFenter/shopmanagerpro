import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { ProductCatalogSettings } from '@/components/settings/ProductCatalogSettings';
import { hasFinancialAccess } from '@/hooks/useJobs';

export default function Settings() {
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
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage product catalog and business settings</p>
      </div>

      <ProductCatalogSettings />
    </div>
  );
}
