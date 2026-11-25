import QRCode from 'qrcode';
import type { CmsData, DayKey } from '../data/types';

export interface PosterExportOptions {
  /** ISO date string (YYYY-MM-DD) for Monday of the week */
  weekStartDate: string;
  /** Whether to show DD/MM next to day labels (e.g. T.Hai · 09/11) */
  showDates: boolean;
  /** Whether to render the two bottom-left QR codes */
  showQrCodes: boolean;
  /** Short single-line address shown at bottom-right */
  footerAddress: string;
  /** Preview URL resolver for logo image */
  logoSrc: string;
}

const POSTER_W = 1920;
const POSTER_H = 1080;

const DAY_COLUMNS: Array<{ key: DayKey; label: string }> = [
  { key: 'mon', label: 'T.Hai' },
  { key: 'tue', label: 'T.Ba' },
  { key: 'wed', label: 'T.Tư' },
  { key: 'thu', label: 'T.Năm' },
  { key: 'fri', label: 'T.Sáu' },
  { key: 'sat', label: 'T.Bảy' },
  { key: 'sun', label: 'C.Nhật' },
];

export function getDefaultMondayIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
  // If today is Sunday, default to tomorrow (upcoming Monday); otherwise Monday of current week
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeToMonday(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  const base =
    parts.length === 3 && !parts.some(Number.isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
}

export function formatDayMonth(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

export function buildPosterFilename(weekStartDate: string, showDates: boolean): string {
  if (!showDates || !weekStartDate) {
    return `lich-tap-power-yoga-${new Date().toISOString().slice(0, 10)}.png`;
  }
  const mon = normalizeToMonday(weekStartDate);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return `lich-tap-power-yoga-${fmt(mon)}-den-${fmt(sun)}.png`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current) {
    // Append remaining words onto the last line and truncate cleanly if needed
    const usedCount = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const remaining = words.slice(usedCount).join(' ');
    let last = remaining || current;
    while (ctx.measureText(last).width > maxWidth && last.length > 3) {
      last = `${last.slice(0, -2)}…`;
    }
    lines.push(last);
  }
  return lines.slice(0, maxLines);
}

async function generateQrCanvas(url: string, size: number): Promise<HTMLCanvasElement | null> {
  const safeUrl = (url || '').trim();
  if (!safeUrl) return null;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, safeUrl, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#181614',
      light: '#FFFFFF',
    },
  });
  return qrCanvas;
}

function drawFooterIconPin(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = '#D9536F';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 5.5, Math.PI, 0);
  ctx.lineTo(cx, cy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFooterIconPhone(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = '#C94B57';
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 2.4, cy - 2.4);
  ctx.quadraticCurveTo(cx - 2.6, cy + 2.4, cx + 2.4, cy + 2.4);
  ctx.stroke();
  ctx.restore();
}

function drawFooterIconGlobe(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = '#3B82C4';
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 3.2, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.stroke();
  ctx.restore();
}

