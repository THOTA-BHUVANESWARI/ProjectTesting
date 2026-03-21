import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, UserCheck, ArrowRight, Copy, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function InterviewLobby() {
  const { user, isInterviewer, isCandidate, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [interviewCode, setInterviewCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Interviewer: after creating a quick session
  const [generatedCode, setGeneratedCode] = useState('');
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [candidateJoined, setCandidateJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const canInterview = isInterviewer || isAdmin;
  const canJoinAsCandidate = isCandidate;

  // ── Redirect if not logged in ──────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to access the interview lobby.',
        variant: 'destructive',
      });
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // ── Realtime: watch for candidate joining (interviewer side) ───────────
  useEffect(() => {
    if (!interviewId) return;

    const channel = supabase
      .channel(`lobby-interview-${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interviewId}`,
        },
        (payload) => {
          if (payload.new.candidate_id) {
            setCandidateJoined(true);
            toast({ title: '🎉 Candidate has joined!' });
            // Auto-navigate interviewer into the room
            setTimeout(() => navigate(`/room/${payload.new.room_code}`), 1000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [interviewId, navigate]);

  // ── Interviewer: start a quick session ────────────────────────────────
  const startInterview = async () => {
    if (!user || !canInterview) {
      toast({
        title: 'Permission Denied',
        description: 'Only interviewers can start interviews.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Insert WITHOUT room_code — the DB trigger auto-generates ABC-123 format
      const { data, error } = await supabase
        .from('interviews')
        .insert({
          title: 'Quick Interview Session',
          scheduled_at: new Date().toISOString(),
          status: 'in_progress',
          interviewer_id: user.id,
        })
        .select('id, room_code')
        .single();

      if (error) throw error;

      setInterviewId(data.id);
      setGeneratedCode(data.room_code);

      toast({
        title: 'Interview room created!',
        description: `Share code ${data.room_code} with your candidate.`,
      });
    } catch (err) {
      console.error('Error starting interview:', err);
      toast({
        title: 'Error',
        description: 'Failed to start interview.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Interviewer: enter room directly ─────────────────────────────────
  const enterRoom = () => {
    if (generatedCode) navigate(`/room/${generatedCode}`);
  };

  // ── Candidate: join by room code ──────────────────────────────────────
  const joinInterview = async () => {
    const code = interviewCode.trim().toUpperCase();

    if (!user) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    if (!code) {
      toast({ title: 'Enter a room code', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Look up interview — RLS allows candidates to see scheduled/in_progress
      const { data: interview, error: fetchError } = await supabase
        .from('interviews')
        .select('id, status, candidate_id, room_code')
        .eq('room_code', code)
        .in('status', ['scheduled', 'in_progress'])
        .single();

      if (fetchError || !interview) {
        toast({
          title: 'Interview not found',
          description: 'Check the code and try again. The room must be scheduled or in progress.',
          variant: 'destructive',
        });
        return;
      }

      // Claim candidate slot if empty
      if (!interview.candidate_id) {
        const { error: claimError } = await supabase
          .from('interviews')
          .update({ candidate_id: user.id })
          .eq('id', interview.id);

        if (claimError) {
          console.warn('Could not claim slot:', claimError.message);
          // Non-fatal — still let them into the room
        }
      }

      toast({ title: 'Joining interview room…' });
      navigate(`/room/${interview.room_code}`);
    } catch (err) {
      console.error('Error joining interview:', err);
      toast({
        title: 'Error',
        description: 'Failed to join interview.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: 'Room code copied to clipboard.' });
  };

  // ── Loading / auth guard ───────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // ── Interviewer: waiting for candidate (room code shown) ──────────────
  if (canInterview && generatedCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Interview Room Ready</CardTitle>
                <CardDescription>Share the code below with your candidate</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Room code */}
            <div className="space-y-2">
              <Label>Room Code</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="font-mono text-2xl tracking-widest text-center font-bold h-14"
                />
                <Button variant="outline" size="icon" className="h-14 w-14" onClick={copyCode}>
                  {copied
                    ? <Check className="w-5 h-5 text-green-500" />
                    : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send this code to your candidate via email or chat
              </p>
            </div>

            {/* Candidate status */}
            <div className="p-4 rounded-xl bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${candidateJoined ? 'bg-green-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-sm font-medium">
                  {candidateJoined ? '🎉 Candidate joined — entering room…' : 'Waiting for candidate to join…'}
                </span>
              </div>
            </div>

            {/* Enter room now (don't wait) */}
            <Button className="w-full h-12" onClick={enterRoom}>
              Enter Room Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setGeneratedCode(''); setInterviewId(null); setCandidateJoined(false); }}
            >
              ← Start New Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Interviewer: start screen ─────────────────────────────────────────
  if (canInterview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
              Interview Room
            </h1>
            <p className="text-muted-foreground text-lg">Start a session or join an existing one</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Start as interviewer */}
            <Card className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-2 hover:border-primary/50 group">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <UserCheck className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Start as Interviewer</CardTitle>
                <CardDescription>Create a room and share the code with your candidate</CardDescription>
              </CardHeader>
              <CardContent className="text-center pt-2">
                <Button
                  className="gap-2 w-full"
                  onClick={startInterview}
                  disabled={loading}
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><ArrowRight className="w-4 h-4" /> Create Room</>}
                </Button>
              </CardContent>
            </Card>

            {/* Join as candidate (for testing) */}
            <Card className="transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-2 hover:border-accent/50 group">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Join with Code</CardTitle>
                <CardDescription>Enter a room code to join an existing interview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="e.g. ABC-123"
                  value={interviewCode}
                  onChange={(e) => setInterviewCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinInterview()}
                  className="font-mono text-center tracking-widest"
                  maxLength={10}
                />
                <Button
                  onClick={joinInterview}
                  disabled={loading || !interviewCode.trim()}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Join Interview
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Candidate-only flow ────────────────────────────────────────────────
  if (canJoinAsCandidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle>Candidate Access</CardTitle>
                <CardDescription>Join your interview session</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Enter Interview Code</Label>
              <Input
                placeholder="e.g. ABC-123"
                value={interviewCode}
                onChange={(e) => setInterviewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinInterview()}
                className="font-mono text-center text-lg tracking-widest h-12"
                maxLength={10}
                autoFocus
              />
            </div>

            <Button
              onClick={joinInterview}
              disabled={loading || !interviewCode.trim()}
              className="w-full h-12 text-base"
              size="lg"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining…</>
                : 'Join Interview'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setInterviewCode('')}
            >
              ← Enter Different Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── No valid role ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>
            Your account doesn't have the required permissions.
            Please contact an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
