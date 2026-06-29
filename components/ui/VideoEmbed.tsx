interface VideoEmbedProps {
  url: string;
  title?: string;
}

function toEmbedUrl(url: string): string | null {
  const ytMatch =
    url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
    url.match(/youtu\.be\/([\w-]+)/);
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

export default function VideoEmbed({ url, title = "Embedded video" }: VideoEmbedProps) {
  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div
      style={{
        margin: "var(--space-8) 0",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        aspectRatio: "16 / 9",
        position: "relative",
      }}
    >
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        style={{ border: "none", width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
    </div>
  );
}
