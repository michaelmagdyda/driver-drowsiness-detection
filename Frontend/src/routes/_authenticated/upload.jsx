import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Upload as UploadIcon } from "lucide-react";
import { ApiError, uploadImage, uploadVideo } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function pickFile(selected) {
    setFile(selected);
    setResult(null);
  }

  async function handle() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const isVideo = file.type.startsWith("video/");
      const session = isVideo ? await uploadVideo(file) : await uploadImage(file);
      setResult(session);
      toast.success("Upload analysed and saved to Detection History.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Upload media</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a driving video or image to run real drowsiness detection. The result is saved as a
          session you can review in Detection History.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>New upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="video/*,image/*"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
          <Button onClick={handle} disabled={!file || busy}>
            <UploadIcon className="mr-2 h-4 w-4" />
            {busy ? "Analysing…" : "Upload and analyse"}
          </Button>

          {result && (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Analysis complete
              </div>
              <p className="text-sm text-muted-foreground">
                Final state: <span className="text-foreground">{result.finalState ?? "—"}</span> ·
                Alert level: <span className="text-foreground">{result.alertLevel ?? "—"}</span> ·
                Fatigue: <span className="text-foreground">{result.maxFatigueScore ?? "—"}</span>
              </p>
              <Button variant="outline" size="sm" asChild className="w-fit">
                <Link to="/history" search={{ session: result.id }}>
                  View in Detection History
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
