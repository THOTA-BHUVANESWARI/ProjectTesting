import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, UserCheck, ArrowRight, Copy, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

// Feedback validation schema
const feedbackSchema = z.object({
  feedback: z.string()
    .trim()
    .min(10, 'Feedback must be at least 10 characters')
    .max(2000, 'Feedback must be less than 2000 characters')
});
export default function InterviewLobby() {
  const { user, isInterviewer, isCandidate, isAdmin, loading: authLoading , role} = useAuth();
  useEffect(() => {
    console.log("ROLE VALUE:", role);
  console.log("User id:", user);
  console.log("isInterviewer:", isInterviewer);
  console.log("isCandidate:", isCandidate);
  console.log("isAdmin:", isAdmin);
  console.log("authLoading:", authLoading);
}, [user, isInterviewer, isCandidate, isAdmin, authLoading,role]);
  const navigate = useNavigate();
  
  const [interviewCode, setInterviewCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<'waiting' | 'joined' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [candidateView, setCandidateView] = useState<'input' | 'waiting' | 'inprogress'>('input');
  const {roomCode} = useParams();
 

  // Determine user's role from database
  const canInterview = isInterviewer || isAdmin;
  const canJoinAsCandidate = isCandidate;

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      toast({ 
        title: 'Authentication Required', 
        description: 'Please sign in to access the interview lobby.',
        variant: 'destructive' 
      });
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // const startInterview = async () => {
  //   if (!user) {
  //     toast({ title: 'Please sign in to start an interview', variant: 'destructive' });
  //     navigate('/auth');
  //     return;
  //   }

  //   if (!canInterview) {
  //     toast({ title: 'Permission Denied', description: 'Only interviewers can start interviews.', variant: 'destructive' });
  //     return;
  //   }

  //   setLoading(true);
  //   try {
  //     const { data, error } = await supabase
  //       .from('interviews')
  //       .insert({
  //         title: 'Quick Interview Session',
  //         scheduled_at: new Date().toISOString(),
  //         status: 'in_progress',
  //         interviewer_id: user.id,
  //       })
  //       .select('id, room_code')
  //       .single();

  //     if (error) throw error;

  //     setInterviewId(data.id);
  //     setGeneratedCode(data.room_code || data.id.slice(0, 8));
  //     setCandidateStatus('waiting');

  //     // Subscribe to real-time updates for candidate joining
  //     const channel = supabase
  //       .channel(`interview-${data.id}`)
  //       .on(
  //         'postgres_changes',
  //         {
  //           event: 'UPDATE',
  //           schema: 'public',
  //           table: 'interviews',
  //           filter: `id=eq.${data.id}`,
  //         },
  //         (payload) => {
  //           if (payload.new.candidate_id) {
  //             setCandidateStatus('joined');
  //             toast({ title: 'Candidate has joined!' });
  //           }
  //         }
  //       )
  //       .subscribe();

  //     toast({ title: 'Interview started!', description: 'Share the code with your candidate.' });
  //   } catch (error) {
  //     console.error('Error starting interview:', error);
  //     toast({ title: 'Error', description: 'Failed to start interview.', variant: 'destructive' });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Function to generate a random 6-character room code
const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// const startInterview = async () => {
//   if (!user) {
//     toast({ title: 'Please sign in to start an interview', variant: 'destructive' });
//     navigate('/auth');
//     return;
//   }

//   if (!canInterview) {
//     toast({ title: 'Permission Denied', description: 'Only interviewers can start interviews.', variant: 'destructive' });
//     return;
//   }

//   setLoading(true);
//   try {
//     const code = generateRoomCode();

//     const { data, error } = await supabase
//       .from('interviews')
//       .insert({
//         title: 'Quick Interview Session',
//         scheduled_at: new Date().toISOString(),
//         status: 'in_progress',
//         interviewer_id: user.id,
//         room_code: code, // insert code into DB
//       })
//       .select('id, room_code')
//       .single();

//     if (error) throw error;

//     setInterviewId(data.id);
//     setGeneratedCode(data.room_code); // DB now has it too
//     setCandidateStatus('waiting');

//     // Subscribe to real-time updates for candidate joining
//     // inside startInterview()
// const channel = supabase
//   .channel(`interview-${data.id}`)
//   .on(
//     'postgres_changes',
//     {
//       event: 'UPDATE',
//       schema: 'public',
//       table: 'interviews',
//       filter: `id=eq.${data.id}`,
//     },
//     (payload) => {
//       console.log('Realtime update:', payload.new);
//       if (payload.new.candidate_id) {
//         setCandidateStatus('joined');
//         toast({ title: 'Candidate has joined!' });
//       }
//       // Optional: if interview gets completed
//       if (payload.new.status === 'completed') {
//         toast({ title: 'Interview completed' });
//       }
//     }
//   )
//   .subscribe();

//     toast({ title: 'Interview started!', description: 'Share the code with your candidate.' });
//   } catch (error) {
//     console.error('Error starting interview:', error);
//     toast({ title: 'Error', description: 'Failed to start interview.', variant: 'destructive' });
//   } finally {
//     setLoading(false);
//   }
// };
//   const joinInterview = async () => {
//     if (!user) {
//       toast({ title: 'Please sign in to join an interview', variant: 'destructive' });
//       navigate('/auth');
//       return;
//     }

//     if (!interviewCode.trim()) {
//       toast({ title: 'Please enter an interview code', variant: 'destructive' });
//       return;
//     }

//     setLoading(true);
//     try {
//       // Find interview by room_code
//       const { data: interview, error } = await supabase
//         .from('interviews')
//         .select('id, status')
//         .or(`room_code.eq.${interviewCode.trim()},id.ilike.${interviewCode.trim()}%`)
//         .single();

        

//       if (error || !interview) {
//         toast({ title: 'Interview not found', description: 'Please check the code and try again.', variant: 'destructive' });
//         return;
//       }

//       setInterviewId(interview.id);

//       // if (interview.status === 'scheduled') {
//       //   setCandidateView('waiting');
//       // } else if (interview.status === 'in_progress') {
//       //   setCandidateView('inprogress');
//       //   // Mark candidate as joined using actual user ID
//       //   await supabase
//       //     .from('interviews')
//       //     .update({ candidate_id: user.id })
//       //     .eq('id', interview.id);
//       // }

//       // Subscribe to status changes
      
//       // Always update candidate_id when a candidate joins
// await supabase
//   .from('interviews')
//   .update({ candidate_id: user.id })
//   .eq('id', interview.id);

// // Set view based on interview status
// if (interview.status === 'scheduled') {
//   setCandidateView('waiting');
// } else {
//   setCandidateView('inprogress');
// }
      
//       const channel = supabase
//         .channel(`candidate-interview-${interview.id}`)
//         .on(
//           'postgres_changes',
//           {
//             event: 'UPDATE',
//             schema: 'public',
//             table: 'interviews',
//             filter: `id=eq.${interview.id}`,
//           },
//           (payload) => {
//             if (payload.new.status === 'in_progress') {
//               setCandidateView('inprogress');
//             } else if (payload.new.status === 'completed') {
//               toast({ title: 'Interview completed', description: 'Thank you for participating!' });
//             }
//           }
//         )
//         .subscribe();

//     } catch (error) {
//       console.error('Error joining interview:', error);
//       toast({ title: 'Error', description: 'Failed to join interview.', variant: 'destructive' });
//     } finally {
//       setLoading(false);
//     }
//   };

const startInterview = async () => {
  if (!user) {
    toast({ title: 'Please sign in to start an interview', variant: 'destructive' });
    navigate('/auth');
    return;
  }

  if (!canInterview) {
    toast({
      title: 'Permission Denied',
      description: 'Only interviewers can start interviews.',
      variant: 'destructive',
    });
    return;
  }

  setLoading(true);

  try {
    const code = generateRoomCode();

    const { data, error } = await supabase
      .from('interviews')
      .insert({
        title: 'Quick Interview Session',
        scheduled_at: new Date().toISOString(),
        status: 'in_progress',
        interviewer_id: user.id,
        room_code: code,
      })
      .select('id, room_code')
      .single();

    if (error) throw error;

    setInterviewId(data.id);
    setGeneratedCode(data.room_code);
    setCandidateStatus('waiting');

    toast({
      title: 'Interview started!',
      description: 'Share the code with your candidate.',
    });

  } catch (error) {
    console.error('Error starting interview:', error);
    toast({
      title: 'Error',
      description: 'Failed to start interview.',
      variant: 'destructive',
    });
  } finally {
    setLoading(false);
  }
};
useEffect(() => {
  if (!interviewId) return;

  const channel = supabase
    .channel(`interview-${interviewId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'interviews',
        filter: `id=eq.${interviewId}`,
      },
      (payload) => {

        if (payload.new.candidate_id !== null) {
  setCandidateStatus('joined');
  toast({ title: 'Candidate has joined!' });

  // 🔥 IMPORTANT: clear dashboard state
  setGeneratedCode('');
  setCandidateStatus(null);

  navigate(`/room/${payload.new.room_code}`);
}

        if (payload.new.status === 'completed') {
          toast({ title: 'Interview completed' });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };

}, [interviewId, navigate]);
// const joinInterview = async () => {
//   if (!user) {
//     toast({ title: 'Please sign in to join an interview', variant: 'destructive' });
//     navigate('/auth');
//     return;
//   }

//   if (!interviewCode.trim()) {
//     toast({ title: 'Please enter an interview code', variant: 'destructive' });
//     return;
//   }

//   setLoading(true);
//   try {
//     // 1️⃣ Find interview by room_code
//     const { data: interview, error: fetchError } = await supabase
//       .from('interviews')
//       .select('id, status, candidate_id')
//       .eq('room_code', interviewCode.trim())
//       .single();

//     if (fetchError || !interview) {
//       toast({ title: 'Interview not found', description: 'Please check the code and try again.', variant: 'destructive' });
//       return;
//     }

//     setInterviewId(interview.id);

//     // 2️⃣ Update candidate_id ONLY if it is not already taken
//     if (!interview.candidate_id) {
//       const { data: updatedInterview, error: updateError } = await supabase
//         .from('interviews')
//         .update({ candidate_id: user.id })
//         .eq('id', interview.id)
//         .select(); // return updated row

//       if (updateError) {
//         console.error('Failed to update candidate_id:', updateError);
//         toast({ title: 'Error', description: 'Could not mark you as joined.', variant: 'destructive' });
//         return;
//       } else {
//         console.log('Candidate joined successfully:', updatedInterview);
//       }
//     }

//     // 3️⃣ Set candidate view based on interview status
//     if (interview.status === 'scheduled') {
//       setCandidateView('waiting');
//     } else {
//       setCandidateView('inprogress');
//     }

//     // 4️⃣ Subscribe to interview status updates
//     const channel = supabase
//       .channel(`candidate-interview-${interview.id}`)
//       .on(
//         'postgres_changes',
//         {
//           event: 'UPDATE',
//           schema: 'public',
//           table: 'interviews',
//           filter: `id=eq.${interview.id}`,
//         },
//         (payload) => {
//           if (payload.new.status === 'in_progress') {
//             setCandidateView('inprogress');
//           } else if (payload.new.status === 'completed') {
//             toast({ title: 'Interview completed', description: 'Thank you for participating!' });
//           }
//         }
//       )
//       .subscribe();

//     toast({ title: 'Successfully joined the interview!' });
//   } catch (error) {
//     console.error('Error joining interview:', error);
//     toast({ title: 'Error', description: 'Failed to join interview.', variant: 'destructive' });
//   } finally {
//     setLoading(false);
//   }
// };
 const joinInterview = async () => {
  if (!user) {
    toast({ title: 'Please sign in to join an interview', variant: 'destructive' });
    navigate('/auth');
    return;
  }

  if (!interviewCode.trim()) {
    toast({ title: 'Please enter an interview code', variant: 'destructive' });
    return;
  }

  setLoading(true);

  try {
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, status, candidate_id, room_code')
      .eq('room_code', interviewCode.trim())
      .single();

    if (fetchError || !interview) {
      toast({
        title: 'Interview not found',
        description: 'Please check the code and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Update candidate_id if empty
    if (!interview.candidate_id) {
      const { error: updateError } = await supabase
        .from('interviews')
        .update({ candidate_id: user.id })
        .eq('id', interview.id);

      if (updateError) {
        console.error(updateError);
        toast({
          title: 'Error',
          description: 'Could not mark you as joined.',
          variant: 'destructive',
        });
        return;
      }
    }

    toast({ title: 'Successfully joined the interview!' });

    // 🚀 Candidate enters room immediately
    navigate(`/room/${interview.room_code}`);

  } catch (error) {
    console.error('Error joining interview:', error);
    toast({
      title: 'Error',
      description: 'Failed to join interview.',
      variant: 'destructive',
    });
  } finally {
    setLoading(false);
  }
};
const submitReview = async () => {
    if (!user) {
      toast({ title: 'Please sign in to submit a review', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    if (!interviewId) {
      toast({ title: 'No active interview', variant: 'destructive' });
      return;
    }

    // Validate feedback with Zod
    const validationResult = feedbackSchema.safeParse({ feedback });
    if (!validationResult.success) {
      toast({ 
        title: 'Invalid feedback', 
        description: validationResult.error.errors[0].message, 
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback_notes')
        .insert({
          interview_id: interviewId,
          evaluator_id: user.id,
          note: feedback.trim(),
          timestamp_seconds: 0,
          category: 'review',
        });

      if (error) throw error;

      // Mark interview as completed
      await supabase
        .from('interviews')
        .update({ status: 'completed' })
        .eq('id', interviewId);

      toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
      setFeedback('');
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Error', description: 'Failed to submit review.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  // Role Selection Screen - show both options to interviewers/admins
  const showRoleSelection = !generatedCode && candidateView === 'input';
  
  // Interviewers and admins see role selection (they can start interviews OR join as candidate to test)
  if (showRoleSelection && canInterview) {
    // User has both roles - show selection (rare case)
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
              Interview Room
            </h1>
            <p className="text-muted-foreground text-lg">Select how you want to participate</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-2",
                "hover:border-primary/50 group"
              )}
              onClick={startInterview}
            >
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <UserCheck className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Start as Interviewer</CardTitle>
                <CardDescription>
                  Start and manage interview sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Start Interview <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-2",
                "hover:border-accent/50 group"
              )}
            >
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Join as Candidate</CardTitle>
                <CardDescription>
                  Join an existing interview session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Enter interview code"
                  value={interviewCode}
                  onChange={(e) => setInterviewCode(e.target.value)}
                  className="font-mono"
                />
                <Button 
                  onClick={joinInterview} 
                  disabled={loading} 
                  variant="outline" 
                  className="w-full gap-2 group-hover:bg-accent group-hover:text-accent-foreground transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Join Interview <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Interviewer Dashboard - shown after starting an interview (has generated code)
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
                <CardTitle>Interviewer Dashboard</CardTitle>
                <CardDescription>Manage your interview session</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Interview Code */}
            <div className="space-y-2">
              <Label>Interview Code</Label>
              <div className="flex gap-2">
                <Input value={generatedCode} readOnly className="font-mono text-lg" />
                <Button variant="outline" size="icon" onClick={copyCode}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Share this code with your candidate</p>
            </div>

            {/* Candidate Status */}
            <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
              <Label>Candidate Status</Label>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  candidateStatus === 'joined' ? "bg-success animate-pulse" : "bg-warning"
                )} />
                <span className="text-sm font-medium">
                  {candidateStatus === 'joined' ? 'Candidate has joined' : 'Waiting for candidate...'}
                </span>
              </div>
            </div>

            {/* Feedback Form */}
            <div className="space-y-3">
              <Label>Feedback / Review</Label>
              <textarea
                placeholder="Enter your feedback about the candidate..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full min-h-[120px] p-3 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button 
                onClick={submitReview} 
                disabled={submitting || !feedback.trim()} 
                className="w-full"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Review
              </Button>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => { setGeneratedCode(''); setCandidateStatus(null); }}>
              ← Start New Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Candidate-only Flow (user has candidate role only, no interviewer access)
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
          <CardContent className="space-y-6">
            {candidateView === 'input' && (
              <>
                <div className="space-y-2">
                  <Label>Enter Interview Code</Label>
                  <Input
                    placeholder="e.g., abc123def"
                    value={interviewCode}
                    onChange={(e) => setInterviewCode(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <Button onClick={joinInterview} disabled={loading} className="w-full" size="lg">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Join Interview
                </Button>
              </>
            )}

            {candidateView === 'waiting' && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-warning mx-auto" />
                <div>
                  <h3 className="font-semibold text-lg">Waiting for interviewer...</h3>
                  <p className="text-muted-foreground text-sm">The interview hasn't started yet. Please wait.</p>
                </div>
              </div>
            )}

            {candidateView === 'inprogress' && (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-success">Interview in Progress</h3>
                  <p className="text-muted-foreground text-sm">You are connected to the interview session.</p>
                </div>
              </div>
            )}

            <Button variant="ghost" className="w-full" onClick={() => { setCandidateView('input'); setInterviewCode(''); }}>
              ← Enter Different Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback - user has no valid role for this page
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>
            Your account doesn't have the required permissions to access the interview lobby.
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