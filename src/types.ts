export type RoomExpiryMode = "never" | "24h" | "7d";
export type PinScope = "edit" | "all";
export type ThemeMode = "light" | "dark";

export interface NotefyRoom {
  id: string;
  code: string;
  displayCode: string;
  title: string;
  padContent: string;
  padUpdatedAt: number | null;
  readOnlyEnabled: boolean;
  readOnlyCode: string;
  hasPin: boolean;
  pinScope: PinScope;
  roomExpiryMode: RoomExpiryMode;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DeletedRoomSnapshot {
  code: string;
  displayCode: string;
  title: string;
  padContent: string;
  readOnlyEnabled: boolean;
  readOnlyCode: string;
}

export interface PresenceMember {
  clientId: string;
  deviceLabel: string;
  mode: "edit" | "view";
  lastSeenAt: number;
}

export interface RecentRoom {
  code: string;
  displayCode: string;
  title: string;
  visitedAt: number;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone?: "default" | "accent" | "burn" | "danger";
  durationMs?: number;
  action?: ToastAction;
}
