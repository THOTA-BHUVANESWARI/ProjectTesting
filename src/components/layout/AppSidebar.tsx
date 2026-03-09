import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Calendar,
  Video,
  ClipboardCheck,
  Users,
  Settings,
  LogOut,
  Code2,
  ChevronLeft,
  Plus,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'interviewer', 'candidate'] },
  { icon: Video, label: 'Lobby', path: '/lobby', roles: ['admin', 'interviewer', 'candidate'] },
  { icon: Calendar, label: 'Interviews', path: '/interviews', roles: ['admin', 'interviewer', 'candidate'] },
  { icon: Bot, label: 'AI Assistant', path: '/assistant', roles: ['admin', 'interviewer', 'candidate'] },
  { icon: ClipboardCheck, label: 'Evaluations', path: '/evaluations', roles: ['admin', 'interviewer'] },
  { icon: Users, label: 'Users', path: '/users', roles: ['admin'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin', 'interviewer', 'candidate'] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside 
      className={cn(
        "bg-sidebar h-screen flex flex-col transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-sidebar-foreground">InterviewHub</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* New Interview Button */}
      {(role === 'admin' || role === 'interviewer') && (
        <div className="p-3">
          <Button
            variant="gradient"
            className={cn("w-full", collapsed ? "px-0" : "")}
            onClick={() => navigate('/interviews/new')}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span>New Interview</span>}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "nav-link w-full",
                isActive && "active",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full mt-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "px-0" : "justify-start"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
