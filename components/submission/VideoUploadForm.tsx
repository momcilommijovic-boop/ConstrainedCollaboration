'use client'

import { useState, useRef } from 'react'
import { getVideoUploadUrl, registerVideoClip } from '@/app/actions/videos'

interface Props {
  cellId: string
  briefId: string | null
  existingClip?: {
    fileName: string | null
    status: string
    uploadedAt: string
  } | null
}

export function VideoUploadForm({ cellId, briefId, existingClip }: Props) {
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const MAX_BYTES = 100 * 1024 * 1024 // 100MB

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please select a video file.')
      return
    }

    const allowed = ['video/mp4', 'video/quicktime', 'video/webm']
    if (!allowed.includes(file.type)) {
      setError('Only MP4, MOV, and WebM files are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File must be under 100MB.')
      return
    }

    setPhase('uploading')
    setProgress(0)
    setError(null)

    // Step 1: get signed upload URL
    const urlForm = new FormData()
    urlForm.set('cell_id', cellId)
    urlForm.set('file_type', file.type)
    const urlResult = await getVideoUploadUrl({ error: null }, urlForm)

    if (urlResult.error || !urlResult.uploadUrl || !urlResult.path) {
      setError(urlResult.error ?? 'Could not get upload URL.')
      setPhase('error')
      return
    }

    // Step 2: PUT directly to signed URL
    try {
      await uploadWithProgress(urlResult.uploadUrl, file, file.type, setProgress)
    } catch {
      setError('Upload failed — please try again.')
      setPhase('error')
      return
    }

    // Step 3: register in DB
    const regForm = new FormData()
    regForm.set('cell_id', cellId)
    if (briefId) regForm.set('brief_id', briefId)
    regForm.set('storage_path', urlResult.path)
    regForm.set('file_name', file.name)
    regForm.set('file_size_bytes', String(file.size))
    const regResult = await registerVideoClip({ error: null }, regForm)

    if (regResult.error) {
      setError(regResult.error)
      setPhase('error')
      return
    }

    setPhase('done')
  }

  const isUploading = phase === 'uploading'
  const isDone = phase === 'done'

  return (
    <div>
      {existingClip && phase === 'idle' && (
        <div className="border border-near-black/20 px-5 py-4 mb-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1">
            Current Clip
          </p>
          <p className="font-mono text-xs text-near-black">
            {existingClip.fileName ?? 'video clip'}
            {' · '}
            <span
              className={
                existingClip.status === 'APPROVED'
                  ? 'text-near-black'
                  : existingClip.status === 'REJECTED'
                  ? 'text-accent-red'
                  : 'text-olive'
              }
            >
              {existingClip.status === 'APPROVED'
                ? 'Approved'
                : existingClip.status === 'REJECTED'
                ? 'Rejected'
                : 'Pending review'}
            </span>
          </p>
          <p className="font-mono text-xs text-olive mt-1">
            Uploaded {new Date(existingClip.uploadedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {isDone && (
        <div className="border border-near-black/20 px-5 py-4 mb-4">
          <p className="font-mono text-xs text-near-black">
            Clip uploaded — pending editor review.
          </p>
        </div>
      )}

      {!isDone && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            disabled={isUploading}
            className="block font-mono text-xs text-near-black
              file:mr-4 file:font-mono file:text-xs
              file:border file:border-near-black file:bg-transparent
              file:px-3 file:py-1.5 file:cursor-pointer
              file:hover:bg-near-black file:hover:text-off-white
              file:transition-colors
              disabled:opacity-40"
          />

          {isUploading && (
            <div>
              <div className="h-px bg-near-black/15 w-full">
                <div
                  className="h-px bg-near-black transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="font-mono text-xs text-olive mt-1">{progress}%</p>
            </div>
          )}

          {error && <p className="font-mono text-xs text-accent-red">{error}</p>}

          <button
            type="submit"
            disabled={isUploading}
            className="font-mono text-xs border border-near-black px-4 py-2
              hover:bg-near-black hover:text-off-white transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading…' : existingClip ? 'Replace Clip' : 'Upload Clip'}
          </button>
          <p className="font-mono text-xs text-olive">
            MP4, MOV or WebM · max 100MB · 1 minute recommended
          </p>
        </form>
      )}
    </div>
  )
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`HTTP ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.send(file)
  })
}
