export interface CompressedImageResult {
  filename: string;
  publicPath: string;
  base64: string;
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

function slugifyStem(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, '');
  const slug = withoutExt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return slug || 'anh';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function compressImageFile(
  file: File,
  options: { maxDimension?: number; quality?: number; preservePng?: boolean } = {}
): Promise<CompressedImageResult> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.84;
  const isPng = file.type === 'image/png';
  const keepPng = Boolean(options.preservePng && isPng);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được tệp ảnh. Vui lòng thử ảnh JPG, PNG hoặc WebP.'));
      el.src = objectUrl;
    });

    let targetW = img.naturalWidth || img.width;
    let targetH = img.naturalHeight || img.height;

    if (targetW > maxDimension || targetH > maxDimension) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * maxDimension) / targetW);
        targetW = maxDimension;
      } else {
        targetW = Math.round((targetW * maxDimension) / targetH);
        targetH = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh Canvas.');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer WebP (or PNG for transparent logos), fallback to JPEG if browser lacks WebP encoder
    let mime = keepPng ? 'image/png' : 'image/webp';
    let dataUrl = canvas.toDataURL(mime, keepPng ? undefined : quality);
    if (!keepPng && !dataUrl.startsWith('data:image/webp')) {
      mime = 'image/jpeg';
      dataUrl = canvas.toDataURL(mime, quality);
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const base64 = dataUrl.split(',')[1] || '';
    const compressedBytes = Math.round((base64.length * 3) / 4);
    const stamp = Date.now().toString(36).slice(-5);
    const filename = `${slugifyStem(file.name)}-${stamp}.${ext}`;

    return {
      filename,
      publicPath: `/images/${filename}`,
      base64,
      dataUrl,
      originalBytes: file.size,
      compressedBytes,
      width: targetW,
      height: targetH,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
