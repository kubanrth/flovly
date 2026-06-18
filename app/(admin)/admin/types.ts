// Shared types/consts for admin server actions.
// MUSI być w osobnym pliku bez "use server" — Next.js 16 wymaga żeby
// pliki "use server" exportowały WYŁĄCZNIE async functions.

export type BulkActionResult = {
  ok: boolean;
  affected: number;
  error?: string;
};

export const bulkUserActionResultZero: BulkActionResult = {
  ok: true,
  affected: 0,
};

export interface UpdateSystemFlagResult {
  ok: boolean;
  error?: string;
}
