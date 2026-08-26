"use client";

import type { ReactNode } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { CheckMark } from "./checkbox";
import { IconCheck, IconChevronRight } from "./icons";
import { POPUP_CLASS, POPUP_ITEM_CLASS } from "./popover";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuPortal = MenuPrimitive.Portal;
export const MenuGroup = MenuPrimitive.Group;
export const MenuSub = MenuPrimitive.SubmenuRoot;
export const MenuRadioGroup = MenuPrimitive.RadioGroup;

export type MenuContentProps = MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

export function MenuContent({ className, side = "bottom", align = "start", sideOffset = 4, alignOffset = 0, ...props }: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} className="z-[100] outline-none">
        <MenuPrimitive.Popup data-slot="menu-content" className={cn(POPUP_CLASS, "min-w-[224px] p-1", className)} {...props} />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const ITEM = cn(POPUP_ITEM_CLASS, "[&_svg]:text-muted-foreground");

export interface MenuItemProps extends MenuPrimitive.Item.Props {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
}

export function MenuItem({ icon, shortcut, destructive, className, children, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item className={cn(ITEM, destructive && "text-danger-text [&_svg]:text-danger-text", className)} {...props}>
      {icon}
      {children}
      {shortcut && <span className="ml-auto pl-4 font-mono text-[10px] text-n-500">{shortcut}</span>}
    </MenuPrimitive.Item>
  );
}

export function MenuSubTrigger({ icon, className, children, ...props }: MenuPrimitive.SubmenuTrigger.Props & { icon?: ReactNode }) {
  return (
    <MenuPrimitive.SubmenuTrigger className={cn(ITEM, "data-popup-open:bg-n-100", className)} {...props}>
      {icon}
      {children}
      <IconChevronRight width={12} height={12} className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function MenuSubContent(props: MenuContentProps) {
  return <MenuContent side="inline-end" align="start" sideOffset={0} alignOffset={-4} {...props} />;
}

export function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return <MenuPrimitive.Separator className={cn("mx-1.5 my-1 h-px bg-n-100", className)} {...props} />;
}

export function MenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return <MenuPrimitive.GroupLabel className={cn("eyebrow px-2 pt-2 pb-1", className)} {...props} />;
}

export function MenuCheckboxItem({ className, children, ...props }: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(ITEM, "group", className)} {...props}>
      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-n-400 bg-card text-white group-data-checked:border-control-on group-data-checked:bg-control-on">
        <MenuPrimitive.CheckboxItemIndicator><CheckMark /></MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function MenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem className={cn(ITEM, className)} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className="ml-auto text-success"><IconCheck width={14} height={14} /></MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

// Aliasy zgodne z poprzednim (shadcn) API.
export {
  Menu as DropdownMenu, MenuTrigger as DropdownMenuTrigger, MenuPortal as DropdownMenuPortal, MenuContent as DropdownMenuContent,
  MenuGroup as DropdownMenuGroup, MenuLabel as DropdownMenuLabel, MenuItem as DropdownMenuItem, MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuRadioGroup as DropdownMenuRadioGroup, MenuRadioItem as DropdownMenuRadioItem, MenuSeparator as DropdownMenuSeparator,
  MenuSub as DropdownMenuSub, MenuSubTrigger as DropdownMenuSubTrigger, MenuSubContent as DropdownMenuSubContent,
};
