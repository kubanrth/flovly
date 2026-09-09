// Demo-workspace „Agencja Nova” z realistycznymi danymi w KAŻDYM module —
// do zrzutów ekranu w dokumentacji funkcji (docs/funkcje). Idempotentny:
// kasuje i tworzy od nowa przestrzeń o slugu `nova-demo`.
// Uruchomienie (staging): npx tsx -r dotenv/config scripts/seed-demo.ts

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { encrypt } from "../lib/vault-crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const DAY = 86_400_000;
const now = new Date();
const d = (days: number, hour = 9) => { const x = new Date(now.getTime() + days * DAY); x.setHours(hour, 0, 0, 0); return x; };
const p = (text: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const h = (text: string, level = 2) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const li = (text: string) => ({ type: "listItem", content: [p(text)] });
const ul = (...items: string[]) => ({ type: "bulletList", content: items.map(li) });
const doc = (...content: object[]) => ({ type: "doc", content });

async function main() {
  const passwordHash = await bcrypt.hash("danielos-demo-2026", 12);
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@danielos.local" } });
  const mk = async (email: string, name: string, rate: number) =>
    db.user.upsert({ where: { email }, update: { name, hourlyRateCents: rate }, create: { email, name, passwordHash, emailVerified: new Date(), hourlyRateCents: rate } });
  const marta = await mk("marta@nova-demo.local", "Marta Kowalczyk", 18_000);
  const piotr = await mk("piotr@nova-demo.local", "Piotr Zieliński", 15_000);
  const kasia = await mk("kasia@nova-demo.local", "Kasia Nowak", 12_000);
  const people = [admin, marta, piotr, kasia];

  const old = await db.workspace.findUnique({ where: { slug: "nova-demo" } });
  if (old) await db.workspace.delete({ where: { id: old.id } });
  const ws = await db.workspace.create({
    data: {
      name: "Agencja Nova", slug: "nova-demo", ownerId: admin.id,
      description: "Agencja marketingowa — kampanie, strony www, social media.",
      enabledViews: ["TABLE", "KANBAN", "ROADMAP", "GANTT", "CALENDAR", "WHITEBOARD", "TASKLINE"],
      memberships: { create: [{ userId: admin.id, role: "ADMIN" }, { userId: marta.id, role: "ADMIN" }, { userId: piotr.id, role: "MEMBER" }, { userId: kasia.id, role: "MEMBER" }] },
    },
  });
  const W = ws.id;

  // ── Tagi ──
  const tag = async (name: string, colorHex: string) => db.tag.create({ data: { workspaceId: W, name, colorHex, creatorId: admin.id } });
  const tMarketing = await tag("marketing", "#FF5C00");
  const tPilne = await tag("pilne", "#D6382C");
  const tKlient = await tag("klient", "#2F6FE8");
  const tDesign = await tag("design", "#7A33EC");

  // ── Tablica 1: Kampania Q4 ──
  const board = await db.board.create({
    data: {
      workspaceId: W, creatorId: admin.id, name: "Kampania Q4", order: 0,
      description: "Kampania jesienna dla klienta Bistro Verde: social media, Google Ads, landing page.",
      overviewJson: doc(h("Kampania Q4 — Bistro Verde"), p("Cel: +30% rezerwacji online w Q4. Budżet mediowy 24 000 zł. Start publikacji 1 października."),
        h("Zakres", 3), ul("Koncepcja kreatywna i key visual", "Landing page z formularzem rezerwacji", "Kampania Meta + Google Ads", "Raport tygodniowy dla klienta")),
      statusColumns: { create: [
        { name: "Backlog", colorHex: "#8A857D", order: 0 }, { name: "Do zrobienia", colorHex: "#64748B", order: 1 },
        { name: "W trakcie", colorHex: "#E8A100", order: 2 }, { name: "Review", colorHex: "#2F6FE8", order: 3 }, { name: "Done", colorHex: "#1E9E5A", order: 4 },
      ] },
      views: { create: [
        { type: "TABLE", configJson: {} }, { type: "KANBAN", configJson: {} }, { type: "GANTT", configJson: {} }, { type: "ROADMAP", configJson: {} },
        { type: "CALENDAR", configJson: {} }, { type: "WHITEBOARD", configJson: {} }, { type: "TASKLINE", configJson: {} },
      ] },
      customColumns: { create: [
        { name: "Budżet", type: "NUMBER", order: 0, options: { numberFormat: "currency", numberCurrency: "PLN", numberPrecision: 0 } },
        { name: "Kanał", type: "SINGLE_SELECT", order: 1, options: { selectOptions: [{ value: "Meta", color: "#2F6FE8" }, { value: "Google", color: "#1E9E5A" }, { value: "WWW", color: "#E8A100" }, { value: "PR", color: "#7A33EC" }] } },
        { name: "Sekcje", type: "SINGLE_SELECT", order: 2, options: { selectOptions: [{ value: "Kreacja", color: "#FF5C00" }, { value: "Media", color: "#2F6FE8" }, { value: "Technologia", color: "#1E9E5A" }] } },
        { name: "Termin klienta", type: "DATE", order: 3, options: {} },
        { name: "Ocena klienta", type: "RATING", order: 4, options: { ratingMax: 5, ratingIcon: "star" } },
        { name: "Zaakceptowane", type: "CHECKBOX", order: 5, options: {} },
      ] },
      links: { create: [{ kind: "DRIVE", url: "https://drive.google.com/drive/folders/demo", label: "Materiały od klienta", order: 0 }, { kind: "SHEETS", url: "https://docs.google.com/spreadsheets/d/demo", label: "Media plan Q4", order: 1 }, { kind: "DOCS", url: "https://docs.google.com/document/d/demo", label: "Brief kampanii", order: 2 }] },
    },
    include: { statusColumns: true, customColumns: true, views: true },
  });
  const B = board.id;
  const st = Object.fromEntries(board.statusColumns.map((s) => [s.name, s.id]));
  const col = Object.fromEntries(board.customColumns.map((c) => [c.name, c.id]));

  const ms = async (title: string, start: number, stop: number, i: number, assigneeId?: string) =>
    db.milestone.create({ data: { workspaceId: W, boardId: B, creatorId: admin.id, assigneeId, title, startAt: d(start), stopAt: d(stop), orderIndex: i, descriptionJson: doc(p(`Etap „${title}” kampanii Q4.`)) } });
  const m1 = await ms("Koncepcja", -21, -7, 0, marta.id);
  const m2 = await ms("Produkcja", -7, 14, 1, piotr.id);
  const m3 = await ms("Publikacja i optymalizacja", 14, 60, 2, kasia.id);

  let n = 0;
  type T = { title: string; status: string; prio?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"; who?: string[]; tags?: string[]; start?: number; stop?: number; ms?: string; desc?: string; custom?: Record<string, string>; parentId?: string; reminder?: number; recur?: { freq: "daily" | "weekly" | "monthly"; day?: number }; tracked?: number };
  const task = async (t: T) => {
    n += 1;
    return db.task.create({
      data: {
        workspaceId: W, boardId: B, displayId: n, creatorId: admin.id, title: t.title, statusColumnId: st[t.status], priority: t.prio ?? "NONE", rowOrder: n,
        milestoneId: t.ms, parentId: t.parentId, startAt: t.start !== undefined ? d(t.start) : undefined, stopAt: t.stop !== undefined ? d(t.stop, 17) : undefined,
        reminderAt: t.reminder !== undefined ? d(t.reminder, 8) : undefined, recurrenceRule: t.recur, timeTrackedSeconds: t.tracked ?? 0,
        descriptionJson: t.desc ? doc(p(t.desc), ul("Uzgodnić z klientem", "Przygotować wersję do akceptacji", "Wysłać do review")) : undefined,
        assignees: { create: (t.who ?? []).map((userId) => ({ userId })) },
        tags: { create: (t.tags ?? []).map((tagId) => ({ tagId })) },
        customValues: { create: Object.entries(t.custom ?? {}).map(([name, valueText]) => ({ columnId: col[name], valueText })) },
      },
    });
  };

  const epic = await task({ title: "Kampania social media Q4", status: "W trakcie", prio: "HIGH", who: [marta.id], tags: [tMarketing.id, tKlient.id], start: -14, stop: 30, ms: m2.id, desc: "Zadanie główne kampanii w social mediach. Podrzędne zadania to poszczególne formaty i kanały.", custom: { Budżet: "24000", Kanał: "Meta", Sekcje: "Media", "Termin klienta": d(28).toISOString().slice(0, 10), "Ocena klienta": "4", Zaakceptowane: "true" } });
  const c1 = await task({ title: "Key visual i 3 warianty grafik", status: "Done", prio: "HIGH", who: [kasia.id], tags: [tDesign.id], start: -14, stop: -6, ms: m1.id, parentId: epic.id, desc: "Key visual kampanii w 3 wariantach kolorystycznych, format 1:1 i 9:16.", custom: { Sekcje: "Kreacja", Kanał: "Meta", Zaakceptowane: "true" }, tracked: 5 * 3600 + 20 * 60 });
  const c2 = await task({ title: "Copy do 12 postów (PL)", status: "Review", prio: "MEDIUM", who: [piotr.id], tags: [tMarketing.id], start: -5, stop: 3, ms: m2.id, parentId: epic.id, desc: "12 postów: 6 produktowych, 4 lifestyle, 2 promocyjne.", custom: { Sekcje: "Kreacja", Kanał: "Meta" }, tracked: 2 * 3600 });
  const c3 = await task({ title: "Konfiguracja kampanii Meta Ads", status: "Do zrobienia", prio: "URGENT", who: [marta.id], tags: [tMarketing.id, tPilne.id], start: 2, stop: 9, ms: m2.id, parentId: epic.id, desc: "Grupy odbiorców, budżety dzienne, piksel na landing page.", custom: { Budżet: "18000", Sekcje: "Media", Kanał: "Meta" }, reminder: 1 });
  const lp = await task({ title: "Landing page z formularzem rezerwacji", status: "W trakcie", prio: "HIGH", who: [piotr.id, kasia.id], tags: [tKlient.id], start: -10, stop: 7, ms: m2.id, desc: "Jednostronicowy landing na Next.js, formularz rezerwacji zintegrowany z kalendarzem restauracji.", custom: { Budżet: "9500", Sekcje: "Technologia", Kanał: "WWW", "Termin klienta": d(7).toISOString().slice(0, 10), "Ocena klienta": "5" }, tracked: 11 * 3600 });
  const ga = await task({ title: "Kampania Google Ads — słowa kluczowe", status: "Do zrobienia", prio: "MEDIUM", who: [marta.id], tags: [tMarketing.id], start: 8, stop: 16, ms: m3.id, desc: "Research słów kluczowych, 3 grupy reklam, rozszerzenia.", custom: { Budżet: "6000", Sekcje: "Media", Kanał: "Google" } });
  await task({ title: "Sesja zdjęciowa dań sezonowych", status: "Done", prio: "MEDIUM", who: [kasia.id], tags: [tDesign.id], start: -20, stop: -15, ms: m1.id, desc: "Sesja w restauracji, 40 zdjęć po obróbce.", custom: { Budżet: "3200", Sekcje: "Kreacja" }, tracked: 7 * 3600 });
  await task({ title: "Brief kreatywny i moodboard", status: "Done", prio: "LOW", who: [marta.id], start: -21, stop: -17, ms: m1.id, custom: { Sekcje: "Kreacja" } });
  await task({ title: "Raport tygodniowy dla klienta", status: "Do zrobienia", prio: "LOW", who: [marta.id], tags: [tKlient.id], start: 4, stop: 4, ms: m3.id, recur: { freq: "weekly", day: 5 }, desc: "Co piątek: zasięgi, kliknięcia, rezerwacje, rekomendacje na kolejny tydzień.", custom: { Sekcje: "Media" } });
  await task({ title: "Newsletter październikowy", status: "Backlog", prio: "LOW", who: [piotr.id], start: 12, stop: 18, ms: m3.id, custom: { Kanał: "PR", Sekcje: "Kreacja" } });
  await task({ title: "Nota prasowa — otwarcie ogródka zimowego", status: "Backlog", prio: "NONE", tags: [tKlient.id], custom: { Kanał: "PR", Sekcje: "Kreacja" } });
  await task({ title: "Optymalizacja kampanii — tydzień 1", status: "Backlog", prio: "MEDIUM", who: [marta.id], start: 21, stop: 25, ms: m3.id, custom: { Sekcje: "Media", Kanał: "Meta" } });
  await task({ title: "Testy A/B nagłówków landing page", status: "Backlog", prio: "MEDIUM", who: [piotr.id], start: 16, stop: 22, ms: m3.id, custom: { Sekcje: "Technologia", Kanał: "WWW" } });

  // Podzadania (checklista), linki, ankieta, komentarze, wpisy czasu
  await db.subtask.createMany({ data: [
    { taskId: lp.id, title: "Makieta w Figmie", completed: true, order: 1 }, { taskId: lp.id, title: "Integracja formularza z kalendarzem", completed: true, order: 2 },
    { taskId: lp.id, title: "Wersja mobilna", completed: false, order: 3 }, { taskId: lp.id, title: "Testy szybkości (Lighthouse > 90)", completed: false, order: 4 },
    { taskId: c3.id, title: "Zainstalować piksel Meta", completed: false, order: 1 }, { taskId: c3.id, title: "Zdefiniować 3 grupy odbiorców", completed: false, order: 2 },
  ] });
  await db.taskLink.createMany({ data: [{ workspaceId: W, sourceTaskId: c1.id, targetTaskId: c2.id, createdById: admin.id }, { workspaceId: W, sourceTaskId: c2.id, targetTaskId: c3.id, createdById: admin.id }, { workspaceId: W, sourceTaskId: lp.id, targetTaskId: ga.id, createdById: admin.id }] });
  const poll = await db.taskPoll.create({ data: { taskId: c1.id, question: "Który wariant key visualu wybieramy?", authorId: marta.id, options: { create: [{ label: "A — ciepłe tony", order: 0 }, { label: "B — zielony akcent", order: 1 }, { label: "C — monochrom", order: 2 }] } }, include: { options: true } });
  await db.taskPollVote.createMany({ data: [{ pollId: poll.id, userId: admin.id, optionId: poll.options[1].id }, { pollId: poll.id, userId: piotr.id, optionId: poll.options[1].id }, { pollId: poll.id, userId: kasia.id, optionId: poll.options[0].id }] });
  const cm = async (taskId: string, authorId: string, text: string, daysAgo: number, mention?: string) => {
    const c = await db.comment.create({ data: { taskId, authorId, bodyJson: doc(p(text)), createdAt: d(-daysAgo, 11) } });
    if (mention) await db.commentMention.create({ data: { commentId: c.id, mentionedUserId: mention } });
  };
  await cm(lp.id, marta.id, "Klient prosi o wersję formularza z wyborem stolika. @Piotr Zieliński dasz radę do piątku?", 2, piotr.id);
  await cm(lp.id, piotr.id, "Dam radę — dorzucę to do makiety jutro rano.", 1);
  await cm(c2.id, admin.id, "Posty 7 i 9 do poprawy: za długie nagłówki. Reszta OK.", 1);
  await cm(epic.id, kasia.id, "Grafiki do postów 1–6 są w Drive, folder „Q4 / posty”.", 3);
  const te = async (taskId: string | null, userId: string, daysAgo: number, hours: number, note: string, rate: number) =>
    db.timeEntry.create({ data: { workspaceId: W, taskId, userId, startedAt: d(-daysAgo, 9), stoppedAt: new Date(d(-daysAgo, 9).getTime() + hours * 3600_000), durationSeconds: hours * 3600, note, rateSnapshotCents: rate, billable: true } });
  await te(lp.id, piotr.id, 1, 4, "Formularz rezerwacji", 15_000); await te(lp.id, piotr.id, 2, 3, "Makieta i layout", 15_000); await te(lp.id, kasia.id, 3, 4, "Ilustracje na landing", 12_000);
  await te(c1.id, kasia.id, 8, 5, "Key visual — 3 warianty", 12_000); await te(c2.id, piotr.id, 4, 2, "Copy postów 1–6", 15_000); await te(epic.id, marta.id, 1, 2, "Koordynacja z klientem", 18_000);
  await te(null, marta.id, 5, 1, "Spotkanie statusowe", 18_000);
  await db.task.update({ where: { id: lp.id }, data: { timerStartedAt: new Date(now.getTime() - 25 * 60_000) } });

  // ── Tablica 2: Strona www — redesign (prywatna) ──
  const b2 = await db.board.create({
    data: {
      workspaceId: W, creatorId: marta.id, name: "Strona www — redesign", order: 1, visibility: "PRIVATE",
      description: "Redesign strony agencji. Tablica prywatna — widoczna dla zaproszonych.",
      statusColumns: { create: [{ name: "Do zrobienia", colorHex: "#64748B", order: 0 }, { name: "W trakcie", colorHex: "#E8A100", order: 1 }, { name: "Done", colorHex: "#1E9E5A", order: 2 }] },
      views: { create: [{ type: "TABLE", configJson: {} }, { type: "KANBAN", configJson: {} }] },
      memberships: { create: [{ userId: marta.id, role: "ADMIN" }, { userId: piotr.id, role: "MEMBER" }] },
    }, include: { statusColumns: true },
  });
  const st2 = Object.fromEntries(b2.statusColumns.map((s) => [s.name, s.id]));
  let n2 = 0;
  for (const [title, status, who] of [["Audyt obecnej strony", "Done", piotr.id], ["Nowa architektura informacji", "W trakcie", marta.id], ["Design system (kolory, typografia)", "W trakcie", kasia.id], ["Strona główna — makieta", "Do zrobienia", kasia.id], ["Portfolio — szablon case study", "Do zrobienia", piotr.id]] as const) {
    n2 += 1;
    await db.task.create({ data: { workspaceId: W, boardId: b2.id, displayId: n2, creatorId: marta.id, title, statusColumnId: st2[status], rowOrder: n2, priority: n2 % 2 ? "MEDIUM" : "LOW", startAt: d(n2 * 3 - 6), stopAt: d(n2 * 3), assignees: { create: [{ userId: who }] } } });
  }

  // ── Whiteboard, Wiki, Briefy, Support, Wydarzenia ──
  const canvas = await db.processCanvas.create({ data: { workspaceId: W, creatorId: admin.id, name: "Ścieżka klienta — rezerwacja" } });
  const node = (label: string, x: number, y: number, shape: "RECTANGLE" | "DIAMOND" | "CIRCLE" | "STICKY", colorHex: string) => db.processNode.create({ data: { canvasId: canvas.id, label, x, y, shape, colorHex, width: 180, height: 80 } });
  const nA = await node("Reklama na Instagramie", 60, 120, "RECTANGLE", "#FFE8DB"); const nB = await node("Landing page", 320, 120, "RECTANGLE", "#DBEAFE"); const nC = await node("Wybór terminu?", 580, 120, "DIAMOND", "#FEF3C7");
  const nD = await node("Rezerwacja potwierdzona", 840, 60, "CIRCLE", "#DCFCE7"); const nE = await node("Remarketing po 3 dniach", 840, 220, "RECTANGLE", "#F3E8FF"); await node("Pomysł: kod rabatowy -10% przy pierwszej rezerwacji", 320, 300, "STICKY", "#FEF9C3");
  await db.processEdge.createMany({ data: [{ canvasId: canvas.id, fromNodeId: nA.id, toNodeId: nB.id }, { canvasId: canvas.id, fromNodeId: nB.id, toNodeId: nC.id }, { canvasId: canvas.id, fromNodeId: nC.id, toNodeId: nD.id, label: "tak" }, { canvasId: canvas.id, fromNodeId: nC.id, toNodeId: nE.id, label: "nie", style: "dashed" }] });
  await db.wikiPage.create({ data: { workspaceId: W, title: "Jak pracujemy w Agencji Nova", updatedById: marta.id, contentJson: doc(h("Jak pracujemy"), p("Krótki przewodnik dla nowych osób w zespole: narzędzia, rytuały i zasady komunikacji z klientami."), h("Rytuały", 3), ul("Poniedziałek 9:30 — planowanie tygodnia", "Piątek 15:00 — raport dla klientów", "Retro raz w miesiącu"), h("Zasady", 3), ul("Każde zadanie ma osobę i termin", "Materiały klienta trzymamy w Dokumentach", "Hasła tylko w sejfie FLOVLY, nigdy w czacie")) } });
  const brief = async (title: string, status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED", emoji: string, color: string, text: string) => db.creativeBrief.create({ data: { workspaceId: W, creatorId: kasia.id, title, status, emoji, headerColor: color, contentJson: doc(h(title), p(text), h("Do kogo mówimy", 3), p("Mieszkańcy Wrocławia 25–45, jedzą na mieście 2–3 razy w tygodniu."), h("Kluczowy przekaz", 3), p("Sezonowe menu z lokalnych składników — w 5 minut od rezerwacji do stolika.")) } });
  await brief("Bistro Verde — kampania jesienna", "APPROVED", "🍂", "#FF5C00", "Jesienna odsłona menu, ciepłe kadry, nacisk na rezerwację online.");
  await brief("Rebranding kawiarni Ziarno", "IN_REVIEW", "☕", "#7A33EC", "Nowe logo i identyfikacja dla sieci 3 kawiarni.");
  await brief("Seria reelsów „Kuchnia od kuchni”", "DRAFT", "🎬", "#2F6FE8", "12 krótkich wideo zza kulis restauracji.");
  const ticket = (title: string, description: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED", priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT", reporterId: string, assigneeId?: string) =>
    db.supportTicket.create({ data: { workspaceId: W, title, description, status, priority, reporterId, assigneeId, isUrgent: priority === "URGENT", dueAt: d(3), resolvedAt: status === "RESOLVED" || status === "CLOSED" ? d(-1) : undefined } });
  await ticket("Formularz na landingu nie wysyła maila", "Po kliknięciu „Rezerwuję” kręci się spinner, mail potwierdzający nie dochodzi. Testowane na Safari i Chrome.", "OPEN", "URGENT", marta.id, piotr.id);
  await ticket("Brak dostępu do Google Ads dla Marty", "Marta nie widzi konta reklamowego klienta po zmianie hasła.", "IN_PROGRESS", "HIGH", kasia.id, admin.id);
  await ticket("Literówka w stopce strony klienta", "„Restauarcja” zamiast „Restauracja”.", "RESOLVED", "LOW", piotr.id, kasia.id);
  await ticket("Eksport raportu do PDF", "Prośba o możliwość eksportu raportu tygodniowego do PDF.", "CLOSED", "MEDIUM", marta.id);
  await db.workspaceEvent.createMany({ data: [
    { workspaceId: W, creatorId: marta.id, title: "Prezentacja koncepcji u klienta", startAt: d(2, 11), endAt: d(2, 12), color: "#FF5C00" },
    { workspaceId: W, creatorId: admin.id, title: "Planowanie tygodnia", startAt: d(1, 9), endAt: d(1, 10), color: "#2F6FE8" },
    { workspaceId: W, creatorId: kasia.id, title: "Sesja zdjęciowa — menu zimowe", startAt: d(9, 8), endAt: d(9, 16), allDay: true, color: "#1E9E5A" },
  ] });

  // ── Kontakty + Plan sprzedaży ──
  const contact = (data: { firstName: string; lastName: string; position: string; email: string; phone: string; companyName: string; city: string; ownerId: string; nip?: string; website?: string }) =>
    db.contact.create({ data: { workspaceId: W, creatorId: admin.id, ...data, country: "PL", notesJson: doc(p("Kontakt pozyskany z polecenia. Preferuje kontakt telefoniczny po 14:00.")) } });
  const cVerde = await contact({ firstName: "Tomasz", lastName: "Wiśniewski", position: "Właściciel", email: "tomasz@bistroverde.pl", phone: "+48 601 200 300", companyName: "Bistro Verde", city: "Wrocław", ownerId: marta.id, nip: "8992700001", website: "https://bistroverde.pl" });
  const cZiarno = await contact({ firstName: "Agnieszka", lastName: "Maj", position: "Dyrektor marketingu", email: "a.maj@ziarno.cafe", phone: "+48 512 100 200", companyName: "Kawiarnie Ziarno", city: "Wrocław", ownerId: marta.id, nip: "8992700002" });
  const cDent = await contact({ firstName: "Marek", lastName: "Lis", position: "Prezes", email: "m.lis@dentalux.pl", phone: "+48 700 800 900", companyName: "Dentalux", city: "Poznań", ownerId: piotr.id });
  await contact({ firstName: "Ewa", lastName: "Sobczak", position: "Founder", email: "ewa@greenbox.pl", phone: "+48 660 111 222", companyName: "GreenBox Catering", city: "Warszawa", ownerId: kasia.id });
  await contact({ firstName: "Robert", lastName: "Krawczyk", position: "Kierownik sprzedaży", email: "r.krawczyk@meblo.pl", phone: "+48 605 333 444", companyName: "Meblo Studio", city: "Wrocław", ownerId: admin.id });
  await db.contactActivity.createMany({ data: [
    { workspaceId: W, contactId: cVerde.id, actorId: marta.id, type: "note", bodyJson: doc(p("Rozmowa telefoniczna: klient zadowolony z key visualu, prosi o wariant B.")), createdAt: d(-3) },
    { workspaceId: W, contactId: cVerde.id, actorId: admin.id, type: "owner_change", bodyJson: { from: null, to: marta.id }, createdAt: d(-20) },
  ] });
  await db.contactMessage.createMany({ data: [
    { workspaceId: W, contactId: cVerde.id, senderId: marta.id, direction: "out", fromEmail: "marta@nova.agency", toEmail: "tomasz@bistroverde.pl", subject: "Koncepcja kampanii Q4", bodyText: "Dzień dobry, w załączniku przesyłam koncepcję kampanii jesiennej. Proponuję omówienie w czwartek o 11:00.", sentAt: d(-4, 10) },
    { workspaceId: W, contactId: cVerde.id, direction: "in", fromEmail: "tomasz@bistroverde.pl", toEmail: "marta@nova.agency", subject: "Re: Koncepcja kampanii Q4", bodyText: "Dziękuję, czwartek pasuje. Podoba mi się wariant z zielonym akcentem.", sentAt: d(-3, 15) },
  ] });
  const stage = (name: string, colorHex: string, order: number, closedKind?: "won" | "lost") => db.dealStage.create({ data: { workspaceId: W, name, colorHex, order, closedKind } });
  const sLead = await stage("Lead", "#8A857D", 0); const sKontakt = await stage("Pierwszy kontakt", "#2F6FE8", 1); const sOferta = await stage("Oferta", "#E8A100", 2); const sNeg = await stage("Negocjacje", "#7A33EC", 3); const sWon = await stage("Wygrane", "#1E9E5A", 4, "won"); const sLost = await stage("Przegrane", "#D6382C", 5, "lost");
  const deal = (title: string, stageId: string, valueAmount: number, contactId: string | undefined, ownerId: string, close: number, order: number) =>
    db.deal.create({ data: { workspaceId: W, creatorId: admin.id, title, stageId, valueAmount, contactId, ownerId, expectedCloseAt: d(close), rowOrder: order, notesJson: doc(p("Notatki z rozmów handlowych.")) } });
  const dz = await deal("Kampania Q4 — Bistro Verde", sWon.id, 42_000, cVerde.id, marta.id, -10, 1);
  await deal("Rebranding — Kawiarnie Ziarno", sNeg.id, 28_000, cZiarno.id, marta.id, 12, 2);
  await deal("Strona www — Dentalux", sOferta.id, 19_500, cDent.id, piotr.id, 20, 3);
  await deal("Social media — GreenBox (roczna obsługa)", sKontakt.id, 60_000, undefined, kasia.id, 35, 4);
  await deal("Katalog produktowy — Meblo Studio", sLead.id, 8_000, undefined, admin.id, 45, 5);
  await deal("Sklep online — Meblo Studio", sLost.id, 35_000, undefined, admin.id, -5, 6);
  await db.dealActivity.createMany({ data: [{ workspaceId: W, dealId: dz.id, actorId: marta.id, type: "stage_change", bodyJson: { from: "Negocjacje", to: "Wygrane" }, createdAt: d(-10) }, { workspaceId: W, dealId: dz.id, actorId: marta.id, type: "note", bodyJson: doc(p("Umowa podpisana, zaliczka 30% opłacona.")), createdAt: d(-9) }] });

  // ── Hasła, Subskrypcje, Umowy, Zapotrzebowanie, Dokumenty ──
  const secret = (name: string, category: string, url: string, username: string, password: string, ownerId: string) => {
    const e = encrypt(password); const nte = encrypt("Konto współdzielone — nie zmieniać hasła bez uzgodnienia.");
    return db.secretItem.create({ data: { workspaceId: W, ownerId, name, category, url, username, passwordEnc: e.enc, passwordIv: e.iv, notesEnc: nte.enc, notesIv: nte.iv } });
  };
  await secret("Meta Business — Bistro Verde", "social", "https://business.facebook.com", "ads@nova.agency", "Demo-Haslo-1!", marta.id);
  await secret("Google Ads — konto agencyjne", "ads", "https://ads.google.com", "ads@nova.agency", "Demo-Haslo-2!", marta.id);
  await secret("Hosting — panel klienta", "hosting", "https://panel.hosting.pl", "nova-agency", "Demo-Haslo-3!", piotr.id);
  await secret("WiFi biuro", "biuro", "", "Nova-Guest", "Demo-Haslo-4!", admin.id);
  const projA = await db.subscriptionProject.create({ data: { workspaceId: W, name: "Bistro Verde", members: { create: [{ userId: marta.id }, { userId: admin.id }] } } });
  const projB = await db.subscriptionProject.create({ data: { workspaceId: W, name: "Narzędzia agencji", members: { create: [{ userId: admin.id }, { userId: marta.id }, { userId: piotr.id }, { userId: kasia.id }] } } });
  await db.subscription.createMany({ data: [
    { workspaceId: W, projectId: projB.id, name: "Figma Professional", url: "https://figma.com", amountCents: 6_000, cycle: "MONTHLY", notes: "3 edytory" },
    { workspaceId: W, projectId: projB.id, name: "Adobe Creative Cloud", url: "https://adobe.com", amountCents: 24_900, cycle: "MONTHLY" },
    { workspaceId: W, projectId: projB.id, name: "Google Workspace", amountCents: 11_600, cycle: "MONTHLY", notes: "4 konta" },
    { workspaceId: W, projectId: projA.id, name: "Hosting landing page", url: "https://hosting.pl", amountCents: 2_900, cycle: "MONTHLY" },
    { workspaceId: W, projectId: projA.id, name: "Domena bistroverde-rezerwacje.pl", amountCents: 8_900, cycle: "YEARLY" },
    { workspaceId: W, name: "Canva Teams", amountCents: 12_000, cycle: "YEARLY", notes: "wspólna dla wszystkich projektów" },
  ] });
  await db.contract.createMany({ data: [
    { workspaceId: W, creatorId: admin.id, title: "Bistro Verde — obsługa marketingowa", details: [{ label: "Kontrahent", value: "Bistro Verde sp. z o.o." }, { label: "Czas trwania umowy", value: "12 miesięcy" }, { label: "Wynagrodzenie", value: "6 500 zł netto / mies." }, { label: "Okres wypowiedzenia", value: "1 miesiąc" }] },
    { workspaceId: W, creatorId: marta.id, title: "Kawiarnie Ziarno — rebranding", details: [{ label: "Kontrahent", value: "Ziarno Coffee S.A." }, { label: "Zakres", value: "Logo, identyfikacja, księga znaku" }, { label: "Wartość", value: "28 000 zł netto" }, { label: "Stały rabat hurtowy", value: "6%" }] },
    { workspaceId: W, creatorId: admin.id, title: "Drukarnia Kolor — umowa ramowa", details: [{ label: "Czas trwania umowy", value: "2 lata" }, { label: "Stały rabat hurtowy", value: "6%" }, { label: "Termin płatności", value: "21 dni" }] },
  ] });
  await db.purchaseRequest.createMany({ data: [
    { workspaceId: W, requesterId: kasia.id, project: "Bistro Verde", link: "https://www.shutterstock.com/", costCents: 39_900 },
    { workspaceId: W, requesterId: piotr.id, project: "Strona www — redesign", link: "https://themeforest.net/", costCents: 25_900 },
    { workspaceId: W, requesterId: marta.id, project: "Narzędzia agencji", link: "https://www.notion.so/pricing", costCents: 8_000 },
    { workspaceId: W, requesterId: admin.id, project: "Biuro", costCents: 149_000 },
  ] });
  await db.document.createMany({ data: [
    { workspaceId: W, uploaderId: marta.id, filename: "Brief_Bistro_Verde_Q4.pdf", mimeType: "application/pdf", sizeBytes: 842_000, storageKey: `w/${W}/doc/demo-brief.pdf` },
    { workspaceId: W, uploaderId: admin.id, filename: "Umowa_Bistro_Verde_2026.pdf", mimeType: "application/pdf", sizeBytes: 1_240_000, storageKey: `w/${W}/doc/demo-umowa.pdf` },
    { workspaceId: W, uploaderId: kasia.id, filename: "KeyVisual_warianty.zip", mimeType: "application/zip", sizeBytes: 48_300_000, storageKey: `w/${W}/doc/demo-kv.zip` },
  ] });
  const docs = await db.document.findMany({ where: { workspaceId: W }, select: { id: true, filename: true } });
  await db.documentAccess.createMany({ data: docs.flatMap((x) => (x.filename.startsWith("Umowa") ? [{ documentId: x.id, userId: marta.id }] : [{ documentId: x.id, userId: piotr.id }, { documentId: x.id, userId: kasia.id }])) });

  // ── Dla Ciebie (konto admina): powiadomienia, przypomnienia, urlopy, notatki, TO DO ──
  await db.notification.deleteMany({ where: { userId: admin.id } });
  await db.notification.createMany({ data: [
    { userId: admin.id, type: "task.assigned", payload: { workspaceId: W, taskId: c3.id, taskTitle: c3.title, boardId: B, boardName: board.name, actorId: marta.id, actorName: marta.name }, createdAt: d(0, 8) },
    { userId: admin.id, type: "comment.mention", payload: { commentId: "x", taskId: lp.id, workspaceId: W, authorId: marta.id, authorName: marta.name, taskTitle: lp.title, snippet: "Klient prosi o wersję formularza z wyborem stolika…" }, createdAt: d(-1, 14) },
    { userId: admin.id, type: "task.status.changed", payload: { workspaceId: W, taskId: c1.id, taskTitle: c1.title, boardId: B, boardName: board.name, actorId: kasia.id, actorName: kasia.name, fromStatusName: "Review", toStatusName: "Done" }, createdAt: d(-1, 9), readAt: d(-1, 10) },
    { userId: admin.id, type: "task.created", payload: { workspaceId: W, taskId: ga.id, taskTitle: ga.title, boardId: B, boardName: board.name, actorId: marta.id, actorName: marta.name }, createdAt: d(-2, 12), readAt: d(-2, 13) },
    { userId: admin.id, type: "poll.created", payload: { workspaceId: W, taskId: c1.id, taskTitle: c1.title, question: poll.question, authorName: marta.name }, createdAt: d(-6, 10), readAt: d(-6, 11) },
  ] });
  await db.personalReminder.createMany({ data: [
    // Terminy w przyszlosci — przypomnienie z minionym terminem wyskakuje jako
    // popup nad cala aplikacja i przechwytuje klikniecia (testy, zrzuty).
    { creatorId: admin.id, recipientId: admin.id, title: "Wysłać fakturę za wrzesień — Bistro Verde", body: "Kwota 6 500 zł netto, termin 14 dni.", dueAt: d(3, 10) },
    { creatorId: marta.id, recipientId: admin.id, title: "Akcept key visualu przed prezentacją", dueAt: d(5, 9) },
    { creatorId: admin.id, recipientId: piotr.id, title: "Odesłać makietę formularza", dueAt: d(2, 15) },
  ] });
  await db.vacationRequest.createMany({ data: [
    { requesterId: kasia.id, startDate: d(10), endDate: d(14), reason: "Urlop wypoczynkowy", status: "pending" },
    { requesterId: piotr.id, startDate: d(-30), endDate: d(-26), reason: "Wyjazd rodzinny", status: "approved", decidedById: admin.id, decidedAt: d(-35) },
    { requesterId: marta.id, startDate: d(20), endDate: d(21), reason: "Sprawy prywatne", status: "rejected", decidedById: admin.id, decidedAt: d(-2), decisionNote: "Prezentacja u klienta w tym terminie — przesuńmy o tydzień." },
  ] });
  const folder = await db.noteFolder.create({ data: { userId: admin.id, name: "Spotkania" } });
  await db.note.createMany({ data: [
    { userId: admin.id, folderId: folder.id, title: "Status z Bistro Verde — 5.09", pinned: true, content: "Klient wybrał wariant B. Landing do 12.09. Raporty co piątek.", contentJson: doc(h("Status z Bistro Verde"), ul("Klient wybrał wariant B key visualu", "Landing page do 12.09", "Raporty co piątek 15:00")) },
    { userId: admin.id, title: "Pomysły na Q1", content: "Webinar dla restauratorów; pakiet „start w social” dla małych lokali.", contentJson: doc(p("Webinar dla restauratorów o rezerwacjach online."), p("Pakiet „start w social” dla małych lokali — 3 miesiące, stała cena.")) },
  ] });
  const tf = await db.todoFolder.create({ data: { userId: admin.id, name: "Praca" } });
  const tl = await db.todoList.create({ data: { userId: admin.id, folderId: tf.id, name: "Ten tydzień" } });
  const item = (content: string, o: Record<string, unknown>) => db.todoItem.create({ data: { listId: tl.id, userId: admin.id, content, order: Math.random(), ...o } });
  const i1 = await item("Przygotować ofertę dla Dentalux", { important: true, dueDate: d(2), myDayAt: now });
  await db.todoStep.createMany({ data: [{ itemId: i1.id, title: "Wycena strony", order: 1, completed: true }, { itemId: i1.id, title: "Harmonogram", order: 2 }, { itemId: i1.id, title: "Wysłać PDF", order: 3 }] });
  await item("Zadzwonić do drukarni w sprawie wizytówek", { dueDate: d(1), myDayAt: now });
  await item("Zaktualizować portfolio na stronie", { completed: true });
  await item("Zamówić kawę do biura", {});
  await db.todoList.create({ data: { userId: admin.id, name: "Prywatne", items: { create: [{ userId: admin.id, content: "Odebrać garnitur z pralni", dueDate: d(3) }, { userId: admin.id, content: "Zapisać się na badania", important: true }] } } });

  console.log(JSON.stringify({ workspaceId: W, boardId: B, board2Id: b2.id, canvasId: canvas.id, epicId: epic.id, lpId: lp.id, c1Id: c1.id, contactId: cVerde.id, dealId: dz.id }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
