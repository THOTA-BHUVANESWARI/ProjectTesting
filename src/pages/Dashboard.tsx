import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Interview, InterviewStatus } from '@/types/database';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { InterviewChatbot } from '@/components/chat/InterviewChatbot';
import { 
  Calendar, 
  Clock, 
  Video, 
  ArrowRight, 
  Plus,
  Users,
  ClipboardCheck,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, role, isInterviewer, isAdmin, isCandidate } = useAuth();
  const [upcomingInterviews, setUpcomingInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    completed: 0,
    inProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: interviews, error } = await supabase
        .from('interviews')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const typedInterviews = (interviews || []) as Interview[];
      
      // Filter upcoming (scheduled or in_progress)
      const upcoming = typedInterviews.filter(i => 
        i.status === 'scheduled' || i.status === 'in_progress'
      ).slice(0, 5);
      
      setUpcomingInterviews(upcoming);
      
      setStats({
        total: typedInterviews.length,
        scheduled: typedInterviews.filter(i => i.status === 'scheduled').length,
        completed: typedInterviews.filter(i => i.status === 'completed').length,
        inProgress: typedInterviews.filter(i => i.status === 'in_progress').length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getStatusBadge = (status: InterviewStatus) => {
    const styles = {
      scheduled: 'status-scheduled',
      in_progress: 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
    };
    
    const labels = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    return (
      <span className={cn('status-badge', styles[status])}>
        {labels[status]}
      </span>
    );
  };

  const statCards = [
    { label: 'Total Interviews', value: stats.total, icon: Calendar, color: 'text-primary' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-primary' },
    { label: 'In Progress', value: stats.inProgress, icon: Video, color: 'text-warning' },
    { label: 'Completed', value: stats.completed, icon: ClipboardCheck, color: 'text-success' },
  ];

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            {isCandidate 
              ? "Here's your interview schedule and progress."
              : "Here's an overview of your interview activities."}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <Card 
              key={stat.label} 
              className="interview-card animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                  <div className={cn("w-12 h-12 rounded-lg bg-secondary flex items-center justify-center", stat.color)}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Interviews */}
          <div className="lg:col-span-2">
            <Card className="glass-card animate-slide-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Interviews</CardTitle>
                  <CardDescription>Your scheduled and ongoing sessions</CardDescription>
                </div>
                {(isAdmin || isInterviewer) && (
                  <Button variant="gradient" size="sm" onClick={() => navigate('/interviews/new')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : upcomingInterviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No upcoming interviews</p>
                    {(isAdmin || isInterviewer) && (
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => navigate('/interviews/new')}
                      >
                        Schedule your first interview
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingInterviews.map((interview, i) => (
                      <div
                        key={interview.id}
                        className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
                        onClick={() => navigate(`/interviews/${interview.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{interview.title}</h3>
                              {getStatusBadge(interview.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {getDateLabel(interview.scheduled_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {format(parseISO(interview.scheduled_at), 'h:mm a')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Video className="h-4 w-4" />
                                {interview.duration_minutes} min
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {upcomingInterviews.length > 0 && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-4"
                    onClick={() => navigate('/interviews')}
                  >
                    View all interviews
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="glass-card animate-slide-up" style={{ animationDelay: '300ms' }}>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(isAdmin || isInterviewer) && (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => navigate('/interviews/new')}
                    >
                      <Plus className="h-4 w-4 mr-3" />
                      Schedule Interview
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => navigate('/evaluations')}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-3" />
                      Review Evaluations
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/users')}
                  >
                    <Users className="h-4 w-4 mr-3" />
                    Manage Users
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/interviews')}
                >
                  <Calendar className="h-4 w-4 mr-3" />
                  View All Interviews
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="glass-card animate-slide-up bg-primary/5 border-primary/20" style={{ animationDelay: '400ms' }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Pro Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Test your camera and microphone before interviews</li>
                  <li>• Use the code editor to collaborate in real-time</li>
                  <li>• Add timestamped notes during the interview</li>
                  {isCandidate && (
                    <li>• Take a deep breath - you've got this!</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Assistant Floating Button */}
        <Sheet open={showChatbot} onOpenChange={setShowChatbot}>
          <SheetTrigger asChild>
            <Button
              variant="gradient"
              size="icon"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            >
              <MessageSquare className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md p-0">
            <InterviewChatbot 
              mode={isCandidate ? 'candidate' : 'interviewer'} 
              className="h-full border-0 rounded-none"
            />
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
