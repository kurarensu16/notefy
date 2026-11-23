import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Check,
  CheckSquare,
  CloudCheck,
  CloudSlash,
  Code,
  CodeBlock,
  Copy,
  ListBullets,
  ListNumbers,
  Minus,
  NotePencil,
  Printer,
  QrCode,
  Quotes,
  SidebarSimple,
  TextB,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "@phosphor-icons/react";
import { copyTextToClipboard } from "../lib/device";
import { htmlToPlainText } from "../lib/export";
import { formatRelativeTime } from "../lib/parsers";
import { Spinner } from "./ui/LoadingStates";

interface MobilePadActions {
  onOpenNotes: () => void;
  onOpenShare: () => void;
  onNewNote: () => void;
  creatingNote?: boolean;
}

interface PadEditorProps {
  value: string;
  updatedAt: number | null;
  readOnly?: boolean;
  presenterScale?: boolean;
  isOffline?: boolean;
  hasPendingSync?: boolean;
  onChange?: (nextHtml: string) => void;
  onCopied?: () => void;
  mobileActions?: MobilePadActions;
}

function normalizeInitialContent(raw: string): string {
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\r?\n\r?\n/)
    .map(
      (para) =>
        `<p>${para
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\r?\n/g, "<br>")}</p>`
    )
    .join("");
}

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        if (!disabled) onClick();
      }}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition active:scale-95 disabled:opacity-35 sm:h-8 sm:w-8 ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

