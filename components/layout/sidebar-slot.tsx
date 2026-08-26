"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// The slot element is static once the shell has mounted, so subscribing is a
// no-op; useSyncExternalStore just gives us "null on the server, the node on
// the client" without a setState-in-effect round trip.
const subscribe = () => () => {};
const getHost = () => document.querySelector("[data-ui=sidebar-slot]");
const getServerHost = () => null;

// Renders its children inside the app sidebar's `[data-ui=sidebar-slot]`, so a
// route can own a nav section (D4's „Widoczne w kalendarzu") without the shell
// having to know about routes.
export function SidebarSlot({ children }: { children: React.ReactNode }) {
  const host = useSyncExternalStore(subscribe, getHost, getServerHost);
  return host ? createPortal(children, host) : null;
}
