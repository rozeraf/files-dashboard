// web/src/components/ui/Lightbox.tsx
import { useEffect, useCallback, useState, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Entry, api } from '@/lib/api'
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Loader2, AlertCircle, Film,
} from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

const isImg = (e: Entry) => e.mime?.startsWith('image/')
const isVid = (e: Entry) => e.mime?.startsWith('video/')
const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const getBufferedEnd = (video: HTMLVideoElement) =>
  video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0

const fmt = (s: number) => {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ─── VideoPlayer ─────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  src: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  onEnded: () => void
}

function VideoPlayer({ src, hasPrev, hasNext, onPrev, onNext, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autoPlayPending = useRef(true)

  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [volume, setVolume]           = useState(1)
  const [muted, setMuted]             = useState(false)
  const [buffered, setBuffered]       = useState(0)
  const [speed, setSpeed]             = useState(1)
  const [ctrlsOn, setCtrlsOn]         = useState(true)
  const [fullscreen, setFullscreen]   = useState(false)
  const [flash, setFlash]             = useState<'play' | 'pause' | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)

  useEffect(() => {
    const onFulls = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFulls)
    return () => document.removeEventListener('fullscreenchange', onFulls)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.playbackRate = speed
    }
  }, [speed])

  useEffect(() => () => {
    clearTimeout(hideTimer.current)
    clearTimeout(flashTimer.current)
    videoRef.current?.pause()
  }, [])

  // auto-hide controls
  const bumpCtrls = useCallback(() => {
    setCtrlsOn(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setCtrlsOn(false), 3000)
  }, [])

  useEffect(() => {
    if (!playing || loading || loadError) {
      clearTimeout(hideTimer.current)
      setCtrlsOn(true)
    }
    else bumpCtrls()
  }, [playing, loading, loadError, bumpCtrls])

  const showFlash = useCallback((t: 'play' | 'pause') => {
    clearTimeout(flashTimer.current)
    setFlash(t)
    flashTimer.current = setTimeout(() => setFlash(null), 500)
  }, [])

  const playVideo = useCallback((flashType?: 'play' | 'pause') => {
    const v = videoRef.current
    if (!v) return
    autoPlayPending.current = false
    const playPromise = v.play()
    if (flashType) showFlash(flashType)
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setPlaying(!v.paused)
      })
    }
  }, [showFlash])

  const attemptAutoPlay = useCallback(() => {
    if (!autoPlayPending.current) return
    playVideo()
  }, [playVideo])

  const seekBy = (delta: number) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta))
    bumpCtrls()
  }

  // keyboard (video-specific)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === ' ')           { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowLeft')   { e.preventDefault(); seekBy(-5) }
      if (e.key === 'ArrowRight')  { e.preventDefault(); seekBy(5) }
      if (e.key === 'm' || e.key === 'M') toggleMute()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    if (loadError) return
    if (v.paused) {
      playVideo('play')
    } else {
      autoPlayPending.current = false
      v.pause()
      showFlash('pause')
    }
    bumpCtrls()
  }
  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    bumpCtrls()
  }
  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement?.parentElement
    if (!document.fullscreenElement) container?.requestFullscreen()
    else document.exitFullscreen()
    bumpCtrls()
  }
  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (videoRef.current) videoRef.current.currentTime = ratio * duration
    bumpCtrls()
  }
  const changeVol = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
    bumpCtrls()
  }
  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
    setSpeed(next)
    bumpCtrls()
  }

  const progPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufPct  = duration > 0 ? (buffered / duration) * 100 : 0
  const volPct  = muted ? 0 : volume * 100

  return (
    <div
      className={`relative w-full h-full bg-black flex items-center justify-center select-none ${ctrlsOn ? 'cursor-default' : 'cursor-none'}`}
      onMouseMove={bumpCtrls}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="max-h-full max-w-full"
        preload="auto"
        playsInline
        onClick={togglePlay}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onLoadedData={e => {
          const v = e.currentTarget
          setDuration(v.duration)
          setBuffered(getBufferedEnd(v))
          setLoading(false)
          setLoadError(null)
          attemptAutoPlay()
        }}
        onCanPlay={() => {
          setLoading(false)
          attemptAutoPlay()
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={e => {
          setPlaying(true)
          setLoading(false)
          setLoadError(null)
          setBuffered(getBufferedEnd(e.currentTarget))
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        onProgress={e => setBuffered(getBufferedEnd(e.currentTarget))}
        onVolumeChange={e => {
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
        onEnded={onEnded}
        onError={() => {
          setLoading(false)
          setLoadError('Unable to load this video.')
          setCtrlsOn(true)
        }}
        style={{ cursor: 'inherit' }}
      />

      {loading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading video
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-black/75 px-5 py-4 text-sm text-white/80 backdrop-blur-sm">
            <AlertCircle size={18} className="shrink-0 text-white/60" />
            <span>{loadError}</span>
          </div>
        </div>
      )}

      {/* Flash indicator */}
      {flash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-5 animate-ping-once">
            {flash === 'play' ? <Play size={40} className="fill-white text-white" /> : <Pause size={40} className="fill-white text-white" />}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 px-4 pt-16 pb-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 ${ctrlsOn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar — tall hit area, thin visual track */}
        <div
          className="relative flex items-center h-5 mb-1 cursor-pointer group/prog"
          onClick={seek}
          onMouseMove={bumpCtrls}
        >
          {/* Track */}
          <div className="absolute inset-x-0 h-1 group-hover/prog:h-1.5 rounded-full bg-white/25 transition-all duration-150">
            <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${progPct}%` }} />
          </div>
          {/* Thumb */}
          <div
            className="absolute -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progPct}%` }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2 text-white">
          {/* Prev */}
          <button onClick={onPrev} disabled={!hasPrev}
            className="p-1 opacity-70 hover:opacity-100 disabled:opacity-20 transition-opacity">
            <SkipBack size={18} />
          </button>

          {/* Play/Pause */}
          <button onClick={togglePlay} className="p-1 hover:opacity-80 transition-opacity">
            {playing ? <Pause size={22} className="fill-white" /> : <Play size={22} className="fill-white" />}
          </button>

          {/* Next */}
          <button onClick={onNext} disabled={!hasNext}
            className="p-1 opacity-70 hover:opacity-100 disabled:opacity-20 transition-opacity">
            <SkipForward size={18} />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol">
            <button onClick={toggleMute} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className="relative h-1 w-16 bg-white/25 rounded-full cursor-pointer overflow-visible" onClick={changeVol}>
              <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${volPct}%` }} />
            </div>
          </div>

          {/* Time */}
          <span className="text-xs font-mono text-white/70 ml-1 tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed */}
          <button onClick={cycleSpeed}
            className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors opacity-80 hover:opacity-100">
            {speed === 1 ? '1×' : `${speed}×`}
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface Props {
  entries: Entry[]
  activeId: string
  onClose: () => void
}

export function Lightbox({ entries, activeId, onClose }: Props) {
  const [currentId, setCurrentId] = useState(activeId)
  const [zoom, setZoom] = useState(1)
  const queueRef = useRef<HTMLDivElement>(null)

  const idx   = entries.findIndex(e => e.id === currentId)
  const entry = entries[idx]
  const image = entry ? isImg(entry) : false
  const video = entry ? isVid(entry) : false

  const go = useCallback((dir: -1 | 1) => {
    const next = idx + dir
    if (next >= 0 && next < entries.length) {
      setCurrentId(entries[next].id)
      setZoom(1)
    }
  }, [idx, entries])

  // scroll active item into view in queue
  useEffect(() => {
    const active = queueRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentId])

  useEffect(() => { setCurrentId(activeId); setZoom(1) }, [activeId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // global keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.target instanceof HTMLVideoElement) return
      if (e.key === 'Escape') onClose()
      if (!video) {
        if (e.key === 'ArrowLeft')  go(-1)
        if (e.key === 'ArrowRight') go(1)
        if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4))
        if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5))
      }
      // video: ArrowLeft/Right handled by VideoPlayer (seek ±5s)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go, onClose, video])

  if (!entry) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex overflow-hidden">

      {/* ── Main column ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top bar */}
        <div className="flex items-center h-11 px-4 gap-3 shrink-0 border-b border-white/5">
          <span className="text-white/40 text-sm tabular-nums">{idx + 1} / {entries.length}</span>
          <span className="text-white/80 text-sm font-medium truncate flex-1">{entry.name}</span>

          {image && (
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                className="p-1 text-white/40 hover:text-white transition-colors"><ZoomOut size={15} /></button>
              <span className="text-white/30 text-xs w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))}
                className="p-1 text-white/40 hover:text-white transition-colors"><ZoomIn size={15} /></button>
            </div>
          )}

          <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors" title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Media */}
        <div className="flex-1 min-h-0 relative">
          {image && (
            <div className="w-full h-full flex items-center justify-center" onClick={onClose}>
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.15s ease' }}
                onClick={e => e.stopPropagation()}
              >
                <img
                  key={currentId}
                  src={api.fs.raw(currentId)}
                  alt={entry.name}
                  className="max-h-[calc(100vh-2.75rem)] max-w-full object-contain"
                  draggable={false}
                />
              </div>
              {idx > 0 && (
                <button
                  className="absolute left-3 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={e => { e.stopPropagation(); go(-1) }}>
                  <ChevronLeft size={32} />
                </button>
              )}
              {idx < entries.length - 1 && (
                <button
                  className="absolute right-3 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={e => { e.stopPropagation(); go(1) }}>
                  <ChevronRight size={32} />
                </button>
              )}
            </div>
          )}

          {video && (
            <VideoPlayer
              key={currentId}
              src={api.fs.raw(currentId)}
              hasPrev={idx > 0}
              hasNext={idx < entries.length - 1}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
              onEnded={() => idx < entries.length - 1 && go(1)}
            />
          )}
        </div>
      </div>

      {/* ── Queue sidebar ── */}
      {entries.length > 1 && (
        <div className="w-72 shrink-0 border-l border-white/5 flex flex-col">
          <p className="px-4 py-3 text-xs font-semibold text-white/30 uppercase tracking-wider shrink-0">
            Queue
          </p>
          <div ref={queueRef} className="flex-1 overflow-y-auto">
            {entries.map((e, i) => {
              const active = e.id === currentId
              const showVideoPreview = Math.abs(i - idx) <= 2
              return (
                <button
                  key={e.id}
                  data-active={active}
                  onClick={() => { setCurrentId(e.id); setZoom(1) }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    active ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-12 rounded overflow-hidden shrink-0 bg-black/60 relative">
                    {isImg(e) && (
                      <img src={api.fs.raw(e.id)} alt={e.name}
                        className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {isVid(e) && (
                      showVideoPreview ? (
                        <>
                          <video
                            src={`${api.fs.raw(e.id)}#t=0.1`}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Play size={14} className="fill-white text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/70 text-white/50">
                          <Film size={14} />
                          <Play size={12} className="fill-current" />
                        </div>
                      )
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${active ? 'text-white' : 'text-white/60'}`}>{e.name}</p>
                    <p className="text-xs text-white/25 mt-0.5">{i + 1}</p>
                  </div>

                  {/* Active indicator */}
                  {active && <div className="w-0.5 h-7 bg-white/70 rounded-full shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
