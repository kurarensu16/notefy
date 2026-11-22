import { Menu, MenuContent, MenuItem, MenuItemIcon, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import { Copy, Export, FileMd, FileText, Printer } from "@phosphor-icons/react";
import type { NotefyRoom } from "../types";
import { copyTextToClipboard } from "../lib/device";
import {
  downloadTextFile,
  formatRoomAsMarkdown,
  formatRoomAsPlainText,
  makeSafeFilename,
} from "../lib/export";

interface ExportMenuProps {
  room: NotefyRoom;
  onNotify: (msg: string) => void;
  compact?: boolean;
}

export function ExportMenu({ room, onNotify, compact = false }: ExportMenuProps) {
  const handleAction = async (action: string) => {
    if (action === "copy-all") {
      const text = formatRoomAsPlainText(room);
      const ok = await copyTextToClipboard(text);
      onNotify(ok ? "Copied note to clipboard" : "Could not access clipboard");
      return;
    }
    if (action === "download-md") {
      const md = formatRoomAsMarkdown(room);
      downloadTextFile(makeSafeFilename(room, "md"), md, "text/markdown;charset=utf-8");
      onNotify("Downloaded Markdown (.md)");
      return;
    }
    if (action === "download-txt") {
      const txt = formatRoomAsPlainText(room);
      downloadTextFile(makeSafeFilename(room, "txt"), txt, "text/plain;charset=utf-8");
      onNotify("Downloaded Plain Text (.txt)");
      return;
    }
    if (action === "print") {
      window.print();
    }
  };

  return (
    <Menu onAction={handleAction}>
      <MenuTrigger
        aria-label="Export note"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
      >
        <Export size={16} weight="regular" className="text-[var(--text-secondary)]" />
        {!compact && <span className="hidden sm:inline">Export</span>}
      </MenuTrigger>

      <MenuContent
        align="end"
        sideOffset={6}
        className="min-w-48 origin-(--transform-origin) rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-sm shadow-xl shadow-black/10 transition-[opacity,scale] duration-150 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-96 data-ending-style:opacity-0 dark:shadow-black/45"
      >
        <MenuItem
          value="copy-all"
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)]"
        >
          <MenuItemIcon>
            <Copy size={15} weight="regular" className="text-[var(--text-secondary)]" />
          </MenuItemIcon>
          Copy all text
        </MenuItem>

        <MenuSeparator className="my-1 h-px bg-[var(--border-subtle)]" />

        <MenuItem
          value="download-md"
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)]"
        >
          <MenuItemIcon>
            <FileMd size={15} weight="duotone" className="text-[var(--accent-primary)]" />
          </MenuItemIcon>
          Download Markdown (.md)
        </MenuItem>

        <MenuItem
          value="download-txt"
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)]"
        >
          <MenuItemIcon>
            <FileText size={15} weight="regular" className="text-[var(--text-secondary)]" />
          </MenuItemIcon>
          Download Plain Text (.txt)
        </MenuItem>

        <MenuSeparator className="my-1 h-px bg-[var(--border-subtle)]" />

        <MenuItem
          value="print"
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)]"
        >
          <MenuItemIcon>
            <Printer size={15} weight="regular" className="text-[var(--text-secondary)]" />
          </MenuItemIcon>
          Print note
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
