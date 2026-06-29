import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import Container from "@/components/Container";
import { getPostBySlug, getPostSlugs } from "@/lib/mdx";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!getPostSlugs().includes(slug)) return {};

  const post = getPostBySlug(slug);
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `https://emillavinen.com/blog/${slug}`,
    },
    openGraph: {
      title: `${post.title} — Emil Lavinen`,
      description: post.description,
      url: `https://emillavinen.com/blog/${slug}`,
      type: "article",
      publishedTime: post.date,
      authors: ["Emil Lavinen"],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  if (!getPostSlugs().includes(slug)) notFound();

  const post = getPostBySlug(slug);

  return (
    <Container>
      <article className="max-w-xl">
        <header className="mb-12">
          <Link
            href="/blog"
            className="text-xs tracking-widest uppercase text-neutral-400 hover:opacity-50 transition-opacity mb-6 inline-block"
          >
            ← Writing
          </Link>
          <h1 className="text-3xl font-light tracking-tight mb-4">
            {post.title}
          </h1>
          <time className="text-xs tracking-widest uppercase text-neutral-400">
            {post.date}
          </time>
        </header>
        <div className="prose prose-neutral prose-sm max-w-none">
          <MDXRemote source={post.content} />
        </div>
      </article>
    </Container>
  );
}
