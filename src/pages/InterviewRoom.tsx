// import { useEffect, useState, useRef } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { useAuth } from '@/hooks/useAuth';
// import { supabase } from '@/integrations/supabase/client';
// import { Interview } from '@/types/database';
// import { VideoCall } from '@/components/interview/VideoCall';
// import { CodeEditor } from '@/components/interview/CodeEditor';
// import { EvaluationPanel } from '@/components/interview/EvaluationPanel';
// import { InterviewChatbot } from '@/components/chat/InterviewChatbot';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
// import { 
//   ArrowLeft, 
//   Clock, 
//   Code2, 
//   Video, 
//   ClipboardCheck,
//   Loader2,
//   AlertCircle,
//   Bot,
// } from 'lucide-react';
// import { toast } from '@/hooks/use-toast';
// import { cn } from '@/lib/utils';

// export default function InterviewRoom() {
//   const { roomCode } = useParams();
//   const navigate = useNavigate();
//   const { user, isInterviewer, isAdmin } = useAuth();
  
//   const [interview, setInterview] = useState<Interview | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [elapsedSeconds, setElapsedSeconds] = useState(0);
//   const [activeView, setActiveView] = useState<'code' | 'video'>('code');
//   const [showEvaluation, setShowEvaluation] = useState(false);
//   const [showAssistant, setShowAssistant] = useState(false);
  
//   const timerRef = useRef<NodeJS.Timeout | null>(null);

//   useEffect(() => {
//     if (roomCode) {
//       fetchInterview();
//     }
//   }, [roomCode]);

//   useEffect(() => {
//     // Start timer when interview is in progress
//     if (interview?.status === 'in_progress') {
//       timerRef.current = setInterval(() => {
//         setElapsedSeconds(prev => prev + 1);
//       }, 1000);
//     }

//     return () => {
//       if (timerRef.current) {
//         clearInterval(timerRef.current);
//       }
//     };
//   }, [interview?.status]);

//   const fetchInterview = async () => {
//     try {
//       const { data, error: fetchError } = await supabase
//         .from('interviews')
//         .select('*')
//         .eq('room_code', roomCode)
//         .single();

//       if (fetchError) throw fetchError;
      
//       if (!data) {
//         setError('Interview not found');
//         return;
//       }

//       setInterview(data as Interview);
      
//       // Start interview if not already started
//       if (data.status === 'scheduled') {
//         await supabase
//           .from('interviews')
//           .update({ status: 'in_progress' })
//           .eq('id', data.id);
        
//         setInterview({ ...data, status: 'in_progress' } as Interview);
//       }
//     } catch (err) {
//       console.error('Error fetching interview:', err);
//       setError('Failed to load interview');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleEndInterview = async () => {
//     if (!interview) return;

//     try {
//       await supabase
//         .from('interviews')
//         .update({ status: 'completed' })
//         .eq('id', interview.id);

//       toast({
//         title: 'Interview ended',
//         description: 'The interview session has been completed.',
//       });
//       navigate('/interviews');
//     } catch (error) {
//       console.error('Error ending interview:', error);
//       toast({
//         title: 'Error',
//         description: 'Failed to end interview.',
//         variant: 'destructive',
//       });
//     }
//   };

//   const formatTime = (seconds: number) => {
//     const hrs = Math.floor(seconds / 3600);
//     const mins = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;
    
//     if (hrs > 0) {
//       return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//     }
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-background">
//         <div className="text-center">
//           <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
//           <p className="text-muted-foreground">Joining interview room...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error || !interview) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-background">
//         <div className="text-center">
//           <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
//           <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
//           <p className="text-muted-foreground mb-4">{error || 'This interview room does not exist.'}</p>
//           <Button onClick={() => navigate('/interviews')}>
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back to Interviews
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   const canEvaluate = isInterviewer || isAdmin;
//   const userMode = isInterviewer || isAdmin ? 'interviewer' : 'candidate';

//   return (
//     <div className="h-screen flex flex-col bg-background">
//       {/* Header */}
//       <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
//         <div className="flex items-center gap-4">
//           <Button variant="ghost" size="sm" onClick={() => navigate('/interviews')}>
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Exit
//           </Button>
//           <div className="h-6 w-px bg-border" />
//           <h1 className="font-semibold truncate max-w-xs">{interview.title}</h1>
//           <Badge variant="outline" className="gap-1">
//             <Clock className="h-3 w-3" />
//             {formatTime(elapsedSeconds)}
//           </Badge>
//         </div>

