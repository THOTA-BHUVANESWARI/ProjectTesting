import { useState, useRef, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";

import {

  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,

  Phone, Circle, Square, Copy, Check, Users, Wifi, WifiOff, Loader2,

} from "lucide-react";

import { toast } from "@/hooks/use-toast";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { supabase } from "@/integrations/supabase/client";

import type { RealtimeChannel } from "@supabase/supabase-js";
 
type Role = "interviewer" | "candidate";

type CallStatus = "idle" | "joining" | "waiting" | "connecting" | "connected" | "error";
 
interface VideoCallProps {

  roomCode?: string;

  role: Role;

  userName?: string;

  onLeave?: () => void;

}
 
const RTC_CONFIG: RTCConfiguration = {

  iceServers: [

    { urls: "stun:stun.l.google.com:19302" },

    { urls: "stun:stun1.l.google.com:19302" },

    { urls: "stun:stun2.l.google.com:19302" },

    { urls: "stun:stun3.l.google.com:19302" },

  ],

};
 
const ICE_DISCONNECT_GRACE_MS = 4000;
 
export function VideoCall({

  roomCode: initialRoomCode,

  role,

  userName = "You",

  onLeave,

}: VideoCallProps) {

  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");

  const [roomCodeInput, setRoomCodeInput] = useState("");

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");

  const [isVideoOn, setIsVideoOn] = useState(false);

  const [isAudioOn, setIsAudioOn] = useState(false);

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [isRecording, setIsRecording] = useState(false);

  const [isCopied, setIsCopied] = useState(false);

  const [remoteName, setRemoteName] = useState("");

  const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(false);
 
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const makingOfferRef = useRef(false);

  const ignoreOfferRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const recordedChunksRef = useRef<Blob[]>([]);

  const autoStartedRef = useRef(false);

  const iceDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // NEW: Store remote stream for retry logic

  const remoteStreamRef = useRef<MediaStream | null>(null);
 
  // ── Helpers ───────────────────────────────────────────────────────────────
 
  const stopStream = (stream: MediaStream | null) => {

    stream?.getTracks().forEach((t) => t.stop());

  };
 
  const attachLocalStream = useCallback((stream: MediaStream) => {

    const tryAttach = (attempts = 0) => {

      if (localVideoRef.current) {

        localVideoRef.current.srcObject = stream;

        localVideoRef.current.play().catch(() => {

          console.warn("Failed to autoplay local video");

        });

      } else if (attempts < 30) {

        setTimeout(() => tryAttach(attempts + 1), 100);

      }

    };

    tryAttach();

  }, []);
 
  // NEW: Helper to attach remote stream with retry logic

  const attachRemoteStream = useCallback((stream: MediaStream) => {

    remoteStreamRef.current = stream;

    const tryAttach = (attempts = 0) => {

      if (remoteVideoRef.current) {

        remoteVideoRef.current.srcObject = stream;

        remoteVideoRef.current.play().catch(() => {

          console.warn("Failed to autoplay remote video");

        });

        console.log("✓ Remote video stream attached successfully");

      } else if (attempts < 30) {

        setTimeout(() => tryAttach(attempts + 1), 100);

      } else {

        console.error("Failed to attach remote video stream after 30 attempts");

      }

    };

    tryAttach();

  }, []);
 
  const sendSignal = useCallback((type: string, payload: unknown) => {

    try {

      channelRef.current?.send({

        type: "broadcast",

        event: type,

        payload: { sender: role, userName, data: payload },

      });

    } catch (err) {

      console.error(`Error sending signal ${type}:`, err);

    }

  }, [role, userName]);
 
  const startLocalMedia = useCallback(async (): Promise<MediaStream | null> => {

    try {

      const stream = await navigator.mediaDevices.getUserMedia({

        video: { width: { ideal: 1280 }, height: { ideal: 720 } },

        audio: { echoCancellation: true, noiseSuppression: true },

      });

      localStreamRef.current = stream;

      attachLocalStream(stream);

      setIsVideoOn(true);

      setIsAudioOn(true);

      console.log("✓ Local media started successfully");

      return stream;

    } catch (err) {

      console.error("Failed to get user media:", err);

      toast({

        title: "Camera Error",

        description: "Please allow camera and microphone permission.",

        variant: "destructive",

      });

      return null;

    }

  }, [attachLocalStream]);
 
  // ── WebRTC ────────────────────────────────────────────────────────────────
 
  const createPeer = useCallback((streamOverride?: MediaStream) => {

    // Cancel any pending disconnect timer from a previous peer

    if (iceDisconnectTimerRef.current) {

      clearTimeout(iceDisconnectTimerRef.current);

      iceDisconnectTimerRef.current = null;

    }
 
    // Null out handlers before closing to prevent stale state updates

    if (peerRef.current) {

      peerRef.current.oniceconnectionstatechange = null;

      peerRef.current.ontrack = null;

      peerRef.current.onicecandidate = null;

      peerRef.current.onnegotiationneeded = null;

      peerRef.current.close();

      peerRef.current = null;

    }
 
    const pc = new RTCPeerConnection(RTC_CONFIG);

    console.log("✓ RTCPeerConnection created");
 
    const stream = streamOverride ?? localStreamRef.current;

    if (stream) {

      stream.getTracks().forEach((t) => {

        pc.addTrack(t, stream);

      });

      console.log("✓ Local tracks added to peer connection");

    }
 
    // FIXED: Improved ontrack handler with proper logging

    pc.ontrack = ({ streams }) => {

      const [remote] = streams;

      console.log("📡 Remote track received:", { streamId: remote.id, trackCount: remote.getTracks().length });

      if (remote) {

        attachRemoteStream(remote);

        setIsRemoteVideoOn(true);

        setCallStatus("connected");
 
        // Track mute/unmute reflects camera-off

        remote.getVideoTracks().forEach((t) => {

          t.onmute = () => {

            console.log("🔴 Remote video track muted");

            setIsRemoteVideoOn(false);

          };

          t.onunmute = () => {

            console.log("🟢 Remote video track unmuted");

            setIsRemoteVideoOn(true);

          };

        });

      }

    };
 
    pc.onicecandidate = ({ candidate }) => {

      if (candidate) {

        sendSignal("ice-candidate", candidate.toJSON());

      }

    };
 
    pc.oniceconnectionstatechange = () => {

      const state = pc.iceConnectionState;

      console.log("🔗 ICE connection state changed:", state);
 
      if (state === "connected" || state === "completed") {

        if (iceDisconnectTimerRef.current) {

          clearTimeout(iceDisconnectTimerRef.current);

          iceDisconnectTimerRef.current = null;

        }

        setCallStatus("connected");

        return;

      }
 
      if (state === "disconnected") {

        if (iceDisconnectTimerRef.current) return;

        iceDisconnectTimerRef.current = setTimeout(() => {

          iceDisconnectTimerRef.current = null;

          const currentState = peerRef.current?.iceConnectionState;

          console.warn("⚠️ ICE connection still disconnected after grace period");

          if (currentState === "disconnected" || currentState === "failed") {

            setIsRemoteVideoOn(false);

            setCallStatus("waiting");

          }

        }, ICE_DISCONNECT_GRACE_MS);

        return;

      }
 
      if (state === "failed" || state === "closed") {

        if (iceDisconnectTimerRef.current) {

          clearTimeout(iceDisconnectTimerRef.current);

          iceDisconnectTimerRef.current = null;

        }

        console.error("❌ ICE connection failed or closed");

        setIsRemoteVideoOn(false);

        setCallStatus("waiting");

      }

    };
 
    pc.onnegotiationneeded = async () => {

      try {

        makingOfferRef.current = true;

        console.log("🤝 Negotiation needed, creating offer");

        await pc.setLocalDescription();

        sendSignal("offer", pc.localDescription);

      } catch (err) {

        console.error("❌ Negotiation error:", err);

        setCallStatus("error");

      } finally {

        makingOfferRef.current = false;

      }

    };
 
    peerRef.current = pc;

    return pc;

  }, [sendSignal, attachRemoteStream]);
 
  const joinChannel = useCallback(async (code: string) => {

    if (channelRef.current) {

      await supabase.removeChannel(channelRef.current);

    }
 
    const ch = supabase.channel(`room:${code}`, {

      config: { broadcast: { self: false } },

    });
 
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {

      if (payload.sender === role) return;

      setRemoteName(payload.userName ?? "Peer");

      console.log("📨 Received offer from", payload.userName);
 
      const pc = peerRef.current ?? createPeer(localStreamRef.current ?? undefined);
 
      const collision =

        payload.data.type === "offer" &&

        (makingOfferRef.current || pc.signalingState !== "stable");
 
      ignoreOfferRef.current = role === "interviewer" && collision;

      if (ignoreOfferRef.current) {

        console.log("🚫 Ignoring offer due to collision (interviewer priority)");

        return;

      }
 
      try {

        if (collision) {

          console.log("⚡ Collision detected, rolling back and accepting offer");

          await Promise.all([

            pc.setLocalDescription({ type: "rollback" }),

            pc.setRemoteDescription(new RTCSessionDescription(payload.data)),

          ]);

        } else {

          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));

        }
 
        if (payload.data.type === "offer") {

          await pc.setLocalDescription();

          sendSignal("answer", pc.localDescription);

        }

        setCallStatus("connecting");

      } catch (err) {

        console.error("❌ Error handling offer:", err);

        setCallStatus("error");

      }

    });
 
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {

      if (payload.sender === role) return;

      const pc = peerRef.current;

      console.log("📨 Received answer");

      if (!pc || pc.signalingState !== "have-local-offer") {

        console.warn("⚠️ Received answer but signaling state is not have-local-offer:", pc?.signalingState);

        return;

      }

      try {

        await pc.setRemoteDescription(new RTCSessionDescription(payload.data));

        setCallStatus("connecting");

      } catch (err) {

        console.error("❌ Error handling answer:", err);

        setCallStatus("error");

      }

    });
 
    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {

      if (payload.sender === role) return;

      try {

        if (peerRef.current) {

          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.data));

        }

      } catch (e) {

        if (!ignoreOfferRef.current) {

          console.warn("⚠️ ICE error:", e);

        }

      }

    });
 
    ch.on("broadcast", { event: "peer-joined" }, ({ payload }) => {

      if (payload.sender === role) return;

      setRemoteName(payload.userName ?? "Peer");

      console.log("👤 Peer joined:", payload.userName);

      toast({

        title: "Someone joined",

        description: `${payload.userName ?? "A participant"} joined the room.`,

      });
 
      if (role === "interviewer") {

        createPeer(localStreamRef.current ?? undefined);

      }

    });
 
    ch.on("broadcast", { event: "peer-left" }, ({ payload }) => {

      if (payload.sender === role) return;

      console.log("👤 Peer left:", payload.userName);

      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      remoteStreamRef.current = null;

      setIsRemoteVideoOn(false);

      setCallStatus("waiting");

      toast({

        title: "Peer left",

        description: `${payload.userName ?? "Participant"} left the call.`,

      });

    });
 
    ch.subscribe((status) => {

      console.log("📡 Channel subscription status:", status);

      if (status === "SUBSCRIBED") {

        sendSignal("peer-joined", {});

        setCallStatus(role === "interviewer" ? "waiting" : "connecting");

      }

    });
 
    channelRef.current = ch;

  }, [role, createPeer, sendSignal]);
 
  // ── Auto-start ────────────────────────────────────────────────────────────

  useEffect(() => {

    if (!initialRoomCode || autoStartedRef.current) return;

    autoStartedRef.current = true;

    setRoomCode(initialRoomCode);
 
    const autoStart = async () => {

      setCallStatus("joining");

      const stream = await startLocalMedia();

      if (!stream) {

        setCallStatus("idle");

        autoStartedRef.current = false;

        return;

      }

      await joinChannel(initialRoomCode);

    };
 
    autoStart();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [initialRoomCode]);
 
  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {

    return () => {

      console.log("🧹 Cleaning up VideoCall component");

      if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current);

      stopStream(localStreamRef.current);

      stopStream(screenStreamRef.current);

      remoteStreamRef.current = null;

      peerRef.current?.close();

      if (channelRef.current) supabase.removeChannel(channelRef.current);

    };

  }, []);
 
  // ── Camera toggle ─────────────────────────────────────────────────────────

  const toggleVideo = async () => {

    try {

      if (isVideoOn) {

        console.log("📹 Turning off video");

        localStreamRef.current?.getVideoTracks().forEach((t) => {

          t.stop();

          peerRef.current?.getSenders()

            .filter((s) => s.track === t)

            .forEach((s) => peerRef.current?.removeTrack(s));

        });

        if (localVideoRef.current) localVideoRef.current.srcObject = null;

        setIsVideoOn(false);

        return;

      }

      console.log("📹 Turning on video");

      const stream = await navigator.mediaDevices.getUserMedia({

        video: { width: { ideal: 1280 }, height: { ideal: 720 } },

        audio: isAudioOn,

      });

      stream.getVideoTracks().forEach((t) => {

        localStreamRef.current?.addTrack(t);

        if (peerRef.current) peerRef.current.addTrack(t, localStreamRef.current!);

      });

      if (!localStreamRef.current) localStreamRef.current = stream;

      attachLocalStream(localStreamRef.current);

      setIsVideoOn(true);

      if (stream.getAudioTracks().length > 0) setIsAudioOn(true);

    } catch (err) {

      console.error("❌ Camera error:", err);

      toast({ title: "Camera Error", description: "Please allow camera permission.", variant: "destructive" });

    }

  };
 
  // ── Mic toggle ────────────────────────────────────────────────────────────

  const toggleAudio = async () => {

    try {

      if (!localStreamRef.current) {

        console.log("🎤 Getting audio stream");

        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });

        localStreamRef.current = stream;

        stream.getTracks().forEach((t) => peerRef.current?.addTrack(t, stream));

        setIsAudioOn(true);

        return;

      }

      const tracks = localStreamRef.current.getAudioTracks();

      if (isAudioOn) {

        console.log("🔇 Muting audio");

        tracks.forEach((t) => (t.enabled = false));

        setIsAudioOn(false);

      } else {

        console.log("🔊 Unmuting audio");

        if (tracks.length === 0) {

          const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });

          s.getAudioTracks().forEach((t) => {

            localStreamRef.current?.addTrack(t);

            peerRef.current?.addTrack(t, localStreamRef.current!);

          });

        } else {

          tracks.forEach((t) => (t.enabled = true));

        }

        setIsAudioOn(true);

      }

    } catch (err) {

      console.error("❌ Microphone error:", err);

      toast({ title: "Microphone Error", description: "Please allow mic permission.", variant: "destructive" });

    }

  };
 
  // ── Screen share ──────────────────────────────────────────────────────────

  const toggleScreenShare = async () => {

    try {

      if (isScreenSharing) {

        console.log("🖥️ Stopping screen share");

        stopStream(screenStreamRef.current);

        screenStreamRef.current = null;

        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

        setIsScreenSharing(false);

        return;

      }

      console.log("🖥️ Starting screen share");

      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

      screenStreamRef.current = display;

      setIsScreenSharing(true);
 
      setTimeout(() => {

        if (screenVideoRef.current) {

          screenVideoRef.current.srcObject = display;

          screenVideoRef.current.play().catch(() => {});

        }

      }, 100);
 
      if (peerRef.current) {

        display.getTracks().forEach((t) => peerRef.current!.addTrack(t, display));

      }
 
      display.getVideoTracks()[0].onended = () => {

        console.log("🖥️ Screen share ended by user");

        stopStream(display);

        screenStreamRef.current = null;

        setIsScreenSharing(false);

      };

    } catch (err) {

      console.error("❌ Screen share error:", err);

      toast({ title: "Screen Share Error", description: "Unable to share screen.", variant: "destructive" });

    }

  };
 
  // ── Recording ─────────────────────────────────────────────────────────────

  const toggleRecording = () => {

    if (isRecording) {

      console.log("⏹️ Stopping recording");

      mediaRecorderRef.current?.stop();

      setIsRecording(false);

      return;

    }

    const stream = screenStreamRef.current || localStreamRef.current;

    if (!stream) {

      toast({ title: "Recording Error", description: "Turn on camera first.", variant: "destructive" });

      return;

    }

    console.log("⏺️ Starting recording");

    recordedChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")

      ? "video/webm;codecs=vp9"

      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {

      if (e.data.size > 0) recordedChunksRef.current.push(e.data);

    };

    recorder.onstop = () => {

      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;

      a.download = `recording-${roomCode}.webm`;

      a.click();

      URL.revokeObjectURL(url);

      console.log("✓ Recording saved");

    };

    recorder.start(1000);

    mediaRecorderRef.current = recorder;

    setIsRecording(true);

  };
 
  // ── Leave ─────────────────────────────────────────────────────────────────

  const handleLeave = () => {

    console.log("📞 Leaving call");

    sendSignal("peer-left", {});

    if (iceDisconnectTimerRef.current) {

      clearTimeout(iceDisconnectTimerRef.current);

      iceDisconnectTimerRef.current = null;

    }

    stopStream(localStreamRef.current);

    stopStream(screenStreamRef.current);

    localStreamRef.current = null;

    screenStreamRef.current = null;

    remoteStreamRef.current = null;

    mediaRecorderRef.current?.stop();

    if (peerRef.current) {

      peerRef.current.oniceconnectionstatechange = null;

      peerRef.current.ontrack = null;

      peerRef.current.close();

      peerRef.current = null;

    }

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (channelRef.current) {

      supabase.removeChannel(channelRef.current);

      channelRef.current = null;

    }

    setCallStatus("idle");

    setIsVideoOn(false);

    setIsAudioOn(false);

    setIsScreenSharing(false);

    setIsRemoteVideoOn(false);

    autoStartedRef.current = false;

    onLeave?.();

  };
 
  // ── Candidate manual join ─────────────────────────────────────────────────

  const handleCandidateJoin = async () => {

    const code = roomCodeInput.trim().toUpperCase();

    if (!code) {

      toast({ title: "Enter a room code", variant: "destructive" });

      return;

    }

    setRoomCode(code);

    setCallStatus("joining");

    const stream = await startLocalMedia();

    if (!stream) { setCallStatus("idle"); return; }

    await joinChannel(code);

  };
 
  const copyRoomCode = async () => {

    await navigator.clipboard.writeText(roomCode);

    setIsCopied(true);

    setTimeout(() => setIsCopied(false), 2000);

    toast({ title: "Copied!", description: "Room code copied to clipboard." });

  };
 
  // ── Render helpers ────────────────────────────────────────────────────────

  const statusLabel: Record<CallStatus, string> = {

    idle: "Not connected",

    joining: "Starting…",

    waiting: "Waiting for participant…",

    connecting: "Connecting…",

    connected: "Connected",

    error: "Connection error",

  };
 
  const statusColor: Record<CallStatus, string> = {

    idle: "bg-zinc-500",

    joining: "bg-amber-500",

    waiting: "bg-amber-500",

    connecting: "bg-blue-500",

    connected: "bg-emerald-500",

    error: "bg-red-500",

  };
 
  const isInCall = ["waiting", "connecting", "connected"].includes(callStatus);

  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
 
  // ── Candidate pre-call ────────────────────────────────────────────────────

  if (role === "candidate" && !isInCall && callStatus === "idle" && !initialRoomCode) {

    return (
<div className="h-full flex flex-col items-center justify-center gap-6 p-8 bg-card rounded-xl">
<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
<Users className="w-8 h-8 text-primary" />
</div>
<div className="text-center space-y-1">
<h2 className="text-xl font-semibold">Join Interview</h2>
<p className="text-sm text-muted-foreground">

            Enter the room code your interviewer shared with you
</p>
</div>
<div className="w-full max-w-sm space-y-3">
<Input

            placeholder="e.g. ABC-123"

            value={roomCodeInput}

            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}

            onKeyDown={(e) => e.key === "Enter" && handleCandidateJoin()}

            className="text-center text-lg font-mono tracking-widest h-12"

            maxLength={10}

          />
<Button

            className="w-full h-12 text-base"

            onClick={handleCandidateJoin}

            disabled={callStatus === "joining"}
>

            {callStatus === "joining"

              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>

              : "Join Call"}
</Button>
</div>
</div>

    );

  }
 
  // ── Loading spinner ───────────────────────────────────────────────────────

  if (callStatus === "joining") {

    return (
<div className="h-full flex flex-col items-center justify-center gap-4 bg-card rounded-xl">
<Loader2 className="w-10 h-10 animate-spin text-primary" />
<p className="text-sm text-muted-foreground">Starting camera…</p>
</div>

    );

  }
 
  // ── IN-CALL ───────────────────────────────────────────────────────────────

  return (
<div className="h-full flex flex-col bg-card rounded-xl overflow-hidden">
 
      {/* Status bar */}
<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
<div className="flex items-center gap-2">
<span className={`w-2 h-2 rounded-full ${statusColor[callStatus]}`} />
<span className="text-xs text-muted-foreground">{statusLabel[callStatus]}</span>
</div>
<div className="flex items-center gap-1.5">

          {callStatus === "connected"

            ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />

            : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
<button

            onClick={copyRoomCode}

            className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
>
<span className="tracking-wider font-semibold">{roomCode}</span>

            {isCopied

              ? <Check className="w-3 h-3 text-emerald-500" />

              : <Copy className="w-3 h-3 text-muted-foreground" />}
</button>
</div>
</div>
 
      {/* Video area */}
<div className="flex-1 relative bg-black overflow-hidden">

        {/* Remote video always mounted */}
<video

          ref={remoteVideoRef}

          autoPlay

          playsInline

          className="w-full h-full object-cover"

        />
 
        {/* Avatar overlay — on top of video, shown only when no remote video */}

        {!isRemoteVideoOn && (
<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900">

            {callStatus === "waiting" ? (
<>
<Loader2 className="w-10 h-10 text-zinc-500 animate-spin" />
<p className="text-zinc-400 text-sm">

                  Waiting for {role === "interviewer" ? "candidate" : "interviewer"}…
</p>
</>

            ) : (
<>
<Avatar className="w-20 h-20">
<AvatarFallback className="text-2xl bg-zinc-700 text-zinc-200">

                    {remoteName ? remoteName[0].toUpperCase() : "?"}
</AvatarFallback>
</Avatar>
<p className="text-zinc-400 text-sm">

                  {remoteName || "Participant"} — camera off
</p>
</>

            )}
</div>

        )}
 
        {/* Screen share PiP */}

        {isScreenSharing && (
<div className="absolute top-3 left-3 w-56 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-lg bg-black">
<video ref={screenVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
<Badge variant="secondary" className="absolute top-1 left-1 text-[10px] px-1 py-0">

              Screen
</Badge>
</div>

        )}
 
        {/* Local PiP */}
<div className="absolute bottom-3 right-3 w-36 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-lg bg-zinc-900">

          {isVideoOn ? (
<video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />

          ) : (
<div className="w-full h-full flex flex-col items-center justify-center gap-1">
<Avatar className="w-10 h-10">
<AvatarFallback className="text-sm bg-zinc-700 text-zinc-200">{initials}</AvatarFallback>
</Avatar>
<span className="text-[10px] text-zinc-400">You</span>
</div>

          )}
</div>
</div>
 
      {/* Controls */}
<div className="px-4 py-3 flex items-center justify-center gap-2 flex-wrap border-t bg-background/80 backdrop-blur-sm">
<Button size="icon" variant={isAudioOn ? "default" : "secondary"} className="rounded-full w-11 h-11" onClick={toggleAudio} title={isAudioOn ? "Mute" : "Unmute"}>

          {isAudioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
</Button>
<Button size="icon" variant={isVideoOn ? "default" : "secondary"} className="rounded-full w-11 h-11" onClick={toggleVideo} title={isVideoOn ? "Camera off" : "Camera on"}>

          {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
</Button>
<Button size="icon" variant={isScreenSharing ? "default" : "secondary"} className="rounded-full w-11 h-11" onClick={toggleScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"}>

          {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
</Button>
<Button size="icon" variant={isRecording ? "destructive" : "secondary"} className="rounded-full w-11 h-11" onClick={toggleRecording} title={isRecording ? "Stop recording" : "Record"}>

          {isRecording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
</Button>
<div className="w-px h-8 bg-border mx-1" />
<Button size="icon" variant="destructive" className="rounded-full w-11 h-11" onClick={handleLeave} title="Leave">
<Phone className="w-4 h-4 rotate-[135deg]" />
</Button>
</div>
</div>

  );

}
 
