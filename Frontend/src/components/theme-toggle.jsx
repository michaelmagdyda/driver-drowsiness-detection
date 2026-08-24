import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
export function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className ?? "h-9 w-9"}
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      // The label is derived from resolvedTheme, which the FOUC-prevention
      // script (see __root.jsx) can correct from localStorage before the
      // client's first paint - but React's hydration diff still compares
      // against the server's "dark"-default render, so a saved "light"
      // theme legitimately produces a different label here on first
      // hydration. That's expected (same reason <html> itself carries
      // suppressHydrationWarning), not a bug to chase.
      suppressHydrationWarning
    >
      <Moon className="hidden h-4 w-4 dark:block" />
      <Sun className="block h-4 w-4 dark:hidden" />
    </Button>
  );
}
