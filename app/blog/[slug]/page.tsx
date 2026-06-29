import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Container from "@/components/Container";
import { getAllPosts, getPostBySlug, getPostSlugs } from "@/lib/mdx";

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
    openGraph: {
      title: `${post.title} — Emil Lavinen`,
      description: post.description,
      url: `https://emillavinen.com/blog/${slug}`,
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
