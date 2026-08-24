import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EnhancedVideoPlayer } from "@/components/video-analysis/EnhancedVideoPlayer";

// Maps a session's real detection_events into the shape EnhancedVideoPlayer
// expects for its synced HUD (EAR/MAR/confidence/state per playback tick).
// `t` is derived relative to the session's own start time, since events carry
// an absolute timestamp and the player needs seconds-from-video-start.
function toFrames(events, startedAt) {
  const startMs = new Date(startedAt).getTime();
  return events.map((e) => ({
    t: (new Date(e.ts).getTime() - startMs) / 1000,
    driverState: e.state,
    alertLevel: e.alertLevel,
    fatigueScore: e.fatigueScore ?? 0,
    eyeAspectRatio: e.ear,
    mouthAspectRatio: e.mar,
    confidence: e.confidence,
    detections: e.detections ?? [],
  }));
}

export function ReplayPlayer({ session, events }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error

  useEffect(() => {
    if (!session?.media) {
      setPreviewUrl(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    supabase.storage
      .from(session.media.bucket)
      .createSignedUrl(session.media.storagePath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setStatus("error");
          return;
        }
        setPreviewUrl(data.signedUrl);
        setStatus("done");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.media]);

  if (!session?.media) {
    return (
      <Card className="glass-panel flex h-full min-h-[300px] flex-col items-center justify-center border-border/50 p-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Film className="h-6 w-6 text-primary" />
        </div>
        <div className="font-display text-sm font-semibold">No recording available</div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          This session has no stored video — either it predates recording support, or the recording
          could not be saved.
        </p>
      </Card>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <Card className="glass-panel flex h-full min-h-[300px] items-center justify-center border-border/50 p-8 text-sm text-muted-foreground">
        Loading recording…
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="glass-panel flex h-full min-h-[300px] flex-col items-center justify-center border-border/50 p-8 text-center">
        <div className="font-display text-sm font-semibold">Could not load recording</div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          The stored clip could not be signed for playback. It may have been deleted.
        </p>
      </Card>
    );
  }

  // An uploaded still image has no video to play - the annotated JPEG itself
  // is the whole replay, so it's shown directly rather than forced into the
  // video player.
  if (session.media.mimeType.startsWith("image/")) {
    const event = events[0];
    return (
      <Card className="glass-panel flex h-full min-h-[300px] flex-col gap-3 border-border/50 p-4">
        <img
          src={previewUrl}
          alt="Annotated upload with detected boxes"
          className="max-h-[420px] w-full rounded-xl border border-border/40 object-contain"
        />
        {event && (
          <p className="text-xs text-muted-foreground">
            State: <span className="text-foreground">{event.state}</span> · Alert:{" "}
            <span className="text-foreground">{event.alertLevel}</span> · Fatigue:{" "}
            <span className="text-foreground">{event.fatigueScore ?? "—"}</span>
          </p>
        )}
      </Card>
    );
  }

  return (
    <EnhancedVideoPlayer src={previewUrl} frames={toFrames(events, session.startedAt)} annotated />
  );
}
