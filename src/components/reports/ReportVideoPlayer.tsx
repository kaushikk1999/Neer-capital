import { youtubeId } from '@/lib/report/video'

// Plays an https MP4 natively, or a YouTube link via the privacy-enhanced embed.
export function ReportVideoPlayer({ url, title }: { url: string; title: string }) {
  const yt = youtubeId(url)
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
      {yt ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
          title={title}
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={url} controls preload="metadata" playsInline className="h-full w-full" />
      )}
    </div>
  )
}
