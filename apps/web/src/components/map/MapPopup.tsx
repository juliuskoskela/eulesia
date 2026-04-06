import { Link } from "react-router-dom";
import {
  Landmark,
  Users,
  MapPin,
  Building2,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import type { MapPoint } from "../../lib/api";

interface MapPopupProps {
  point: MapPoint;
  onViewDetails?: () => void;
}

const typeConfig = {
  municipality: {
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  thread: {
    icon: Landmark,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  club: { icon: Users, color: "text-green-600", bgColor: "bg-green-100" },
  place: { icon: MapPin, color: "text-orange-600", bgColor: "bg-orange-100" },
};

export function MapPopup({ point, onViewDetails }: MapPopupProps) {
  const config = typeConfig[point.pointType as keyof typeof typeConfig];
  const Icon = config?.icon;
  const meta = (point.meta ?? {}) as Record<string, unknown>;

  const getLink = () => {
    switch (point.pointType) {
      case "thread":
        return `/agora/thread/${point.id}`;
      case "club":
        return `/clubs/${point.id}`;
      case "municipality":
        return `/kunnat/${point.id}`;
      default:
        return null;
    }
  };

  const link = getLink();

  return (
    <div className="min-w-[200px] max-w-[280px]">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {point.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {point.pointType}
          </p>
        </div>
      </div>

      {/* Meta info */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {meta.threadCount !== undefined && (
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <MessageCircle className="w-3.5 h-3.5" />
            {String(meta.threadCount)} threads
          </span>
        )}
        {meta.memberCount !== undefined && (
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {String(meta.memberCount)} members
          </span>
        )}
        {typeof meta.category === "string" && (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
            {meta.category}
          </span>
        )}
        {typeof meta.scope === "string" && (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded capitalize">
            {meta.scope}
          </span>
        )}
        {typeof meta.language === "string" && (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded uppercase">
            {meta.language}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
        {link ? (
          <Link
            to={link}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            View <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            onClick={onViewDetails}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            Details <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
