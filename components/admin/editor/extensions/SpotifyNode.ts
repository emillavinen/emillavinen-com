import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spotifyEmbed: {
      insertSpotify: (url: string) => ReturnType;
    };
  }
}

export const SpotifyNode = Node.create({
  name: "spotifyEmbed",
  group: "block",
  atom: true,

  addAttributes() {
    return { url: { default: null } };
  },

  parseHTML() {
    return [{ tag: "div[data-spotify]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-spotify": "true" })];
  },

  addCommands() {
    return {
      insertSpotify:
        (url: string) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs: { url } }),
    };
  },
});