export async function renderSchedulePosterCanvas(
  data: CmsData,
  options: PosterExportOptions
): Promise<HTMLCanvasElement> {
  // Ensure web fonts (Cormorant Garamond & Be Vietnam Pro) are loaded before painting
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D.');

  const sec = data.scheduleSection;
  const site = data.site;
  const slots = sec.slots;

  // 1. Background (warm off-white linen matching official fanpage poster)
  ctx.fillStyle = '#F3F0E9';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // 2. Subtitle pale horizontal ribbon across the canvas (under title & logo)
  ctx.fillStyle = '#E8E4DC';
  ctx.fillRect(0, 102, POSTER_W, 34);

  // 3. Top-left Poster Title ("Lịch Tập Tuần")
  ctx.fillStyle = '#2B2824';
  ctx.font = '700 80px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(sec.posterTitle || 'Lịch Tập Tuần', 88, 79);

  // 4. Subtitle text inside the ribbon
  ctx.fillStyle = '#4B463F';
  ctx.font = '500 22px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const subtitleUpper = (sec.posterSubtitle || '').toUpperCase();
  ctx.fillText(subtitleUpper, 88, 120, 1460);

  // 5. Top-right official Power Yoga Logo
  const logoImg = await loadImage(options.logoSrc || site.logoImage);
  if (logoImg) {
    const maxLogoW = 240;
    const maxLogoH = 128;
    const ratio = Math.min(maxLogoW / logoImg.naturalWidth, maxLogoH / logoImg.naturalHeight);
    const drawW = logoImg.naturalWidth * ratio;
    const drawH = logoImg.naturalHeight * ratio;
    const drawX = POSTER_W - 88 - drawW;
    const drawY = 10 + (maxLogoH - drawH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
  }

  // 6. Timetable Grid Geometry
  const leftMargin = 88;
  const rightMargin = 88;
  const timeColW = 206;
  const timeGap = 16;
  const colGap = 14;
  const gridLeft = leftMargin + timeColW + timeGap;
  const gridWidth = POSTER_W - rightMargin - gridLeft;
  const dayColW = (gridWidth - colGap * 6) / 7;

  // 7. Day Header Pills (7 olive-sage rounded bars)
  const headerY = 152;
  const headerH = 64;
  const monday = normalizeToMonday(options.weekStartDate);

  DAY_COLUMNS.forEach((col, i) => {
    const x = gridLeft + i * (dayColW + colGap);
    drawRoundedRect(ctx, x, headerY, dayColW, headerH, 12);
    ctx.fillStyle = '#6A725E';
    ctx.fill();

    let labelText = col.label;
    if (options.showDates) {
      const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      labelText = `${col.label} · ${formatDayMonth(dt)}`;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '500 21px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x + dayColW / 2, headerY + headerH / 2 + 1, dayColW - 16);
  });

  // 8. Time Slot Rows
  const rowsTop = 232;
  const rowsBottom = options.showQrCodes ? 892 : 990;
  const availableH = rowsBottom - rowsTop;
  const slotCount = Math.max(slots.length, 1);
  const rowGap = slotCount <= 6 ? 14 : 10;
  const rowH = Math.min(110, (availableH - rowGap * (slotCount - 1)) / slotCount);
  const compactScale = rowH < 88 ? rowH / 96 : 1;

  slots.forEach((slot, rowIdx) => {
    const y = rowsTop + rowIdx * (rowH + rowGap);

    // Left time pill (taupe-khaki centered vertically in row)
    const pillH = Math.min(48, rowH * 0.56);
    const pillY = y + (rowH - pillH) / 2;
    drawRoundedRect(ctx, leftMargin, pillY, timeColW, pillH, 10);
    ctx.fillStyle = '#AAA393';
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `500 ${Math.round(20 * compactScale)}px "Be Vietnam Pro", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.time, leftMargin + timeColW / 2, pillY + pillH / 2 + 1, timeColW - 14);

    // 7 Day cells
    const byDay = new Map(slot.sessions.map((s) => [s.dayKey, s]));
    DAY_COLUMNS.forEach((col, colIdx) => {
      const x = gridLeft + colIdx * (dayColW + colGap);
      const sess = byDay.get(col.key);

      drawRoundedRect(ctx, x, y, dayColW, rowH, 14);
      if (sess?.special) {
        ctx.fillStyle = '#E5E2DC';
        ctx.fill();
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#5E5A53';
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = 'rgba(36, 31, 27, 0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (!sess) return;

      // Measure & stack text lines cleanly centered inside card
      const maxTextW = dayColW - 18;
      const viFontSize = Math.round(17.2 * compactScale);
      const enFontSize = Math.round(16 * compactScale);
      const teacherFontSize = Math.round(15.5 * compactScale);
      const lineStep = Math.round(21 * compactScale);

      ctx.font = `700 ${viFontSize}px "Be Vietnam Pro", system-ui, sans-serif`;
      const viLines = wrapLines(ctx, sess.titleVi || '', maxTextW, 2);

      ctx.font = `600 ${enFontSize}px "Be Vietnam Pro", system-ui, sans-serif`;
      const enLines = sess.titleEn ? wrapLines(ctx, sess.titleEn, maxTextW, 1) : [];

      const teacherLine = (sess.teacher || '').trim();
      const totalLines = viLines.length + enLines.length + (teacherLine ? 1 : 0);
      const blockH = (totalLines - 1) * lineStep;
      let cursorY = y + rowH / 2 - blockH / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Line(s) 1: Vietnamese title
      ctx.fillStyle = '#25221E';
      ctx.font = `700 ${viFontSize}px "Be Vietnam Pro", system-ui, sans-serif`;
      for (const line of viLines) {
        ctx.fillText(line, x + dayColW / 2, cursorY, maxTextW);
        cursorY += lineStep;
      }

      // Line 2: English title
      if (enLines.length) {
        ctx.fillStyle = '#332F2A';
        ctx.font = `600 ${enFontSize}px "Be Vietnam Pro", system-ui, sans-serif`;
        for (const line of enLines) {
          ctx.fillText(line, x + dayColW / 2, cursorY, maxTextW);
          cursorY += lineStep;
        }
      }

      // Line 3: Teacher name (italic muted grey-brown)
      if (teacherLine) {
        ctx.fillStyle = '#8A8378';
        ctx.font = `italic 500 ${teacherFontSize}px "Be Vietnam Pro", system-ui, sans-serif`;
        ctx.fillText(teacherLine, x + dayColW / 2, cursorY + 1, maxTextW);
      }
    });
  });

  // 9. Footer Divider
  if (options.showQrCodes) {
    ctx.strokeStyle = '#E5E0D6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(88, 906);
    ctx.lineTo(POSTER_W - 88, 906);
    ctx.stroke();

    // Two real scannable QR codes (Consult Form + Google Maps)
    const qrSize = 136;
    const qrY = 922;

    const [qrConsult, qrMaps] = await Promise.all([
      generateQrCanvas(site.contact.consultFormUrl || site.contact.zaloHref, qrSize),
      generateQrCanvas(site.contact.googleMapsUrl, qrSize),
    ]);

    // QR 1: Phiếu đăng ký tư vấn
    if (qrConsult) {
      const qr1X = 122;
      drawRoundedRect(ctx, qr1X - 4, qrY - 4, qrSize + 8, qrSize + 8, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(qrConsult, qr1X, qrY, qrSize, qrSize);

      const textX = qr1X + qrSize + 24;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#24211D';
      ctx.font = '500 22px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('PHIẾU ĐĂNG', textX, qrY + 10);
      ctx.fillText('KÝ TƯ VẤN', textX, qrY + 39);
      ctx.font = '700 24px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('POWER', textX, qrY + 70);
      ctx.fillText('YOGA', textX, qrY + 99);
    }

    // QR 2: Đường đến Power Yoga
    if (qrMaps) {
      const qr2X = 514;
      drawRoundedRect(ctx, qr2X - 4, qrY - 4, qrSize + 8, qrSize + 8, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(qrMaps, qr2X, qrY, qrSize, qrSize);

      const textX = qr2X + qrSize + 24;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#24211D';
      ctx.font = '500 22px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('ĐƯỜNG ĐẾN', textX, qrY + 26);
      ctx.font = '700 24px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('POWER', textX, qrY + 58);
      ctx.fillText('YOGA', textX, qrY + 88);
    }
  }

  // 10. Bottom-right Single Info Strip (Address · Phone · Brand)
  const infoY = 1046;
  ctx.font = '500 16px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const brandText = site.name || 'Power Yoga Đồng Nai';
  const phoneText = site.contact.phoneDisplay || '0847 684 539';
  const addrText = (options.footerAddress || site.address.streetAddress || site.address.current).trim();

  const sep = '   ·   ';
  const brandW = ctx.measureText(brandText).width;
  const phoneW = ctx.measureText(phoneText).width;
  const addrW = ctx.measureText(addrText).width;
  const sepW = ctx.measureText(sep).width;
  const iconSpace = 20;

  const totalInfoW =
    iconSpace + addrW + sepW + iconSpace + phoneW + sepW + iconSpace + brandW;
  let infoX = POSTER_W - rightMargin - totalInfoW;

  // Address
  drawFooterIconPin(ctx, infoX + 7, infoY);
  infoX += iconSpace;
  ctx.fillStyle = '#38342E';
  ctx.fillText(addrText, infoX, infoY);
  infoX += addrW;

  ctx.fillStyle = '#9C9488';
  ctx.fillText(sep, infoX, infoY);
  infoX += sepW;

  // Phone
  drawFooterIconPhone(ctx, infoX + 7, infoY);
  infoX += iconSpace;
  ctx.fillStyle = '#38342E';
  ctx.fillText(phoneText, infoX, infoY);
  infoX += phoneW;

  ctx.fillStyle = '#9C9488';
  ctx.fillText(sep, infoX, infoY);
  infoX += sepW;

  // Brand
  drawFooterIconGlobe(ctx, infoX + 7, infoY);
  infoX += iconSpace;
  ctx.fillStyle = '#38342E';
  ctx.fillText(brandText, infoX, infoY);

  return canvas;
}
