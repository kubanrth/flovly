# Redesign v5 — changelog

## F1 — Fundament (2026-08-26)
- Tokeny v5 (`app/globals.css`, light only), Inter + JetBrains Mono, znak marki (kula), favicon/OG.
- Usunięty dark mode, Onest, glass/aura/gradienty, fioletowa paleta, stare logo.
- `components/ui/*` przepisane (36 prymitywów + `icons.tsx` z makiet), podgląd `/dev/ui`.
- Nowy shell: `AppFrame` = top bar (48px, Utwórz, skróty, menu awatara z gęstością) + sidebar (240/56/drawer, Ostatnie/Gwiazdka, Dostosuj pasek) + `RouteFrame`.
- Board header: breadcrumb, tabsy podkreślane z „Więcej N", toolbar, dialog nowego widoku (B12).
- `next.config`: `images.remotePatterns` dla Supabase (przegląd przestrzeni padał na avatarach).
- Lint: 171 → 0 błędów (przed redesignem było 171); e2e zaadaptowane do nowych selektorów.
