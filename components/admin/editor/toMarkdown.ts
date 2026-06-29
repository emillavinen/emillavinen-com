import type { JSONContent } from "@tiptap/react";

function attrs(node: JSONContent): Record<string, unknown> {
  return node.attrs ?? {};
}

function inlineToMd(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "text") {
        let t = n.text ?? "";
        const marks = n.marks ?? [];
        for (const m of marks) {
          if (m.type === "bold") t = `**${t}**`;
          else if (m.type === "italic") t = `*${t}*`;
          else if (m.type === "code") t = `\`${t}\``;
          else if (m.type === "link") t = `[${t}](${m.attrs?.href ?? ""})`;
        }
        return t;
      }
      if (n.type === "hardBreak") return "  \n";
      return "";
    })
    .join("");
}

function blockToMd(node: JSONContent, indent = ""): string {
  switch (node.type) {
    case "paragraph":
      return inlineToMd(node.content) + "\n\n";

    case "heading": {
      const level = (attrs(node).level as number) ?? 1;
      return "#".repeat(level) + " " + inlineToMd(node.content) + "\n\n";
    }

    case "blockquote":
      return (
        (node.content ?? [])
          .map((c) => "> " + blockToMd(c, indent).trimEnd())
          .join("\n") + "\n\n"
      );

    case "codeBlock": {
      const lang = (attrs(node).language as string) ?? "";
      const code = (node.content ?? []).map((c) => c.text ?? "").join("\n");
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case "bulletList":
      return (
        (node.content ?? [])
          .map((item) =>
            (item.content ?? [])
              .map((c) => `- ${blockToMd(c, indent).trimEnd()}`)
              .join("\n")
          )
          .join("\n") + "\n\n"
      );

    case "orderedList":
      return (
        (node.content ?? [])
          .map((item, i) =>
            (item.content ?? [])
              .map((c) => `${i + 1}. ${blockToMd(c, indent).trimEnd()}`)
              .join("\n")
          )
          .join("\n") + "\n\n"
      );

    case "horizontalRule":
      return "---\n\n";

    case "image": {
      const { src = "", alt = "", title } = attrs(node) as {
        src?: string; alt?: string; title?: string;
      };
      return `![${alt}](${src}${title ? ` "${title}"` : ""})\n\n`;
    }

    case "spotifyEmbed":
      return `<SpotifyEmbed url="${attrs(node).url ?? ""}" />\n\n`;

    case "videoEmbed":
      return `<VideoEmbed url="${attrs(node).url ?? ""}" />\n\n`;

    default:
      return "";
  }
}

export function tiptapToMarkdown(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((n) => blockToMd(n))
    .join("")
    .trimEnd();
}
