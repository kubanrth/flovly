"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Intercepted-modal not-found: gdy task'a już nie ma (usunięty / poza
// workspace'em), nie pokazujemy generycznego 404 Next.js'owego — auto-
// zamykamy drawer wracając na underlying page. Bez tego user widział
// 404 page wewnątrz drawer'a i musiał reloadować stronę.
export default function TaskModalNotFound() {
  const router = useRouter();
  useEffect(() => {
    // Drobny delay (50ms) żeby browser zdążył zarejestrować mount + dać
    // klatkę paint'u przed redirect — wcześniej cofało się ZA SZYBKO i
    // history stack robił się dziwny.
    const t = setTimeout(() => router.back(), 50);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
