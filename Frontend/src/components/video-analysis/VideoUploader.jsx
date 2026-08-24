import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileVideo, RefreshCw, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
// Pre-screens against the same limits the backend enforces (see Backend's
// ALLOWED_VIDEO_MIME_TYPES / max_video_size_mb) so an obviously-rejected file
// never reaches the network - but the backend's check on the actual upload
// is still the authoritative one (Frontend Integration §8).
const ACCEPTED = ["video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska"];
const ACCEPTED_EXT = [".mp4", ".avi", ".mov", ".mkv"];
const MAX_SIZE_MB = 500;
export function VideoUploader({ video, onVideo }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const validate = (file) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.includes(ext))
      return "Unsupported format. Use MP4, avi, MOV, or MKV.";
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_SIZE_MB} MB limit.`;
    return null;
  };
  // Selecting a file is purely local (an object URL for the preview player) -
  // nothing is sent to the backend until analysis is started, so this no
  // longer pretends to "ingest" or upload anything at this step.
  const ingest = useCallback(
    (file) => {
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      onVideo({ file, url, sizeMB: file.size / 1024 / 1024 });
    },
    [onVideo],
  );
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingest(file);
  };
  if (video) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
            <FileVideo className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium">{video.file.name}</div>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-metric mt-0.5 text-xs text-muted-foreground">
              {video.sizeMB.toFixed(1)} MB · Ready for analysis
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                URL.revokeObjectURL(video.url);
                onVideo(null);
              }}
              className="text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT.join(",")}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])}
        />
      </div>
    );
  }
  return (
    <div>
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        animate={{ scale: dragging ? 1.01 : 1 }}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed backdrop-blur-xl transition-colors ${
          dragging
            ? "border-primary/70 bg-primary/5"
            : "border-border/70 bg-card/30 hover:border-primary/40"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="relative flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/40 bg-primary/10 shadow-[0_0_40px_-8px_var(--color-primary)]">
            <UploadCloud className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="font-display text-lg font-semibold tracking-tight">
              Drop your driving video here
            </div>
            <div className="text-sm text-muted-foreground">
              or click to browse — MP4, AVI, MOV, MKV · up to {MAX_SIZE_MB} MB
            </div>
          </div>
          <Button
            onClick={() => inputRef.current?.click()}
            className="mt-2 bg-primary/90 text-primary-foreground hover:bg-primary"
          >
            <UploadCloud className="h-4 w-4" />
            Browse files
          </Button>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {ACCEPTED_EXT.map((ext) => (
              <span
                key={ext}
                className="text-metric rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                {ext.slice(1)}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT.join(",")}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])}
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
