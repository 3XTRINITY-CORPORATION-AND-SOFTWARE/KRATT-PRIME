import { DOWNLOAD_PROFILE } from './types'

export { DOWNLOAD_PROFILE }

export type CaptureCaps = {
  mediaRecorder: boolean
  preferredMime: string | null
  canvasCapture: boolean
  asio: 'deferred-desktop'
}

export function probeCapture(): CaptureCaps {
  let mediaRecorder = false
  let preferredMime: string | null = null
  let canvasCapture = false
  try {
    mediaRecorder = typeof MediaRecorder !== 'undefined'
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ]
    for (const m of candidates) {
      if (mediaRecorder && MediaRecorder.isTypeSupported(m)) {
        preferredMime = m
        break
      }
    }
  } catch {
    mediaRecorder = false
  }
  try {
    canvasCapture =
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function'
  } catch {
    canvasCapture = false
  }
  return { mediaRecorder, preferredMime, canvasCapture, asio: 'deferred-desktop' }
}

/** Best-effort canvas → blob download. Returns null if unsupported. */
export async function captureCanvasBlob(
  canvas: HTMLCanvasElement,
  ms = 2500,
): Promise<{ blob: Blob; mime: string } | null> {
  const caps = probeCapture()
  if (!caps.canvasCapture || !caps.mediaRecorder || !caps.preferredMime) return null
  const stream = canvas.captureStream(30)
  const chunks: BlobPart[] = []
  const rec = new MediaRecorder(stream, { mimeType: caps.preferredMime })
  return new Promise((resolve) => {
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (!chunks.length) {
        resolve(null)
        return
      }
      resolve({ blob: new Blob(chunks, { type: caps.preferredMime! }), mime: caps.preferredMime! })
    }
    rec.onerror = () => {
      stream.getTracks().forEach((t) => t.stop())
      resolve(null)
    }
    rec.start(200)
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop()
    }, ms)
  })
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function extForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  return 'webm'
}
