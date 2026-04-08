import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Lock,
  Users,
  UserPlus,
  UserMinus,
  X,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/layout";
import { SEOHead } from "../components/SEOHead";
import {
  useGroupConversation,
  useSendGroupMessage,
  useMarkRead,
  useInviteGroupMember,
  useRemoveGroupMember,
} from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { useDevice } from "../hooks/useDevice";
import { useSocket } from "../hooks/useSocket";
import { useKeyboard } from "../hooks/useKeyboard";
import { formatRelativeTime } from "../lib/formatTime";
import { api } from "../lib/api";
import type { DirectMessage, GroupMember } from "../lib/api";
import type { SearchUserResult } from "../lib/api";

export function GroupConversationPage() {
  const { t } = useTranslation("messages");
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { currentUser } = useAuth();
  const { deviceId, isInitialized: deviceReady } = useDevice();
  const { joinDm, leaveDm, emitTypingDm, typingInDm } = useSocket();
  const { isKeyboardOpen } = useKeyboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: groupData,
    isLoading,
    error,
  } = useGroupConversation(conversationId || "");

  const currentEpoch = groupData?.currentEpoch ?? 0;
  const sendMessageMutation = useSendGroupMessage(conversationId || "", {
    deviceId: deviceReady ? deviceId : null,
    epoch: currentEpoch,
  });
  const markReadMutation = useMarkRead(conversationId || "");

  const [newMessage, setNewMessage] = useState("");
  const [showMembers, setShowMembers] = useState(false);

  // Determine current user's role
  const myMembership = groupData?.members.find(
    (m) => m.userId === currentUser?.id,
  );
  const isOwner = myMembership?.role === "owner";

  useEffect(() => {
    if (conversationId) {
      joinDm(conversationId);
      return () => {
        leaveDm(conversationId);
      };
    }
  }, [conversationId, joinDm, leaveDm]);

  useEffect(() => {
    if (conversationId && groupData) {
      markReadMutation.mutate();
    }
  }, [conversationId, groupData?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupData?.messages]);

  useEffect(() => {
    if (isKeyboardOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isKeyboardOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !deviceReady) return;

    try {
      await sendMessageMutation.mutateAsync(newMessage.trim());
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send group message:", err);
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

  if (error || !groupData) {
    return (
      <Layout>
        <div className="px-4 py-12 text-center">
          <p className="text-red-600 mb-4">
            {t("loadError", { defaultValue: "Failed to load conversation" })}
          </p>
          <button
            onClick={() => navigate("/messages")}
            className="text-teal-600 hover:underline"
          >
            {t("backToMessages", { defaultValue: "Back to Messages" })}
          </button>
        </div>
      </Layout>
    );
  }

  const messages = groupData.messages ?? [];
  const typingUsers = conversationId ? (typingInDm[conversationId] ?? []) : [];

  return (
    <Layout>
      <SEOHead
        title={groupData.name || t("groupChat", { defaultValue: "Group" })}
        path={`/messages/group/${conversationId}`}
        noIndex
      />
      <div className="flex flex-col h-[calc(100dvh-56px)]">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-950 border-b border-emerald-600/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/messages")}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-white truncate">
                {groupData.name}
              </h1>
              <p className="text-xs text-white/70">
                {t("memberCount", {
                  defaultValue: "{{count}} members",
                  count: groupData.members.length,
                })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-white/10 text-white/85">
                <Lock className="w-3 h-3 text-emerald-200" /> E2EE
              </span>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Member panel (slide out) */}
        {showMembers && (
          <MemberPanel
            conversationId={conversationId || ""}
            members={groupData.members}
            isOwner={isOwner}
            currentUserId={currentUser?.id ?? ""}
            onClose={() => setShowMembers(false)}
          />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50 via-white to-gray-50 dark:from-emerald-950/20 dark:via-gray-950 dark:to-gray-950">
          <div className="px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("noGroupMessages", {
                    defaultValue: "No messages yet. Start the conversation!",
                  })}
                </p>
              </div>
            ) : (
              messages.map((msg: DirectMessage) => (
                <GroupMessageBubble
                  key={msg.id}
                  message={msg}
                  isOwnMessage={msg.author?.id === currentUser?.id}
                />
              ))
            )}
            {typingUsers.length > 0 && (
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

        {/* Device warning */}
        {!deviceReady && (
          <div className="flex-shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("deviceNotRegistered", {
                defaultValue:
                  "Your device is not registered for encryption. Go to Settings to set up a device.",
              })}
            </p>
          </div>
        )}

        {/* Input bar */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 border-t border-emerald-100 dark:border-emerald-950/40 px-4 py-3 backdrop-blur">
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
              disabled={!deviceReady}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={
                !newMessage.trim() ||
                sendMessageMutation.isPending ||
                !deviceReady
              }
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

// ---------------------------------------------------------------------------
// Group message bubble (simplified — no edit/delete for groups)
// ---------------------------------------------------------------------------

function GroupMessageBubble({
  message,
  isOwnMessage,
}: {
  message: DirectMessage;
  isOwnMessage: boolean;
}) {
  return (
    <div className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOwnMessage
            ? "bg-teal-600 text-white rounded-br-md"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}
      >
        {!isOwnMessage && message.author && (
          <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-0.5">
            {message.author.name}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div
          className={`flex items-center gap-1 mt-1 ${
            isOwnMessage ? "justify-end" : ""
          }`}
        >
          <span
            className={`text-[10px] ${
              isOwnMessage
                ? "text-teal-200"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.ciphertext && (
            <Lock
              className={`w-2.5 h-2.5 ${
                isOwnMessage
                  ? "text-teal-200"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member panel
// ---------------------------------------------------------------------------

function MemberPanel({
  conversationId,
  members,
  isOwner,
  currentUserId,
  onClose,
}: {
  conversationId: string;
  members: GroupMember[];
  isOwner: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("messages");
  const inviteMutation = useInviteGroupMember(conversationId);
  const removeMutation = useRemoveGroupMember(conversationId);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberIds = new Set(members.map((m) => m.userId));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchUsers(query.trim(), 10);
        setSearchResults(results.filter((u) => !memberIds.has(u.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleInvite = async (userId: string) => {
    try {
      await inviteMutation.mutateAsync(userId);
      setSearchQuery("");
      setSearchResults([]);
      setShowInvite(false);
    } catch (err) {
      console.error("Failed to invite member:", err);
    }
  };

  return (
    <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 px-4 py-3 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t("members", { defaultValue: "Members" })} ({members.length})
        </h3>
        <div className="flex items-center gap-1">
          {isOwner && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invite search */}
      {showInvite && (
        <div className="mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("searchUsers", {
                defaultValue: "Search users to invite...",
              })}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          {isSearching && (
            <p className="text-xs text-gray-400 mt-1">
              {t("searching", { defaultValue: "Searching..." })}
            </p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-1 space-y-1">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleInvite(user.id)}
                  disabled={inviteMutation.isPending}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {user.name}
                  </span>
                  <UserPlus className="w-3.5 h-3.5 text-teal-600 ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="space-y-1">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center justify-between py-1"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-[10px] font-bold">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {member.name}
                {member.userId === currentUserId && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({t("you", { defaultValue: "you" })})
                  </span>
                )}
              </span>
              {member.role === "owner" && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                  {t("owner", { defaultValue: "Owner" })}
                </span>
              )}
            </div>
            {isOwner && member.userId !== currentUserId && (
              <button
                onClick={() => removeMutation.mutate(member.userId)}
                disabled={removeMutation.isPending}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                title={t("removeMember", { defaultValue: "Remove member" })}
              >
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
