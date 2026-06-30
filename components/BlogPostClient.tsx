"use client";

import { useRef } from "react";
import ReadingProgress from "@/components/ReadingProgress";
import TableOfContents from "@/components/TableOfContents";
import type { TocItem } from "@/lib/toc";

interface Props {
  children: React.ReactNode;
  toc: TocItem[];
  wordCount: number;
}

export default function BlogPostClient({ children, toc, wordCount }: Props) {
  const articleRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <ReadingProgress articleRef={articleRef} />
      <article ref={articleRef} style={{ maxWidth: "680px" }}>
        {wordCount >= 800 && toc.length >= 3 && (
          <TableOfContents items={toc} wordCount={wordCount} />
        )}
        {children}
      </article>
    </>
  );
}
