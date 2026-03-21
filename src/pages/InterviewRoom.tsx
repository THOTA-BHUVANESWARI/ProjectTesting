import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Interview } from '@/types/database';
import { VideoCall } from '@/components/interview/VideoCall';
import { CodeEditor } from '@/components/interview/CodeEditor';
import { EvaluationPanel } from '@/components/interview/EvaluationPanel';
import { InterviewChatbot } from '@/components/chat/InterviewChatbot';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  ArrowLeft,
  Clock,
  Code2,
  Video,
  ClipboardCheck,
  Loader2,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Detect if a string looks like a UUID or UUID fragment (no dashes in ABC-123 format)
const looksLikeUUID = (str: string) =>
  /^[0-9a-f-]{8,}$/i.test(str) && !str.match(/^[A-Z]{3}-\d{3}$/);

export default function InterviewRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, isInterviewer, isAdmin, isCandidate, loading: authLoading } = useAuth();
  

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeView, setActiveView] = useState<'code' | 'video'>('code');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isInterviewerOrAdmin = isInterviewer || isAdmin;
  const userRole: 'interviewer' | 'candidate' = isInterviewerOrAdmin
    ? 'interviewer'
    : 'candidate';
  const userName =
    user?.user_metadata?.full_name ?? user?.email ?? 'You';

 //const { loading: authLoading } = useAuth(); // add this to your destructuring at the top

useEffect(() => {
  if (roomCode && !authLoading) fetchInterview();
}, [roomCode, authLoading]);

  useEffect(() => {
    if (interview?.status === 'in_progress') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interview?.status]);

  const fetchInterview = async () => {
    if (!roomCode) return;

    try {
      let data: Interview | null = null;

      // ── Strategy 1: look up by room_code (normal formatted code e.g. ABC-123) ──
      const { data: byCode, error: codeError } = await supabase
        .from('interviews')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (byCode) {
        data = byCode as Interview;
      } else if (looksLikeUUID(roomCode)) {
        // ── Strategy 2: URL contains a UUID — look up by id (old records) ──────
        const { data: byId, error: idError } = await supabase
          .from('interviews')
          .select('*')
          .eq('id', roomCode)
          .maybeSingle();

        if (byId) {
          data = byId as Interview;

          // If this old record has no proper room_code, generate + save one now
          if (!data.room_code || looksLikeUUID(data.room_code)) {
            const letters = Array.from({ length: 3 }, () =>
              String.fromCharCode(65 + Math.floor(Math.random() * 26))
            ).join('');
            const digits = Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, '0');
            const newCode = `${letters}-${digits}`;

            const { data: patched, error: patchError } = await supabase
              .from('interviews')
              .update({ room_code: newCode })
              .eq('id', data.id)
              .select()
              .single();

            if (!patchError && patched) {
              data = patched as Interview;
              // Redirect to the clean URL so future reloads use the proper code
              navigate(`/room/${newCode}`, { replace: true });
              return; // fetchInterview will re-run via the roomCode param change
            }
          } else {
            // Record already has a good room_code — just redirect to it
            navigate(`/room/${data.room_code}`, { replace: true });
            return;
          }
        } else {
          if (idError) console.error('ID lookup error:', idError);
        }
      } else {
        if (codeError) console.error('Code lookup error:', codeError);
      }

      if (!data) {
        setError('Interview not found. Check the room code.');
        setLoading(false);
        return;
      }

      setInterview(data);

      // Mark as in_progress when interviewer enters
      if (data.status === 'scheduled' && isInterviewerOrAdmin) {
        const { data: updated, error: updateError } = await supabase
          .from('interviews')
          .update({ status: 'in_progress' })
          .eq('id', data.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setInterview(updated as Interview);
      }

      // Candidate claims slot
      if (isCandidate && !data.candidate_id && user) {
        const { error: claimError } = await supabase
          .from('interviews')
          .update({ candidate_id: user.id })
          .eq('id', data.id);
        if (claimError)
          console.warn('Could not claim slot:', claimError.message);
      }
    } catch (err: any) {
      console.error('Error fetching interview:', err);
      if (err?.code === 'PGRST116' || err?.message?.includes('rows')) {
        setError('Interview not found. Check the room code.');
      } else {
        setError('Failed to load interview');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEndInterview = async () => {
    if (!interview) return;
    try {
      await supabase
        .from('interviews')
        .update({ status: 'completed' })
        .eq('id', interview.id);
      toast({ title: 'Interview ended' });
      navigate('/interviews');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to end interview.',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0)
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Joining interview room...</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'This interview room does not exist.'}
          </p>
          <Button onClick={() => navigate('/interviews')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Interviews
          </Button>
        </div>
      </div>
    );
  }

  const canEvaluate = isInterviewerOrAdmin;

  // ── Room ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/interviews')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="font-semibold truncate max-w-xs">
            {interview.title}
          </h1>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(elapsedSeconds)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex lg:hidden">
            <Button
              variant={activeView === 'code' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('code')}
            >
              <Code2 className="h-4 w-4" />
            </Button>
            <Button
              variant={activeView === 'video' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('video')}
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant={showAssistant ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAssistant(!showAssistant)}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI Help</span>
          </Button>

          {canEvaluate && (
            <Button
              variant={showEvaluation ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowEvaluation(!showEvaluation)}
              className="gap-2"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Evaluation</span>
            </Button>
          )}

          {canEvaluate && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndInterview}
            >
              End Interview
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={showEvaluation ? 45 : 60}
            minSize={30}
            className={cn('p-4', activeView !== 'code' && 'hidden lg:block')}
          >
            <CodeEditor interviewId={interview.id} />
          </ResizablePanel>

          <ResizableHandle withHandle className="hidden lg:flex" />

          <ResizablePanel
            defaultSize={showEvaluation ? 30 : 40}
            minSize={25}
            className={cn('p-4', activeView !== 'video' && 'hidden lg:block')}
          >
            {/* Always pass interview.room_code from DB — never the URL param */}
            <VideoCall
              roomCode={interview.room_code ?? undefined}
              role={userRole}
              userName={userName}
              onLeave={() => navigate('/interviews')}
            />
          </ResizablePanel>

          {showEvaluation && canEvaluate && (
            <>
              <ResizableHandle withHandle className="hidden lg:flex" />
              <ResizablePanel
                defaultSize={25}
                minSize={20}
                className="p-4 hidden lg:block"
              >
                <EvaluationPanel
                  interviewId={interview.id}
                  elapsedSeconds={elapsedSeconds}
                />
              </ResizablePanel>
            </>
          )}

          {showAssistant && !showEvaluation && (
            <>
              <ResizableHandle withHandle className="hidden lg:flex" />
              <ResizablePanel
                defaultSize={25}
                minSize={20}
                className="p-4 hidden lg:block"
              >
                <InterviewChatbot mode={userRole} className="h-full" />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile: evaluation overlay */}
        {showEvaluation && canEvaluate && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border p-4 z-50 animate-slide-up">
            <EvaluationPanel
              interviewId={interview.id}
              elapsedSeconds={elapsedSeconds}
            />
          </div>
        )}

        {/* Mobile: assistant overlay */}
        {showAssistant && !showEvaluation && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border z-50 animate-slide-up">
            <InterviewChatbot
              mode={userRole}
              className="h-full rounded-none border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
