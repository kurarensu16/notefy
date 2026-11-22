import QRCode from "qrcode";

export interface BrandedQrCardOptions {
  url: string;
  code: string;
  title: string;
  modeLabel: "EDIT & SYNC" | "READ-ONLY VIEW";
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/**
 * Renders a crisp, high-resolution stationery-styled Notefy QR Card as a PNG Blob.
 */
export async function renderBrandedQrCardBlob(options: BrandedQrCardOptions): Promise<Blob> {
  const width = 760;
  const height = 940;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // 1. Warm paper outer canvas
  ctx.fillStyle = "#F7F6F2";
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural dot grid
  ctx.fillStyle = "rgba(24, 23, 21, 0.055)";
  for (let gx = 24; gx < width; gx += 26) {
    for (let gy = 24; gy < height; gy += 26) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. White stationery inner card
  const cardX = 48;
  const cardY = 48;
  const cardW = width - 96;
  const cardH = height - 96;

  ctx.save();
  ctx.shadowColor = "rgba(24, 23, 21, 0.08)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.strokeStyle = "#E5E1D8";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Brand mark + Mode pill
  const headerY = cardY + 52;
  // Mint square mark
  drawRoundedRect(ctx, cardX + 44, headerY - 22, 42, 42, 12);
  ctx.fillStyle = "#0F766E";
  ctx.fill();

  // Simple white notepad lines inside mark
  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, cardX + 54, headerY - 12, 22, 22, 4);
  ctx.fill();
  ctx.fillStyle = "#0F766E";
  ctx.fillRect(ctx.canvas.width ? cardX + 58 : 0, headerY - 6, 14, 2.5);
  ctx.fillRect(cardX + 58, headerY - 1, 10, 2.5);
  ctx.fillRect(cardX + 58, headerY + 4, 12, 2.5);

  ctx.fillStyle = "#181715";
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Notefy", cardX + 98, headerY);

  // Mode badge on right
  ctx.font = '700 14px "JetBrains Mono", ui-monospace, monospace';
  const badgeText = options.modeLabel;
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeX = cardX + cardW - 44 - badgeW;
  drawRoundedRect(ctx, badgeX, headerY - 16, badgeW, 32, 16);
  ctx.fillStyle = "#CCFBF1";
  ctx.fill();
  ctx.fillStyle = "#115E59";
  ctx.textAlign = "center";
  ctx.fillText(badgeText, badgeX + badgeW / 2, headerY + 0.5);

  // 4. Note Title
  const titleText = options.title.trim() || "Shared Note";
  ctx.fillStyle = "#181715";
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textAlign = "center";
  const fittedTitle = truncateText(ctx, titleText, cardW - 96);
  ctx.fillText(fittedTitle, width / 2, cardY + 138);

  // 5. QR Code framed cleanly
  const qrSize = 420;
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, options.url, {
    width: qrSize,
    margin: 2,
    color: { dark: "#181715", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });

  const qrBoxSize = qrSize + 36;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = cardY + 180;

  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E5E1D8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.drawImage(qrCanvas, qrBoxX + 18, qrBoxY + 18, qrSize, qrSize);

  // 6. Access Code Pill
  const codeSectionY = qrBoxY + qrBoxSize + 44;
  ctx.fillStyle = "#8A8478";
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("SCAN QR OR ENTER ACCESS CODE", width / 2, codeSectionY);

  const codeDisplay = options.code.length <= 6
    ? options.code.toUpperCase().split("").join(" ")
    : options.code;
  ctx.font = '700 40px "JetBrains Mono", ui-monospace, monospace';
  const codePillW = Math.min(cardW - 96, Math.max(240, ctx.measureText(codeDisplay).width + 64));
  const codePillX = (width - codePillW) / 2;
  const codePillY = codeSectionY + 24;

  drawRoundedRect(ctx, codePillX, codePillY, codePillW, 74, 20);
  ctx.fillStyle = "#EEFBF7";
  ctx.fill();
  ctx.strokeStyle = "#A7E8D5";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#0F766E";
  ctx.fillText(truncateText(ctx, codeDisplay, codePillW - 36), width / 2, codePillY + 38);

  // 7. Clean URL footer
  const cleanUrl = options.url.replace(/^https?:\/\//i, "");
  ctx.fillStyle = "#5C584F";
  ctx.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(truncateText(ctx, cleanUrl, cardW - 96), width / 2, codePillY + 114);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode QR card PNG"));
    }, "image/png");
  });
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      typeof ClipboardItem !== "undefined"
    ) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    }
  } catch {
    // Fallback / unsupported
  }
  return false;
}
