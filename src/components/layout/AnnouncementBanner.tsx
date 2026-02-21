import { useState } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { useAnnouncements } from "../../hooks/useApi";
import type { SystemAnnouncement } from "../../lib/api";

const typeConfig = {
  info: {
    bg: "bg-blue-600",
    icon: Info,
  },
  warning: {
    bg: "bg-amber-500",
    icon: AlertTriangle,
  },
  critical: {
    bg: "bg-red-600",
    icon: AlertCircle,
  },
} as const;

export function AnnouncementBanner() {
  const { data: announcements } = useAnnouncements();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!announcements?.length) return null;

  const visible = announcements.filter(
    (a: SystemAnnouncement) => !dismissed.has(a.id),
  );
  if (!visible.length) return null;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="fixed top-14 left-0 right-0 z-50">
      {visible.map((announcement: SystemAnnouncement) => {
        const config = typeConfig[announcement.type];
        const Icon = config.icon;
        return (
          <div key={announcement.id} className={`${config.bg} text-white`}>
            <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
              <Icon className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">
                  {announcement.title}
                </span>
                {announcement.message &&
                  announcement.message !== announcement.title && (
                    <span className="text-sm opacity-90 ml-1.5">
                      — {announcement.message}
                    </span>
                  )}
              </div>
              {announcement.type !== "critical" && (
                <button
                  onClick={() => handleDismiss(announcement.id)}
                  className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
