import { scorePassword } from "@/lib/password-strength";
const TONES = [
  "bg-signal-danger",
  "bg-signal-danger",
  "bg-signal-drowsy",
  "bg-signal-drowsy",
  "bg-signal-awake",
];
export function PasswordStrengthMeter({ value }) {
  const { score, label, hints } = scorePassword(value);
  const active = value.length > 0 ? Math.max(score, 1) : 0;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < active ? TONES[score] : "bg-secondary"}`}
          />
        ))}
      </div>
      {value.length > 0 && (
        <div className="flex items-center justify-between text-[11px]">
          <span className="uppercase tracking-widest text-muted-foreground">Strength</span>
          <span className="font-medium text-foreground">{label}</span>
        </div>
      )}
      {hints.length > 0 && value.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Add: {hints.slice(0, 2).join(" · ")}</p>
      )}
    </div>
  );
}
