/**
 * File Upload Service
 *
 * Handles image uploads with processing (resize, compress, WebP conversion).
 * Stores files locally with option to move to cloud storage later.
 */

import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

// Upload directory (relative to project root)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// API URL for generating full image URLs
const API_URL = process.env.API_URL || 'http://localhost:3001'

// Image size presets
export const IMAGE_PRESETS = {
  avatar: {
    width: 200,
    height: 200,
    quality: 70,
    fit: 'cover' as const
  },
  content: {
    width: 640,
    height: 480,
    quality: 70,
    fit: 'inside' as const  // Fit within bounds, maintain aspect ratio
  },
  thumbnail: {
    width: 200,
    height: 150,
    quality: 60,
    fit: 'cover' as const
  }
} as const

export type ImagePreset = keyof typeof IMAGE_PRESETS

/**
 * Ensure upload directories exist
 */
export async function ensureUploadDirs(): Promise<void> {
  const dirs = [
    path.join(UPLOAD_DIR, 'avatars'),
    path.join(UPLOAD_DIR, 'images'),
    path.join(UPLOAD_DIR, 'thumbnails')
  ]

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

/**
 * Generate a unique filename
 */
function generateFilename(userId: string): string {
  const ext = 'webp' // Always convert to WebP
  const hash = crypto.randomBytes(8).toString('hex')
  const timestamp = Date.now()
  return `${userId.slice(0, 8)}_${timestamp}_${hash}.${ext}`
}

/**
 * Process and save an avatar image
 */
export async function processAvatar(
  buffer: Buffer,
  userId: string
): Promise<{ url: string; filename: string }> {
  await ensureUploadDirs()

  const preset = IMAGE_PRESETS.avatar
  const filename = generateFilename(userId)
  const outputPath = path.join(UPLOAD_DIR, 'avatars', filename)

  // Process image: auto-rotate based on EXIF orientation, resize, convert to WebP
  await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation metadata (mobile photos)
    .resize(preset.width, preset.height, {
      fit: preset.fit,
      position: 'center'
    })
    .webp({ quality: preset.quality })
    .toFile(outputPath)

  // Return full URL (served by the API)
  const url = `${API_URL}/uploads/avatars/${filename}`

  return { url, filename }
}

/**
 * Process and save a content image (for threads, comments, etc.)
 */
export async function processContentImage(
  buffer: Buffer,
  userId: string
): Promise<{ url: string; thumbnailUrl: string; filename: string; width: number; height: number }> {
  await ensureUploadDirs()

  const contentPreset = IMAGE_PRESETS.content
  const thumbPreset = IMAGE_PRESETS.thumbnail
  const filename = generateFilename(userId)
  const thumbFilename = filename.replace('.webp', '_thumb.webp')

  const outputPath = path.join(UPLOAD_DIR, 'images', filename)
  const thumbPath = path.join(UPLOAD_DIR, 'thumbnails', thumbFilename)

  // Process main image: auto-rotate based on EXIF orientation, resize, convert to WebP
  const processedImage = await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation metadata (mobile photos)
    .resize(contentPreset.width, contentPreset.height, {
      fit: contentPreset.fit,
      withoutEnlargement: true // Don't upscale small images
    })
    .webp({ quality: contentPreset.quality })
    .toFile(outputPath)

  // Process thumbnail
  await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation metadata (mobile photos)
    .resize(thumbPreset.width, thumbPreset.height, {
      fit: thumbPreset.fit,
      position: 'center'
    })
    .webp({ quality: thumbPreset.quality })
    .toFile(thumbPath)

  return {
    url: `${API_URL}/uploads/images/${filename}`,
    thumbnailUrl: `${API_URL}/uploads/thumbnails/${thumbFilename}`,
    filename,
    width: processedImage.width,
    height: processedImage.height
  }
}

/**
 * Delete an uploaded file
 */
export async function deleteUpload(url: string): Promise<void> {
  // Extract the relative path from the URL
  // URLs can be full (http://host/uploads/avatars/file.webp) or relative (/uploads/avatars/file.webp)
  const uploadsIndex = url.indexOf('/uploads/')
  if (uploadsIndex === -1) return

  const relativePath = url.substring(uploadsIndex + '/uploads/'.length)

  // Prevent path traversal
  const normalizedPath = path.normalize(relativePath)
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) return

  const fullPath = path.join(UPLOAD_DIR, normalizedPath)

  try {
    await fs.unlink(fullPath)
  } catch (err) {
    // File might not exist, that's ok
    console.warn(`Could not delete file: ${fullPath}`, err)
  }
}

/**
 * Get file stats for storage monitoring
 */
export async function getStorageStats(): Promise<{
  avatars: { count: number; sizeBytes: number }
  images: { count: number; sizeBytes: number }
  thumbnails: { count: number; sizeBytes: number }
  totalBytes: number
}> {
  const stats = {
    avatars: { count: 0, sizeBytes: 0 },
    images: { count: 0, sizeBytes: 0 },
    thumbnails: { count: 0, sizeBytes: 0 },
    totalBytes: 0
  }

  const dirs = ['avatars', 'images', 'thumbnails'] as const

  for (const dir of dirs) {
    const dirPath = path.join(UPLOAD_DIR, dir)
    try {
      const files = await fs.readdir(dirPath)
      for (const file of files) {
        const fileStat = await fs.stat(path.join(dirPath, file))
        stats[dir].count++
        stats[dir].sizeBytes += fileStat.size
      }
    } catch {
      // Directory might not exist yet
    }
  }

  stats.totalBytes = stats.avatars.sizeBytes + stats.images.sizeBytes + stats.thumbnails.sizeBytes

  return stats
}
