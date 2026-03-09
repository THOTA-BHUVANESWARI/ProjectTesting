import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Interview, InterviewStatus } from '@/types/database';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InterviewChatbot } from '@/components/chat/InterviewChatbot';
import { 
  Calendar, 
  Clock, 
  Video, 
  Plus,
  Search,
  MoreVertical,
  Play,
  Eye,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function Interviews() {
  const navigate = useNavigate();
  const { isAdmin, isInterviewer, isCandidate } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      setInterviews((data || []) as Interview[]);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interviews.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // const handleStartInterview = async (interview: Interview) => {
  //   try {
  //     await supabase
  //       .from('interviews')
  //       .update({ status: 'in_progress' })
  //       .eq('id', interview.id);
      
  //     navigate(`/room/${interview.room_code}`);
  //   } catch (error) {
  //     console.error('Error starting interview:', error);
  //   }
  // };
  const handleStartInterview = async (interview: Interview) => {
  try {
    const { error } = await supabase
      .from('interviews')
      .update({ status: 'in_progress' })
      .eq('id', interview.id);

    if (error) throw error;

    // ✅ Always navigate using DB room_code
    navigate(`/room/${interview.room_code}`);

  } catch (error) {
    console.error('Error starting interview:', error);
    toast({
      title: 'Error',
      description: 'Failed to start interview.',
      variant: 'destructive',
    });
  }
};

  const handleDeleteInterview = async (id: string) => {
    try {
      const { error } = await supabase
        .from('interviews')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setInterviews(prev => prev.filter(i => i.id !== id));
      toast({
        title: 'Interview deleted',
        description: 'The interview has been removed.',
      });
    } catch (error) {
      console.error('Error deleting interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete interview.',
        variant: 'destructive',
      });
    }
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

  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = interview.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interview.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && interview.status === activeTab;
  });

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold mb-2">Interviews</h1>
            <p className="text-muted-foreground">Manage and track all interview sessions</p>
          </div>
          {(isAdmin || isInterviewer) && (
            <Button variant="gradient" onClick={() => navigate('/interviews/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search interviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : filteredInterviews.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No interviews found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery 
                      ? 'Try adjusting your search query'
                      : 'Get started by scheduling your first interview'}
                  </p>
                  {(isAdmin || isInterviewer) && !searchQuery && (
                    <Button variant="gradient" onClick={() => navigate('/interviews/new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Interview
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInterviews.map((interview, i) => (
                  <Card 
                    key={interview.id}
                    className="interview-card cursor-pointer animate-scale-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => navigate(`/interviews/${interview.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-1">{interview.title}</CardTitle>
                          <CardDescription className="line-clamp-2 mt-1">
                            {interview.description || 'No description'}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/interviews/${interview.id}`);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {interview.status === 'scheduled' && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleStartInterview(interview);
                              }}>
                                <Play className="h-4 w-4 mr-2" />
                                Start Interview
                              </DropdownMenuItem>
                            )}
                            {(isAdmin || isInterviewer) && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteInterview(interview.id);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {getStatusBadge(interview.status)}
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(interview.scheduled_at), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(interview.scheduled_at), 'h:mm a')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Video className="h-4 w-4" />
                          <span>{interview.duration_minutes} minutes</span>
                        </div>
                        
                        {(interview.status === 'scheduled' || interview.status === 'in_progress') && (
                          <Button 
                            variant={interview.status === 'in_progress' ? 'warning' : 'gradient'}
                            className="w-full mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartInterview(interview);
                            }}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            {interview.status === 'in_progress' ? 'Join Room' : 'Start Interview'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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