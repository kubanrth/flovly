// Id karty przegladarki do tlumienia echa realtime (lib/realtime.ts,
// hooks/use-workspace-realtime.ts). Per karta (sessionStorage), a ciasteczko
// nadpisuje karta z fokusem — tylko ona moze wykonac akcje, wiec serwer
// widzi w ciasteczku id wlasciwej karty. Ciasteczko nie jest zabezpieczeniem.

export const CLIENT_ID_COOKIE = "flovly_cid";
const KEY = "flovly:cid";

export function getClientId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(KEY, id); }
    return id;
  } catch { return ""; }
}

export function claimClientIdCookie() {
  const id = getClientId();
  if (!id) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CLIENT_ID_COOKIE}=${id}; Path=/; SameSite=Lax${secure}`;
}
