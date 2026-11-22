import { useEffect } from "react";

export function useDocumentMeta(title: string, options?: { noIndex?: boolean }) {
  const noIndex = options?.noIndex ?? false;

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = noIndex ? "noindex, nofollow, noarchive" : "index, follow";
  }, [noIndex]);
}
