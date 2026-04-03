import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
  type: "thread" | "comment" | "message";
}

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  type,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation("common");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-sm">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t("deleteConfirm.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            aria-label={t("actions.close")}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t(`deleteConfirm.${type}`)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {t("deleteConfirm.warning")}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {t("actions.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? t("actions.loading") : t("actions.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
