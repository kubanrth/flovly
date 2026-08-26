// A board's canvas is created lazily on first visit. The first visit renders
// more than once (prefetch + navigation), so two passes can both see "no
// canvas yet" and race into create — the loser hits the (boardId, kind) unique
// constraint and the whole view renders as an error page. Prisma's upsert does
// not close the window either: with `include` it falls back to read-then-write.
// So: create, and if the constraint fires, the other pass already made it.
export async function createOnce<T>(create: () => Promise<T>, read: () => Promise<T | null>): Promise<T> {
  try {
    return await create();
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    const existing = await read();
    if (!existing) throw err;
    return existing;
  }
}
