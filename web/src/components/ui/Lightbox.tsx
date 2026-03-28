import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { api, type Entry } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Film,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { isImageEntry, isVideoEntry, isTextEntry } from './useMediaViewer'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

interface Props {
  entries: Entry[]
  activeId: string
  onClose: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function QueuePreview({ entry, active }: { entry: Entry; active: boolean }) {
  const isImage = isImageEntry(entry)
  const isVideo = isVideoEntry(entry)
  const isText = isTextEntry(entry)

  return (
    <div
      className={cn(
        'relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border',
        active ? 'border-white/20 bg-white/10' : 'border-white/5 bg-white/[0.04]'
      )}
    >
      {isImage ? (
        <img
          src={api.fs.thumb(entry.id)}
          alt={entry.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-white/[0.08] to-white/[0.02] text-white/55">
          {isText ? <FileText size={18} /> : <Film size={18} />}
        </div>
      )}

      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Play size={14} className="fill-white text-white drop-shadow-sm" />
        </div>
      )}
    </div>
  )
}

function TextViewer({ entry }: { entry: Entry }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    fetch(api.fs.raw(entry.id))
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.text()
      })
      .then(setContent)
      .catch(() => setError('Failed to load file content.'))
  }, [entry.id])

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
        {error}
      </div>
    )
  }

  if (content === null) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
        Loading…
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-auto p-4 sm:p-8">
      <pre className="whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-white/85 select-text">
        {content}
      </pre>
    </div>
  )
}

function NavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous media item' : 'Next media item'}
      className={cn(
        'absolute top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/70 backdrop-blur-md transition hover:bg-black/50 hover:text-white',
        direction === 'prev' ? 'left-4' : 'right-4',
        disabled && 'pointer-events-none opacity-20'
      )}
    >
      {direction === 'prev' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  )
}

