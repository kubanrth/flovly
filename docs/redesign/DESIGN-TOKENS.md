# DESIGN-TOKENS — "Marty Supreme" system

Single source of truth for the rebuild. Every color in the app must resolve to a token below. No hex literals in components.

## 1. Brand orange (primary)

| Step | Hex | Use |
|---|---|---|
| 50 | `#FFF4EE` | selected row tint, hover on orange-ish surfaces |
| 100 | `#FFE8DB` | chips / badges background (with 800 text) |
| 200 | `#FFCFB3` | focus ring inner, progress track |
| 300 | `#FFAE80` | decorative only |
| 400 | `#FF8640` | dark-mode primary text/links on `#000` (8.7:1) |
| **500** | **`#FF5C00`** | PRIMARY: buttons, active nav rail, focus ring, links (large/medium only), brand mark |
| 600 | `#E04E00` | primary hover |
| 700 | `#B83F00` | primary active/pressed; **link text on white (5.6:1 ✓)** |
| 800 | `#8A3000` | text on 100 tint (7.1:1 ✓) |
| 900 | `#5C2000` | rarely; dark-mode chip text |
| 950 | `#331200` | rarely |

**Hard rules**
- Text ON orange-500 = `#14110D` (ink) → 6.1:1 ✓. **Never white text on orange** (3.1:1 ✗ for body text; allowed only ≥ 24px bold / icons).
- Orange as *surface* only for: primary button, active indicator (2px rail / underline), brand mark, selection checkbox. Not for page backgrounds, cards, headers.
- Links in running text: orange-700 on light, orange-400 on dark.

## 2. Neutrals (warm gray — replaces violet-tinted `--n-*`)

| Step | Hex | Light role | Dark role |
|---|---|---|---|
| 0 | `#FFFFFF` | card / row bg | — |
| 50 | `#FAF9F7` | app canvas, table header bg | — |
| 100 | `#F3F1EE` | hover row, secondary button bg | — |
| 200 | `#E6E3DE` | **border**, dividers | — |
| 300 | `#D2CEC7` | disabled border, scrollbar | — |
| 400 | `#B0ABA3` | placeholder, disabled text | tertiary text on dark (9.2:1) |
| 500 | `#8A857D` | icon default, tertiary text (3.7:1 → large/UI only) | secondary text on `#0A0A0A` (5.4:1 ✓) |
| 600 | `#66625B` | **secondary text** (6.1:1 ✓) | — |
| 700 | `#4A4640` | strong secondary, table header text (9.4:1) | — |
| 900 | `#1C1A17` | **primary text** (17.4:1) | card border-ish |
| 950 | `#0F0E0C` | headings on light | — |
| ink | `#14110D` | text on orange, mark cut | — |

Dark surfaces (pure black direction, continuity with K139): `bg #000000`, `card #0A0A0A`, `popover #0D0D0D`, `border rgba(255,255,255,0.10)`, `border-strong rgba(255,255,255,0.16)`, text `#F5F3F0` (19:1).

## 3. Semantic

| Name | Fill (bg with dark text) | Text on white | Note |
|---|---|---|---|
| success | `#1E9E5A` | text: `#157A45` | 500 on white = 3.45 → use darker for text |
| warning | `#E8A100` | text: `#8A5F00` | 500 on white = 2.2 → **never as text**; fill + ink text only |
| danger | `#D6382C` | text: `#B7291F` | 4.7:1 ✓ as text too |
| info | `#2F6FE8` | text: `#2457B8` | 4.6:1 ✓ |

## 4. Status / tag / select palette (Airtable-style pastel bg + deep text, 12 hues, equal lightness)

| id | bg | text | id | bg | text |
|---|---|---|---|---|---|
| gray | `#EDEBE7` | `#4A4640` | orange | `#FFE8DB` | `#8A3000` |
| red | `#FDE3E1` | `#8F1F16` | yellow | `#FBF0C8` | `#6E4F00` |
| green | `#DDF3E6` | `#14603A` | teal | `#D8F1EF` | `#0F5C57` |
| blue | `#DDE9FC` | `#1D3F8A` | indigo | `#E3E4FB` | `#2F3A8F` |
| purple | `#EDE3FA` | `#5A2E8A` | pink | `#FBE2EE` | `#8A1F52` |
| brown | `#EFE4DA` | `#5C3A1E` | black | `#1C1A17` | `#FFFFFF` |

