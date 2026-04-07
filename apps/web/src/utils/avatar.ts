/** Get 1-2 letter initials from a display name. */
export function getAvatarInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Enrich comments with avatar initials and authorId for CommentThread.
 * Uses `any` internally because TypeScript cannot infer intersection
 * types through generic spreads without losing fields. The public
 * contract is enforced by the call-site types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enrichComments(comments: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return comments.map((c: any) => ({
    ...c,
    authorId: c.authorId ?? c.author?.id ?? "",
    author: c.author
      ? {
          ...c.author,
          verified: false,
          avatarInitials: getAvatarInitials(c.author.name),
        }
      : null,
  }));
}
