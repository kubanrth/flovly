// Ikony 16px z makiet v5 (ścieżki 1:1, stroke 1.4–1.5, currentColor).
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: IconProps) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}
const s = { stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const f = { fill: "currentColor" } as const;

export function IconMenu(p: IconProps) { return <Svg {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" {...s} strokeWidth={1.5} /></Svg>; }
export function IconSearch(p: IconProps) { return <Svg {...p}><circle cx="7" cy="7" r="4.5" {...s} strokeWidth={1.5} /><path d="M10.5 10.5L14 14" {...s} strokeWidth={1.5} /></Svg>; }
export function IconPlus(p: IconProps) { return <Svg {...p}><path d="M8 3v10M3 8h10" {...s} strokeWidth={1.6} /></Svg>; }
export function IconChevronDown(p: IconProps) { return <Svg {...p}><path d="M4 6l4 4 4-4" {...s} strokeWidth={1.6} /></Svg>; }
export function IconChevronUp(p: IconProps) { return <Svg {...p}><path d="M4 10l4-4 4 4" {...s} strokeWidth={1.6} /></Svg>; }
export function IconChevronRight(p: IconProps) { return <Svg {...p}><path d="M6 4l4 4-4 4" {...s} strokeWidth={1.6} /></Svg>; }
export function IconChevronLeft(p: IconProps) { return <Svg {...p}><path d="M10 4L6 8l4 4" {...s} strokeWidth={1.6} /></Svg>; }
export function IconBell(p: IconProps) { return <Svg {...p}><path d="M8 2.2a4 4 0 0 0-4 4v2.8L2.6 11h10.8L12 9V6.2a4 4 0 0 0-4-4z" {...s} strokeWidth={1.5} /><path d="M6.8 13.2a1.3 1.3 0 0 0 2.4 0" {...s} strokeWidth={1.5} /></Svg>; }
export const IconInbox = IconBell;
export function IconHelp(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="6.2" {...s} strokeWidth={1.5} /><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.5-.8 1v.3" {...s} strokeWidth={1.5} /><circle cx="8" cy="11.4" r=".8" {...f} /></Svg>; }
export function IconSettings(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="2" {...s} strokeWidth={1.5} /><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" {...s} strokeWidth={1.5} /></Svg>; }
export function IconMore(p: IconProps) { return <Svg {...p}><circle cx="3.5" cy="8" r="1.2" {...f} /><circle cx="8" cy="8" r="1.2" {...f} /><circle cx="12.5" cy="8" r="1.2" {...f} /></Svg>; }
export function IconClose(p: IconProps) { return <Svg {...p}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...s} strokeWidth={1.5} /></Svg>; }
export function IconCheck(p: IconProps) { return <Svg {...p}><path d="M3 8.5l3.5 3.5L13 5" {...s} strokeWidth={1.6} /></Svg>; }
export function IconCheckCircle(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="6.5" {...s} strokeWidth={1.5} /><path d="M5.4 8.2l1.8 1.8 3.4-4" {...s} strokeWidth={1.5} /></Svg>; }
export function IconTasks(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="6.2" {...s} strokeWidth={1.5} /><path d="M5.4 8.2l1.8 1.8 3.4-4" {...s} strokeWidth={1.5} /></Svg>; }
export function IconTodo(p: IconProps) { return <Svg {...p}><rect x="2.5" y="2.5" width="11" height="11" rx="2" {...s} strokeWidth={1.5} /><path d="M5.4 8.2l1.8 1.8 3.4-4" {...s} strokeWidth={1.5} /></Svg>; }
export function IconCalendar(p: IconProps) { return <Svg {...p}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" {...s} strokeWidth={1.5} /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" {...s} strokeWidth={1.5} /></Svg>; }
export function IconNotes(p: IconProps) { return <Svg {...p}><path d="M3 2.5h7.5L13 5v8.5H3V2.5z" {...s} strokeWidth={1.5} /><path d="M10 2.5V5h3M5.5 8h5M5.5 10.5h3" {...s} strokeWidth={1.5} /></Svg>; }
export function IconFile(p: IconProps) { return <Svg {...p}><path d="M3 2.5h7.5L13 5v8.5H3V2.5z" {...s} strokeWidth={1.5} /><path d="M10 2.5V5h3" {...s} strokeWidth={1.5} /></Svg>; }
export function IconReminders(p: IconProps) { return <Svg {...p}><circle cx="8" cy="9" r="4.5" {...s} strokeWidth={1.5} /><path d="M8 6.8V9l1.8 1M3.5 3L2 4.5M12.5 3L14 4.5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconVacations(p: IconProps) { return <Svg {...p}><rect x="2.5" y="5" width="11" height="8.5" rx="1.5" {...s} strokeWidth={1.5} /><path d="M6 5V3.8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5M2.5 8.5h11" {...s} strokeWidth={1.5} /></Svg>; }
export function IconRecent(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="5.5" {...s} strokeWidth={1.5} /><path d="M8 5v3l2 1.2" {...s} strokeWidth={1.5} /></Svg>; }
export const IconTime = IconRecent;
export function IconStar(p: IconProps) { return <Svg {...p}><path d="M8 2.2l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.6l-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2.2z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconStarFilled(p: IconProps) { return <Svg {...p}><path d="M8 2.2l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.6l-3.6 1.9.7-4.1-3-2.9 4.1-.6L8 2.2z" {...f} stroke="currentColor" strokeWidth={1} /></Svg>; }
export function IconBoards(p: IconProps) { return <Svg {...p}><rect x="2.5" y="3" width="3" height="10" rx="1" {...s} strokeWidth={1.4} /><rect x="6.5" y="3" width="3" height="6.5" rx="1" {...s} strokeWidth={1.4} /><rect x="10.5" y="3" width="3" height="8.5" rx="1" {...s} strokeWidth={1.4} /></Svg>; }
export const IconBoard = IconBoards;
export function IconContacts(p: IconProps) { return <Svg {...p}><circle cx="8" cy="5.5" r="2.7" {...s} strokeWidth={1.5} /><path d="M3 13.5a5 5 0 0 1 10 0" {...s} strokeWidth={1.5} /></Svg>; }
export const IconUser = IconContacts;
export function IconUsers(p: IconProps) { return <Svg {...p}><circle cx="6" cy="5.5" r="2.4" {...s} strokeWidth={1.4} /><path d="M1.5 13a4.5 4.5 0 0 1 9 0M10.5 3.3a2.4 2.4 0 0 1 0 4.4M12 9.2a4.5 4.5 0 0 1 2.5 3.8" {...s} strokeWidth={1.4} /></Svg>; }
export function IconSales(p: IconProps) { return <Svg {...p}><path d="M2.5 13.5h11M3.5 10.5l3-3 2.5 2 3.5-4.5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconPasswords(p: IconProps) { return <Svg {...p}><circle cx="5" cy="8" r="2.5" {...s} strokeWidth={1.5} /><path d="M7.5 8h6M11 8v2.3M13.5 8v1.7" {...s} strokeWidth={1.5} /></Svg>; }
export function IconSubscriptions(p: IconProps) { return <Svg {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.5" {...s} strokeWidth={1.5} /><path d="M2 6.5h12" {...s} strokeWidth={1.5} /></Svg>; }
export function IconCreative(p: IconProps) { return <Svg {...p}><path d="M5.7 10.8a3.9 3.9 0 1 1 4.6 0c-.6.4-.9 1-1 1.7H6.7c-.1-.7-.4-1.3-1-1.7z" {...s} strokeWidth={1.4} /><path d="M6.7 14.2h2.6" {...s} strokeWidth={1.4} /></Svg>; }
export function IconSupport(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="5.5" {...s} strokeWidth={1.4} /><circle cx="8" cy="8" r="2.2" {...s} strokeWidth={1.4} /><path d="M4.2 4.2l2 2M9.8 9.8l2 2M11.8 4.2l-2 2M6.2 9.8l-2 2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconWiki(p: IconProps) { return <Svg {...p}><path d="M3 3.8A1.8 1.8 0 0 1 4.8 2H13v10.5H4.8A1.8 1.8 0 0 0 3 14.2V3.8z" {...s} strokeWidth={1.4} /><path d="M13 12.5H4.8A1.8 1.8 0 0 0 3 14.2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconWhiteboard(p: IconProps) { return <Svg {...p}><path d="M3 13l1-3.5 7-7a1.4 1.4 0 0 1 2 2l-7 7L3 13z" {...s} strokeWidth={1.4} /></Svg>; }
export const IconEdit = IconWhiteboard;
export function IconGrid(p: IconProps) { return <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" {...s} strokeWidth={1.4} /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" {...s} strokeWidth={1.4} /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" {...s} strokeWidth={1.4} /><rect x="9" y="9" width="4.5" height="4.5" rx="1" {...s} strokeWidth={1.4} /></Svg>; }
export function IconShield(p: IconProps) { return <Svg {...p}><path d="M8 2l5 1.8v4c0 3-2.1 4.9-5 6.2-2.9-1.3-5-3.2-5-6.2v-4L8 2z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconShieldCheck(p: IconProps) { return <Svg {...p}><path d="M8 2l5 1.8v4c0 3-2.1 4.9-5 6.2-2.9-1.3-5-3.2-5-6.2v-4L8 2z" {...s} strokeWidth={1.4} /><path d="M5.8 8l1.6 1.6 2.8-3.2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconSliders(p: IconProps) { return <Svg {...p}><path d="M2.5 5h11M2.5 11h11" {...s} strokeWidth={1.4} /><circle cx="10" cy="5" r="1.8" fill="var(--card)" {...s} strokeWidth={1.4} /><circle cx="6" cy="11" r="1.8" fill="var(--card)" {...s} strokeWidth={1.4} /></Svg>; }
export function IconList(p: IconProps) { return <Svg {...p}><path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8" {...s} strokeWidth={1.5} /><circle cx="2.7" cy="4.5" r="1" {...f} /><circle cx="2.7" cy="8" r="1" {...f} /><circle cx="2.7" cy="11.5" r="1" {...f} /></Svg>; }
export function IconListNumbered(p: IconProps) { return <Svg {...p}><path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8" {...s} strokeWidth={1.4} /><path d="M2 4h1.2v1.2M2 5.2h1.4M2.2 7.6h1.2c.4 0 .5.5.2.8L2 9.8h1.6M2.1 11h1.3l-.7.9c.5 0 .8.3.8.7 0 .5-.4.8-.9.8-.3 0-.6-.1-.8-.3" {...s} strokeWidth={1} /></Svg>; }
export function IconTimeline(p: IconProps) { return <Svg {...p}><rect x="2" y="3.5" width="7" height="2.6" rx="1.3" {...f} /><rect x="5" y="7" width="9" height="2.6" rx="1.3" {...f} opacity=".55" /><rect x="3.5" y="10.5" width="5" height="2.6" rx="1.3" {...f} opacity=".35" /></Svg>; }
export function IconRoadmap(p: IconProps) { return <Svg {...p}><path d="M8 2.5L13.5 8 8 13.5 2.5 8 8 2.5z" {...s} strokeWidth={1.4} /></Svg>; }
export const IconMilestone = IconRoadmap;
export function IconTaskline(p: IconProps) { return <Svg {...p}><circle cx="3.5" cy="8" r="1.5" {...s} strokeWidth={1.4} /><path d="M5 8h5.5M8.5 5.5L11 8l-2.5 2.5" {...s} strokeWidth={1.4} /></Svg>; }
export function IconDoc(p: IconProps) { return <Svg {...p}><path d="M3.5 2.5h9M3.5 5.5h9M3.5 8.5h6M3.5 11.5h4" {...s} strokeWidth={1.4} /></Svg>; }
export function IconShare(p: IconProps) { return <Svg {...p}><circle cx="4" cy="8" r="1.7" {...s} strokeWidth={1.4} /><circle cx="12" cy="4" r="1.7" {...s} strokeWidth={1.4} /><circle cx="12" cy="12" r="1.7" {...s} strokeWidth={1.4} /><path d="M5.6 7.2l4.8-2.4M5.6 8.8l4.8 2.4" {...s} strokeWidth={1.4} /></Svg>; }
export function IconLogout(p: IconProps) { return <Svg {...p}><path d="M6 2.5H3.5v11H6M10 11l3-3-3-3M13 8H6.5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconMail(p: IconProps) { return <Svg {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.5" {...s} strokeWidth={1.4} /><path d="M2.5 4.5L8 9l5.5-4.5" {...s} strokeWidth={1.4} /></Svg>; }
export function IconMove(p: IconProps) { return <Svg {...p}><path d="M2.5 8h9M8.5 4.5L12 8l-3.5 3.5M13.5 3v10" {...s} strokeWidth={1.4} /></Svg>; }
export function IconArrowRight(p: IconProps) { return <Svg {...p}><path d="M2.5 8h9M8.5 4.5L12 8l-3.5 3.5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconArrowUp(p: IconProps) { return <Svg {...p}><path d="M8 12V3M4.5 6.5L8 3l3.5 3.5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconArrowDown(p: IconProps) { return <Svg {...p}><path d="M8 4v9M4.5 9.5L8 13l3.5-3.5" {...s} strokeWidth={1.5} /></Svg>; }
export const IconSort = IconArrowDown;
export function IconExpand(p: IconProps) { return <Svg {...p}><path d="M9.5 2.5h4v4M13.5 2.5L8.5 7.5M6.5 13.5h-4v-4M2.5 13.5l5-5" {...s} strokeWidth={1.5} /></Svg>; }
export function IconExternal(p: IconProps) { return <Svg {...p}><path d="M9.5 2.5h4v4M13.5 2.5L8.5 7.5" {...s} strokeWidth={1.4} /><path d="M6.5 3.5H3.5v9h9v-3" {...s} strokeWidth={1.4} /></Svg>; }
export const IconLink = IconExternal;
export function IconAttachment(p: IconProps) { return <Svg {...p}><path d="M11 7l-3.8 3.8a2 2 0 1 1-2.8-2.8L9 3.4a1.5 1.5 0 1 1 2.1 2.1L7 9.6" {...s} strokeWidth={1.3} /></Svg>; }
export function IconComment(p: IconProps) { return <Svg {...p}><path d="M2.5 3.5h11v7h-6L4 13.2V10.5H2.5v-7z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconTrash(p: IconProps) { return <Svg {...p}><path d="M3 4.5h10M6.5 4V3h3v1M4.7 4.5l.6 8.5h5.4l.6-8.5" {...s} strokeWidth={1.4} /></Svg>; }
export function IconCopy(p: IconProps) { return <Svg {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" {...s} strokeWidth={1.4} /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconEye(p: IconProps) { return <Svg {...p}><path d="M1.8 8s2.2-4 6.2-4 6.2 4 6.2 4-2.2 4-6.2 4-6.2-4-6.2-4z" {...s} strokeWidth={1.4} /><circle cx="8" cy="8" r="1.8" {...s} strokeWidth={1.4} /></Svg>; }
export function IconEyeOff(p: IconProps) { return <Svg {...p}><path d="M2 2l12 12M5.2 5.4A6.6 6.6 0 0 0 1.8 8s2.2 4 6.2 4c1 0 1.9-.2 2.7-.6M6.8 4.2c.4-.1.8-.2 1.2-.2 4 0 6.2 4 6.2 4a10 10 0 0 1-1.8 2.2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconLock(p: IconProps) { return <Svg {...p}><rect x="3" y="6.5" width="10" height="7" rx="1.5" {...s} strokeWidth={1.4} /><path d="M5.5 6.5v-2a2.5 2.5 0 0 1 5 0v2" {...s} strokeWidth={1.4} /></Svg>; }
export function IconUpload(p: IconProps) { return <Svg {...p}><path d="M8 10V2.5M5 5l3-3 3 3M3 13.5h10" {...s} strokeWidth={1.5} /></Svg>; }
export function IconDownload(p: IconProps) { return <Svg {...p}><path d="M8 2.5V10M4.5 6.5L8 10l3.5-3.5M3 13.5h10" {...s} strokeWidth={1.5} /></Svg>; }
export function IconFilter(p: IconProps) { return <Svg {...p}><path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" {...s} strokeWidth={1.5} /></Svg>; }
export function IconColumns(p: IconProps) { return <Svg {...p}><rect x="2.5" y="3" width="11" height="10" rx="1.5" {...s} strokeWidth={1.4} /><path d="M6.5 3v10M10.5 3v10" {...s} strokeWidth={1.4} /></Svg>; }
export function IconTable(p: IconProps) { return <Svg {...p}><rect x="2.5" y="3" width="11" height="10" rx="1.5" {...s} strokeWidth={1.4} /><path d="M2.5 6.5h11M6.5 3v10M10.5 3v10" {...s} strokeWidth={1.4} /></Svg>; }
export function IconDensity(p: IconProps) { return <Svg {...p}><path d="M3 4.5h10M3 8h10M3 11.5h10" {...s} strokeWidth={1.5} /></Svg>; }
export function IconGroup(p: IconProps) { return <Svg {...p}><rect x="3" y="3.5" width="10" height="3.5" rx="1" {...s} strokeWidth={1.4} /><rect x="3" y="9" width="10" height="3.5" rx="1" {...s} strokeWidth={1.4} /></Svg>; }
export function IconTag(p: IconProps) { return <Svg {...p}><path d="M2.5 8V2.5H8L13.5 8 8 13.5 2.5 8z" {...s} strokeWidth={1.4} /><circle cx="5.5" cy="5.5" r="1" {...f} /></Svg>; }
export function IconFolder(p: IconProps) { return <Svg {...p}><path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h2.5l1.5 1.5H12A1.5 1.5 0 0 1 13.5 6v5A1.5 1.5 0 0 1 12 12.5H4A1.5 1.5 0 0 1 2.5 11v-6.5z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconImage(p: IconProps) { return <Svg {...p}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" {...s} strokeWidth={1.3} /><path d="M2.5 10l3-3 2.5 2.5L11 6.5l2.5 2.5" {...s} strokeWidth={1.3} /><circle cx="6" cy="6" r=".9" {...f} /></Svg>; }
export function IconWarning(p: IconProps) { return <Svg {...p}><path d="M8 2.6l5.8 10.4H2.2L8 2.6z" {...s} strokeWidth={1.5} /><path d="M8 6.8v2.6" {...s} strokeWidth={1.5} /><circle cx="8" cy="11.4" r=".9" {...f} /></Svg>; }
export function IconInfo(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="6.2" {...s} strokeWidth={1.5} /><path d="M8 7v3.5" {...s} strokeWidth={1.5} /><circle cx="8" cy="4.9" r=".9" {...f} /></Svg>; }
export function IconSend(p: IconProps) { return <Svg {...p}><path d="M2.5 8l11-5-3 11-2.5-4.5L2.5 8z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconPhone(p: IconProps) { return <Svg {...p}><path d="M3.5 2.5h2.4l1.2 3-1.6 1.2a9.5 9.5 0 0 0 3.8 3.8l1.2-1.6 3 1.2v2.4a1 1 0 0 1-1.1 1A11.5 11.5 0 0 1 2.5 3.6a1 1 0 0 1 1-1.1z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconUndo(p: IconProps) { return <Svg {...p}><path d="M6.5 3.5L3 7l3.5 3.5M3 7h7a3 3 0 0 1 0 6H8" {...s} strokeWidth={1.4} /></Svg>; }
export function IconMonitor(p: IconProps) { return <Svg {...p}><rect x="2" y="3" width="12" height="8.5" rx="1.5" {...s} strokeWidth={1.4} /><path d="M5.5 14h5" {...s} strokeWidth={1.4} /></Svg>; }
export function IconSun(p: IconProps) { return <Svg {...p}><circle cx="8" cy="8" r="3.2" {...s} strokeWidth={1.4} /><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" {...s} strokeWidth={1.4} /></Svg>; }
export function IconPlay(p: IconProps) { return <Svg {...p}><path d="M5 3.5v9l7-4.5-7-4.5z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconPause(p: IconProps) { return <Svg {...p}><rect x="4" y="3.5" width="3" height="9" rx="1" {...f} /><rect x="9" y="3.5" width="3" height="9" rx="1" {...f} /></Svg>; }
export function IconStop(p: IconProps) { return <Svg {...p}><rect x="4" y="4" width="8" height="8" rx="1" {...f} /></Svg>; }
export function IconCursor(p: IconProps) { return <Svg {...p}><path d="M3 2.5l4.5 10 1.4-4.1 4.1-1.4-10-4.5z" {...s} strokeWidth={1.4} /></Svg>; }
export function IconPen(p: IconProps) { return <Svg {...p}><path d="M2.5 12.5c2-4 4.5-8 6-9.5a1.6 1.6 0 0 1 2.3 2.3c-1.5 1.5-5.5 4-8.3 7.2z" {...s} strokeWidth={1.4} /></Svg>; }
