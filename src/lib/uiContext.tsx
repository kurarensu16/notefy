import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { NotefyRoom, RecentRoom, ThemeMode, ToastAction, ToastMessage } from "../types";
import {
  applyTheme,
  clearBrowserSessionState,
  clearRoomE2eeKey,
  clearRoomSessionToken,
  getInitialTheme,
  getRecentRooms,
  getRoomE2eeKey,
  getRoomSessionToken,
  recordRecentRoom,
  removeRecentRoom,
  setRoomE2eeKey,
  setRoomSessionToken,
} from "./clientState";

interface NotefyUiValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  toasts: ToastMessage[];
  pushToast: (
    text: string,
    options?: { tone?: ToastMessage["tone"]; durationMs?: number; action?: ToastAction }
  ) => void;
  dismissToast: (id: string) => void;
  recentRooms: RecentRoom[];
  touchRecentRoom: (room: Pick<NotefyRoom, "code" | "displayCode" | "title">) => void;
  forgetRecentRoom: (code: string) => void;
  clearLocalState: () => void;
  sessionVersion: number;
  getRoomSession: (roomId: string) => string | undefined;
  saveRoomSession: (roomId: string, token: string) => void;
  clearRoomSession: (roomId: string) => void;
  getRoomE2ee: (roomId: string) => string | undefined;
  saveRoomE2ee: (roomId: string, keyB64: string) => void;
  clearRoomE2ee: (roomId: string) => void;
}

const NotefyUiContext = createContext<NotefyUiValue | null>(null);

export function NotefyUiProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => getRecentRooms());
  const [sessionVersion, setSessionVersion] = useState(0);
  const toastTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (
      text: string,
      options?: { tone?: ToastMessage["tone"]; durationMs?: number; action?: ToastAction }
    ) => {
      const id = `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const durationMs = options?.durationMs ?? (options?.action ? 5000 : 2800);
      setToasts((prev) => [
        ...prev.slice(-3),
        { id, text, tone: options?.tone ?? "default", durationMs, action: options?.action },
      ]);
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        toastTimers.current.delete(id);
      }, durationMs);
      toastTimers.current.set(id, timer);
    },
    []
  );

  const touchRecentRoom = useCallback(
    (room: Pick<NotefyRoom, "code" | "displayCode" | "title">) => {
      setRecentRooms(
        recordRecentRoom({
          code: room.code,
          displayCode: room.displayCode,
          title: room.title,
        })
      );
    },
    []
  );

  const forgetRecentRoom = useCallback((code: string) => {
    setRecentRooms(removeRecentRoom(code));
  }, []);

  const clearLocalState = useCallback(() => {
    clearBrowserSessionState();
    setRecentRooms([]);
    setSessionVersion((v) => v + 1);
  }, []);

  const getRoomSession = useCallback(
    (roomId: string): string | undefined => {
      void sessionVersion;
      return getRoomSessionToken(roomId) ?? undefined;
    },
    [sessionVersion]
  );

  const saveRoomSession = useCallback((roomId: string, token: string) => {
    setRoomSessionToken(roomId, token);
    setSessionVersion((v) => v + 1);
  }, []);

  const clearRoomSession = useCallback((roomId: string) => {
    clearRoomSessionToken(roomId);
    setSessionVersion((v) => v + 1);
  }, []);

  const getRoomE2ee = useCallback(
    (roomId: string): string | undefined => {
      void sessionVersion;
      return getRoomE2eeKey(roomId) ?? undefined;
    },
    [sessionVersion]
  );

  const saveRoomE2ee = useCallback((roomId: string, keyB64: string) => {
    setRoomE2eeKey(roomId, keyB64);
    setSessionVersion((v) => v + 1);
  }, []);

  const clearRoomE2ee = useCallback((roomId: string) => {
    clearRoomE2eeKey(roomId);
    setSessionVersion((v) => v + 1);
  }, []);

  const value = useMemo<NotefyUiValue>(
    () => ({
      theme,
      toggleTheme,
      toasts,
      pushToast,
      dismissToast,
      recentRooms,
      touchRecentRoom,
      forgetRecentRoom,
      clearLocalState,
      sessionVersion,
      getRoomSession,
      saveRoomSession,
      clearRoomSession,
      getRoomE2ee,
      saveRoomE2ee,
      clearRoomE2ee,
    }),
    [
      theme,
      toggleTheme,
      toasts,
      pushToast,
      dismissToast,
      recentRooms,
      touchRecentRoom,
      forgetRecentRoom,
      clearLocalState,
      sessionVersion,
      getRoomSession,
      saveRoomSession,
      clearRoomSession,
      getRoomE2ee,
      saveRoomE2ee,
      clearRoomE2ee,
    ]
  );

  return <NotefyUiContext.Provider value={value}>{children}</NotefyUiContext.Provider>;
}

export function useNotefyUi(): NotefyUiValue {
  const ctx = useContext(NotefyUiContext);
  if (!ctx) {
    throw new Error("useNotefyUi must be used within NotefyUiProvider");
  }
  return ctx;
}
