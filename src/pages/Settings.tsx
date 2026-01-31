import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { TeamMemberSettings } from '@/components/settings/TeamMemberSettings';
import { OverheadSettings } from '@/components/settings/OverheadSettings';
import { CostDashboard } from '@/components/settings/CostDashboard';

export default function Settings() {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage team rates, overhead, and business settings</p>
      </div>

      <CostDashboard />

      <div className="grid gap-6 lg:grid-cols-2">
        <TeamMemberSettings />
        <OverheadSettings />
      </div>
    </div>
  );
}
