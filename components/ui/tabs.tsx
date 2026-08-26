"use client";

import type { ReactNode } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root className={cn("flex flex-col", className)} {...props} />;
}

export function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List className={cn("no-scrollbar flex gap-0.5 overflow-x-auto border-b border-border", className)} {...props} />;
}

export function Tab({ icon, count, className, children, ...props }: TabsPrimitive.Tab.Props & { icon?: ReactNode; count?: number }) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative inline-flex h-(--tabs) shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-sm font-medium text-muted-foreground outline-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 hover:text-foreground data-active:text-foreground data-active:after:bg-orange-500 data-disabled:text-n-400 [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && <Badge tone="gray">{count}</Badge>}
    </TabsPrimitive.Tab>
  );
}

export function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />;
}

export { Tab as TabsTrigger, TabsPanel as TabsContent };
