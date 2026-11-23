import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { encryptClientE2ee, isE2eePayload } from "../lib/e2ee";
import {
  cacheRoomSnapshot,
  clearPendingRoomSync,
  deleteOfflineDraft,
  getCachedRoomSnapshot,
  listOfflineDrafts,
  listPendingRoomSyncs,
} from "../lib/offlineStore";
import { useNotefyUi } from "../lib/uiContext";

export function OfflineSyncManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const createFromDraft = useMutation(api.rooms.createFromDraft);
  const updateTitle = useMutation(api.rooms.updateTitle);
  const updatePad = useMutation(api.rooms.updatePad);

  const {
    isOnline,
    touchRecentRoom,
    forgetRecentRoom,
    getRoomSession,
    getRoomE2ee,
    bumpOfflineVersion,
    pushToast,
  } = useNotefyUi();

  const syncingRef = useRef(false);
  const promptedUpdateRef = useRef(false);
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Register Service Worker & show a non-intrusive update toast when a new build is ready
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh || promptedUpdateRef.current) return;
    promptedUpdateRef.current = true;
    pushToast("Update available for Notefy", {
      durationMs: 12000,
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
    });
  }, [needRefresh, updateServiceWorker, pushToast]);

  // Flush offline drafts & queued room edits whenever connectivity is online
  useEffect(() => {
    if (!isOnline) return;
    if (syncingRef.current) return;

    const drafts = listOfflineDrafts();
    const pendingEdits = listPendingRoomSyncs();
    if (drafts.length === 0 && pendingEdits.length === 0) return;

    syncingRef.current = true;

    void (async () => {
      let syncedDrafts = 0;
      let lastDraftCode = "";
      let syncedEdits = 0;

      // 1. Promote offline local drafts to real server-allocated 4-char notes
      for (const draft of drafts) {
        try {
          const created = await createFromDraft({
            title: draft.title,
            padContent: draft.padContent,
          });
          cacheRoomSnapshot(created);
          forgetRecentRoom(draft.draftId);
          touchRecentRoom(created);
          deleteOfflineDraft(draft.draftId);
          syncedDrafts++;
          lastDraftCode = created.displayCode;

          if (pathnameRef.current.toLowerCase() === `/${draft.draftId.toLowerCase()}`) {
            navigate(`/${created.displayCode}`, { replace: true });
          }
        } catch {
          // Keep draft locally and retry on next reconnect
        }
      }

      // 2. Push queued edits for existing synced rooms
      for (const item of pendingEdits) {
        try {
          const roomId = item.roomId as Id<"rooms">;
          const sessionToken = getRoomSession(item.roomId);
          const e2eeKey = getRoomE2ee(item.roomId);
          const cached = getCachedRoomSnapshot(item.code);
          const shouldEncrypt = Boolean(cached?.hasPin && cached?.pinScope === "all" && e2eeKey);

          if (item.title !== undefined) {
            const payload =
              shouldEncrypt && e2eeKey && !isE2eePayload(item.title)
                ? await encryptClientE2ee(item.title.trim(), e2eeKey)
                : item.title;
            await updateTitle({ roomId, title: payload, sessionToken });
          }

          if (item.padContent !== undefined) {
            const payload =
              shouldEncrypt && e2eeKey && !isE2eePayload(item.padContent)
                ? await encryptClientE2ee(item.padContent, e2eeKey)
                : item.padContent;
            await updatePad({ roomId, padContent: payload, sessionToken });
          }

          clearPendingRoomSync(item.roomId);
          syncedEdits++;
        } catch {
          // Keep queued edit to retry later (or until PIN unlocked)
        }
      }

      if (syncedDrafts > 0 || syncedEdits > 0) {
        bumpOfflineVersion();
        if (syncedDrafts === 1 && syncedEdits === 0) {
          pushToast(`Synced offline note · Code ${lastDraftCode}`);
        } else {
          const total = syncedDrafts + syncedEdits;
          pushToast(`Back online · Synced ${total} ${total === 1 ? "note" : "notes"}`);
        }
      }
    })().finally(() => {
      syncingRef.current = false;
    });
  }, [
    isOnline,
    createFromDraft,
    updateTitle,
    updatePad,
    touchRecentRoom,
    forgetRecentRoom,
    getRoomSession,
    getRoomE2ee,
    bumpOfflineVersion,
    pushToast,
    navigate,
  ]);

  return null;
}
