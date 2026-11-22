import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, DownloadSimple, ImageSquare } from "@phosphor-icons/react";
import { copyPngBlobToClipboard, renderBrandedQrCardBlob } from "../lib/qrCard";
import { Spinner } from "./ui/LoadingStates";

interface QrCodeBoxProps {
  value: string;
  size?: number;
  filename?: string;
  showDownload?: boolean;
  /** Optional branded card metadata for Download PNG & Copy QR Image */
  brandedCard?: {
    code: string;
    title: string;
    modeLabel: "EDIT & SYNC" | "READ-ONLY VIEW";
  };
  onNotify?: (msg: string) => void;
  className?: string;
}

export function QrCodeBox({
  value,
  size = 216,
  filename = "notefy-qr.png",
  showDownload = true,
  brandedCard,
  onNotify,
  className = "",
}: QrCodeBoxProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [downloaded, setDownloaded] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [busyAction, setBusyAction] = useState<"download" | "copy" | null>(null);

  useEffect(() => {
    let active = true;
    setDataUrl("");
    QRCode.toDataURL(value, {
      width: Math.max(size * 2, 480),
      margin: 2,
      color: {
        dark: "#181715",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  const handleDownload = async () => {
    if (!dataUrl || busyAction) return;
    setBusyAction("download");
    try {
      if (brandedCard) {
        const blob = await renderBrandedQrCardBlob({
          url: value,
          code: brandedCard.code,
          title: brandedCard.title,
          modeLabel: brandedCard.modeLabel,
        });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setDownloaded(true);
      onNotify?.("Downloaded QR card PNG");
      window.setTimeout(() => setDownloaded(false), 1600);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyImage = async () => {
    if (!dataUrl || !brandedCard || busyAction) return;
    setBusyAction("copy");
    try {
      const blob = await renderBrandedQrCardBlob({
        url: value,
        code: brandedCard.code,
        title: brandedCard.title,
        modeLabel: brandedCard.modeLabel,
      });
      const ok = await copyPngBlobToClipboard(blob);
      if (ok) {
        setCopiedImg(true);
        onNotify?.("Copied QR card image to clipboard");
        window.setTimeout(() => setCopiedImg(false), 1600);
      } else {
        onNotify?.("Image copy requires HTTPS — try Save Card instead");
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div
        className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/8"
        style={{ width: size + 20, height: size + 20 }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code for ${value}`}
            width={size}
            height={size}
            className="animate-fade-in h-full w-full rounded-lg object-contain"
          />
        ) : (
          <div className="notefy-skeleton flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg text-xs text-stone-500">
            <Spinner size={20} className="text-[var(--accent-primary)]" />
          </div>
        )}
      </div>

      {showDownload && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!dataUrl || busyAction !== null}
            title="Download branded QR card PNG"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] active:scale-[0.98] disabled:opacity-50"
          >
            {busyAction === "download" ? (
              <Spinner size={13} />
            ) : downloaded ? (
              <Check size={13} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
            ) : (
              <DownloadSimple size={13} weight="regular" />
            )}
            <span>{downloaded ? "Saved" : "Save PNG"}</span>
          </button>

          {brandedCard && (
            <button
              type="button"
              onClick={() => void handleCopyImage()}
              disabled={!dataUrl || busyAction !== null}
              title="Copy QR card image to clipboard"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] active:scale-[0.98] disabled:opacity-50"
            >
              {busyAction === "copy" ? (
                <Spinner size={13} />
              ) : copiedImg ? (
                <Check size={13} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
              ) : (
                <ImageSquare size={13} weight="regular" />
              )}
              <span>{copiedImg ? "Copied" : "Copy QR"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