//         <div className="flex items-center gap-2">
//           {/* View Toggle (mobile) */}
//           <div className="flex lg:hidden">
//             <Button
//               variant={activeView === 'code' ? 'default' : 'ghost'}
//               size="sm"
//               onClick={() => setActiveView('code')}
//             >
//               <Code2 className="h-4 w-4" />
//             </Button>
//             <Button
//               variant={activeView === 'video' ? 'default' : 'ghost'}
//               size="sm"
//               onClick={() => setActiveView('video')}
//             >
//               <Video className="h-4 w-4" />
//             </Button>
//           </div>

//           <Button
//             variant={showAssistant ? 'default' : 'outline'}
//             size="sm"
//             onClick={() => setShowAssistant(!showAssistant)}
//             className="gap-2"
//           >
//             <Bot className="h-4 w-4" />
//             <span className="hidden sm:inline">AI Help</span>
//           </Button>

//           {canEvaluate && (
//             <Button
//               variant={showEvaluation ? 'default' : 'outline'}
//               size="sm"
//               onClick={() => setShowEvaluation(!showEvaluation)}
//               className="gap-2"
//             >
//               <ClipboardCheck className="h-4 w-4" />
//               <span className="hidden sm:inline">Evaluation</span>
//             </Button>
//           )}

//           {canEvaluate && (
//             <Button variant="destructive" size="sm" onClick={handleEndInterview}>
//               End Interview
//             </Button>
//           )}
//         </div>
//       </header>

//       {/* Main Content */}
//       <div className="flex-1 min-h-0">
//         <ResizablePanelGroup direction="horizontal" className="h-full">
//           {/* Code Editor Panel */}
//           <ResizablePanel 
//             defaultSize={showEvaluation ? 45 : 60} 
//             minSize={30}
//             className={cn(
//               "p-4",
//               activeView !== 'code' && "hidden lg:block"
//             )}
//           >
//             <CodeEditor interviewId={interview.id} />
//           </ResizablePanel>

//           <ResizableHandle withHandle className="hidden lg:flex" />

//           {/* Video Panel */}
//           <ResizablePanel 
//             defaultSize={showEvaluation ? 30 : 40} 
//             minSize={25}
//             className={cn(
//               "p-4",
//               activeView !== 'video' && "hidden lg:block"
//             )}
//           >
//             <VideoCall 
//               roomCode={interview.room_code} 
//               onLeave={() => navigate('/interviews')}
//             />
//           </ResizablePanel>

//           {/* Evaluation Panel */}
//           {showEvaluation && canEvaluate && (
//             <>
//               <ResizableHandle withHandle className="hidden lg:flex" />
//               <ResizablePanel defaultSize={25} minSize={20} className="p-4 hidden lg:block">
//                 <EvaluationPanel 
//                   interviewId={interview.id} 
//                   elapsedSeconds={elapsedSeconds}
//                 />
//               </ResizablePanel>
//             </>
//           )}

//           {/* AI Assistant Panel */}
//           {showAssistant && !showEvaluation && (
//             <>
//               <ResizableHandle withHandle className="hidden lg:flex" />
//               <ResizablePanel defaultSize={25} minSize={20} className="p-4 hidden lg:block">
//                 <InterviewChatbot 
//                   mode={userMode}
//                   className="h-full"
//                 />
//               </ResizablePanel>
//             </>
//           )}
//         </ResizablePanelGroup>

//         {/* Mobile Evaluation Panel */}
//         {showEvaluation && canEvaluate && (
//           <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border p-4 z-50 animate-slide-up">
//             <EvaluationPanel 
//               interviewId={interview.id} 
//               elapsedSeconds={elapsedSeconds}
//             />
//           </div>
//         )}

//         {/* Mobile AI Assistant Panel */}
//         {showAssistant && !showEvaluation && (
//           <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border z-50 animate-slide-up">
//             <InterviewChatbot 
//               mode={userMode}
//               className="h-full rounded-none border-0"
//             />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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

