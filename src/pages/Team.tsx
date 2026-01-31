import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserRole {
  user_id: string;
  role: 'admin' | 'manager' | 'team';
}

export default function Team() {
  const { role, loading } = useAuth();
  const { teamMembers, isLoading } = useTeamMembers();

  // Fetch user roles
  const rolesQuery = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: role === 'admin',
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const getRoleForUser = (userId: string) => {
    return rolesQuery.data?.find(r => r.user_id === userId)?.role || 'team';
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground">Manage team members and roles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Users who have signed up. Assign roles to control access levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No team members yet. They'll appear here after signing up.
            </p>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <Avatar>
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.full_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{member.full_name || 'Unnamed'}</p>
                    <p className="text-sm text-muted-foreground">
                      User ID: {member.user_id.slice(0, 8)}...
                    </p>
                  </div>
                  <Badge variant={getRoleBadgeVariant(getRoleForUser(member.user_id))}>
                    {getRoleForUser(member.user_id)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Badge variant="destructive">admin</Badge>
              <span className="text-muted-foreground">Full access: team management, financials, settings, all data</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge>manager</Badge>
              <span className="text-muted-foreground">Financial access: view/edit pricing, costs, reports. No team management.</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">team</Badge>
              <span className="text-muted-foreground">Production only: jobs, recipes, time tracking. No financial data.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
