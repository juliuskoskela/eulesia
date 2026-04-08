import { useState, useRef, useEffect, useCallback } from "react";
import { ContentWithPreviews } from "../components/common/ContentWithPreviews";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Pencil,
  Trash2,
  Check,
  Lock,
  Unlock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout";
import { SEOHead } from "../components/SEOHead";
import {
  ActorBadge,
  EditedIndicator,
  ConfirmDeleteDialog,
} from "../components/common";
import {
  useConversation,
  useSendDM,
  useMarkRead,
  useEditDirectMessage,
  useDeleteDirectMessage,
} from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { useDevice } from "../hooks/useDevice";
import { useSocket } from "../hooks/useSocket";
import { useKeyboard } from "../hooks/useKeyboard";
import { formatRelativeTime } from "../lib/formatTime";
import type { DirectMessage } from "../lib/api";
import { getAvatarInitials } from "../utils/avatar";

/**
 * Hook to decrypt an E2EE message on demand. Returns the decrypted content
 * or falls back to the plaintext content field.
 */
function useDecryptedContent(message: DirectMessage): {
  content: string;
  isDecrypting: boolean;
  decryptionFailed: boolean;
} {
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionFailed, setDecryptionFailed] = useState(false);

  const decrypt = useCallback(async () => {
    if (!message.ciphertext || !message.senderDeviceId) return;

    setIsDecrypting(true);
    try {
      const { decryptConversationMessage } = await import(
        "../lib/e2ee/index.ts"
      );
      const plaintext = await decryptConversationMessage(
        message.conversationId,
        message.senderDeviceId,
        message.ciphertext,
      );
      setDecryptedContent(plaintext);
    } catch (err) {
      console.warn("Message decryption failed:", err);
      setDecryptionFailed(true);
    } finally {
      setIsDecrypting(false);
    }
  }, [message.ciphertext, message.senderDeviceId, message.conversationId]);

  useEffect(() => {
    if (message.ciphertext && message.senderDeviceId && !decryptedContent) {
      decrypt();
    }
  }, [message.ciphertext, message.senderDeviceId, decryptedContent, decrypt]);

  // If we have ciphertext and decrypted it, use that. Otherwise use content.
  const content = decryptedContent ?? message.content;

  return { content, isDecrypting, decryptionFailed };
}

interface DMMessageBubbleProps {
  message: DirectMessage;
  isOwnMessage: boolean;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
}

