import type { AuthorSummary } from "../types/generated/AuthorSummary";
import type { Comment as ApiComment } from "../lib/api";

/**
 * Enrich an AuthorSummary (from the Rust backend) with UI-computed fields.
 * This is a temporary bridge — components should eventually compute these
 * inline and use AuthorSummary directly.
 */
export function transformAuthor(
  author: AuthorSummary | { id: string; name: string; role: string },
) {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    verified: false, // TODO: derive from user profile, not author summary
    canViewProfile: Boolean(author.id),
    avatarUrl: "avatarUrl" in author ? author.avatarUrl : null,
    avatarInitials: getAvatarInitials(author.name),
  };
}

/**
 * Enrich a CommentResponse with UI-computed fields.
 * Temporary bridge — same as transformAuthor.
 */
export function transformComment(comment: ApiComment) {
  return {
    id: comment.id,
    threadId: comment.threadId ?? "",
    authorId: comment.authorId ?? comment.author?.id ?? "",
    parentId: comment.parentId,
    content: comment.content,
    contentHtml: comment.contentHtml,
    score: comment.score || 0,
    depth: comment.depth || 0,
    userVote: comment.userVote || 0,
    createdAt: comment.createdAt,
    isHidden: comment.isHidden,
    author: comment.author ? transformAuthor(comment.author) : null,
  };
}

export function getAvatarInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
