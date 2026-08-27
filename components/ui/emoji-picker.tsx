"use client";

import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Wspólny picker emoji. Bez nowej zależności — lista jest statyczna, a wyszukiwarka
// filtruje po polskich słowach kluczowych, więc „usmiech" i „uśmiech" trafiają tak samo.
// ponytail: 120 pozycji zamiast pełnego zestawu Unicode; gdy zabraknie, dopisz do tablicy
// albo podmień na @emoji-mart/react.
interface Emoji {
  char: string;
  /** Słowa kluczowe bez ogonków — po nich szuka `search`. */
  keys: string;
}

const GROUPS: { label: string; items: Emoji[] }[] = [
  {
    label: "Reakcje",
    items: [
      { char: "👍", keys: "kciuk tak ok super" },
      { char: "👎", keys: "kciuk nie zle" },
      { char: "👏", keys: "brawo oklaski" },
      { char: "🙌", keys: "brawo rece hurra" },
      { char: "🤝", keys: "umowa rece deal" },
      { char: "🙏", keys: "prosze dzieki modlitwa" },
      { char: "💪", keys: "sila moc" },
      { char: "✌️", keys: "spoko pokoj" },
      { char: "🫶", keys: "serce rece" },
      { char: "👀", keys: "oczy patrze sprawdzam" },
    ],
  },
  {
    label: "Emocje",
    items: [
      { char: "😀", keys: "usmiech radosc" },
      { char: "😄", keys: "usmiech smiech" },
      { char: "😅", keys: "smiech nerwowo pot" },
      { char: "😂", keys: "smiech lzy lol" },
      { char: "🙂", keys: "usmiech lekki" },
      { char: "😉", keys: "oczko mrugniecie" },
      { char: "😍", keys: "zakochany serca" },
      { char: "😎", keys: "okulary cool" },
      { char: "🤔", keys: "myslenie zastanawiam" },
      { char: "😐", keys: "obojetnie neutralnie" },
      { char: "😴", keys: "spie sen nuda" },
      { char: "😭", keys: "placz smutek" },
      { char: "😡", keys: "zlosc gniew" },
      { char: "🤯", keys: "szok glowa wybuch" },
      { char: "🥳", keys: "impreza swieto" },
      { char: "🤢", keys: "obrzydzenie" },
      { char: "😬", keys: "zazenowanie ups" },
      { char: "🫠", keys: "topie sie chaos" },
      { char: "🤷", keys: "wzruszenie ramion nie wiem" },
      { char: "🫡", keys: "salut tak jest" },
    ],
  },
  {
    label: "Praca",
    items: [
      { char: "✅", keys: "zrobione ok gotowe check" },
      { char: "❌", keys: "nie blad usun" },
      { char: "⚠️", keys: "uwaga ostrzezenie" },
      { char: "🔥", keys: "pilne ogien hot" },
      { char: "🚀", keys: "wdrozenie start rakieta" },
      { char: "🐛", keys: "bug blad robak" },
      { char: "🛠", keys: "naprawa narzedzia" },
      { char: "🧪", keys: "test eksperyment" },
      { char: "📝", keys: "notatka pisanie" },
      { char: "📌", keys: "pinezka wazne" },
      { char: "📅", keys: "kalendarz termin data" },
      { char: "⏰", keys: "budzik czas deadline" },
      { char: "⏳", keys: "czeka klepsydra" },
      { char: "🎯", keys: "cel target" },
      { char: "📊", keys: "wykres dane raport" },
      { char: "📈", keys: "wzrost wykres" },
      { char: "📉", keys: "spadek wykres" },
      { char: "💰", keys: "pieniadze budzet kasa" },
      { char: "🧾", keys: "faktura rachunek" },
      { char: "📦", keys: "paczka wydanie release" },
      { char: "🔒", keys: "klodka bezpieczenstwo" },
      { char: "🔑", keys: "klucz dostep haslo" },
      { char: "💡", keys: "pomysl idea" },
      { char: "❓", keys: "pytanie" },
      { char: "❗", keys: "wykrzyknik wazne" },
      { char: "🔗", keys: "link odnosnik" },
      { char: "📎", keys: "zalacznik spinacz" },
      { char: "🗑", keys: "kosz usun" },
      { char: "🏁", keys: "meta koniec finish" },
      { char: "🧹", keys: "sprzatanie cleanup" },
    ],
  },
  {
    label: "Ludzie i miejsca",
    items: [
      { char: "🧑‍💻", keys: "programista praca laptop" },
      { char: "👤", keys: "osoba uzytkownik" },
      { char: "👥", keys: "zespol ludzie" },
      { char: "🏢", keys: "biuro firma" },
      { char: "🏠", keys: "dom home" },
      { char: "✈️", keys: "samolot podroz urlop" },
      { char: "🌴", keys: "urlop palma wakacje" },
      { char: "☕", keys: "kawa przerwa" },
      { char: "🍕", keys: "pizza jedzenie" },
      { char: "🎉", keys: "sukces impreza konfetti" },
    ],
  },
  {
    label: "Symbole",
    items: [
      { char: "⭐", keys: "gwiazdka ulubione" },
      { char: "❤️", keys: "serce lubie" },
      { char: "💯", keys: "sto procent" },
      { char: "✨", keys: "iskry nowe" },
      { char: "🟢", keys: "zielone ok status" },
      { char: "🟡", keys: "zolte uwaga status" },
      { char: "🔴", keys: "czerwone blokada status" },
      { char: "🔵", keys: "niebieskie status" },
      { char: "⚪", keys: "biale status" },
      { char: "➡️", keys: "strzalka dalej" },
      { char: "⬅️", keys: "strzalka wstecz" },
      { char: "🔁", keys: "powtarzaj cykl" },
    ],
  },
];

