import { Film } from "lucide-react";
import { Slider } from "@/components/ui/slider";
export const DEFAULT_CONFIG = {
  sampleRate: 2,
};
// The backend clamps to [0.5, 5] samples/sec regardless of what is sent here
// (see Backend/app/core/constants.py MIN/MAX_VIDEO_SAMPLE_RATE_FPS) - a CPU
// forward pass per frame cannot keep up with the source frame rate within one
// request. The slider only exposes the range the server will actually honour.
const MIN_RATE = 0.5;
const MAX_RATE = 5;
export function AnalysisSettings({ config, onChange, disabled }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Film className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">Frame sampling rate</div>
            <div className="text-[11px] text-muted-foreground">
              Frames per second sent to the model — the server may reduce this for a long clip
            </div>
          </div>
        </div>
        <span className="text-metric text-sm text-primary">{config.sampleRate.toFixed(1)} fps</span>
      </div>
      <Slider
        disabled={disabled}
        value={[config.sampleRate]}
        onValueChange={(v) => onChange({ ...config, sampleRate: v[0] ?? MIN_RATE })}
        min={MIN_RATE}
        max={MAX_RATE}
        step={0.5}
      />
    </div>
  );
}
