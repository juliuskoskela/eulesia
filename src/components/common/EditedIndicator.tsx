import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../lib/formatTime";

interface EditedIndicatorProps {
  editedAt: string;
  editorName?: string | null;
}

export function EditedIndicator({
  editedAt,
  editorName,
}: EditedIndicatorProps) {
  const { t } = useTranslation("common");

  return (
    <span
      className="text-xs text-gray-400 italic"
      title={new Date(editedAt).toLocaleString()}
    >
      (
      {editorName
        ? t("actions.editedBy", { name: editorName })
        : t("actions.edited")}{" "}
      {formatRelativeTime(editedAt)})
    </span>
  );
}
