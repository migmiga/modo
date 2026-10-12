"use client";

import { useEffect } from "react";

import { LoginGateProvider } from "@/components/auth/LoginGateProvider";
import { useAppStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      useAppStore.getState().setHydrated();
    });
    useAppStore.persist.rehydrate();
    return unsub;
  }, []);

  return <LoginGateProvider>{children}</LoginGateProvider>;
}
