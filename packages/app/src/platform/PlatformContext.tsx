import type { ICodePlatformApi } from "@icode/platform";
import { createContext, useContext, type ReactNode } from "react";

const PlatformContext = createContext<ICodePlatformApi | null>(null);

export function PlatformProvider({
  api,
  children,
}: {
  api: ICodePlatformApi;
  children: ReactNode;
}) {
  return <PlatformContext.Provider value={api}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const api = useContext(PlatformContext);
  if (!api) throw new Error("PlatformProvider is missing");
  return api;
}