export function Lightbox({ entries, activeId, onClose }: Props) {
  const [currentId, setCurrentId] = useState(activeId)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const desktopQueueRef = useRef<HTMLDivElement>(null)
  const mobileQueueRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isPinchingRef = useRef(false)
  const pinchDistRef = useRef<number | null>(null)
  const imageAreaRef = useRef<HTMLDivElement>(null)

  if (entries.length === 0) return null

  const currentIndex = Math.max(0, entries.findIndex(entry => entry.id === currentId))
  const entry = entries[currentIndex]
  const image = isImageEntry(entry)
  const video = isVideoEntry(entry)
  const text = isTextEntry(entry)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < entries.length - 1

  const selectEntry = (id: string) => {
    setCurrentId(id)
    setZoom(MIN_ZOOM)
    setMobileQueueOpen(false)
  }

  const go = (direction: -1 | 1) => {
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= entries.length) return
    selectEntry(entries[nextIndex].id)
  }

  const adjustZoom = (direction: -1 | 1) => {
    if (!image) return
    setZoom(value => clamp(value + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))
  }

  const togglePlay = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (videoElement.paused) {
      void videoElement.play().catch(() => {
        setVideoPlaying(!videoElement.paused)
      })
      return
    }

    videoElement.pause()
  }

  const seekVideo = (seconds: number) => {
    const videoElement = videoRef.current
    if (!videoElement) return
    const nextTime = clamp(
      videoElement.currentTime + seconds,
      0,
      Number.isFinite(videoElement.duration) ? videoElement.duration : videoElement.currentTime + seconds
    )
    videoElement.currentTime = nextTime
  }

  const toggleMute = () => {
    const videoElement = videoRef.current
    if (!videoElement) return
    videoElement.muted = !videoElement.muted
  }

  const toggleFullscreen = () => {
    const target = videoRef.current?.parentElement
    if (!target) return

    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }

    void target.requestFullscreen?.()
  }

  useEffect(() => {
    setCurrentId(activeId)
  }, [activeId])

  useEffect(() => {
    if (entries.some(candidate => candidate.id === currentId)) return
    setCurrentId(entries[0].id)
  }, [currentId, entries])

  useEffect(() => {
    setZoom(MIN_ZOOM)
    setMobileQueueOpen(false)
    setImageLoading(image)
    setImageError(null)
    setVideoLoading(video)
    setVideoError(null)
    setVideoPlaying(false)
    setVideoMuted(false)
  }, [currentId, image, video])

  useEffect(() => {
    const scrollActiveIntoView = (container: HTMLDivElement | null) => {
      const activeItem = container?.querySelector('[data-active="true"]')
      activeItem?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }

    scrollActiveIntoView(desktopQueueRef.current)
    scrollActiveIntoView(mobileQueueRef.current)
  }, [currentId, mobileQueueOpen])

  const onWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return

    const lowerKey = event.key.toLowerCase()

    if (event.key === 'Escape') {
      if (mobileQueueOpen) {
        setMobileQueueOpen(false)
        return
      }
      if (document.fullscreenElement) {
        void document.exitFullscreen()
        return
      }
      onClose()
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (video && !event.shiftKey) {
        seekVideo(-5)
        return
      }
      go(-1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (video && !event.shiftKey) {
        seekVideo(5)
        return
      }
      go(1)
      return
    }

    if (image && (event.key === '+' || event.key === '=')) {
      event.preventDefault()
      adjustZoom(1)
      return
    }

    if (image && event.key === '-') {
      event.preventDefault()
      adjustZoom(-1)
      return
    }

    if (!video) return

    if (event.key === ' ' || lowerKey === 'k') {
      event.preventDefault()
      togglePlay()
      return
    }

    if (lowerKey === 'm') {
      event.preventDefault()
      toggleMute()
      return
    }

    if (lowerKey === 'f') {
      event.preventDefault()
      toggleFullscreen()
    }
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onWindowKeyDown(event)
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onWindowKeyDown])

  useEffect(() => {
    const el = imageAreaRef.current
    if (!el || !image) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
        isPinchingRef.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchDistRef.current === null) return
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = dist / pinchDistRef.current
      pinchDistRef.current = dist
      setZoom(z => clamp(z * scale, MIN_ZOOM, MAX_ZOOM))
    }

    const handleTouchEnd = () => {
      pinchDistRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [image, currentId])

  return (
    <Dialog.Root open onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex overflow-hidden bg-[#050505] text-white focus:outline-none"
          onPointerDownOutside={event => event.preventDefault()}
        >
          <Dialog.Title className="sr-only">{entry.name}</Dialog.Title>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="safe-top flex min-h-14 items-center gap-2 border-b border-white/8 px-3 py-2 sm:px-4">
              <span className="shrink-0 text-xs tabular-nums text-white/45">
                {currentIndex + 1} / {entries.length}
              </span>
              <div className="min-w-0 flex-1">
                <p data-testid="lightbox-title" className="truncate text-sm font-medium text-white/90 sm:text-base">
                  {entry.name}
                </p>
                <p className="truncate text-xs text-white/35">
                  {video && entries.length > 1
                    ? 'Left and right seek, Shift with arrows switches files'
                    : image
                      ? 'Arrow keys switch files, plus and minus change zoom'
                      : text
                        ? 'Text file — select and copy freely'
                        : 'Media viewer'}
                </p>
              </div>

              {entries.length > 1 && (
                <button
                  type="button"
                  data-testid="lightbox-open-queue"
                  onClick={() => setMobileQueueOpen(open => !open)}
                  aria-expanded={mobileQueueOpen}
                  aria-label={mobileQueueOpen ? 'Close queue' : 'Open queue'}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 text-xs font-medium text-white transition hover:bg-white/12 sm:hidden"
                >
                  <Film size={14} />
                  Queue
                </button>
              )}

              {image && (
                <div className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => adjustZoom(-1)}
                    disabled={zoom <= MIN_ZOOM}
                    aria-label="Zoom out"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white disabled:opacity-30"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="w-12 text-center text-xs tabular-nums text-white/45">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustZoom(1)}
                    disabled={zoom >= MAX_ZOOM}
                    aria-label="Zoom in"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white disabled:opacity-30"
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>
              )}

              {video && (
                <>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={videoPlaying ? 'Pause video' : 'Play video'}
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white sm:inline-flex"
                  >
                    {videoPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label="Toggle mute"
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white sm:inline-flex"
                  >
                    {videoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </>
              )}

              <a
                href={api.fs.raw(entry.id)}
                download={entry.name}
                className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 text-xs font-medium text-white transition hover:bg-white/12 sm:inline-flex"
              >
                <Download size={14} />
                Download
              </a>

              <Dialog.Close
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white"
                aria-label="Close media viewer"
              >
                <X size={18} />
              </Dialog.Close>
            </div>

            <div
              ref={imageAreaRef}
              className="relative flex-1"
              onTouchStart={e => {
                isPinchingRef.current = e.touches.length >= 2
                if (e.touches.length === 1) {
                  touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
                }
              }}
              onTouchEnd={e => {
                if (isPinchingRef.current) {
                  isPinchingRef.current = false
                  touchStartRef.current = null
                  return
                }
                if (!touchStartRef.current) return
                const t = e.changedTouches[0]
                const dx = t.clientX - touchStartRef.current.x
                const dy = t.clientY - touchStartRef.current.y
                const dt = Date.now() - touchStartRef.current.time
                touchStartRef.current = null
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 400 && zoom <= MIN_ZOOM) {
                  if (dx > 0) go(-1)
                  else go(1)
                }
              }}
            >
              {image && (
                <div className="absolute inset-0" onClick={onClose}>
                  <div
                    className={cn(
                      'absolute inset-x-4 inset-y-6 sm:inset-x-8 sm:inset-y-8 flex items-center justify-center',
                      zoom > MIN_ZOOM ? 'overflow-auto' : 'overflow-hidden'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center',
                        zoom > MIN_ZOOM ? 'min-h-full min-w-full' : 'h-full w-full'
                      )}
                      onClick={event => event.stopPropagation()}
                    >
                      <img
                        key={entry.id}
                        data-testid="lightbox-media-image"
                        src={api.fs.raw(entry.id)}
                        alt={entry.name}
                        draggable={false}
                        onLoad={() => { setImageLoading(false); setImageError(null) }}
                        onError={() => { setImageLoading(false); setImageError('Failed to load this image.') }}
                        onDoubleClick={() => setZoom(value => value > 1 ? MIN_ZOOM : 2)}
                        className="select-none object-contain shadow-2xl"
                        style={{
                          maxHeight: zoom === MIN_ZOOM ? '100%' : 'none',
                          maxWidth: zoom === MIN_ZOOM ? '100%' : `${zoom * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {video && (
                <div className="absolute inset-0 bg-black">
                  <div className="absolute inset-x-4 inset-y-6 sm:inset-x-8 sm:inset-y-8 flex items-center justify-center">
                    <div className="relative flex h-full w-full items-center justify-center">
                      <video
                        key={entry.id}
                        ref={videoRef}
                        className="max-h-full max-w-full rounded-2xl bg-black shadow-2xl"
                        controls
                        autoPlay
                        playsInline
                        preload="auto"
                        onLoadStart={() => { setVideoLoading(true); setVideoError(null) }}
                        onCanPlay={() => setVideoLoading(false)}
                        onPlay={() => setVideoPlaying(true)}
                        onPause={() => setVideoPlaying(false)}
                        onWaiting={() => setVideoLoading(true)}
                        onPlaying={() => setVideoLoading(false)}
                        onVolumeChange={event => setVideoMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
                        onEnded={() => { setVideoPlaying(false); if (hasNext) go(1) }}
                        onError={() => { setVideoLoading(false); setVideoError('Failed to load this video.') }}
                      >
                        <source src={api.fs.raw(entry.id)} type={entry.mime} />
                      </video>
                    </div>
                  </div>
                </div>
              )}

              {!image && !video && text && <TextViewer entry={entry} />}

              {!image && !video && !text && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                  Unsupported media type
                </div>
              )}

              {imageLoading && image && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-white/75 backdrop-blur-sm">
                    Loading image
                  </div>
                </div>
              )}

              {imageError && image && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                  <div className="rounded-2xl border border-white/10 bg-black/65 px-5 py-4 text-sm text-white/80 backdrop-blur-sm">
                    {imageError}
                  </div>
                </div>
              )}

              {videoLoading && video && (
                <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                  <div className="rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-white/75 backdrop-blur-sm">
                    Buffering video
                  </div>
                </div>
              )}

              {videoError && video && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                  <div className="rounded-2xl border border-white/10 bg-black/65 px-5 py-4 text-sm text-white/80 backdrop-blur-sm">
                    {videoError}
                  </div>
                </div>
              )}

              {entries.length > 1 && (
                <>
                  <NavButton direction="prev" disabled={!hasPrev} onClick={() => go(-1)} />
                  <NavButton direction="next" disabled={!hasNext} onClick={() => go(1)} />
                </>
              )}
            </div>
          </div>

          {entries.length > 1 && (
            <aside className="hidden w-80 shrink-0 border-l border-white/8 bg-white/[0.03] sm:flex sm:flex-col">
              <div className="border-b border-white/8 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Queue</p>
                <p className="mt-1 text-sm text-white/70">
                  {entries.length} media items
                </p>
              </div>

              <div ref={desktopQueueRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {entries.map((item, index) => {
                  const active = item.id === entry.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={active}
                      onClick={() => selectEntry(item.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
                        active
                          ? 'border-white/18 bg-white/10'
                          : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                      )}
                    >
                      <QueuePreview entry={item} active={active} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm font-medium', active ? 'text-white' : 'text-white/75')}>
                          {item.name}
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {index + 1} of {entries.length}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>
          )}

          {entries.length > 1 && mobileQueueOpen && (
            <div className="fixed inset-0 z-[60] sm:hidden">
              <button
                type="button"
                aria-label="Close queue"
                onClick={() => setMobileQueueOpen(false)}
                className="absolute inset-0 bg-black/60"
              />

              <div
                data-testid="lightbox-mobile-queue"
                className="safe-bottom absolute inset-x-0 bottom-0 z-10 flex max-h-[min(70vh,34rem)] flex-col rounded-t-[1.75rem] border-t border-white/10 bg-[#101010] shadow-2xl"
              >
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/15" />

                <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Queue</p>
                    <p className="mt-1 text-sm text-white/70">
                      {currentIndex + 1} of {entries.length}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileQueueOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close queue"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div ref={mobileQueueRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                  {entries.map((item, index) => {
                    const active = item.id === entry.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-active={active}
                        data-testid="lightbox-queue-item"
                        onClick={() => selectEntry(item.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
                          active
                            ? 'border-white/18 bg-white/10'
                            : 'border-white/5 bg-white/[0.03] active:bg-white/[0.1]'
                        )}
                      >
                        <QueuePreview entry={item} active={active} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm font-medium', active ? 'text-white' : 'text-white/75')}>
                            {item.name}
                          </p>
                          <p className="mt-1 text-[11px] text-white/35">
                            {index + 1} of {entries.length}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
