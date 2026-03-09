import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, UserRoleRecord } from '@/types/database';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search,
  Shield,
  UserCheck,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UserWithRole extends Profile {
  role?: UserRole;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch all user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('*');

      // Combine data
      const combined = (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.id)?.role as UserRole | undefined,
      }));

      setUsers(combined as UserWithRole[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId);
    try {
      // Update or insert role
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
        }, {
          onConflict: 'user_id,role',
        });

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: 'Role updated',
        description: `User role has been changed to ${newRole}.`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'interviewer':
        return <UserCheck className="h-4 w-4" />;
      default:
        return <UserIcon className="h-4 w-4" />;
    }
  };

  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive';
      case 'interviewer':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    interviewers: users.filter(u => u.role === 'interviewer').length,
    candidates: users.filter(u => u.role === 'candidate').length,
  };

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats.total, icon: Users },
            { label: 'Admins', value: stats.admins, icon: Shield },
            { label: 'Interviewers', value: stats.interviewers, icon: UserCheck },
            { label: 'Candidates', value: stats.candidates, icon: UserIcon },
          ].map((stat, i) => (
            <Card key={stat.label} className="interview-card animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <stat.icon className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </div>

        {/* Users List */}
        <Card className="glass-card animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage user roles</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No users found matching your search' : 'No users yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge 
                        variant="outline" 
                        className={cn('gap-1 capitalize border-0', getRoleBadgeStyle(user.role))}
                      >
                        {getRoleIcon(user.role)}
                        {user.role || 'No role'}
                      </Badge>

                      {user.id !== currentUser?.id && (
                        <Select
                          value={user.role || 'candidate'}
                          onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                          disabled={updating === user.id}
                        >
                          <SelectTrigger className="w-36">
                            {updating === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="candidate">Candidate</SelectItem>
                            <SelectItem value="interviewer">Interviewer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
