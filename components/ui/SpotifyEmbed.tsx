interface SpotifyEmbedProps {
  url: string;
}

function toEmbedUrl(url: string): string {
  // Accepts spotify:artist:ID, spotify:track:ID, or https://open.spotify.com/...
  const uri = url.startsWith("spotify:")
    ? url.replace(/^spotify:/, "").replace(/:/g, "/")
    : url.replace("https://open.spotify.com/", "");
  return `https://open.spotify.com/embed/${uri}`;
}

export default function SpotifyEmbed({ url }: SpotifyEmbedProps) {
  const embedUrl = toEmbedUrl(url);
  return (
    <div
      style={{
        margin: "var(--space-8) 0",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <iframe
        src={embedUrl}
        width="100%"
        height="152"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ border: "none", display: "block" }}
        title="Spotify player"
      />
    </div>
  );
}
