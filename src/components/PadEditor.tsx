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
  Code,
  CodeBlock,
  Copy,
  ListBullets,
  ListNumbers,
  Minus,
  Printer,
  Quotes,
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

interface PadEditorProps {
  value: string;
  updatedAt: number | null;
  readOnly?: boolean;
  presenterScale?: boolean;
  onChange?: (nextHtml: string) => void;
  onCopied?: () => void;
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
        if (!disabled) onClick();
      }}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-35 ${
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
  onChange,
  onCopied,
}: PadEditorProps) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [plainText, setPlainText] = useState(() => htmlToPlainText(value));
  const saveTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
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

  return (
    <div className="notefy-print-surface flex flex-1 flex-col bg-[var(--bg-surface)]">
      {/* Full-Width Flush Formatting Toolbar (Edit mode only) */}
      {!readOnly && editor && (
        <div className="print-hidden sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/75 px-4 py-1.5 backdrop-blur-md sm:px-6">
          <div className="flex flex-wrap items-center gap-0.5">
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

            <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

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

            <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

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
            <ToolbarButton
              title="Checklist"
              active={editor.isActive("taskList")}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <CheckSquare size={16} weight={editor.isActive("taskList") ? "fill" : "regular"} />
            </ToolbarButton>

            <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

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

            <span className="mx-1 hidden h-4 w-px bg-[var(--border-subtle)] sm:inline-block" />

            <div className="hidden items-center gap-0.5 sm:flex">
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
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
        </div>
      )}

      {/* Expansive Full-Width Writing Canvas */}
      <div
        onClick={() => {
          if (!readOnly && editor && !editor.isFocused) {
            editor.chain().focus().run();
          }
        }}
        className={`animate-fade-in flex-1 px-5 py-7 sm:px-10 lg:px-14 xl:px-16 ${readOnly ? "" : "cursor-text"}`}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Flush Bottom Status Bar */}
      <div className="print-hidden sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-5 py-2 text-[11px] text-[var(--text-muted)] backdrop-blur-sm sm:px-8">
        <div className="flex items-center gap-2 font-mono">
          {readOnly ? (
            <span>{updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : "Read-only"}</span>
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
              {copied ? <Check size={13} weight="bold" className="text-[var(--accent-primary)]" /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