/** Bez ogonków i wielkości liter — „Uśmiech" i „usmiech" filtrują tak samo. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
}

/**
 * Wstawia tekst w miejscu kursora zwykłego `<input>`/`<textarea>` i odpala
 * zdarzenie `input`, żeby kontrolowany komponent Reacta zobaczył zmianę.
 * Edytory bogate mają własne `insertContent` — to jest dla pól natywnych.
 */
export function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement | null, text: string): void {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.focus();
  // setRangeText utrzymuje historię cofania przeglądarki, ręczne sklejanie nie.
  el.setRangeText(text, start, end, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function EmojiPicker({
  onPick,
  label = "Wstaw emoji",
  className,
  triggerClassName,
  children,
}: {
  onPick: (emoji: string) => void;
  label?: string;
  className?: string;
  triggerClassName?: string;
  children?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((e) => e.char === q.trim() || fold(e.keys).includes(needle)),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(""); }}>
      <PopoverTrigger
        aria-label={label}
        title={label}
        className={cn(
          "grid size-6 place-items-center rounded-sm text-n-600 outline-none hover:bg-n-100 hover:text-foreground data-popup-open:bg-n-100 data-popup-open:text-foreground",
          triggerClassName,
        )}
      >
        {children ?? <span aria-hidden className="text-[13px] leading-none">🙂</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[268px] p-2", className)}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj emoji…"
          aria-label="Szukaj emoji"
          className="mb-2 h-7 w-full rounded-sm border border-input-border bg-card px-2 text-xs outline-none focus:border-orange-500 focus:shadow-[var(--focus)]"
        />
        <div className="max-h-[220px] overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-fg-3">Nic nie pasuje.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-1.5 last:mb-0">
                <p className="eyebrow px-1 pb-1">{g.label}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.items.map((e) => (
                    <button
                      key={e.char}
                      type="button"
                      // onMouseDown zamiast onClick: pole tekstowe nie traci
                      // zaznaczenia, więc emoji ląduje w kursorze, a nie na końcu.
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        onPick(e.char);
                        setOpen(false);
                        setQ("");
                      }}
                      aria-label={`Emoji ${e.char}`}
                      className="grid size-7 place-items-center rounded-sm text-base outline-none hover:bg-n-100 focus-visible:shadow-[var(--focus)] active:bg-n-200"
                    >
                      {e.char}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
