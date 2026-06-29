import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      insertVideo: (url: string) => ReturnType;
    };
  }
}

export const VideoNode = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,

  addAttributes() {
    return { url: { default: null } };
  },

  parseHTML() {
    return [{ tag: "div[data-video]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-video": "true" })];
  },

  addCommands() {
    return {
      insertVideo:
        (url: string) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs: { url } }),
    };
  },
});
