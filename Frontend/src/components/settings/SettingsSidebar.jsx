import { cn } from "@/lib/utils";
import { CATEGORIES, GROUP_LABELS } from "./data";
import { motion } from "framer-motion";
export function SettingsSidebar({ active, onSelect, collapsed }) {
  const groups = Object.keys(GROUP_LABELS);
  return (
    <aside
      className={cn(
        "glass-panel sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/50 p-3 transition-all",
        collapsed ? "w-[68px]" : "w-full",
      )}
    >
      {groups.map((g) => {
        const items = CATEGORIES.filter((c) => c.group === g);
        return (
          <div key={g} className="mb-4">
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                {GROUP_LABELS[g]}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map((c) => {
                const activeItem = active === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all",
                      activeItem
                        ? "border border-primary/25 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_20px_-6px_var(--color-primary)]"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {activeItem && (
                      <motion.span
                        layoutId="settings-active"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary shadow-[0_0_10px_var(--color-primary)]"
                      />
                    )}
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.badge && (
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest",
                              c.badge === "Danger"
                                ? "border-red-500/40 bg-red-500/10 text-red-400"
                                : "border-primary/40 bg-primary/10 text-primary",
                            )}
                          >
                            {c.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
