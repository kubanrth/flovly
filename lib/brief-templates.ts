// Creative Board templates — Tiptap doc + picker metadata (emoji, opis,
// akcent). Helpery h2/h3/p/ul/table trzymają verbose JSON czytelnie.

type TT = Record<string, unknown>;

function h2(emoji: string, text: string): TT {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: `${emoji} ${text}` }],
  };
}
function h3(text: string): TT {
  return {
    type: "heading",
    attrs: { level: 3 },
    content: [{ type: "text", text }],
  };
}
function p(text: string): TT {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}
function ul(items: string[]): TT {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
    })),
  };
}
function tcell(text: string, isHeader = false): TT {
  return {
    type: isHeader ? "tableHeader" : "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}
function tr(cells: string[], isHeader = false): TT {
  return {
    type: "tableRow",
    content: cells.map((c) => tcell(c, isHeader)),
  };
}
function table(headerCells: string[], bodyRows: string[][]): TT {
  return {
    type: "table",
    content: [tr(headerCells, true), ...bodyRows.map((r) => tr(r))],
  };
}

export interface BriefTemplate {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  doc: TT;
  defaultHeaderColor: string;
  defaultEmoji: string;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Design Brief — comprehensive design brief
// ─────────────────────────────────────────────────────────────────────
const DESIGN_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🎯", "Cel projektu"),
    p("Krótko o co chodzi w tym projekcie. Jaki problem rozwiązujemy, dlaczego TERAZ, co po jego ukończeniu się zmieni dla biznesu i odbiorcy."),
    h2("📋", "Kontekst i tło"),
    p("Sytuacja wyjściowa, dotychczasowa komunikacja, ostatnie zmiany, ograniczenia (regulacyjne, brandowe, techniczne)."),
    h2("✅", "Cele projektu"),
    ul([
      "Cel 1 — mierzalny rezultat (np. +15% CTR w newsletterze)",
      "Cel 2 — jakościowy rezultat (np. spójna identyfikacja na 5 touchpointach)",
      "Cel 3 — internal goal (np. szybsza onboarding'owa ścieżka)",
    ]),
    h2("👥", "Grupa docelowa"),
    p("Kto jest odbiorcą — segment + 2-3 persony, ich potrzeby, frustracje, język."),
    h2("📦", "Deliverables"),
    table(
      ["Element", "Format / wymiary", "Notatki"],
      [
        ["Logo", "SVG, PNG @1×/2×", "Wersja podstawowa + monochromatyczna"],
        ["Web banner", "1920×600 px", "Hero strona główna"],
        ["Social post", "1080×1080 px", "5 wariantów na launch"],
      ],
    ),
    h2("🎨", "Brand & visual identity"),
    h3("Kolory marki"),
    table(
      ["Nazwa", "Hex", "Zastosowanie"],
      [
        ["Primary", "#7B68EE", "CTA, akcenty"],
        ["Accent", "#10B981", "Success states"],
        ["Ink", "#1F2937", "Body text"],
      ],
    ),
    h3("Typografia"),
    ul([
      "Display (nagłówki) — np. Söhne / Inter Display",
      "Body (treść) — np. Inter / system-ui",
    ]),
    h3("Tone of voice"),
    p("Bezpośredni, konkretny, bez korpomowy."),
    h2("📅", "Timeline"),
    table(
      ["Etap", "Daty", "Deliverable"],
      [
        ["Discovery", "T1–T2", "Notatki research, mood-board"],
        ["Koncepcja", "T3", "3 kierunki, mocki low-fi"],
        ["Iteracja", "T4–T5", "Wybrany kierunek + revisions"],
        ["Launch", "T6", "Pliki finalne, handoff"],
      ],
    ),
    h2("👤", "Zespół"),
    table(
      ["Osoba", "Rola", "Kontakt"],
      [["", "Creative Director", ""], ["", "Designer (lead)", ""], ["", "Stakeholder", ""]],
    ),
    h2("🔗", "Referencje"),
    ul(["Inspiracja 1 — link", "Inspiracja 2 — link", "Czego unikać"]),
    h2("📊", "Success metrics"),
    ul(["Metryka biznesowa", "Metryka jakościowa", "Termin oceny"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 2. Design Brief — Task List (ClickUp-style task table)
// ─────────────────────────────────────────────────────────────────────
const DESIGN_BRIEF_TASKS: TT = {
  type: "doc",
  content: [
    h2("📋", "Design Brief — Task List"),
    p("Plan zadań dla całego projektu. Każdy wiersz = task. Phase oznacza fazę projektu, Involvement = kto musi się zaangażować."),
    table(
      ["Task", "Faza", "Start", "Termin", "Zaangażowanie"],
      [
        ["Initial client session", "Focus & Vision", "T1", "T1", "Internal Team + Client"],
        ["Demographics & audience analytics", "Target Audience", "T1", "T2", "Internal Team"],
        ["Overall brief goals", "Identify Goals", "T2", "T2", "Internal Team + Client"],
        ["Theme proposal", "Creative Direction", "T2", "T3", "Internal Team"],
        ["Competitor research", "Brand", "T3", "T3", "Internal Team"],
        ["Asset gathering", "Brand", "T3", "T3", "Internal Team"],
        ["Strategy session", "Creative Direction", "T4", "T4", "Internal Team + Client"],
      ],
    ),
    h2("📝", "Notatki dodatkowe"),
    p("Wszystko czego nie da się ujarzmić w wierszach tabeli. Decyzje, kontekst, blokery."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 3. Whiteboard Brief — color-coded sections (visual layout)
// ─────────────────────────────────────────────────────────────────────
const WHITEBOARD_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🎨", "Design Brief — Whiteboard"),
    p("Wzór 1:1 z ClickUp Design Brief Whiteboard. Każda sekcja to oddzielny obszar do kolaboracji — używaj tabeli + kolory tekstu/highlight żeby grupować notatki."),
    h3("📌 How to use"),
    ul([
      "Każdy obszar = jeden temat. Dodaj swoje notatki bullet'ami.",
      "Używaj highlight'a (kolor tła) żeby grupować pomysły.",
      "Tabela poniżej to mapa — wypełnij wiersze podczas sesji.",
    ]),
    h3("📋 Guidelines"),
    p("Krótko opisz workflow — kto robi co, kiedy, jakim tonem komunikujemy się ze stakeholderami."),
    table(
      ["Sekcja", "Zawartość", "Owner"],
      [
        ["🟡 Client Request", "Co klient zamówił, jaki jest oczekiwany efekt", ""],
        ["🟢 Brand Highlight", "Kluczowe elementy brand'u — co podkreślić", ""],
        ["🟣 Objectives", "Cele projektu, sukces=", ""],
        ["🔴 References", "Inspiracje, mood-board, konkurencja", ""],
        ["🟠 Target Market", "Grupa docelowa — segment, persona, język", ""],
        ["🔵 Marketing Direction", "Kierunek komunikacji, kanały, kampania", ""],
      ],
    ),
    h2("💬", "Notatki z sesji"),
    p("Decyzje, follow-upy, otwarte pytania."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 4. Creative Brief — focus on concept + creative idea
// ─────────────────────────────────────────────────────────────────────
const CREATIVE_BRIEF: TT = {
  type: "doc",
  content: [
    h2("💡", "Creative Brief"),
    p("Brief skupiony na koncepcji kreatywnej. Pre-design — najpierw pomysł, potem visualizacja."),
    h2("🎯", "Big idea"),
    p("Jednym zdaniem: jaki insight, jaki mechanizm kreatywny, dlaczego to zadziała."),
    h2("🪜", "Strategy"),
    ul([
      "Insight — co odkryliśmy o odbiorcy",
      "Promise — co obiecujemy",
      "Reason to believe — dlaczego to jest wiarygodne",
    ]),
    h2("📣", "Komunikat"),
    table(
      ["Element", "Treść"],
      [
        ["Hook (otwarcie)", ""],
        ["Body (rozwinięcie)", ""],
        ["CTA (zakończenie)", ""],
      ],
    ),
    h2("🎨", "Creative directions"),
    h3("Kierunek A — bezpieczny"),
    p(""),
    h3("Kierunek B — odważny"),
    p(""),
    h3("Kierunek C — wildcard"),
    p(""),
    h2("📦", "Deliverables"),
    ul(["Asset 1", "Asset 2", "Asset 3"]),
    h2("📅", "Timeline"),
    p("Decyzja kierunku do __, finalne pliki do __."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 5. Marketing Brief — campaign-focused
// ─────────────────────────────────────────────────────────────────────
const MARKETING_BRIEF: TT = {
  type: "doc",
  content: [
    h2("📣", "Marketing Brief"),
    p("Brief kampanii marketingowej — od insight'u przez kreatywę po dystrybucję i KPI."),
    h2("🎯", "Cele kampanii"),
    table(
      ["Cel", "Metryka", "Target"],
      [
        ["Awareness", "Reach, impressions", ""],
        ["Engagement", "CTR, comments, shares", ""],
        ["Conversion", "Sign-ups, sales, leads", ""],
      ],
    ),
    h2("👥", "Grupa docelowa"),
    p("Persona, segment, demografia, behawioralne."),
    h2("💡", "Kluczowy komunikat"),
    p("Co chcemy żeby zapamiętali po jednym ekspozycji."),
    h2("📺", "Kanały i taktyki"),
    table(
      ["Kanał", "Format", "Budżet", "KPI"],
      [
        ["Meta Ads", "", "", ""],
        ["Google Search", "", "", ""],
        ["Newsletter", "", "", ""],
        ["Influencerzy", "", "", ""],
      ],
    ),
    h2("📅", "Timeline"),
    p("Kick-off, launch, recap."),
    h2("💰", "Budżet"),
    p("Łącznie: __. Rozbicie: media __, produkcja __, talent __."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 6. Branding Brief — full brand identity
// ─────────────────────────────────────────────────────────────────────
const BRANDING_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🪪", "Branding Brief"),
    p("Pełny brief identyfikacji wizualnej — od strategii po visual system."),
    h2("📖", "Brand story"),
    h3("Misja"),
    p(""),
    h3("Wizja"),
    p(""),
    h3("Wartości"),
    ul(["Wartość 1", "Wartość 2", "Wartość 3"]),
    h2("👥", "Pozycjonowanie"),
    table(
      ["Wymiar", "Naszej marki", "Konkurencji"],
      [
        ["Personality", "", ""],
        ["Tone", "", ""],
        ["Price tier", "", ""],
        ["Audience", "", ""],
      ],
    ),
    h2("🎨", "Visual identity"),
    h3("Logo"),
    p("Charakter, wymagania, zastosowania."),
    h3("Paleta kolorów"),
    table(
      ["Rola", "Hex", "Pantone", "Zastosowanie"],
      [
        ["Primary", "", "", ""],
        ["Secondary", "", "", ""],
        ["Accent", "", "", ""],
        ["Neutral", "", "", ""],
      ],
    ),
    h3("Typografia"),
    p("Display + body + alt — z licencjami."),
    h3("Photography style"),
    p("Mood, kolorystyka, sceny."),
    h2("📦", "Deliverables"),
    ul(["Logo (master + warianty)", "Brand guidelines (PDF)", "Style tile", "Templates: prezentacja, social, email"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 7. Web Design Brief — website-specific
// ─────────────────────────────────────────────────────────────────────
const WEB_DESIGN_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🌐", "Web Design Brief"),
    p("Brief redesignu / nowej strony www. Funkcjonalność + zawartość + design + tech."),
    h2("🎯", "Cele strony"),
    ul(["Primary CTA — co user MUSI zrobić", "Secondary — co dobrze gdyby zrobił", "Brand goal — co o nas zapamięta"]),
    h2("👥", "Audience & user goals"),
    p("Kto, jakim urządzeniem, czego szuka, w jakim stanie umysłu."),
    h2("🗺️", "Sitemap"),
    table(
      ["Strona", "Cel", "CTA", "Treść"],
      [
        ["Home", "", "", ""],
        ["O nas", "", "", ""],
        ["Produkt / Usługa", "", "", ""],
        ["Case studies", "", "", ""],
        ["Kontakt", "", "", ""],
      ],
    ),
    h2("⚙️", "Funkcjonalność"),
    ul(["Must-have feature 1", "Must-have feature 2", "Nice-to-have feature 1"]),
    h2("🎨", "Design references"),
    ul(["Referencja 1 — link + co bierzemy", "Referencja 2 — link + co bierzemy", "Czego unikać"]),
    h2("🔧", "Tech stack"),
    p("Hosting, CMS, framework, integracje (analytics, payments, CRM)."),
    h2("📅", "Timeline"),
    p("Discovery → Design → Development → Launch."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 8. Logo Brief — focused on logo design
// ─────────────────────────────────────────────────────────────────────
const LOGO_BRIEF: TT = {
  type: "doc",
  content: [
    h2("✨", "Logo Brief"),
    p("Brief projektu logo — od strategii brand'u po pliki finalne."),
    h2("📖", "O firmie"),
    p("Nazwa, branża, wiek, wielkość, geograficzny zasięg."),
    h2("🎯", "Co logo musi komunikować"),
    ul(["Wartość 1 (np. profesjonalizm)", "Wartość 2 (np. nowoczesność)", "Wartość 3 (np. zaufanie)"]),
    h2("🚫", "Czego unikać"),
    p("Style / motywy / kolory które już w branży się przejadły lub które klient odrzuca."),
    h2("🎨", "Style references"),
    table(
      ["Inspiracja", "Co bierzemy", "Czego nie"],
      [["", "", ""], ["", "", ""], ["", "", ""]],
    ),
    h2("📦", "Zastosowania logo"),
    table(
      ["Medium", "Wymagania"],
      [
        ["Drukarnia (CMYK)", ""],
        ["Web (RGB, dark/light)", ""],
        ["Social avatar (kwadrat)", ""],
        ["Pieczątka / wizytówka", ""],
        ["Embroidery / tampondruk", ""],
      ],
    ),
    h2("🎁", "Deliverables"),
    ul(["Master logo (SVG)", "Wersje: poziom, pion, monogram, monochromatyczna", "Zastosowania: positive/negative", "Mini brand guidelines (1-pager)"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 9. Social Media Brief — content/campaign on social
// ─────────────────────────────────────────────────────────────────────
const SOCIAL_BRIEF: TT = {
  type: "doc",
  content: [
    h2("📱", "Social Media Brief"),
    p("Brief contentu / kampanii w social mediach — od strategii po kalendarium."),
    h2("🎯", "Cele social"),
    ul(["Awareness — zasięg, impresje", "Engagement — komentarze, shares", "Lead gen — DM, kliknięcia w bio"]),
    h2("📊", "Platformy"),
    table(
      ["Platforma", "Format(y)", "Częstotliwość", "Tone"],
      [
        ["Instagram", "Reels, Stories, posty", "", ""],
        ["TikTok", "Reels", "", ""],
        ["LinkedIn", "Posty, articles", "", ""],
        ["YouTube", "Shorts, długie", "", ""],
      ],
    ),
    h2("🧱", "Content pillars"),
    ul(["Pillar 1 — np. Educational", "Pillar 2 — np. Behind the scenes", "Pillar 3 — np. Customer stories", "Pillar 4 — np. Promo"]),
    h2("📅", "Kalendarium (przykład)"),
    table(
      ["Tydzień", "Pn", "Wt", "Śr", "Cz", "Pt"],
      [
        ["W1", "Pillar 1", "Pillar 3", "Pillar 2", "Pillar 4", "Pillar 1"],
        ["W2", "", "", "", "", ""],
        ["W3", "", "", "", "", ""],
        ["W4", "", "", "", "", ""],
      ],
    ),
    h2("✍️", "Tone & copy guidelines"),
    p("Person, slang, emoji yes/no, długość."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 10. Design Ideation — brainstorm matrix
// ─────────────────────────────────────────────────────────────────────
const IDEATION_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🧠", "Design Ideation"),
    p("Burza mózgów dla nowego projektu. Każdy uczestnik proponuje 3 koncepcje na 3 różne sposoby (process / product / people)."),
    h2("📋", "Legenda"),
    ul(["💡 Process-oriented — koncepcje skupione na metodologii / workflow", "🎨 Product-oriented — koncepcje skupione na samym artefakcie", "👥 People-oriented — koncepcje skupione na użytkowniku"]),
    h2("🎯", "Matryca pomysłów"),
    table(
      ["Idea Owner", "💡 Process", "🎨 Product", "👥 People"],
      [
        ["Osoba 1", "", "", ""],
        ["Osoba 2", "", "", ""],
        ["Osoba 3", "", "", ""],
        ["Osoba 4", "", "", ""],
      ],
    ),
    h2("🔍", "Top picks (po dyskusji)"),
    ul(["Pick 1 — kto, dlaczego", "Pick 2 — kto, dlaczego", "Pick 3 — kto, dlaczego"]),
    h2("➡️", "Next steps"),
    p("Kto rozwija które pomysły, do kiedy, co potem."),
  ],
};

// ─────────────────────────────────────────────────────────────────────
// 11. Pitch Brief — sales / agency pitch
// ─────────────────────────────────────────────────────────────────────
const PITCH_BRIEF: TT = {
  type: "doc",
  content: [
    h2("🎤", "Pitch Brief"),
    p("Brief pitch'a do klienta — co prezentujemy, kto jest w sali, co chcemy uzyskać."),
    h2("👥", "Audience"),
    table(
      ["Stakeholder", "Rola", "Co go obchodzi"],
      [["", "Decision maker", ""], ["", "Influencer", ""], ["", "Gatekeeper", ""]],
    ),
    h2("🎯", "Goal of pitch"),
    p("Jeden konkretny outcome: kontrakt? next meeting? RFP?"),
    h2("📖", "Story arc"),
    ul([
      "1. Hook — uderzeniowa statystyka / pytanie / scenariusz",
      "2. Problem — czego boli klient",
      "3. Insight — co widzimy że oni przegapili",
      "4. Solution — nasza propozycja",
      "5. Proof — case studies, social proof",
      "6. Ask — co dalej, kiedy",
    ]),
    h2("📦", "Co prezentujemy"),
    table(
      ["Asset", "Format", "Owner"],
      [
        ["Deck", "Keynote / PDF", ""],
        ["Demo / mockup", "Wideo / interaktywny", ""],
        ["One-pager", "PDF do zostawienia", ""],
        ["Case study", "PDF", ""],
      ],
    ),
    h2("💰", "Pricing scaffold"),
    table(
      ["Pakiet", "Zakres", "Cena", "Timeline"],
      [["Starter", "", "", ""], ["Standard", "", "", ""], ["Premium", "", "", ""]],
    ),
    h2("❓", "Q&A prep"),
    p("Lista 5 najtwardszych pytań które mogą paść + przygotowane odpowiedzi."),
  ],
};

export const BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: "design-brief",
    name: "Design Brief",
    emoji: "🎯",
    color: "#7B68EE",
    description: "Klasyczny design brief — cele, deliverables, brand, timeline.",
    doc: DESIGN_BRIEF,
    defaultHeaderColor: "#7B68EE",
    defaultEmoji: "🎯",
  },
  {
    id: "design-brief-tasks",
    name: "Design Brief — Task list",
    emoji: "📋",
    color: "#10B981",
    description: "Lista zadań projektu w tabeli z fazami i zaangażowaniem.",
    doc: DESIGN_BRIEF_TASKS,
    defaultHeaderColor: "#10B981",
    defaultEmoji: "📋",
  },
  {
    id: "whiteboard-brief",
    name: "Whiteboard Brief",
    emoji: "🎨",
    color: "#F59E0B",
    description: "Color-coded sekcje (Client / Brand / Objectives / References).",
    doc: WHITEBOARD_BRIEF,
    defaultHeaderColor: "#F59E0B",
    defaultEmoji: "🎨",
  },
  {
    id: "creative-brief",
    name: "Creative Brief",
    emoji: "💡",
    color: "#EAB308",
    description: "Brief skupiony na kreatywnej koncepcji + 3 kierunki.",
    doc: CREATIVE_BRIEF,
    defaultHeaderColor: "#EAB308",
    defaultEmoji: "💡",
  },
  {
    id: "marketing-brief",
    name: "Marketing Brief",
    emoji: "📣",
    color: "#EF4444",
    description: "Brief kampanii — cele, kanały, KPI, budżet.",
    doc: MARKETING_BRIEF,
    defaultHeaderColor: "#EF4444",
    defaultEmoji: "📣",
  },
  {
    id: "branding-brief",
    name: "Branding Brief",
    emoji: "🪪",
    color: "#8B5CF6",
    description: "Pełna identyfikacja marki — od strategii po visual system.",
    doc: BRANDING_BRIEF,
    defaultHeaderColor: "#8B5CF6",
    defaultEmoji: "🪪",
  },
  {
    id: "web-design-brief",
    name: "Web Design Brief",
    emoji: "🌐",
    color: "#3B82F6",
    description: "Brief strony www — sitemap, funkcjonalność, tech stack.",
    doc: WEB_DESIGN_BRIEF,
    defaultHeaderColor: "#3B82F6",
    defaultEmoji: "🌐",
  },
  {
    id: "logo-brief",
    name: "Logo Brief",
    emoji: "✨",
    color: "#EC4899",
    description: "Brief projektu logo — strategia, references, deliverables.",
    doc: LOGO_BRIEF,
    defaultHeaderColor: "#EC4899",
    defaultEmoji: "✨",
  },
  {
    id: "social-brief",
    name: "Social Media Brief",
    emoji: "📱",
    color: "#14B8A6",
    description: "Brief contentu w social — pillars, kalendarium, tone.",
    doc: SOCIAL_BRIEF,
    defaultHeaderColor: "#14B8A6",
    defaultEmoji: "📱",
  },
  {
    id: "ideation",
    name: "Design Ideation",
    emoji: "🧠",
    color: "#06B6D4",
    description: "Matryca brainstorming'u 3×3 (process / product / people).",
    doc: IDEATION_BRIEF,
    defaultHeaderColor: "#06B6D4",
    defaultEmoji: "🧠",
  },
  {
    id: "pitch-brief",
    name: "Pitch Brief",
    emoji: "🎤",
    color: "#64748B",
    description: "Brief pitch'a sprzedażowego — story arc + Q&A prep.",
    doc: PITCH_BRIEF,
    defaultHeaderColor: "#64748B",
    defaultEmoji: "🎤",
  },
];

export function getBriefTemplate(id: string): BriefTemplate {
  return BRIEF_TEMPLATES.find((t) => t.id === id) ?? BRIEF_TEMPLATES[0];
}
