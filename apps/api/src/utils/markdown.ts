import { marked, type TokenizerExtension, type RendererExtension } from 'marked'
import sanitizeHtml from 'sanitize-html'

// --- YouTube embed extension ---
const YOUTUBE_REGEX = /^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^\s]*)\n?/

const youtubeExtension: TokenizerExtension & RendererExtension = {
  name: 'youtube',
  level: 'block',
  start(src: string) {
    return src.match(/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//)?.index
  },
  tokenizer(src: string) {
    const match = src.match(YOUTUBE_REGEX)
    if (match) {
      return {
        type: 'youtube',
        raw: match[0],
        videoId: match[2]
      }
    }
  },
  renderer(token) {
    return `<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${token.videoId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" title="YouTube video"></iframe></div>\n`
  }
}

// --- Image URL embed extension ---
const IMAGE_URL_REGEX = /^(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|avif|bmp)(?:\?[^\s]*)?)\n?/i

const imageEmbedExtension: TokenizerExtension & RendererExtension = {
  name: 'imageEmbed',
  level: 'block',
  start(src: string) {
    return src.match(/^https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|avif|bmp)/i)?.index
  },
  tokenizer(src: string) {
    const match = src.match(IMAGE_URL_REGEX)
    if (match) {
      return {
        type: 'imageEmbed',
        raw: match[0],
        url: match[1]
      }
    }
  },
  renderer(token) {
    const escaped = escapeHtml(token.url)
    return `<img src="${escaped}" alt="Embedded image" loading="lazy" class="embedded-image" referrerpolicy="no-referrer" />\n`
  }
}

// --- Link preview placeholder extension ---
// Matches bare URLs on their own line that are NOT YouTube or image URLs
const YOUTUBE_HOST_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?[^\s]*)?$/i
const LINK_PREVIEW_REGEX = /^(https?:\/\/[^\s]+)\n?/

const linkPreviewExtension: TokenizerExtension & RendererExtension = {
  name: 'linkPreview',
  level: 'block',
  start(src: string) {
    return src.match(/^https?:\/\//)?.index
  },
  tokenizer(src: string) {
    const match = src.match(LINK_PREVIEW_REGEX)
    if (match) {
      const url = match[1]
      // Skip if YouTube or image (those have their own handlers)
      if (YOUTUBE_HOST_RE.test(url) || IMAGE_EXT_RE.test(url)) return undefined
      return {
        type: 'linkPreview',
        raw: match[0],
        url
      }
    }
  },
  renderer(token) {
    const escaped = escapeHtml(token.url)
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>\n<div class="link-preview" data-url="${escaped}"></div>\n`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Configure marked with extensions
marked.setOptions({
  gfm: true,
  breaks: true
})
// Note: order matters — YouTube and image extensions are checked first
marked.use({ extensions: [youtubeExtension, imageEmbedExtension, linkPreviewExtension] })

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'del', 's',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // Embeds
    'iframe', 'div'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class', 'referrerpolicy'],
    code: ['class'],
    pre: ['class'],
    iframe: ['src', 'allow', 'allowfullscreen', 'loading', 'title'],
    div: ['class', 'data-url']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['https', 'http']
  },
  allowedIframeHostnames: ['www.youtube-nocookie.com', 'www.youtube.com'],
  allowedClasses: {
    div: ['youtube-embed', 'link-preview', 'summary-keypoints', 'summary-footer'],
    img: ['uploaded-image', 'embedded-image']
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    }),
    img: (tagName, attribs) => {
      const src = attribs.src || ''
      const apiUrl = process.env.API_URL || 'http://localhost:3001'
      const isLocalUpload = src.startsWith('/uploads/')
      const isApiUpload = src.startsWith(`${apiUrl}/uploads/`)
      const isApiDomain = src.startsWith('https://api.eulesia.eu/uploads/')
      const isExternalImage = src.startsWith('https://') && /\.(jpg|jpeg|png|gif|webp|avif|bmp)/i.test(src)

      if (!isLocalUpload && !isApiUpload && !isApiDomain && !isExternalImage) {
        return { tagName: '', attribs: {} }
      }

      if (isLocalUpload || isApiUpload || isApiDomain) {
        return {
          tagName,
          attribs: {
            ...attribs,
            loading: 'lazy',
            class: 'uploaded-image'
          }
        }
      }

      // External image
      return {
        tagName,
        attribs: {
          ...attribs,
          loading: 'lazy',
          class: 'embedded-image',
          referrerpolicy: 'no-referrer'
        }
      }
    }
  }
}

export function renderMarkdown(content: string): string {
  const html = marked(content) as string
  return sanitizeHtml(html, sanitizeOptions)
}