export function PadEditor({
  value,
  updatedAt,
  readOnly = false,
  presenterScale = false,
  isOffline = false,
  hasPendingSync = false,
  onChange,
  onCopied,
  mobileActions,
}: PadEditorProps) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [plainText, setPlainText] = useState(() => htmlToPlainText(value));
  const saveTimerRef = useRef<number | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder:
          "Start typing… Use the toolbar or markdown shortcuts (# heading, **bold**, - list, [] checklist, ``` code)",
      }),
    ],
    content: normalizeInitialContent(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: `notefy-prose ${presenterScale ? "notefy-prose-presenter" : "min-h-full"}`,
      },
    },
    onFocus: () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
      setEditorFocused(true);
    },
    onBlur: () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = window.setTimeout(() => {
        setEditorFocused(false);
      }, 140);
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setPlainText(ed.getText());
      if (readOnly || !onChange) return;
      setSaving(true);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        lastEmittedRef.current = html;
        onChange(html);
        setSaving(false);
      }, 260);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    const normalized = normalizeInitialContent(value);
    if (editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
      setPlainText(editor.getText());
      lastEmittedRef.current = value;
    }
  }, [editor, value]);

  // Keep mobile keyboard accessory bar hugging the top of the virtual keyboard
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateOffset = () => {
      const offset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardOffset(offset > 40 ? offset : 0);
    };
    updateOffset();
    vv.addEventListener("resize", updateOffset);
    vv.addEventListener("scroll", updateOffset);
    return () => {
      vv.removeEventListener("resize", updateOffset);
      vv.removeEventListener("scroll", updateOffset);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  const handleCopyPad = async () => {
    const text = editor ? editor.getText().trim() : htmlToPlainText(value);
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const trimmed = plainText.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = plainText.length;

  if (presenterScale) {
    return <EditorContent editor={editor} />;
  }

  const renderFormattingControls = (mobileFirstUndo = false) =>
    editor && (
      <>
        {mobileFirstUndo && (
          <>
            <ToolbarButton
              title="Undo"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <ArrowUUpLeft size={16} />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <ArrowUUpRight size={16} />
            </ToolbarButton>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <ToolbarButton
              title="Checklist"
              active={editor.isActive("taskList")}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <CheckSquare size={17} weight={editor.isActive("taskList") ? "fill" : "regular"} />
            </ToolbarButton>
          </>
        )}

        <ToolbarButton
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <TextHOne size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <TextHTwo size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <TextHThree size={16} weight="bold" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        <ToolbarButton
          title="Bold (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextB size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <TextUnderline size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <TextStrikethrough size={16} weight="bold" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBullets size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers size={16} />
        </ToolbarButton>
        {!mobileFirstUndo && (
          <ToolbarButton
            title="Checklist"
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <CheckSquare size={16} weight={editor.isActive("taskList") ? "fill" : "regular"} />
          </ToolbarButton>
        )}

        <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        <ToolbarButton
          title="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Code block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeBlock size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={16} />
        </ToolbarButton>

        {!mobileFirstUndo && (
          <>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <ToolbarButton
              title="Undo (Ctrl+Z)"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <ArrowUUpLeft size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Redo (Ctrl+Shift+Z)"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <ArrowUUpRight size={15} />
            </ToolbarButton>
          </>
        )}
      </>
    );

  const showMobileIdleNav = Boolean(mobileActions) && keyboardOffset === 0;

  return (
    <div className="notefy-print-surface flex flex-1 flex-col bg-[var(--bg-surface)]">
      {/* Full-Width Flush Formatting Toolbar (Always visible: single swipeable row on mobile, wrapped on desktop) */}
      {!readOnly && editor && (
        <div className="print-hidden sticky top-14 z-20 flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 px-2.5 py-1.5 backdrop-blur-md sm:flex-wrap sm:px-6">
          <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
            {renderFormattingControls(false)}
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => window.print()}
              title="Print note"
              aria-label="Print note"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={handleCopyPad}
              disabled={!trimmed}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] active:scale-[0.98] disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check size={14} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy
                </>
              )}
            </button>
          </div>

          {editorFocused && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.commands.blur();
                setEditorFocused(false);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 text-xs font-semibold text-white shadow-2xs active:scale-95 sm:hidden dark:text-[#0d1f1d]"
            >
              <Check size={13} weight="bold" />
              Done
            </button>
          )}
        </div>
      )}

      {/* Expansive Full-Width Writing Canvas */}
      <div
        onClick={() => {
          if (!readOnly && editor && !editor.isFocused) {
            editor.chain().focus().run();
          }
        }}
        className={`animate-fade-in flex-1 px-4 pt-5 sm:px-10 sm:py-7 lg:px-14 xl:px-16 ${
          mobileActions ? "pb-24" : "pb-16"
        } ${readOnly ? "" : "cursor-text"}`}
      >
        <EditorContent editor={editor} className="h-full" />

        {/* Subtle inline mobile note metadata (only shown on phones in edit workspace) */}
        {mobileActions && (
          <div className="print-hidden mt-8 flex items-center justify-between border-t border-[var(--border-subtle)]/70 pt-3 font-mono text-[11px] text-[var(--text-muted)] sm:hidden">
            {isOffline || hasPendingSync ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--status-burn)]">
                <CloudSlash size={13} weight="duotone" />
                {isOffline ? "Offline · Saved locally" : "Pending sync…"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {saving ? (
                  <Spinner size={12} className="text-[var(--accent-primary)]" />
                ) : (
                  <CloudCheck size={13} weight="duotone" className="text-[var(--accent-primary)]" />
                )}
                {saving ? "Syncing…" : updatedAt ? `Saved ${formatRelativeTime(updatedAt)}` : "Ready"}
              </span>
            )}
            <span>
              {words} {words === 1 ? "word" : "words"}
            </span>
          </div>
        )}
      </div>

      {/* Desktop Sticky Bottom Status Bar (and mobile read-only status bar when no bottom navbar) */}
      <div
        className={`print-hidden sticky bottom-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] text-[var(--text-muted)] backdrop-blur-sm sm:flex sm:px-8 sm:py-2 ${
          mobileActions ? "hidden" : "flex"
        }`}
      >
        <div className="flex items-center gap-2 font-mono">
          {readOnly ? (
            <span>{updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : "Read-only"}</span>
          ) : isOffline || hasPendingSync ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--status-burn)]">
              <CloudSlash size={14} weight="duotone" />
              {isOffline
                ? "Offline · Saved locally (will sync when online)"
                : "Reconnecting · Syncing local edits…"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {saving ? (
                <Spinner size={13} className="text-[var(--accent-primary)]" />
              ) : (
                <CloudCheck
                  size={14}
                  weight="duotone"
                  className="animate-pop-in text-[var(--accent-primary)]"
                />
              )}
              {saving ? "Syncing…" : updatedAt ? `Saved ${formatRelativeTime(updatedAt)}` : "Ready"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span>
            {words} {words === 1 ? "word" : "words"} · {chars} chars
          </span>
          {readOnly && (
            <button
              type="button"
              onClick={handleCopyPad}
              disabled={!trimmed}
              className="inline-flex items-center gap-1 font-sans font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              {copied ? (
                <Check size={13} weight="bold" className="text-[var(--accent-primary)]" />
              ) : (
                <Copy size={13} />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Thumb-Zone Bottom Bar (Apple Notes style; hides automatically when keyboard opens) */}
      {showMobileIdleNav && mobileActions && (
        <nav
          aria-label="Note actions"
          className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/92 px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-4 items-center gap-1">
            <button
              type="button"
              onClick={mobileActions.onOpenNotes}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[var(--text-secondary)] transition active:scale-95 active:bg-[var(--bg-subtle)]"
            >
              <SidebarSimple size={20} weight="regular" />
              <span className="text-[10px] font-semibold">Notes</span>
            </button>

            <button
              type="button"
              onClick={mobileActions.onOpenShare}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[var(--text-secondary)] transition active:scale-95 active:bg-[var(--bg-subtle)]"
            >
              <QrCode size={20} weight="duotone" className="text-[var(--accent-primary)]" />
              <span className="text-[10px] font-semibold">Share</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPad}
              disabled={!trimmed}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[var(--text-secondary)] transition active:scale-95 active:bg-[var(--bg-subtle)] disabled:opacity-35"
            >
              {copied ? (
                <Check size={20} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
              ) : (
                <Copy size={20} weight="regular" />
              )}
              <span className="text-[10px] font-semibold">{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={mobileActions.onNewNote}
              disabled={mobileActions.creatingNote}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-[var(--accent-soft)] py-1.5 text-[var(--accent-soft-text)] transition active:scale-95 disabled:opacity-60"
            >
              {mobileActions.creatingNote ? (
                <Spinner size={19} />
              ) : (
                <NotePencil size={20} weight="duotone" />
              )}
              <span className="text-[10px] font-semibold">New</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
