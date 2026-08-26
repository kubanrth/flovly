import { CircleDot, Flag, Hash, ListChecks, Type as TypeIcon } from "lucide-react";
import type { FieldType } from "@/lib/table-fields";
import {
  IconAttachment,
  IconCalendar,
  IconContacts,
  IconDoc,
  IconLink,
  IconMail,
  IconPhone,
  IconRecent,
  IconRoadmap,
  IconStar,
  IconTag,
  IconTodo,
} from "@/components/ui/icons";

// Header/type icons — v5 glyphs where they exist, lucide (1.5 stroke) for the rest.
export function FieldTypeIcon({ type, size = 12, className }: { type: FieldType; size?: number; className?: string }) {
  const p = { width: size, height: size, className };
  const l = { size, strokeWidth: 1.5, className };
  switch (type) {
    case "TEXT": return <TypeIcon {...l} />;
    case "LONG_TEXT": return <IconDoc {...p} />;
    case "NUMBER":
    case "AUTO_NUMBER": return <Hash {...l} />;
    case "DATE": return <IconCalendar {...p} />;
    case "CHECKBOX": return <IconTodo {...p} />;
    case "SINGLE_SELECT": return <CircleDot {...l} />;
    case "MULTI_SELECT": return <ListChecks {...l} />;
    case "URL": return <IconLink {...p} />;
    case "EMAIL": return <IconMail {...p} />;
    case "PHONE": return <IconPhone {...p} />;
    case "RATING": return <IconStar {...p} />;
    case "USER": return <IconContacts {...p} />;
    case "ATTACHMENT": return <IconAttachment {...p} />;
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME": return <IconRecent {...p} />;
  }
}

export function BuiltinColumnIcon({ id, size = 12, className }: { id: string; size?: number; className?: string }) {
  const p = { width: size, height: size, className };
  switch (id) {
    case "title": return <TypeIcon size={size} strokeWidth={1.5} className={className} />;
    case "statusColumnId": return <CircleDot size={size} strokeWidth={1.5} className={className} />;
    case "priority": return <Flag size={size} strokeWidth={1.5} className={className} />;
    case "assignees": return <IconContacts {...p} />;
    case "tags": return <IconTag {...p} />;
    case "startAt":
    case "stopAt": return <IconCalendar {...p} />;
    case "attachments": return <IconAttachment {...p} />;
    case "milestone": return <IconRoadmap {...p} />;
    default: return null;
  }
}
