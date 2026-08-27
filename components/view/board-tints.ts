// Odcienie tła tablicy (A2). To dane kolorów, nie warstwa stylu — mieszkają
// poza komponentem, żeby literały hex nie siedziały w JSX. Ciepłe i o niskiej
// chromie: nagłówek zachowuje własne kolory tekstu, więc muszą być na tyle
// jasne, żeby `--foreground` trzymał kontrast AA.
export const TINTS: { label: string; value: string | null }[] = [
  { label: "Brak", value: null },
  { label: "Piaskowe", value: "#FAF7F2" },
  { label: "Pomarańczowe", value: "#FFF4EE" },
  { label: "Miętowe", value: "#F0F7F3" },
  { label: "Błękitne", value: "#F0F4FA" },
  { label: "Liliowe", value: "#F5F1FA" },
  { label: "Różowe", value: "#FBF0F3" },
];
