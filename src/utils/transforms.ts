import type { Comment as ApiComment, UserSummary } from '../lib/api'

export function transformAuthor(author: UserSummary) {
  return {
    id: author.id,
    name: author.name,
    role: author.role,
    verified: true,
    avatarUrl: author.avatarUrl,
    avatarInitials: author.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    institutionType: author.institutionType as 'municipality' | 'agency' | 'ministry' | undefined,
    institutionName: author.institutionName
  }
}

export function transformComment(comment: ApiComment) {
  return {
    id: comment.id,
    threadId: '',
    authorId: comment.author?.id ?? '',
    parentId: comment.parentId,
    content: comment.content,
    contentHtml: comment.contentHtml,
    score: comment.score || 0,
    depth: comment.depth || 0,
    userVote: comment.userVote || 0,
    createdAt: comment.createdAt,
    isHidden: comment.isHidden,
    author: comment.author ? transformAuthor(comment.author) : null
  }
}

export function getAvatarInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
