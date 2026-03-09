import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { InterviewChatbot } from "@/components/chat/InterviewChatbot";
import { ResumeUpload } from "@/components/chat/ResumeUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AssistantChat() {
  const { user, role, profile } = useAuth();
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  // Determine available modes based on user role
  const isInterviewer = role === "interviewer" || role === "admin";
  const isCandidate = role === "candidate" || role === "admin";
  const defaultMode = isCandidate ? "candidate" : "interviewer";

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("resume_url, resume_filename")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setResumeUrl(data.resume_url);
          setResumeFilename(data.resume_filename);
          
          // For demo purposes, we'll use the filename as context
          // In production, you'd want to parse the PDF/DOCX content
          if (data.resume_url) {
            setResumeText(`Resume file: ${data.resume_filename}`);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Interview Assistant</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered assistance for interview preparation and conducting
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resume Upload - Only for candidates */}
          {isCandidate && user && (
            <div className="lg:col-span-1">
              <ResumeUpload
                userId={user.id}
                currentResumeUrl={resumeUrl}
                currentFilename={resumeFilename}
                onUploadComplete={(url, filename) => {
                  setResumeUrl(url);
                  setResumeFilename(filename);
                  setResumeText(`Resume file: ${filename}`);
                }}
                onDelete={() => {
                  setResumeUrl(null);
                  setResumeFilename(null);
                  setResumeText(undefined);
                }}
              />
            </div>
          )}

          {/* Chat Interface */}
          <div className={isCandidate ? "lg:col-span-2" : "lg:col-span-3"}>
            {role === "admin" ? (
              <Tabs defaultValue={defaultMode} className="h-[600px] flex flex-col">
                <TabsList className="w-fit">
                  <TabsTrigger value="candidate">Candidate Mode</TabsTrigger>
                  <TabsTrigger value="interviewer">Interviewer Mode</TabsTrigger>
                </TabsList>
                <TabsContent value="candidate" className="flex-1 mt-4">
                  <InterviewChatbot
                    mode="candidate"
                    resumeText={resumeText}
                    className="h-full"
                  />
                </TabsContent>
                <TabsContent value="interviewer" className="flex-1 mt-4">
                  <InterviewChatbot
                    mode="interviewer"
                    resumeText={resumeText}
                    className="h-full"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <InterviewChatbot
                mode={isInterviewer ? "interviewer" : "candidate"}
                resumeText={resumeText}
                className="h-[600px]"
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
