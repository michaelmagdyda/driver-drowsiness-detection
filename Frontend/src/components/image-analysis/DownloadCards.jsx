import { motion } from "framer-motion";
import { Download, FileImage, FileText, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const CARDS = [
  {
    key: "image",
    label: "Processed image",
    desc: "PNG with overlays and landmarks",
    icon: FileImage,
    tone: "var(--color-primary)",
  },
  {
    key: "pdf",
    label: "PDF report",
    desc: "Executive summary + metrics",
    icon: FileText,
    tone: "var(--color-signal-drowsy)",
  },
  {
    key: "json",
    label: "JSON results",
    desc: "Raw detection payload",
    icon: FileJson,
    tone: "oklch(0.72 0.14 260)",
  },
  {
    key: "csv",
    label: "CSV report",
    desc: "Tabular metrics for analytics",
    icon: FileSpreadsheet,
    tone: "oklch(0.7 0.18 150)",
  },
];
export function DownloadCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="group flex flex-col rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl transition-colors hover:border-primary/40"
        >
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              backgroundColor: `${c.tone}18`,
              color: c.tone,
              border: `1px solid ${c.tone}55`,
            }}
          >
            <c.icon className="h-5 w-5" />
          </div>
          <div className="mt-3 font-display text-sm font-semibold">{c.label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{c.desc}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 justify-start px-2 text-xs text-primary hover:text-primary"
            onClick={() => toast.info("Downloads will be wired to POST /predict/image response.")}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
