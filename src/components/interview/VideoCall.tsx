import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  Maximize2,
  Circle,
  Square,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface VideoCallProps {
  roomCode: string;
  onLeave?: () => void;
}

export function VideoCall({ roomCode, onLeave }: VideoCallProps) {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  /* ---------------- Attach Camera Stream Safely ---------------- */

  useEffect(() => {
    if (localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [isVideoOn]);

  /* ---------------- Cleanup ---------------- */

  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      stopStream(screenStreamRef.current);
    };
  }, []);

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  /* ================= CAMERA ================= */

  const toggleVideo = async () => {
    try {
      if (isVideoOn) {
        stopStream(streamRef.current);
        streamRef.current = null;
        setIsVideoOn(false);
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: isAudioOn,
      });

      streamRef.current = mediaStream;
      setIsVideoOn(true);

      if (mediaStream.getAudioTracks().length > 0) {
        setIsAudioOn(true);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Camera Error",
        description: "Please allow camera permission.",
        variant: "destructive",
      });
    }
  };

  /* ================= AUDIO ================= */

  const toggleAudio = async () => {
    try {
      if (!streamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = audioStream;
      }

      const audioTracks = streamRef.current.getAudioTracks();

      if (isAudioOn) {
        audioTracks.forEach((track) => (track.enabled = false));
        setIsAudioOn(false);
      } else {
        if (audioTracks.length === 0) {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          audioStream
            .getAudioTracks()
            .forEach((track) => streamRef.current?.addTrack(track));
        } else {
          audioTracks.forEach((track) => (track.enabled = true));
        }
        setIsAudioOn(true);
      }
    } catch {
      toast({
        title: "Microphone Error",
        description: "Please allow microphone permission.",
        variant: "destructive",
      });
    }
  };

  /* ================= SCREEN SHARE ================= */

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = displayStream;

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = displayStream;
        screenVideoRef.current.play().catch(() => {});
      }

      displayStream.getVideoTracks()[0].onended = () => {
        stopStream(displayStream);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      };

      setIsScreenSharing(true);
    } catch {
      toast({
        title: "Screen Share Error",
        description: "Unable to share screen.",
        variant: "destructive",
      });
    }
  };

  /* ================= RECORDING ================= */

  const startRecording = () => {
    const activeStream = screenStreamRef.current || streamRef.current;

    if (!activeStream) {
      toast({
        title: "Recording Error",
        description: "Turn on camera or screen share first.",
        variant: "destructive",
      });
      return;
    }

    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(activeStream, {
      mimeType: "video/webm",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, {
        type: "video/webm",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${roomCode}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    isRecording ? stopRecording() : startRecording();
  };

  /* ================= LEAVE ================= */

  const handleLeave = () => {
    stopStream(streamRef.current);
    stopStream(screenStreamRef.current);
    mediaRecorderRef.current?.stop();
    onLeave?.();
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl overflow-hidden">
      <div className="flex-1 p-4 grid grid-cols-1 gap-4 relative">
        {isScreenSharing && (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black rounded-lg"
          />
        )}

        <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
          {isVideoOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="text-center text-white">
              <Avatar className="w-20 h-20 mx-auto mb-3">
                <AvatarFallback>You</AvatarFallback>
              </Avatar>
              <p>Camera off</p>
            </div>
          )}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="px-4 py-3 flex items-center justify-center gap-3 flex-wrap border-t">
        <Button onClick={toggleAudio} className="rounded-full">
          {isAudioOn ? <Mic /> : <MicOff />}
        </Button>

        <Button onClick={toggleVideo} className="rounded-full">
          {isVideoOn ? <Video /> : <VideoOff />}
        </Button>

        <Button onClick={toggleScreenShare} className="rounded-full">
          {isScreenSharing ? <MonitorOff /> : <Monitor />}
        </Button>

        <Button
          onClick={toggleRecording}
          variant={isRecording ? "destructive" : "secondary"}
          className="rounded-full"
        >
          {isRecording ? <Square /> : <Circle />}
        </Button>

        <Button onClick={handleLeave} variant="destructive" className="rounded-full">
          <Phone className="rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}