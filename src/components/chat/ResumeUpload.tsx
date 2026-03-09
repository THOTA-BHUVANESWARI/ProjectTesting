import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Trash2, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ResumeUploadProps {
  userId: string;
  currentResumeUrl?: string | null;
  currentFilename?: string | null;
  onUploadComplete: (url: string, filename: string) => void;
  onDelete?: () => void;
  className?: string;
}

export function ResumeUpload({
  userId,
  currentResumeUrl,
  currentFilename,
  onUploadComplete,
  onDelete,
  className,
}: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or Word document",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // Delete old resume if exists
      if (currentResumeUrl) {
        const oldPath = currentResumeUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("resumes").remove([oldPath]);
      }

      // Upload new resume
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          resume_url: urlData.publicUrl,
          resume_filename: file.name,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      onUploadComplete(urlData.publicUrl, file.name);
      toast({
        title: "Resume uploaded",
        description: "Your resume has been uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentResumeUrl) return;

    try {
      const filePath = currentResumeUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("resumes").remove([filePath]);

      await supabase
        .from("profiles")
        .update({
          resume_url: null,
          resume_filename: null,
        })
        .eq("id", userId);

      onDelete?.();
      toast({
        title: "Resume deleted",
        description: "Your resume has been removed",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete resume",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume
        </CardTitle>
        <CardDescription>
          Upload your resume for personalized interview assistance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentResumeUrl ? (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">
                  {currentFilename || "Resume"}
                </p>
                <p className="text-xs text-muted-foreground">Uploaded</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              isUploading && "opacity-50 pointer-events-none"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {isUploading ? "Uploading..." : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF or Word (max 5MB)</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