export default function InterviewRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, isInterviewer, isAdmin } = useAuth();
  
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeView, setActiveView] = useState<'code' | 'video'>('code');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (roomCode) {
      fetchInterview();
    }
  }, [roomCode]);

  useEffect(() => {
    // Start timer when interview is in progress
    if (interview?.status === 'in_progress') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [interview?.status]);

  // const fetchInterview = async () => {
  //   try {

  //     const { data, error: fetchError } = await supabase
  //       .from('interviews')
  //       .select('*')
  //       .eq('room_code', roomCode)
  //       .single();

        

  //     if (fetchError) throw fetchError;
      
  //     if (!data) {
  //       setError('Interview not found');
  //       return;
  //     }

  //     setInterview(data as Interview);
      
  //     // Start interview if not already started
  //     if (data.status === 'scheduled') {
  //       await supabase
  //         .from('interviews')
  //         .update({ status: 'in_progress' })
  //         .eq('id', data.id);
        
  //       setInterview({ ...data, status: 'in_progress' } as Interview);
  //     }
  //   } catch (err) {
  //     console.error('Error fetching interview:', err);
  //     setError('Failed to load interview');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const fetchInterview = async () => {
  try {
    console.log("🚀 Fetching interview for room:", roomCode);

    const { data, error: fetchError } = await supabase
      .from('interviews')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    console.log("📦 Raw data from DB:", data);
    console.log("❌ Fetch error:", fetchError);

    if (fetchError) throw fetchError;

    if (!data) {
      console.log("⚠️ No interview found");
      setError('Interview not found');
      return;
    }

    console.log("✅ Interview found:");
    console.log("   ID:", data.id);
    console.log("   Status:", data.status);
    console.log("   Candidate ID:", data.candidate_id);

    setInterview(data as Interview);

    // 🔥 AUTO START LOGIC
    if (data.status === 'scheduled') {
      console.log("🔄 Status is 'scheduled' → updating to 'in_progress'");

      const { data: updateData, error: updateError } = await supabase
        .from('interviews')
        .update({ status: 'in_progress' })
        .eq('id', data.id)
        .select()
        .single();

      console.log("📤 Update response:", updateData);
      console.log("❌ Update error:", updateError);

      if (updateError) throw updateError;

      console.log("🧪 After update:");
      console.log("   Status:", updateData.status);
      console.log("   Candidate ID:", updateData.candidate_id);

      setInterview(updateData as Interview);
    }

  } catch (err) {
    console.error("💥 Error fetching interview:", err);
    setError('Failed to load interview');
  } finally {
    setLoading(false);
    console.log("🏁 Fetch interview completed");
  }
};
  const handleEndInterview = async () => {
    if (!interview) return;

    try {
      await supabase
        .from('interviews')
        .update({ status: 'completed' })
        .eq('id', interview.id);

      toast({
        title: 'Interview ended',
        description: 'The interview session has been completed.',
      });
      navigate('/interviews');
    } catch (error) {
      console.error('Error ending interview:', error);
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
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  if (error || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || 'This interview room does not exist.'}</p>
          <Button onClick={() => navigate('/interviews')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Interviews
          </Button>
        </div>
      </div>
    );
  }

  const canEvaluate = isInterviewer || isAdmin;
  const userMode = isInterviewer || isAdmin ? 'interviewer' : 'candidate';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/interviews')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="font-semibold truncate max-w-xs">{interview.title}</h1>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(elapsedSeconds)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle (mobile) */}
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
            <Button variant="destructive" size="sm" onClick={handleEndInterview}>
              End Interview
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Code Editor Panel */}
          <ResizablePanel 
            defaultSize={showEvaluation ? 45 : 60} 
            minSize={30}
            className={cn(
              "p-4",
              activeView !== 'code' && "hidden lg:block"
            )}
          >
            <CodeEditor interviewId={interview.id} />
          </ResizablePanel>

          <ResizableHandle withHandle className="hidden lg:flex" />

          {/* Video Panel */}
          <ResizablePanel 
            defaultSize={showEvaluation ? 30 : 40} 
            minSize={25}
            className={cn(
              "p-4",
              activeView !== 'video' && "hidden lg:block"
            )}
          >
            <VideoCall 
              roomCode={interview.room_code} 
              onLeave={() => navigate('/interviews')}
            />
          </ResizablePanel>

          {/* Evaluation Panel */}
          {showEvaluation && canEvaluate && (
            <>
              <ResizableHandle withHandle className="hidden lg:flex" />
              <ResizablePanel defaultSize={25} minSize={20} className="p-4 hidden lg:block">
                <EvaluationPanel 
                  interviewId={interview.id} 
                  elapsedSeconds={elapsedSeconds}
                />
              </ResizablePanel>
            </>
          )}

          {/* AI Assistant Panel */}
          {showAssistant && !showEvaluation && (
            <>
              <ResizableHandle withHandle className="hidden lg:flex" />
              <ResizablePanel defaultSize={25} minSize={20} className="p-4 hidden lg:block">
                <InterviewChatbot 
                  mode={userMode}
                  className="h-full"
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile Evaluation Panel */}
        {showEvaluation && canEvaluate && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border p-4 z-50 animate-slide-up">
            <EvaluationPanel 
              interviewId={interview.id} 
              elapsedSeconds={elapsedSeconds}
            />
          </div>
        )}

        {/* Mobile AI Assistant Panel */}
        {showAssistant && !showEvaluation && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-card border-t border-border z-50 animate-slide-up">
            <InterviewChatbot 
              mode={userMode}
              className="h-full rounded-none border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}