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

export function VideoCall({
  roomCode: initialRoomCode,
  role,
  userName = "You",
  onLeave,
}: VideoCallProps) {
  const [roomCode, setRoomCode]               = useState(initialRoomCode ?? "");
  const [roomCodeInput, setRoomCodeInput]     = useState("");
  const [callStatus, setCallStatus]           = useState<CallStatus>("idle");
  const [isVideoOn, setIsVideoOn]             = useState(false);
  const [isAudioOn, setIsAudioOn]             = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording]         = useState(false);
  const [isCopied, setIsCopied]               = useState(false);
  const [remoteName, setRemoteName]           = useState("");
  const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(false);

  const localVideoRef     = useRef<HTMLVideoElement>(null);
  const remoteVideoRef    = useRef<HTMLVideoElement>(null);
  const screenVideoRef    = useRef<HTMLVideoElement>(null);
  const localStreamRef    = useRef<MediaStream | null>(null);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const peerRef           = useRef<RTCPeerConnection | null>(null);
  const channelRef        = useRef<RealtimeChannel | null>(null);
  const makingOfferRef    = useRef(false);
  const ignoreOfferRef    = useRef(false);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const autoStartedRef    = useRef(false);
  const remoteTrackCountRef = useRef(0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((t) => t.stop());
  };

  const attachLocalStream = useCallback((stream: MediaStream) => {
    const tryAttach = (attempts = 0) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      } else if (attempts < 30) {
        setTimeout(() => tryAttach(attempts + 1), 100);
      }
    };
    tryAttach();
  }, []);

  const sendSignal = useCallback((type: string, payload: unknown) => {
    channelRef.current?.send({
      type: "broadcast",
      event: type,
      payload: { sender: role, userName, data: payload },
    });
  }, [role, userName]);

  const startLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      attachLocalStream(stream);
      setIsVideoOn(true);
      setIsAudioOn(true);
      return stream;
    } catch {
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
    if (peerRef.current) {
      peerRef.current.ontrack                    = null;
      peerRef.current.onicecandidate             = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.onnegotiationneeded        = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    remoteTrackCountRef.current = 0;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    const stream = streamOverride ?? localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    }

    pc.ontrack = ({ track, streams }) => {
      remoteTrackCountRef.current += 1;
      const [remote] = streams;

      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remote) {
        remoteVideoRef.current.srcObject = remote;
        remoteVideoRef.current.play().catch(() => {});
      }

      if (track.kind === "video") {
        setIsRemoteVideoOn(true);
        setCallStatus("connected");

        track.onended = () => {
          const stillHasVideo = (remoteVideoRef.current?.srcObject as MediaStream)
            ?.getVideoTracks()
            .some((t) => t.readyState === "live");
          if (!stillHasVideo) setIsRemoteVideoOn(false);
        };
      }

      if (track.kind === "audio") {
        setCallStatus("connected");
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal("ice-candidate", candidate.toJSON());
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;

      if (state === "connected" || state === "completed") {
        // ── FIX: both sides mark themselves as connected on ICE completion ──
        setCallStatus("connected");
      }

      if (state === "failed" || state === "closed") {
        if (remoteTrackCountRef.current === 0) {
          setIsRemoteVideoOn(false);
        }
        setCallStatus("waiting");
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        sendSignal("offer", pc.localDescription);
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    peerRef.current = pc;
    return pc;
  }, [sendSignal]);

  // ── Channel ───────────────────────────────────────────────────────────────

  const joinChannel = useCallback(async (code: string) => {
    if (channelRef.current) await supabase.removeChannel(channelRef.current);

    const ch = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false } },
    });

    // ── offer ──────────────────────────────────────────────────────────────
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.sender === role) return;
      setRemoteName(payload.userName ?? "Peer");

      const pc = peerRef.current ?? createPeer(localStreamRef.current ?? undefined);

      const collision =
        payload.data.type === "offer" &&
        (makingOfferRef.current || pc.signalingState !== "stable");

      ignoreOfferRef.current = role === "interviewer" && collision;
      if (ignoreOfferRef.current) return;

      try {
        if (collision) {
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
        console.error("Error handling offer:", err);
      }
    });

    // ── answer ─────────────────────────────────────────────────────────────
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.sender === role) return;
      const pc = peerRef.current;
      if (!pc || pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
        setCallStatus("connecting");
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    // ── ICE ────────────────────────────────────────────────────────────────
    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.sender === role) return;
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(payload.data));
      } catch (e) {
        if (!ignoreOfferRef.current) console.error("ICE error:", e);
      }
    });

    // ── peer-joined ────────────────────────────────────────────────────────
    // Fired when someone first subscribes to the channel.
    ch.on("broadcast", { event: "peer-joined" }, ({ payload }) => {
      if (payload.sender === role) return;
      setRemoteName(payload.userName ?? "Peer");
      toast({
        title: "Someone joined",
        description: `${payload.userName ?? "A participant"} joined the room.`,
      });

      if (role === "interviewer") {
        // Interviewer always initiates the offer
        createPeer(localStreamRef.current ?? undefined);
        // ── FIX: move out of "waiting" immediately so UI shows progress ──
        setCallStatus("connecting");
      } else {
        // ── FIX: candidate echoes back so a refreshed interviewer knows
        //         someone is already here and re-initiates ──────────────
        sendSignal("peer-here", {});
      }
    });

    // ── peer-here ──────────────────────────────────────────────────────────
    // Fired by the candidate in response to peer-joined, so a freshly
    // refreshed interviewer knows the candidate is already in the room.
    ch.on("broadcast", { event: "peer-here" }, ({ payload }) => {
      if (payload.sender === role) return;
      setRemoteName(payload.userName ?? "Peer");

      if (role === "interviewer") {
        // Re-initiate the WebRTC handshake
        createPeer(localStreamRef.current ?? undefined);
        // ── FIX: same status fix as peer-joined ──────────────────────────
        setCallStatus("connecting");
      } else {
        // Candidate received peer-here from interviewer — shouldn't normally
        // happen, but handle symmetrically just in case
        sendSignal("peer-here", {});
      }
    });

    // ── peer-left ──────────────────────────────────────────────────────────
    ch.on("broadcast", { event: "peer-left" }, ({ payload }) => {
      if (payload.sender === role) return;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteTrackCountRef.current = 0;
      setIsRemoteVideoOn(false);
      setCallStatus("waiting");
      toast({
        title: "Peer left",
        description: `${payload.userName ?? "Participant"} left the call.`,
      });
    });

    // ── subscribe ──────────────────────────────────────────────────────────
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Announce presence to anyone already in the room
        sendSignal("peer-joined", {});
        // ── FIX: also broadcast peer-here so a peer who is already
        //         subscribed (e.g. after a page refresh) gets notified ──
        sendSignal("peer-here", {});
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

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopStream(localStreamRef.current);
      stopStream(screenStreamRef.current);
      peerRef.current?.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Camera toggle ─────────────────────────────────────────────────────────

  const toggleVideo = async () => {
    try {
      if (isVideoOn) {
        localStreamRef.current?.getVideoTracks().forEach((t) => {
          t.stop();
          peerRef.current
            ?.getSenders()
            .filter((s) => s.track === t)
            .forEach((s) => peerRef.current?.removeTrack(s));
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setIsVideoOn(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
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
    } catch {
      toast({
        title: "Camera Error",
        description: "Please allow camera permission.",
        variant: "destructive",
      });
    }
  };

  // ── Mic toggle ────────────────────────────────────────────────────────────

  const toggleAudio = async () => {
    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        stream.getTracks().forEach((t) => peerRef.current?.addTrack(t, stream));
        setIsAudioOn(true);
        return;
      }
      const tracks = localStreamRef.current.getAudioTracks();
      if (isAudioOn) {
        tracks.forEach((t) => (t.enabled = false));
        setIsAudioOn(false);
      } else {
        if (tracks.length === 0) {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getAudioTracks().forEach((t) => {
            localStreamRef.current?.addTrack(t);
            peerRef.current?.addTrack(t, localStreamRef.current!);
          });
        } else {
          tracks.forEach((t) => (t.enabled = true));
        }
        setIsAudioOn(true);
      }
    } catch {
      toast({
        title: "Microphone Error",
        description: "Please allow mic permission.",
        variant: "destructive",
      });
    }
  };

  // ── Screen share ──────────────────────────────────────────────────────────

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        setIsScreenSharing(false);
        return;
      }
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
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
        stopStream(display);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      };
    } catch {
      toast({
        title: "Screen Share Error",
        description: "Unable to share screen.",
        variant: "destructive",
      });
    }
  };

  // ── Recording ─────────────────────────────────────────────────────────────

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const stream = screenStreamRef.current || localStreamRef.current;
    if (!stream) {
      toast({
        title: "Recording Error",
        description: "Turn on camera first.",
        variant: "destructive",
      });
      return;
    }
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
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `recording-${roomCode}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  // ── Leave ─────────────────────────────────────────────────────────────────

  const handleLeave = () => {
    sendSignal("peer-left", {});
    stopStream(localStreamRef.current);
    stopStream(screenStreamRef.current);
    localStreamRef.current  = null;
    screenStreamRef.current = null;
    mediaRecorderRef.current?.stop();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteTrackCountRef.current = 0;
    peerRef.current?.close();
    peerRef.current = null;
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
    idle:       "Not connected",
    joining:    "Starting…",
    waiting:    "Waiting for participant…",
    connecting: "Connecting…",
    connected:  "Connected",
    error:      "Connection error",
  };

  const statusColor: Record<CallStatus, string> = {
    idle:       "bg-zinc-500",
    joining:    "bg-amber-500",
    waiting:    "bg-amber-500",
    connecting: "bg-blue-500",
    connected:  "bg-emerald-500",
    error:      "bg-red-500",
  };

  const isInCall  = ["waiting", "connecting", "connected"].includes(callStatus);
  const initials  = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Candidate pre-call screen ─────────────────────────────────────────────

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
            {callStatus === "joining" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
            ) : "Join Call"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading screen ────────────────────────────────────────────────────────

  if (callStatus === "joining") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-card rounded-xl">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Starting camera…</p>
      </div>
    );
  }

  // ── In-call UI ────────────────────────────────────────────────────────────

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
            ? <Wifi    className="w-3.5 h-3.5 text-emerald-500" />
            : <WifiOff className="w-3.5 h-3.5 text-amber-500"   />}
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
          >
            <span className="tracking-wider font-semibold">{roomCode}</span>
            {isCopied
              ? <Check className="w-3 h-3 text-emerald-500"      />
              : <Copy  className="w-3 h-3 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative bg-black overflow-hidden">

        {/* Remote video — always in DOM so srcObject is never lost */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ display: isRemoteVideoOn ? "block" : "none" }}
        />

        {/* Overlay when remote video is inactive */}
        {!isRemoteVideoOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900">
            {callStatus === "waiting" || callStatus === "connecting" ? (
              <>
                <Loader2 className="w-10 h-10 text-zinc-500 animate-spin" />
                <p className="text-zinc-400 text-sm">
                  {callStatus === "waiting"
                    ? `Waiting for ${role === "interviewer" ? "candidate" : "interviewer"}…`
                    : "Connecting…"}
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

        {/* Screen-share PiP */}
        {isScreenSharing && (
          <div className="absolute top-3 left-3 w-56 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-lg bg-black">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <Badge variant="secondary" className="absolute top-1 left-1 text-[10px] px-1 py-0">
              Screen
            </Badge>
          </div>
        )}

        {/* Local PiP */}
        <div className="absolute bottom-3 right-3 w-36 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-lg bg-zinc-900">
          {isVideoOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="text-sm bg-zinc-700 text-zinc-200">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-zinc-400">You</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-center gap-2 flex-wrap border-t bg-background/80 backdrop-blur-sm">
        <Button
          size="icon"
          variant={isAudioOn ? "default" : "secondary"}
          className="rounded-full w-11 h-11"
          onClick={toggleAudio}
          title={isAudioOn ? "Mute microphone" : "Unmute microphone"}
        >
          {isAudioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant={isVideoOn ? "default" : "secondary"}
          className="rounded-full w-11 h-11"
          onClick={toggleVideo}
          title={isVideoOn ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant={isScreenSharing ? "default" : "secondary"}
          className="rounded-full w-11 h-11"
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant={isRecording ? "destructive" : "secondary"}
          className="rounded-full w-11 h-11"
          onClick={toggleRecording}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </Button>

        <div className="w-px h-8 bg-border mx-1" />

        <Button
          size="icon"
          variant="destructive"
          className="rounded-full w-11 h-11"
          onClick={handleLeave}
          title="Leave call"
        >
          <Phone className="w-4 h-4 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}
