import type { NotefyRoom } from "../types";

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.innerText || doc.body.textContent || "").trim();
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  if (typeof DOMParser === "undefined") return htmlToPlainText(html);

  const doc = new DOMParser().parseFromString(html, "text/html");

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    switch (tag) {
      case "h1":
        return `# ${inner.trim()}\n\n`;
      case "h2":
        return `## ${inner.trim()}\n\n`;
      case "h3":
        return `### ${inner.trim()}\n\n`;
      case "p":
        return inner.trim() ? `${inner}\n\n` : "\n";
      case "br":
        return "\n";
      case "strong":
      case "b":
        return `**${inner}**`;
      case "em":
      case "i":
        return `*${inner}*`;
      case "u":
        return `<u>${inner}</u>`;
      case "s":
      case "del":
        return `~~${inner}~~`;
      case "code":
        return el.parentElement?.tagName.toLowerCase() === "pre" ? inner : `\`${inner}\``;
      case "pre":
        return `\`\`\`\n${el.textContent?.trimEnd() ?? ""}\n\`\`\`\n\n`;
      case "blockquote":
        return (
          inner
            .trim()
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n") + "\n\n"
        );
      case "hr":
        return `---\n\n`;
      case "ul": {
        const isTask = el.getAttribute("data-type") === "taskList";
        const items = Array.from(el.children)
          .map((li) => {
            if (isTask) {
              const checked = li.getAttribute("data-checked") === "true";
              const text = walk(li).trim().replace(/\n+/g, " ");
              return `- [${checked ? "x" : " "}] ${text}`;
            }
            return `- ${walk(li).trim().replace(/\n+/g, "\n  ")}`;
          })
          .join("\n");
        return `${items}\n\n`;
      }
      case "ol": {
        const items = Array.from(el.children)
          .map((li, idx) => `${idx + 1}. ${walk(li).trim().replace(/\n+/g, "\n   ")}`)
          .join("\n");
        return `${items}\n\n`;
      }
      case "li":
        return inner;
      case "label":
      case "input":
        return "";
      case "a": {
        const href = el.getAttribute("href");
        return href ? `[${inner}](${href})` : inner;
      }
      default:
        return inner;
    }
  };

  return walk(doc.body)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isRichHtmlEmpty(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}

export function formatRoomAsMarkdown(room: NotefyRoom): string {
  const lines: string[] = [];
  const heading = room.title.trim() || room.displayCode;
  lines.push(`# ${heading}`);
  lines.push(`> Code: \`${room.displayCode}\` · Exported ${new Date().toLocaleString()}`);
  lines.push("");

  const padMd = htmlToMarkdown(room.padContent);
  if (padMd) {
    lines.push(padMd);
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function formatRoomAsPlainText(room: NotefyRoom): string {
  const lines: string[] = [];
  const heading = room.title.trim() || room.displayCode;
  lines.push(heading);
  lines.push("=".repeat(Math.min(48, heading.length)));
  lines.push("");

  const padPlain = htmlToPlainText(room.padContent);
  if (padPlain) {
    lines.push(padPlain);
  }

  return lines.join("\n").trim() + "\n";
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function makeSafeFilename(room: NotefyRoom, ext: "md" | "txt"): string {
  const base = (room.title.trim() || room.displayCode || "notefy")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "notefy-note"}.${ext}`;
}
