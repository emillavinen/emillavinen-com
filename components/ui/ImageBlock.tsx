import Image from "next/image";

interface ImageBlockProps {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export default function ImageBlock({
  src,
  alt,
  caption,
  width = 1200,
  height = 800,
}: ImageBlockProps) {
  return (
    <figure
      style={{
        margin: "var(--space-8) 0",
        padding: 0,
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "var(--radius-md)",
        }}
      />
      {caption && (
        <figcaption
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-muted)",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.02em",
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
