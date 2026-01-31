import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { useTeamMembers, TeamMember } from '@/hooks/useTeamMembers';

export function TeamMemberSettings() {
  const { teamMembers, isLoading, updateMember } = useTeamMembers();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleUpdate = (member: TeamMember, updates: Partial<TeamMember>) => {
    updateMember.mutate({ profileId: member.id, ...updates });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>
          Configure pay rates for labor cost calculations. Supports hourly or salary employees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No team members yet. Team members are created when users sign up.
          </p>
        ) : (
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 p-4 border rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {member.full_name || 'Unnamed'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`salary-${member.id}`} className="text-sm text-muted-foreground">
                      Salary
                    </Label>
                    <Switch
                      id={`salary-${member.id}`}
                      checked={member.is_salary}
                      onCheckedChange={(checked) => handleUpdate(member, { is_salary: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {member.is_salary ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Monthly Salary</Label>
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-1">$</span>
                        <Input
                          type="number"
                          value={member.monthly_salary || ''}
                          onChange={(e) => handleUpdate(member, { monthly_salary: parseFloat(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Hourly Rate</Label>
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-1">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={member.hourly_rate || ''}
                          onChange={(e) => handleUpdate(member, { hourly_rate: parseFloat(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Weekly Hours</Label>
                    <Input
                      type="number"
                      value={member.weekly_hours || 40}
                      onChange={(e) => handleUpdate(member, { weekly_hours: parseFloat(e.target.value) || 40 })}
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Effective $/hr</Label>
                    <div className="h-8 flex items-center text-sm font-medium">
                      ${member.is_salary 
                        ? ((member.monthly_salary || 0) / ((member.weekly_hours || 40) * 4.33)).toFixed(2)
                        : (member.hourly_rate || 0).toFixed(2)
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
