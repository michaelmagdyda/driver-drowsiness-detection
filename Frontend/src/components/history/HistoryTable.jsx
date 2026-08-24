import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Eye,
  Download,
  GitCompareArrows,
  Trash2,
  ArrowUpDown,
  Camera,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { formatDuration } from "./mockData";
import { StatusBadge, DriverStateBadge } from "./StatusBadge";
const TYPE_ICON = { webcam: Camera, dashcam: Camera, video: Film, image: ImageIcon };
const PAGE_SIZE = 8;
export function HistoryTable({ sessions, selectedId, onSelect, isAdmin }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("startedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [checked, setChecked] = useState(new Set());
  const sorted = useMemo(() => {
    const s = [...sessions].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (sortDir === "asc" ? 1 : -1);
    });
    return s;
  }, [sessions, sortKey, sortDir]);
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };
  const toggleAll = () => {
    if (checked.size === paged.length) setChecked(new Set());
    else setChecked(new Set(paged.map((s) => s.id)));
  };
  const toggleOne = (id) => {
    const n = new Set(checked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setChecked(n);
  };
  return (
    <Card className="glass-panel overflow-hidden border-border/50">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div>
          <div className="font-display text-sm font-semibold">Session History</div>
          <div className="text-[11px] text-muted-foreground">
            {total} session{total !== 1 ? "s" : ""} · {checked.size} selected
          </div>
        </div>
        {checked.size > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-3 w-3" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <GitCompareArrows className="mr-1.5 h-3 w-3" /> Compare
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={checked.size === paged.length && paged.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Session</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("startedAt")}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Started <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Driver State</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("maxFatigueScore")}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Fatigue <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Alerts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((s) => {
              const TypeIcon = TYPE_ICON[s.source] ?? Camera;
              const isSel = selectedId === s.id;
              return (
                <TableRow
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`cursor-pointer border-border/30 transition-colors ${isSel ? "bg-primary/5" : "hover:bg-primary/[0.03]"}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={checked.has(s.id)} onCheckedChange={() => toggleOne(s.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {s.id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    <div>{format(new Date(s.startedAt), "MMM d, yyyy")}</div>
                    <div className="text-muted-foreground">
                      {format(new Date(s.startedAt), "HH:mm:ss")}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.durationSeconds != null ? formatDuration(s.durationSeconds) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/40 px-2 py-0.5 text-[11px] capitalize">
                      <TypeIcon className="h-3 w-3 text-primary" /> {s.source}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DriverStateBadge state={s.finalState?.toLowerCase()} />
                  </TableCell>
                  <TableCell>
                    <FatigueBar value={s.maxFatigueScore} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-xs font-semibold ${s.totalAlerts === 0 ? "text-muted-foreground" : s.totalAlerts > 5 ? "text-red-400" : "text-amber-300"}`}
                    >
                      {s.totalAlerts}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconAction icon={Eye} label="View" onClick={() => onSelect(s.id)} />
                      {isAdmin && <IconAction icon={Trash2} label="Delete" danger />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 px-5 py-3">
        <div className="text-[11px] text-muted-foreground">
          Page {page} of {pages}
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer"
              />
            </PaginationItem>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => setPage(p)}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="cursor-pointer"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </Card>
  );
}
function FatigueBar({ value }) {
  const color = value > 70 ? "bg-red-500" : value > 45 ? "bg-amber-400" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
function IconAction({ icon: Icon, label, danger, onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={label}
      className={`h-7 w-7 ${danger ? "hover:bg-red-500/10 hover:text-red-400" : "hover:bg-primary/10 hover:text-primary"}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