function MessageBubble({
  message,
  isOwnMessage,
  onEdit,
  onDelete,
}: DMMessageBubbleProps) {
  const { t } = useTranslation(["messages", "common"]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const {
    content: displayContent,
    isDecrypting,
    decryptionFailed,
  } = useDecryptedContent(message);

  if (message.isHidden) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
          {t("common:messageDeleted")}
        </span>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditContent(displayContent);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
    >
      <div className="flex-shrink-0">
        {message.author && (
          <ActorBadge
            user={{
              ...message.author,
              avatarInitials: getAvatarInitials(message.author.name),
            }}
            showName={false}
            size="sm"
          />
        )}
      </div>
      <div className={`max-w-[75%] ${isOwnMessage ? "text-right" : ""}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className={`text-sm font-medium text-gray-800 dark:text-gray-200 ${isOwnMessage ? "order-2" : ""}`}
          >
            {message.author?.name}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.editedAt && <EditedIndicator editedAt={message.editedAt} />}
        </div>
        {isEditing ? (
          <div className="text-left">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                {t("common:actions.save")}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t("common:actions.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative inline-block">
            <div
              className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                isOwnMessage
                  ? "bg-teal-600 text-white rounded-br-md"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-100 dark:border-gray-700"
              }`}
            >
              {isDecrypting ? (
                <p className="text-sm italic opacity-60">Decrypting...</p>
              ) : decryptionFailed ? (
                <p className="text-sm italic opacity-60">
                  Unable to decrypt message
                </p>
              ) : message.contentHtml && !message.ciphertext ? (
                <ContentWithPreviews
                  html={message.contentHtml}
                  className={`prose prose-sm max-w-none ${
                    isOwnMessage ? "prose-invert" : "dark:prose-invert"
                  }`}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
              )}
              {message.ciphertext && !decryptionFailed && !isDecrypting && (
                <Lock className="inline-block w-3 h-3 ml-1 opacity-40" />
              )}
            </div>
            {isOwnMessage && (
              <div className="absolute top-0 left-0 -translate-x-full pr-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                <button
                  onClick={handleStartEdit}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title={t("common:actions.edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
                  title={t("common:actions.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        type="message"
        onConfirm={() => {
          onDelete(message.id);
          setShowDeleteConfirm(false);
        }}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export function DMConversationPage() {
  const { t } = useTranslation("messages");
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { currentUser } = useAuth();
  const { deviceId, isInitialized: deviceReady } = useDevice();
  const { joinDm, leaveDm, emitTypingDm, typingInDm } = useSocket();
  const { isKeyboardOpen, keyboardHeight } = useKeyboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    data: conversationData,
    isLoading,
    error,
  } = useConversation(conversationId || "");
  const otherUserId = conversationData?.otherUser?.id ?? null;
  const sendMessageMutation = useSendDM(conversationId || "", {
    deviceId: deviceReady ? deviceId : null,
    otherUserId,
  });
  const markReadMutation = useMarkRead(conversationId || "");
  const editMessageMutation = useEditDirectMessage(conversationId || "");
  const deleteMessageMutation = useDeleteDirectMessage(conversationId || "");

  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      joinDm(conversationId);
      return () => {
        leaveDm(conversationId);
      };
    }
  }, [conversationId, joinDm, leaveDm]);

  useEffect(() => {
    if (conversationId && conversationData) {
      markReadMutation.mutate();
    }
  }, [conversationId, conversationData?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationData?.messages]);

  useEffect(() => {
    if (isKeyboardOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isKeyboardOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;

    try {
      await sendMessageMutation.mutateAsync(newMessage.trim());
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !conversationData) {
    return (
      <Layout>
        <div className="px-4 py-12 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {t("loadError")}
          </p>
          <Link
            to="/messages"
            className="text-teal-600 dark:text-teal-400 hover:underline"
          >
            {t("backToMessages")}
          </Link>
        </div>
      </Layout>
    );
  }

  const { otherUser, messages } = conversationData;
  // E2EE is active when the device is initialized and conversation supports it
  const isEncrypted = deviceReady && conversationData.encryption === "e2ee";
  const canLinkToOtherUserProfile =
    Boolean(otherUser?.id) && (otherUser?.canViewProfile ?? true);

  const otherUserHeader = otherUser ? (
    <>
      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
        {otherUser.avatarUrl ? (
          <img
            src={otherUser.avatarUrl}
            alt={otherUser.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-white text-sm font-bold">
            {getAvatarInitials(otherUser.name)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-white truncate">
          {otherUser.name}
        </h1>
        {otherUser.institutionName && (
          <p className="text-sm text-white/70 truncate">
            {otherUser.institutionName}
          </p>
        )}
      </div>
    </>
  ) : null;

  return (
    <Layout>
      <SEOHead
        title={t("title")}
        path={`/messages/${conversationId}`}
        noIndex
      />
      <div
        className="flex flex-col"
        style={{
          height: isKeyboardOpen
            ? `calc(100dvh - 3.5rem - ${keyboardHeight}px)`
            : "calc(100dvh - 3.5rem - 5rem)",
        }}
      >
        {/* Header */}
        <div className="bg-teal-700 dark:bg-teal-800 px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            {otherUser && canLinkToOtherUserProfile && (
              <Link
                to={`/user/${otherUser.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {otherUserHeader}
              </Link>
            )}
            {otherUser && !canLinkToOtherUserProfile && (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {otherUserHeader}
              </div>
            )}
            {/* Encryption status */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10"
              title={
                isEncrypted
                  ? t("encryptionEnabled", {
                      defaultValue: "End-to-end encrypted",
                    })
                  : t("encryptionDisabled", {
                      defaultValue: "Not encrypted",
                    })
              }
            >
              {isEncrypted ? (
                <Lock className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-white/50" />
              )}
              <span className="text-xs text-white/70">
                {isEncrypted
                  ? t("encrypted", { defaultValue: "E2EE" })
                  : t("plaintext", { defaultValue: "Plain" })}
              </span>
            </div>
          </div>
        </div>

        {/* Messages area — contained surface with subtle pattern */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="px-4 py-4 space-y-4 min-h-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Send className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {t("noMessagesYet")}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {t("sendFirstMessage")}
                </p>
              </div>
            ) : (
              messages.map((msg: DirectMessage) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwnMessage={msg.author?.id === currentUser?.id}
                  onEdit={(messageId, content) =>
                    editMessageMutation.mutate({ messageId, content })
                  }
                  onDelete={(messageId) =>
                    deleteMessageMutation.mutate(messageId)
                  }
                />
              ))
            )}
            {/* Typing indicator */}
            {conversationId &&
              (typingInDm[conversationId]?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex gap-0.5">
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                  <span>{t("typing")}</span>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar — elevated surface */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (conversationId && e.target.value.trim())
                  emitTypingDm(conversationId);
              }}
              placeholder={t("writeMessage")}
              enterKeyHint="send"
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-750 transition-colors"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="p-2.5 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label={t("sendMessage")}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