Dark mode: keep text hue, swap bg to `color-mix(in oklch, <text> 22%, #0A0A0A)`.

## 5. Typography

- **Sans**: Inter (already installed; optional swap to Geist Sans — same metrics class). `font-feature-settings: "cv11","ss01","tnum"`.
- **Mono**: JetBrains Mono — IDs (`#250`), timestamps, code, kbd.
- **No display font.** Headings = Inter 600/700. Onest removed.

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| text-2xs | 11 / 16 | 500 | eyebrows (uppercase, tracking 0.06em), table header, kbd |
| text-xs | 12 / 16 | 400/500 | meta, chips, secondary cell text |
| **text-sm** | **13 / 20** | 400 | **default body, table cells, sidebar** |
| text-base | 14 / 20 | 400 | forms, dialog body |
| text-md | 16 / 24 | 500/600 | card titles, task title in panel |
| text-lg | 20 / 28 | 600 | page h2 |
| text-xl | 24 / 32 | 600 | page h1 (board name) |
| text-2xl | 32 / 40 | 700 | dashboard KPI numbers only |

Tracking: headings `-0.01em`; never `-0.03em`+ (current app overdoes it).

## 6. Spacing, radius, elevation

- Grid **4px**. Component paddings: 4/8/12/16/24. Page gutter 24 (desktop) / 16 (mobile).
- Radius: `xs 4` (inputs, chips, table cells' focus), `sm 6` (buttons, menu items), `md 8` (cards, popovers, dropdowns), `lg 12` (dialogs, side panel corners), `full` (avatars, status dots, pills).
- Borders: 1px `neutral-200` everywhere; no 2px decorative borders; no `border-white/60` glass edges.
- Elevation (neutral, no tint):
  - `e1` (dropdown/popover): `0 1px 2px rgba(20,17,13,.06), 0 4px 12px rgba(20,17,13,.08)`
  - `e2` (dialog/side panel): `0 8px 24px rgba(20,17,13,.12), 0 2px 6px rgba(20,17,13,.06)`
  - Dark: same offsets, `rgba(0,0,0,.5/.6)`.
- Cards on canvas: **flat** — bg `#FFFFFF`, 1px border, no shadow. Shadow is for floating layers only.

## 7. Density (per-view, persisted per user in localStorage `ui:density`)

| Mode | Row h | Cell pad | Font |
|---|---|---|---|
| compact | 28 | 4×8 | 12 |
| **comfortable (default)** | 36 | 6×12 | 13 |
| spacious | 44 | 10×12 | 13 |

Sidebar item 32px; top bar 48px; board tabs 40px; icon buttons 28 (sm) / 32 (md).

## 8. Motion

- Durations: `fast 100ms`, `normal 150ms`, `slow 220ms` (side panel / dialog).
- Easing: `ease-out` (cubic-bezier(.2,.8,.2,1)) for enter; `ease-in` for exit. **No spring/overshoot.**
- Only `opacity` and `transform`. No `transition-all`. Side panel: translateX 8px + fade. Dropdown: fade + scale .98→1 from origin.
- `prefers-reduced-motion: reduce` → durations 0.

## 9. Focus & states

- Focus-visible: `outline: 2px solid #FF5C00; outline-offset: 2px` (dark: same). Inputs: border → orange-500 + `box-shadow 0 0 0 3px #FFE8DB` (dark: `rgba(255,92,0,.25)`).
- Hover row: `neutral-100`. Selected row: `orange-50` + 2px left rail `orange-500`. Active nav: `orange-50` bg + rail (light) / `rgba(255,92,0,.12)` (dark).
- Disabled: opacity .5, no pointer.

## 10. Z-index — reuse `lib/z-index.ts` hierarchy unchanged (base 0 / dropdown 30 / sticky 40 / fab 50 / toast 80 / mobileNav 90 / modalBackdrop 100 / modal 110 / popoverInModal 200 / tooltip 300).

## 11. Tailwind v4 `@theme` block (paste into new `globals.css`)

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

@theme {
  --color-orange-50:#FFF4EE; --color-orange-100:#FFE8DB; --color-orange-200:#FFCFB3;
  --color-orange-300:#FFAE80; --color-orange-400:#FF8640; --color-orange-500:#FF5C00;
  --color-orange-600:#E04E00; --color-orange-700:#B83F00; --color-orange-800:#8A3000;
  --color-orange-900:#5C2000; --color-orange-950:#331200;

  --color-neutral-0:#FFFFFF; --color-neutral-50:#FAF9F7; --color-neutral-100:#F3F1EE;
  --color-neutral-200:#E6E3DE; --color-neutral-300:#D2CEC7; --color-neutral-400:#B0ABA3;
  --color-neutral-500:#8A857D; --color-neutral-600:#66625B; --color-neutral-700:#4A4640;
  --color-neutral-900:#1C1A17; --color-neutral-950:#0F0E0C; --color-ink:#14110D;

  --color-success:#1E9E5A; --color-success-text:#157A45;
  --color-warning:#E8A100; --color-warning-text:#8A5F00;
  --color-danger:#D6382C;  --color-danger-text:#B7291F;
  --color-info:#2F6FE8;    --color-info-text:#2457B8;

  /* semantic surface tokens (switch in .dark) */
  --color-bg: var(--bg); --color-canvas: var(--canvas); --color-card: var(--card);
  --color-popover: var(--popover); --color-border: var(--border);
  --color-fg: var(--fg); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3);
  --color-primary:#FF5C00; --color-primary-fg:#14110D;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --radius-xs:4px; --radius-sm:6px; --radius-md:8px; --radius-lg:12px;

  --shadow-e1: 0 1px 2px rgb(20 17 13 / .06), 0 4px 12px rgb(20 17 13 / .08);
  --shadow-e2: 0 8px 24px rgb(20 17 13 / .12), 0 2px 6px rgb(20 17 13 / .06);

  --ease-out: cubic-bezier(.2,.8,.2,1);
}

