"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
const TokenContext = createContext<RefObject<string> | null>(null);
/** Transient memory only: survives a locale switch, cleared on leaving activation. */
export function ActivationTokenProvider({ children }: { children: ReactNode }) {
  const token = useRef(""),
    pathname = usePathname();
  useEffect(() => {
    if (!/^\/(vi|en)\/activate\/?$/.test(pathname)) token.current = "";
  }, [pathname]);
  return (
    <TokenContext.Provider value={token}>{children}</TokenContext.Provider>
  );
}
export function useActivationToken() {
  const value = useContext(TokenContext);
  if (!value) throw new Error("Activation context unavailable");
  return value;
}
