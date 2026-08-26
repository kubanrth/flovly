import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export const dynamic = "force-dynamic";

// Podgląd prymitywów components/ui (A1) — tylko dev.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