:root {
  --bg:#FFFFFF; --canvas:#FAF9F7; --card:#FFFFFF; --popover:#FFFFFF;
  --border:#E6E3DE; --fg:#1C1A17; --fg-2:#66625B; --fg-3:#8A857D;
}
.dark {
  --bg:#000000; --canvas:#000000; --card:#0A0A0A; --popover:#0D0D0D;
  --border:rgb(255 255 255 / .10); --fg:#F5F3F0; --fg-2:#B0ABA3; --fg-3:#8A857D;
  --color-primary:#FF5C00; /* orange stays; text-on-primary stays ink */
}
```

## 12. Contrast audit (computed, WCAG 2.x)

| Pair | Ratio | Verdict |
|---|---|---|
| `#FF5C00` on `#FFFFFF` | 3.10 | UI/large only |
| `#FFFFFF` on `#FF5C00` | 3.10 | ✗ body text |
| `#14110D` on `#FF5C00` | 6.08 | ✓ AA (button label) |
| `#FF5C00` on `#000000` | 6.78 | ✓ dark links/labels |
| `#B83F00` on `#FFFFFF` | 5.60 | ✓ light links |
| `#8A3000` on `#FFE8DB` | 7.12 | ✓ chips |
| `#66625B` on `#FFFFFF` | 6.06 | ✓ secondary text |
| `#8A857D` on `#FFFFFF` | 3.66 | icons / ≥18px only |
| `#1C1A17` on `#FAF9F7` | 16.5 | ✓ |
| `#8A857D` on `#0A0A0A` | 5.40 | ✓ dark secondary |
| `#E8A100` on `#FFFFFF` | 2.20 | ✗ never as text |
