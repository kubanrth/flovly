// Detects whether a ProseMirror/Tiptap doc carries any visible text. An empty
// editor still persists as `{ type: "doc", content: [{ type: "paragraph" }] }`,
// so we can't trust nullness alone to mean "the user wrote something".
export function docHasText(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const queue: unknown[] = [doc];
  while (queue.length) {
    const node = queue.shift() as {
      type?: string;
      text?: string;
      content?: unknown[];
    };
    if (
      node?.type === "text" &&
      typeof node.text === "string" &&
      node.text.trim().length > 0
    ) {
      return true;
    }
    if (Array.isArray(node?.content)) queue.push(...node.content);
  }
  return false;
}
