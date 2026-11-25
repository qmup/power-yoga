import type {
  CmsData,
  DayKey,
  GalleryLayout,
  ScheduleSession,
  ScheduleSlot,
  SeniorBenefit,
  YogaClassTemplate,
} from '../data/types';
import { compressImageFile, formatBytes, type CompressedImageResult } from './admin-image-utils';
import {
  buildPosterFilename,
  getDefaultMondayIso,
  renderSchedulePosterCanvas,
} from './schedule-poster-export';

interface MediaFileItem {
  name: string;
  path: string;
  previewUrl: string;
  size: number;
}

interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  usingDevFallback: boolean;
  authConfigured: boolean;
  storageMode: 'github' | 'local' | 'unconfigured';
  repo: string | null;
  branch: string;
}

type TabId = 'schedule' | 'teachers' | 'gallery' | 'hero' | 'benefits' | 'pricing' | 'site';

const DAYS: Array<{ key: DayKey; short: string; full: string }> = [
  { key: 'mon', short: 'T.Hai', full: 'Thứ 2' },
  { key: 'tue', short: 'T.Ba', full: 'Thứ 3' },
  { key: 'wed', short: 'T.Tư', full: 'Thứ 4' },
  { key: 'thu', short: 'T.Năm', full: 'Thứ 5' },
  { key: 'fri', short: 'T.Sáu', full: 'Thứ 6' },
  { key: 'sat', short: 'T.Bảy', full: 'Thứ 7' },
  { key: 'sun', short: 'C.Nhật', full: 'Chủ Nhật' },
];

const TABS: Array<{ id: TabId; label: string; desc: string }> = [
  { id: 'schedule', label: 'Thời khóa biểu', desc: 'Lịch tập tuần & khung giờ' },
  { id: 'teachers', label: 'Giáo viên', desc: 'Master Ấn Độ & phiên dịch' },
  { id: 'gallery', label: 'Hình ảnh & Kho ảnh', desc: 'Thư viện ảnh & tải ảnh mới' },
  { id: 'hero', label: 'Đầu trang & Triết lý', desc: 'Banner chính, chỉ số & câu dẫn' },
  { id: 'benefits', label: 'Lợi ích & Không gian', desc: 'Trị liệu tuổi hưu & 4 chương' },
  { id: 'pricing', label: 'Ưu đãi, Đánh giá & FAQ', desc: 'Học phí, cảm nhận & hỏi đáp' },
  { id: 'site', label: 'Liên hệ, Địa chỉ & SEO', desc: 'Hotline, Zalo, bản đồ, logo' },
];

const state: {
  session: SessionInfo | null;
  data: CmsData | null;
  media: MediaFileItem[];
  pendingUploads: Map<string, CompressedImageResult>; // key = publicPath (/images/xxx)
  deletedImages: Set<string>; // filenames only
  activeTab: TabId;
  scheduleSubTab: 'grid' | 'catalog';
  catalogSearch: string;
  isDirty: boolean;
  isPublishing: boolean;
  lastPublishMsg: { text: string; commitUrl?: string } | null;
  editingCell: { slotIdx: number; dayKey: DayKey } | null;
  imagePickerCallback: ((publicPath: string) => void) | null;
  posterModalOpen: boolean;
  posterWeekStart: string;
  posterShowDates: boolean;
  posterShowQr: boolean;
  posterFooterAddress: string;
  lastPosterCanvas: HTMLCanvasElement | null;
} = {
  session: null,
  data: null,
  media: [],
  pendingUploads: new Map(),
  deletedImages: new Set(),
  activeTab: 'schedule',
  scheduleSubTab: 'grid',
  catalogSearch: '',
  isDirty: false,
  isPublishing: false,
  lastPublishMsg: null,
  editingCell: null,
  imagePickerCallback: null,
  posterModalOpen: false,
  posterWeekStart: getDefaultMondayIso(),
  posterShowDates: true,
  posterShowQr: true,
  posterFooterAddress: '',
  lastPosterCanvas: null,
};

function slugifyClassId(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${base || 'lop'}-${Date.now().toString(36).slice(-4)}`;
}

function ensureClassCatalog(d: CmsData): YogaClassTemplate[] {
  if (!Array.isArray(d.scheduleSection.classCatalog)) {
    const seen = new Map<string, YogaClassTemplate>();
    for (const slot of d.scheduleSection.slots) {
      for (const sess of slot.sessions) {
        const key = `${sess.titleVi.trim().toLowerCase()}||${sess.titleEn.trim().toLowerCase()}`;
        if (!seen.has(key) && sess.titleVi.trim()) {
          seen.set(key, {
            id: slugifyClassId(sess.titleEn || sess.titleVi),
            titleVi: sess.titleVi.trim(),
            titleEn: sess.titleEn.trim(),
            defaultNote: sess.note?.trim() || '',
            defaultSeniorFriendly: Boolean(sess.seniorFriendly),
            ...(sess.special ? { defaultSpecial: true } : {}),
          });
        }
      }
    }
    d.scheduleSection.classCatalog = Array.from(seen.values());
  }
  return d.scheduleSection.classCatalog;
}

function findMatchingClassTemplate(catalog: YogaClassTemplate[], titleVi: string, titleEn: string): YogaClassTemplate | undefined {
  const vi = titleVi.trim().toLowerCase();
  const en = titleEn.trim().toLowerCase();
  if (!vi && !en) return undefined;
  return (
    catalog.find((c) => c.titleVi.trim().toLowerCase() === vi && c.titleEn.trim().toLowerCase() === en) ||
    catalog.find((c) => c.titleVi.trim().toLowerCase() === vi) ||
    (en ? catalog.find((c) => c.titleEn.trim().toLowerCase() === en) : undefined)
  );
}

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePreview(imagePath: string): string {
  if (!imagePath) return '';
  const pending = state.pendingUploads.get(imagePath);
  if (pending) return pending.dataUrl;
  const found = state.media.find((m) => m.path === imagePath);
  if (found) return found.previewUrl;
  return imagePath;
}

function markDirty() {
  state.isDirty = true;
  updateTopBarStatus();
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('admin-toast');
  if (!container) return;
  const colors =
    type === 'success'
      ? 'border-sage/30 bg-sage-dark text-ivory'
      : type === 'error'
        ? 'border-red-300 bg-red-700 text-white'
        : 'border-ink/15 bg-ink text-ivory';

  const el = document.createElement('div');
  el.className = `pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl transition-all duration-300 ${colors}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

function getAllReferencedImages(): Set<string> {
  const used = new Set<string>();
  const d = state.data;
  if (!d) return used;
  [
    d.site.logoImage,
    d.site.markImage,
    d.site.seo.ogImage,
    d.hero.primaryImage,
    d.hero.secondaryImage,
    d.benefitsSection.featuredImage,
    d.benefitsSection.consultImage,
  ].forEach((p) => p && used.add(p));
  d.storySection.chapters.forEach((c) => c.image && used.add(c.image));
  d.teachersSection.masters.forEach((m) => m.image && used.add(m.image));
  d.gallerySection.items.forEach((g) => g.image && used.add(g.image));
  return used;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let curr: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (curr[k] == null || typeof curr[k] !== 'object') {
      curr[k] = {};
    }
    curr = curr[k] as Record<string, unknown>;
  }
  curr[keys[keys.length - 1]] = value;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

// =========================================================================
// API CALLS
// =========================================================================

async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/admin/session', { cache: 'no-store' });
  return res.json();
}

async function loadCmsAndMedia() {
  const [contentRes, mediaRes] = await Promise.all([
    fetch('/api/admin/content', { cache: 'no-store' }),
    fetch('/api/admin/media', { cache: 'no-store' }),
  ]);

  if (contentRes.status === 401 || mediaRes.status === 401) {
    state.session = await fetchSession();
    renderApp();
    return;
  }

  const contentJson = await contentRes.json();
  const mediaJson = await mediaRes.json();

  if (!contentJson.ok) {
    throw new Error(contentJson.error || 'Không tải được dữ liệu nội dung');
  }
  state.data = contentJson.data as CmsData;
  ensureClassCatalog(state.data);
  state.media = mediaJson.ok ? (mediaJson.files as MediaFileItem[]) : [];
  state.isDirty = false;
  state.pendingUploads.clear();
  state.deletedImages.clear();
}

async function handleUploadImage(
  file: File,
  onReady: (publicPath: string) => void,
  options: { preservePng?: boolean; maxDimension?: number } = {}
) {
  try {
    showToast('Đang tối ưu & nén ảnh nhẹ cho web...', 'info');
    const result = await compressImageFile(file, options);
    state.pendingUploads.set(result.publicPath, result);
    state.deletedImages.delete(result.filename);
    onReady(result.publicPath);
    markDirty();
    showToast(
      `Đã chuẩn bị ảnh (${formatBytes(result.originalBytes)} → ${formatBytes(result.compressedBytes)}). Nhớ bấm "Xuất bản thay đổi" để lưu lên web.`,
      'success'
    );
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi xử lý ảnh', 'error');
  }
}

async function handlePublish(commitMessage?: string) {
  if (!state.data || state.isPublishing) return;
  state.isPublishing = true;
  updateTopBarStatus();

  try {
    const uploads = Array.from(state.pendingUploads.values()).map((u) => ({
      filename: u.filename,
      base64: u.base64,
    }));
    const deletedImages = Array.from(state.deletedImages.values());

    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: state.data,
        uploads,
        deletedImages,
        commitMessage,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Xuất bản thất bại');
    }

    // Refresh media library after publish
    const mediaRes = await fetch('/api/admin/media', { cache: 'no-store' });
    const mediaJson = await mediaRes.json();
    if (mediaJson.ok) {
      state.media = mediaJson.files;
    }

    state.pendingUploads.clear();
    state.deletedImages.clear();
    state.isDirty = false;
    state.lastPublishMsg =
      json.mode === 'github'
        ? {
            text: 'Đã lưu lên GitHub thành công! Website chính sẽ tự động cập nhật sau khoảng 30–60 giây.',
            commitUrl: json.commitUrl,
          }
        : {
            text: 'Đã lưu trực tiếp vào tệp dữ liệu cục bộ (chế độ phát triển).',
          };

    showToast('Xuất bản thay đổi thành công!', 'success');
    renderApp();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Có lỗi khi xuất bản', 'error');
  } finally {
    state.isPublishing = false;
    updateTopBarStatus();
  }
}

// =========================================================================
// REUSABLE FIELD TEMPLATES
// =========================================================================

function fieldInput(label: string, path: string, value: string, opts: { placeholder?: string; type?: string; hint?: string } = {}): string {
  return `
    <label class="block">
      <span class="block text-xs font-semibold text-ink-soft mb-1.5">${esc(label)}</span>
      <input
        type="${opts.type || 'text'}"
        data-bind="${esc(path)}"
        value="${esc(value)}"
        placeholder="${esc(opts.placeholder || '')}"
        class="w-full rounded-xl border border-ink/12 bg-ivory/60 px-3.5 py-2.5 text-sm text-ink transition focus:border-sage focus:bg-surface focus:outline-none"
      />
      ${opts.hint ? `<span class="mt-1 block text-[11px] text-ink-muted">${esc(opts.hint)}</span>` : ''}
    </label>
  `;
}

function fieldTextarea(label: string, path: string, value: string, rows = 3, hint = ''): string {
  return `
    <label class="block">
      <span class="block text-xs font-semibold text-ink-soft mb-1.5">${esc(label)}</span>
      <textarea
        rows="${rows}"
        data-bind="${esc(path)}"
        class="w-full rounded-xl border border-ink/12 bg-ivory/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink transition focus:border-sage focus:bg-surface focus:outline-none"
      >${esc(value)}</textarea>
      ${hint ? `<span class="mt-1 block text-[11px] text-ink-muted">${esc(hint)}</span>` : ''}
    </label>
  `;
}

function imageControl(label: string, path: string, currentImage: string, opts: { preservePng?: boolean; aspect?: string } = {}): string {
  const preview = resolvePreview(currentImage);
  return `
    <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-3.5">
      <p class="text-xs font-semibold text-ink-soft mb-2.5">${esc(label)}</p>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="${opts.aspect || 'h-24 w-36'} shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-cream">
          ${
            preview
              ? `<img src="${esc(preview)}" alt="" class="h-full w-full ${opts.preservePng ? 'object-contain p-2' : 'object-cover'}" />`
              : `<div class="flex h-full w-full items-center justify-center text-xs text-ink-muted">Chưa có ảnh</div>`
          }
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <p class="truncate text-xs font-mono text-ink-muted" title="${esc(currentImage)}">${esc(currentImage || '(trống)')}</p>
          <div class="flex flex-wrap gap-2">
            <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-sage">
              <span>↑ Tải ảnh mới</span>
              <input type="file" accept="image/*" class="hidden" data-upload-bind="${esc(path)}" data-preserve-png="${opts.preservePng ? '1' : '0'}" />
            </label>
            <button
              type="button"
              data-open-picker="${esc(path)}"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-ink/40"
            >
              Chọn từ kho ảnh
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// TAB RENDERERS
// =========================================================================

function renderClassCatalogManager(d: CmsData): string {
  const catalog = ensureClassCatalog(d);
  const query = state.catalogSearch.trim().toLowerCase();
  const filtered = catalog
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (!query) return true;
      return (
        item.titleVi.toLowerCase().includes(query) ||
        item.titleEn.toLowerCase().includes(query) ||
        (item.defaultNote || '').toLowerCase().includes(query)
      );
    });

  // Count usage of each template across schedule slots
  const usageCount = (item: YogaClassTemplate) => {
    const vi = item.titleVi.trim().toLowerCase();
    const en = item.titleEn.trim().toLowerCase();
    let count = 0;
    for (const slot of d.scheduleSection.slots) {
      for (const s of slot.sessions) {
        if (s.titleVi.trim().toLowerCase() === vi || (en && s.titleEn.trim().toLowerCase() === en)) {
          count++;
        }
      }
    }
    return count;
  };

  return `
    <div class="space-y-5">
      <!-- Quick Add New Yoga Class -->
      <div class="rounded-3xl border border-sage/25 bg-sage-soft/35 p-5 shadow-2xs sm:p-6">
        <h2 class="font-display text-2xl font-semibold text-ink">Thêm bài tập / lớp Yoga mới</h2>
        <p class="mt-0.5 text-xs text-ink-soft">
          Các bài tập lưu tại đây sẽ xuất hiện sẵn trong ô chọn (dropdown) khi xếp thời khóa biểu. Chọn tiếng Việt sẽ tự nhảy tiếng Anh và ngược lại.
        </p>

        <form id="add-class-catalog-form" class="mt-4 grid gap-3 sm:grid-cols-12">
          <label class="block sm:col-span-4">
            <span class="block text-xs font-semibold text-ink-soft mb-1">Tên bài tập (Tiếng Việt) *</span>
            <input name="titleVi" required placeholder="VD: Yoga Trị Liệu Cổ Vai Gáy" class="w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-sage focus:outline-none" />
          </label>
          <label class="block sm:col-span-4">
            <span class="block text-xs font-semibold text-ink-soft mb-1">Tên tiếng Anh / phụ *</span>
            <input name="titleEn" required placeholder="VD: Neck & Shoulder Therapy" class="w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-sage focus:outline-none" />
          </label>
          <label class="block sm:col-span-4">
            <span class="block text-xs font-semibold text-ink-soft mb-1">Ghi chú mặc định (tùy chọn)</span>
            <input name="defaultNote" placeholder="VD: Nhẹ nhàng, giảm đau mỏi vai gáy" class="w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-sage focus:outline-none" />
          </label>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-1 sm:col-span-12">
            <div class="flex flex-wrap items-center gap-4">
              <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                <input type="checkbox" name="defaultSeniorFriendly" checked class="h-4 w-4 accent-sage-dark" />
                <span>Mặc định: Nhẹ nhàng cho người lớn tuổi</span>
              </label>
              <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                <input type="checkbox" name="defaultSpecial" class="h-4 w-4 accent-clay" />
                <span>Mặc định: Lớp đặc biệt (viền nổi bật)</span>
              </label>
            </div>
            <button
              type="submit"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-5 py-2.5 text-xs font-semibold text-ivory shadow-xs transition hover:bg-sage"
            >
              + Thêm vào danh mục
            </button>
          </div>
        </form>
      </div>

      <!-- Saved Classes List -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 pb-4">
          <div>
            <h3 class="font-display text-2xl font-semibold text-ink">Danh sách bài tập đã lưu (${catalog.length} lớp)</h3>
            <p class="mt-0.5 text-xs text-ink-soft">Chỉnh sửa trực tiếp tên tiếng Việt, tiếng Anh hoặc ghi chú mặc định bên dưới.</p>
          </div>
          <input
            type="search"
            id="catalog-search-input"
            value="${esc(state.catalogSearch)}"
            placeholder="Tìm nhanh bài tập..."
            class="w-full rounded-full border border-ink/15 bg-ivory/70 px-4 py-2 text-xs text-ink focus:border-sage focus:bg-surface focus:outline-none sm:w-64"
          />
        </div>

        ${
          filtered.length === 0
            ? `<p class="py-8 text-center text-sm text-ink-muted">Không tìm thấy bài tập nào phù hợp.</p>`
            : `<div class="mt-4 space-y-3">
                ${filtered
                  .map(({ item, idx }) => {
                    const count = usageCount(item);
                    return `
                      <div class="rounded-2xl border border-ink/10 bg-ivory/45 p-3.5 sm:p-4">
                        <div class="grid gap-3 sm:grid-cols-12 sm:items-center">
                          <div class="sm:col-span-3">
                            <span class="block text-[11px] font-semibold text-ink-muted mb-1">Tên tiếng Việt</span>
                            <input
                              type="text"
                              value="${esc(item.titleVi)}"
                              data-catalog-field="titleVi"
                              data-catalog-idx="${idx}"
                              class="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-sage focus:outline-none"
                            />
                          </div>
                          <div class="sm:col-span-3">
                            <span class="block text-[11px] font-semibold text-ink-muted mb-1">Tên tiếng Anh / phụ</span>
                            <input
                              type="text"
                              value="${esc(item.titleEn)}"
                              data-catalog-field="titleEn"
                              data-catalog-idx="${idx}"
                              class="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm italic text-ink-soft focus:border-sage focus:outline-none"
                            />
                          </div>
                          <div class="sm:col-span-3">
                            <span class="block text-[11px] font-semibold text-ink-muted mb-1">Ghi chú mặc định</span>
                            <input
                              type="text"
                              value="${esc(item.defaultNote || '')}"
                              data-catalog-field="defaultNote"
                              data-catalog-idx="${idx}"
                              placeholder="Không có"
                              class="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2 text-xs text-ink-soft focus:border-sage focus:outline-none"
                            />
                          </div>
                          <div class="flex flex-wrap items-center justify-between gap-2 sm:col-span-3 sm:flex-col sm:items-end">
                            <div class="flex items-center gap-3">
                              <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink" title="Nhẹ nhàng cho cô chú">
                                <input type="checkbox" data-catalog-check="defaultSeniorFriendly" data-catalog-idx="${idx}" ${item.defaultSeniorFriendly ? 'checked' : ''} class="h-3.5 w-3.5 accent-sage-dark" />
                                <span>Nhẹ nhàng</span>
                              </label>
                              <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink" title="Lớp đặc biệt">
                                <input type="checkbox" data-catalog-check="defaultSpecial" data-catalog-idx="${idx}" ${item.defaultSpecial ? 'checked' : ''} class="h-3.5 w-3.5 accent-clay" />
                                <span>Đặc biệt</span>
                              </label>
                            </div>
                            <div class="flex items-center gap-2">
                              <span class="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">${count} ca/tuần</span>
                              <button
                                type="button"
                                data-action="delete-catalog-item"
                                data-index="${idx}"
                                class="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                              >Xóa</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>`
        }
      </div>
    </div>
  `;
}

function renderScheduleTab(d: CmsData): string {
  const sec = d.scheduleSection;
  const catalog = ensureClassCatalog(d);

  const subNav = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex rounded-full border border-ink/10 bg-surface p-1 shadow-2xs">
        <button
          type="button"
          data-schedule-subtab="grid"
          class="cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
            state.scheduleSubTab === 'grid'
              ? 'bg-sage-dark text-ivory shadow-2xs'
              : 'text-ink-soft hover:text-ink'
          }"
        >
          Bảng thời khóa biểu tuần
        </button>
        <button
          type="button"
          data-schedule-subtab="catalog"
          class="cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
            state.scheduleSubTab === 'catalog'
              ? 'bg-sage-dark text-ivory shadow-2xs'
              : 'text-ink-soft hover:text-ink'
          }"
        >
          Quản lý danh mục bài tập (${catalog.length})
        </button>
      </div>
    </div>
  `;

  if (state.scheduleSubTab === 'catalog') {
    return `
      <div class="space-y-5">
        ${subNav}
        ${renderClassCatalogManager(d)}
      </div>
    `;
  }

  return `
    <div class="space-y-6">
      ${subNav}

      <!-- Visual 7-Day Interactive Timetable -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 pb-4">
          <div>
            <h2 class="font-display text-2xl font-semibold text-ink">Bảng thời khóa biểu trực quan</h2>
            <p class="mt-0.5 text-xs text-ink-soft">Bấm trực tiếp vào từng ô (kể cả ô trống) để chọn bài tập từ danh mục, đổi giáo viên hoặc xóa lớp.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-action="open-poster-modal"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-clay/35 bg-clay-soft px-4 py-2 text-xs font-semibold text-clay transition hover:bg-clay hover:text-ivory"
            >
              <span>↓ Xuất ảnh đăng Fanpage</span>
            </button>
            <button
              type="button"
              data-schedule-subtab="catalog"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-ivory px-4 py-2 text-xs font-semibold text-ink transition hover:border-sage hover:text-sage-dark"
            >
              Danh mục bài tập (${catalog.length})
            </button>
            <button
              type="button"
              data-action="add-slot"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-sage"
            >
              + Thêm khung giờ mới
            </button>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto pb-2">
          <table class="w-full min-w-[920px] table-fixed border-separate border-spacing-1.5 text-center">
            <colgroup>
              <col class="w-[155px]" />
              ${DAYS.map(() => '<col />').join('')}
            </colgroup>
            <thead>
              <tr>
                <th class="rounded-xl bg-cream px-2 py-2 text-xs font-semibold text-ink-soft">Khung giờ</th>
                ${DAYS.map(
                  (day) => `
                  <th class="rounded-xl bg-sage-dark px-2 py-2 text-xs font-semibold text-ivory">${day.full}</th>
                `
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${sec.slots
                .map((slot, slotIdx) => {
                  const byDay = new Map(slot.sessions.map((s) => [s.dayKey, s]));
                  return `
                    <tr>
                      <td class="rounded-xl border border-ink/10 bg-cream/80 p-2 text-left align-middle">
                        <input
                          type="text"
                          value="${esc(slot.time)}"
                          data-slot-time="${slotIdx}"
                          aria-label="Khung giờ"
                          class="w-full rounded-lg border border-ink/12 bg-surface px-2 py-1 text-xs font-semibold text-ink"
                        />
                        <div class="mt-1.5 flex items-center gap-1">
                          <select
                            data-slot-period="${slotIdx}"
                            class="w-full rounded-lg border border-ink/12 bg-surface px-1.5 py-1 text-[11px] text-ink-soft"
                          >
                            <option value="morning-early" ${slot.period === 'morning-early' ? 'selected' : ''}>Sáng sớm</option>
                            <option value="morning" ${slot.period === 'morning' ? 'selected' : ''}>Buổi sáng</option>
                            <option value="afternoon" ${slot.period === 'afternoon' ? 'selected' : ''}>Chiều / Tối</option>
                          </select>
                        </div>
                        <div class="mt-1.5 flex items-center justify-between gap-1">
                          <input
                            type="text"
                            value="${esc(slot.periodLabel)}"
                            data-slot-label="${slotIdx}"
                            placeholder="Nhãn buổi"
                            class="w-full rounded-lg border border-ink/10 bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted"
                          />
                          <button
                            type="button"
                            data-action="delete-slot"
                            data-index="${slotIdx}"
                            title="Xóa khung giờ này"
                            class="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          >✕</button>
                        </div>
                      </td>
                      ${DAYS.map((day) => {
                        const sess = byDay.get(day.key);
                        if (!sess) {
                          return `
                            <td class="p-0 align-middle">
                              <button
                                type="button"
                                data-edit-cell="${slotIdx}:${day.key}"
                                class="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-ivory/60 px-1.5 text-xs text-ink-muted transition hover:border-sage hover:bg-sage-soft/50 hover:text-sage-dark"
                              >
                                <span class="text-base leading-none">+</span>
                                <span class="mt-1 text-[10px]">Thêm lớp</span>
                              </button>
                            </td>
                          `;
                        }
                        return `
                          <td class="p-0 align-middle">
                            <button
                              type="button"
                              data-edit-cell="${slotIdx}:${day.key}"
                              class="relative flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition hover:border-sage hover:ring-2 hover:ring-sage/25 ${
                                sess.special
                                  ? 'border-dashed border-clay/50 bg-clay-soft/60'
                                  : 'border-ink/10 bg-surface shadow-2xs'
                              }"
                            >
                              ${
                                sess.seniorFriendly
                                  ? '<span title="Nhẹ nhàng cho cô chú" class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sage"></span>'
                                  : ''
                              }
                              <span class="line-clamp-2 text-xs leading-tight font-semibold text-ink">${esc(sess.titleVi)}</span>
                              <span class="mt-0.5 line-clamp-1 text-[10.5px] italic text-ink-soft">${esc(sess.titleEn)}</span>
                              <span class="mt-1 line-clamp-1 text-[10.5px] font-medium text-clay">${esc(sess.teacher)}</span>
                            </button>
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Timetable Texts -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <h3 class="font-display text-xl font-semibold text-ink mb-4">Tiêu đề & Ghi chú mục Lịch tập</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          ${fieldInput('Nhãn nhỏ phía trên', 'scheduleSection.eyebrow', sec.eyebrow)}
          ${fieldInput('Tiêu đề bảng lịch (Poster)', 'scheduleSection.posterTitle', sec.posterTitle)}
          ${fieldInput('Tiêu đề lớn dòng 1', 'scheduleSection.titleLine1', sec.titleLine1)}
          ${fieldInput('Tiêu đề lớn dòng 2', 'scheduleSection.titleLine2', sec.titleLine2)}
        </div>
        <div class="mt-4 space-y-4">
          ${fieldTextarea('Mô tả ngắn bên phải tiêu đề', 'scheduleSection.description', sec.description, 2)}
          ${fieldInput('Dòng ưu đãi ngay dưới "Lịch Tập Tuần"', 'scheduleSection.posterSubtitle', sec.posterSubtitle)}
          ${fieldInput('Ghi chú dưới chân bảng lịch', 'scheduleSection.footerNote', sec.footerNote)}
          ${fieldInput('Tiêu đề khung kêu gọi cuối lịch tập', 'scheduleSection.bannerTitle', sec.bannerTitle)}
          ${fieldTextarea('Nội dung khung kêu gọi cuối lịch tập', 'scheduleSection.bannerDescription', sec.bannerDescription, 2)}
        </div>
      </div>
    </div>
  `;
}

function renderTeachersTab(d: CmsData): string {
  const sec = d.teachersSection;
  return `
    <div class="space-y-6">
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-display text-2xl font-semibold text-ink">Đội ngũ Giáo viên & Phiên dịch</h2>
            <p class="mt-0.5 text-xs text-ink-soft">Thêm mới, thay ảnh đại diện hoặc cập nhật thông tin Master Ấn Độ & phiên dịch viên.</p>
          </div>
          <button
            type="button"
            data-action="add-teacher"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-sage"
          >
            + Thêm giáo viên
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          ${fieldInput('Nhãn nhỏ phía trên', 'teachersSection.eyebrow', sec.eyebrow)}
          ${fieldInput('Tiêu đề dòng 1', 'teachersSection.titleLine1', sec.titleLine1)}
          ${fieldInput('Tiêu đề dòng 2', 'teachersSection.titleLine2', sec.titleLine2)}
        </div>
        <div class="mt-4">
          ${fieldTextarea('Mô tả mục giáo viên', 'teachersSection.description', sec.description, 2)}
        </div>
      </div>

      <div class="space-y-4">
        ${sec.masters
          .map(
            (master, idx) => `
          <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ink/8 pb-3 mb-4">
              <span class="text-sm font-semibold text-ink">Thành viên #${idx + 1}: ${esc(master.name || 'Chưa đặt tên')}</span>
              <div class="flex items-center gap-1.5">
                <button type="button" data-action="move-teacher-up" data-index="${idx}" ${idx === 0 ? 'disabled' : ''} class="cursor-pointer rounded-lg border border-ink/12 px-2.5 py-1 text-xs font-medium text-ink disabled:opacity-35">↑</button>
                <button type="button" data-action="move-teacher-down" data-index="${idx}" ${idx === sec.masters.length - 1 ? 'disabled' : ''} class="cursor-pointer rounded-lg border border-ink/12 px-2.5 py-1 text-xs font-medium text-ink disabled:opacity-35">↓</button>
                <button type="button" data-action="delete-teacher" data-index="${idx}" class="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Xóa</button>
              </div>
            </div>

            <div class="grid gap-5 lg:grid-cols-12">
              <div class="lg:col-span-5">
                ${imageControl('Ảnh giáo viên', `teachersSection.masters.${idx}.image`, master.image, { aspect: 'h-32 w-28' })}
                <div class="mt-3">
                  ${fieldInput('Mô tả ảnh (SEO Alt)', `teachersSection.masters.${idx}.imageAlt`, master.imageAlt)}
                </div>
              </div>
              <div class="space-y-3.5 lg:col-span-7">
                <div class="grid gap-3.5 sm:grid-cols-2">
                  ${fieldInput('Tên hiển thị', `teachersSection.masters.${idx}.name`, master.name)}
                  ${fieldInput('Vai trò / Chức danh', `teachersSection.masters.${idx}.role`, master.role)}
                </div>
                ${fieldInput('Chuyên môn (cách nhau bởi dấu ·)', `teachersSection.masters.${idx}.specialty`, master.specialty)}
                ${fieldTextarea('Giới thiệu chi tiết', `teachersSection.masters.${idx}.description`, master.description, 3)}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderGalleryTab(d: CmsData): string {
  const sec = d.gallerySection;
  const usedImages = getAllReferencedImages();
  const layoutLabels: Record<GalleryLayout, string> = {
    wide: 'Ảnh rộng (7/12 hàng)',
    medium: 'Ảnh vừa (5/12 hàng)',
    third: 'Ô 1/3 hàng (4/12)',
    full: 'Trải ngang toàn hàng (12/12)',
  };

  // Combine existing media + newly pending uploads
  const allMedia: Array<{ name: string; path: string; previewUrl: string; size: number; isNew?: boolean; isDeleted?: boolean }> = [
    ...Array.from(state.pendingUploads.values()).map((u) => ({
      name: u.filename,
      path: u.publicPath,
      previewUrl: u.dataUrl,
      size: u.compressedBytes,
      isNew: true,
    })),
    ...state.media
      .filter((m) => !state.pendingUploads.has(m.path))
      .map((m) => ({
        ...m,
        isDeleted: state.deletedImages.has(m.name),
      })),
  ];

  return `
    <div class="space-y-6">
      <!-- Gallery Section Header & Items -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-display text-2xl font-semibold text-ink">Thư viện ảnh thực tế trên trang chủ</h2>
            <p class="mt-0.5 text-xs text-ink-soft">Quản lý các ảnh hiển thị ở mục "Khoảnh khắc thực tế tại phòng tập".</p>
          </div>
          <button
            type="button"
            data-action="add-gallery"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-sage"
          >
            + Thêm ảnh vào thư viện
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          ${fieldInput('Nhãn nhỏ', 'gallerySection.eyebrow', sec.eyebrow)}
          ${fieldInput('Tiêu đề dòng 1', 'gallerySection.titleLine1', sec.titleLine1)}
          ${fieldInput('Tiêu đề dòng 2', 'gallerySection.titleLine2', sec.titleLine2)}
        </div>
        <div class="mt-3">
          ${fieldInput('Mô tả ngắn', 'gallerySection.description', sec.description)}
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          ${sec.items
            .map(
              (item, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/45 p-4 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-ink">Ảnh #${idx + 1}</span>
                <div class="flex items-center gap-1">
                  <button type="button" data-action="move-gallery-up" data-index="${idx}" ${idx === 0 ? 'disabled' : ''} class="cursor-pointer rounded-md border border-ink/12 bg-surface px-2 py-0.5 text-xs disabled:opacity-35">↑</button>
                  <button type="button" data-action="move-gallery-down" data-index="${idx}" ${idx === sec.items.length - 1 ? 'disabled' : ''} class="cursor-pointer rounded-md border border-ink/12 bg-surface px-2 py-0.5 text-xs disabled:opacity-35">↓</button>
                  <button type="button" data-action="delete-gallery" data-index="${idx}" class="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Xóa</button>
                </div>
              </div>
              ${imageControl('Hình ảnh', `gallerySection.items.${idx}.image`, item.image)}
              ${fieldInput('Chú thích hiển thị trên ảnh', `gallerySection.items.${idx}.caption`, item.caption)}
              <div class="grid gap-3 sm:grid-cols-2">
                ${fieldInput('Mô tả SEO (Alt)', `gallerySection.items.${idx}.alt`, item.alt)}
                <label class="block">
                  <span class="block text-xs font-semibold text-ink-soft mb-1.5">Kích thước khung</span>
                  <select
                    data-bind="gallerySection.items.${idx}.layout"
                    class="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2.5 text-sm text-ink"
                  >
                    ${(Object.keys(layoutLabels) as GalleryLayout[])
                      .map(
                        (k) => `<option value="${k}" ${item.layout === k ? 'selected' : ''}>${layoutLabels[k]}</option>`
                      )
                      .join('')}
                  </select>
                </label>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Shared Media Library -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="font-display text-2xl font-semibold text-ink">Kho ảnh chung của website (${allMedia.length} ảnh)</h3>
            <p class="mt-0.5 text-xs text-ink-soft">Ảnh tải lên được tự động nén nhẹ (~150KB) để web luôn tải nhanh trên điện thoại.</p>
          </div>
          <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-sage-dark">
            <span>↑ Tải thêm ảnh vào kho</span>
            <input type="file" accept="image/*" multiple class="hidden" data-bulk-upload />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          ${allMedia
            .map((m) => {
              const inUse = usedImages.has(m.path);
              return `
                <div class="overflow-hidden rounded-2xl border ${m.isDeleted ? 'border-red-300 opacity-50' : 'border-ink/10'} bg-ivory/50">
                  <div class="relative aspect-[4/3] bg-cream">
                    <img src="${esc(m.previewUrl)}" alt="${esc(m.name)}" loading="lazy" class="h-full w-full object-cover" />
                    <span class="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      m.isNew
                        ? 'bg-amber-600 text-white'
                        : inUse
                          ? 'bg-sage-dark text-ivory'
                          : 'bg-ink/70 text-ivory'
                    }">
                      ${m.isNew ? 'Ảnh mới' : inUse ? 'Đang dùng' : 'Chưa dùng'}
                    </span>
                  </div>
                  <div class="p-2.5">
                    <p class="truncate text-xs font-medium text-ink" title="${esc(m.name)}">${esc(m.name)}</p>
                    <div class="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-ink-muted">
                      <span>${formatBytes(m.size)}</span>
                      ${
                        !inUse && !m.isNew
                          ? `<button type="button" data-action="toggle-delete-media" data-filename="${esc(m.name)}" class="cursor-pointer font-semibold ${m.isDeleted ? 'text-sage-dark' : 'text-red-600'} hover:underline">${m.isDeleted ? 'Hoàn tác' : 'Xóa khỏi kho'}</button>`
                          : ''
                      }
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderHeroTab(d: CmsData): string {
  const h = d.hero;
  const m = d.manifesto;
  return `
    <div class="space-y-6">
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <h2 class="font-display text-2xl font-semibold text-ink">Phần mở đầu trang chủ (Hero)</h2>
        ${fieldInput('Dòng nhãn nhỏ phía trên tiêu đề', 'hero.badge', h.badge)}
        <div class="grid gap-4 sm:grid-cols-3">
          ${fieldInput('Tiêu đề dòng 1', 'hero.headlineLine1', h.headlineLine1)}
          ${fieldInput('Dòng nhấn màu xanh nghiêng', 'hero.headlineAccent', h.headlineAccent)}
          ${fieldInput('Tiêu đề dòng 3', 'hero.headlineLine3', h.headlineLine3)}
        </div>
        ${fieldTextarea('Đoạn giới thiệu bên phải', 'hero.description', h.description, 3)}
        ${fieldInput('Ghi chú ưu đãi tập thử dưới nút gọi', 'hero.trialNote', h.trialNote)}

        <div class="grid gap-4 pt-2 lg:grid-cols-2">
          <div class="space-y-3">
            ${imageControl('Ảnh chính lớn (bên trái)', 'hero.primaryImage', h.primaryImage)}
            ${fieldInput('Mô tả ảnh chính (SEO Alt)', 'hero.primaryImageAlt', h.primaryImageAlt)}
            ${fieldInput('Nhãn nhỏ góc dưới ảnh chính', 'hero.primaryBadgeTop', h.primaryBadgeTop)}
            ${fieldInput('Dòng chữ dưới góc ảnh chính', 'hero.primaryBadgeBottom', h.primaryBadgeBottom)}
          </div>
          <div class="space-y-3">
            ${imageControl('Ảnh phòng tập nhỏ (bên phải)', 'hero.secondaryImage', h.secondaryImage)}
            ${fieldInput('Mô tả ảnh phụ (SEO Alt)', 'hero.secondaryImageAlt', h.secondaryImageAlt)}
            ${fieldInput('Nhãn nhỏ khung bên phải', 'hero.sideEyebrow', h.sideEyebrow)}
            ${fieldInput('Tiêu đề khung bên phải', 'hero.sideTitle', h.sideTitle)}
            ${fieldTextarea('Nội dung khung bên phải', 'hero.sideDescription', h.sideDescription, 3)}
            ${fieldInput('Dòng giờ mở cửa dưới ảnh phụ', 'hero.secondaryHoursLabel', h.secondaryHoursLabel)}
          </div>
        </div>
      </div>

      <!-- 4 Key Trust Stats -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6">
        <h3 class="font-display text-xl font-semibold text-ink mb-4">4 Con số nổi bật dưới Hero</h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${d.site.stats
            .map(
              (st, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-3.5 space-y-2.5">
              ${fieldInput(`Số #${idx + 1}`, `site.stats.${idx}.value`, st.value)}
              ${fieldInput('Mô tả ngắn', `site.stats.${idx}.label`, st.label)}
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Manifesto -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <h3 class="font-display text-xl font-semibold text-ink">Triết lý luyện tập (Manifesto)</h3>
        ${fieldInput('Nhãn phía trên', 'manifesto.eyebrow', m.eyebrow)}
        ${fieldTextarea('Câu trích dẫn lớn (hiệu ứng sáng chữ khi cuộn)', 'manifesto.quote', m.quote, 2)}
        ${fieldTextarea('Đoạn giải thích bên dưới', 'manifesto.subtitle', m.subtitle, 2)}
      </div>
    </div>
  `;
}

function renderBenefitsAndStoryTab(d: CmsData): string {
  const b = d.benefitsSection;
  const s = d.storySection;
  const iconOptions: Array<{ value: SeniorBenefit['icon']; label: string }> = [
    { value: 'knee', label: 'Khiên bảo vệ (Xương khớp)' },
    { value: 'spine', label: 'Cột sống (Lưng vai gáy)' },
    { value: 'sleep', label: 'Mặt trăng (Giấc ngủ)' },
    { value: 'community', label: 'Cộng đồng (Nhóm bạn)' },
  ];

  return `
    <div class="space-y-6">
      <!-- Benefits Section -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-5">
        <h2 class="font-display text-2xl font-semibold text-ink">Mục 1: Lợi ích trị liệu cho tuổi hưu</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          ${fieldInput('Nhãn nhỏ', 'benefitsSection.eyebrow', b.eyebrow)}
          ${fieldInput('Tiêu đề dòng 1', 'benefitsSection.titleLine1', b.titleLine1)}
          ${fieldInput('Tiêu đề dòng 2', 'benefitsSection.titleLine2', b.titleLine2)}
        </div>
        ${fieldTextarea('Mô tả chung', 'benefitsSection.description', b.description, 2)}

        <div class="grid gap-4 md:grid-cols-2">
          ${b.items
            .map(
              (item, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-4 space-y-3">
              <div class="grid gap-3 sm:grid-cols-2">
                ${fieldInput(`Thẻ nhãn #${idx + 1}`, `benefitsSection.items.${idx}.tag`, item.tag)}
                <label class="block">
                  <span class="block text-xs font-semibold text-ink-soft mb-1.5">Biểu tượng</span>
                  <select data-bind="benefitsSection.items.${idx}.icon" class="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2.5 text-sm text-ink">
                    ${iconOptions.map((o) => `<option value="${o.value}" ${item.icon === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>
                </label>
              </div>
              ${fieldInput('Tiêu đề thẻ', `benefitsSection.items.${idx}.title`, item.title)}
              ${fieldTextarea('Nội dung chính', `benefitsSection.items.${idx}.description`, item.description, 3)}
              ${fieldInput('Dòng nhấn chân thẻ', `benefitsSection.items.${idx}.detail`, item.detail)}
            </div>
          `
            )
            .join('')}
        </div>

        <div class="grid gap-4 lg:grid-cols-2 pt-2">
          <div class="space-y-3">
            ${imageControl('Ảnh lớp tập bên phải (ảnh lớn)', 'benefitsSection.featuredImage', b.featuredImage)}
            ${fieldInput('Tiêu đề chú thích ảnh (chữ đậm)', 'benefitsSection.featuredCaptionTitle', b.featuredCaptionTitle)}
            ${fieldInput('Nội dung chú thích ảnh', 'benefitsSection.featuredCaptionText', b.featuredCaptionText)}
          </div>
          <div class="space-y-3">
            ${imageControl('Ảnh khung tư vấn Zalo', 'benefitsSection.consultImage', b.consultImage)}
            ${fieldInput('Nhãn khung tư vấn', 'benefitsSection.consultEyebrow', b.consultEyebrow)}
            ${fieldTextarea('Lời nhắn tư vấn', 'benefitsSection.consultText', b.consultText, 2)}
            ${fieldInput('Chữ nút Zalo', 'benefitsSection.consultCtaLabel', b.consultCtaLabel)}
          </div>
        </div>
      </div>

      <!-- Story Chapters -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-2xl font-semibold text-ink">Mục 2: Câu chuyện không gian 800m² (${s.chapters.length} chương)</h2>
            <p class="mt-0.5 text-xs text-ink-soft">Mỗi chương gồm phần nội dung bên trái và ảnh chuyển mượt bên phải.</p>
          </div>
          <button
            type="button"
            data-action="add-chapter"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory hover:bg-sage"
          >
            + Thêm chương
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          ${fieldInput('Nhãn nhỏ', 'storySection.eyebrow', s.eyebrow)}
          ${fieldInput('Tiêu đề dòng 1', 'storySection.titleLine1', s.titleLine1)}
          ${fieldInput('Tiêu đề dòng 2', 'storySection.titleLine2', s.titleLine2)}
        </div>
        ${fieldInput('Mô tả chung', 'storySection.description', s.description)}

        <div class="space-y-4">
          ${s.chapters
            .map(
              (ch, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-4 space-y-3.5">
              <div class="flex items-center justify-between gap-2 border-b border-ink/8 pb-2.5">
                <span class="text-sm font-semibold text-ink">Chương ${esc(ch.number)}: ${esc(ch.eyebrow)}</span>
                <button type="button" data-action="delete-chapter" data-index="${idx}" class="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Xóa chương</button>
              </div>
              <div class="grid gap-4 lg:grid-cols-12">
                <div class="space-y-3 lg:col-span-5">
                  ${imageControl('Ảnh minh họa chương', `storySection.chapters.${idx}.image`, ch.image)}
                  ${fieldInput('Chú thích nổi dưới ảnh', `storySection.chapters.${idx}.caption`, ch.caption)}
                  ${fieldInput('Mô tả SEO ảnh (Alt)', `storySection.chapters.${idx}.imageAlt`, ch.imageAlt)}
                </div>
                <div class="space-y-3 lg:col-span-7">
                  <div class="grid gap-3 sm:grid-cols-3">
                    ${fieldInput('Số thứ tự', `storySection.chapters.${idx}.number`, ch.number)}
                    <div class="sm:col-span-2">${fieldInput('Nhãn chương', `storySection.chapters.${idx}.eyebrow`, ch.eyebrow)}</div>
                  </div>
                  ${fieldInput('Tiêu đề chương', `storySection.chapters.${idx}.title`, ch.title)}
                  ${fieldTextarea('Nội dung mô tả', `storySection.chapters.${idx}.description`, ch.description, 3)}
                  <label class="block">
                    <span class="block text-xs font-semibold text-ink-soft mb-1.5">Các ý nổi bật (mỗi dòng 1 ý)</span>
                    <textarea
                      rows="3"
                      data-lines-bind="storySection.chapters.${idx}.highlights"
                      class="w-full rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-sage focus:outline-none"
                    >${esc(ch.highlights.join('\n'))}</textarea>
                  </label>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderPricingTab(d: CmsData): string {
  const p = d.pricingSection;
  return `
    <div class="space-y-6">
      <!-- Offers & Pricing -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-5">
        <h2 class="font-display text-2xl font-semibold text-ink">Học phí & Ưu đãi tập thử</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          ${fieldInput('Nhãn nhỏ', 'pricingSection.eyebrow', p.eyebrow)}
          ${fieldInput('Tiêu đề dòng 1', 'pricingSection.titleLine1', p.titleLine1)}
          ${fieldInput('Tiêu đề dòng 2', 'pricingSection.titleLine2', p.titleLine2)}
        </div>
        ${fieldTextarea('Mô tả chung', 'pricingSection.description', p.description, 2)}

        <div class="grid gap-5 lg:grid-cols-2">
          <!-- Trial card -->
          <div class="rounded-2xl border border-sage/25 bg-sage-soft/35 p-4 space-y-3">
            <h3 class="text-sm font-bold text-sage-dark uppercase tracking-wide">Thẻ 1: Tập thử miễn phí</h3>
            ${fieldInput('Nhãn phía trên', 'pricingSection.trialCard.badge', p.trialCard.badge)}
            ${fieldInput('Tiêu đề lớn', 'pricingSection.trialCard.title', p.trialCard.title)}
            ${fieldTextarea('Mô tả', 'pricingSection.trialCard.description', p.trialCard.description, 2)}
            <label class="block">
              <span class="block text-xs font-semibold text-ink-soft mb-1.5">Danh sách quyền lợi (mỗi dòng 1 ý)</span>
              <textarea rows="3" data-lines-bind="pricingSection.trialCard.highlights" class="w-full rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink">${esc(p.trialCard.highlights.join('\n'))}</textarea>
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              ${fieldInput('Nút chính (Zalo)', 'pricingSection.trialCard.primaryCtaLabel', p.trialCard.primaryCtaLabel)}
              ${fieldInput('Nút phụ (Gọi)', 'pricingSection.trialCard.secondaryCtaLabel', p.trialCard.secondaryCtaLabel)}
            </div>
          </div>

          <!-- Membership card -->
          <div class="rounded-2xl border border-clay/25 bg-clay-soft/35 p-4 space-y-3">
            <h3 class="text-sm font-bold text-clay uppercase tracking-wide">Thẻ 2: Gói hội viên</h3>
            ${fieldInput('Nhãn phía trên', 'pricingSection.membershipCard.badge', p.membershipCard.badge)}
            <div class="grid gap-3 sm:grid-cols-2">
              ${fieldInput('Mức giá hiển thị', 'pricingSection.membershipCard.price', p.membershipCard.price)}
              ${fieldInput('Đơn vị', 'pricingSection.membershipCard.priceUnit', p.membershipCard.priceUnit)}
            </div>
            ${fieldInput('Dòng ưu đãi nổi bật', 'pricingSection.membershipCard.promoText', p.membershipCard.promoText)}
            ${fieldTextarea('Mô tả gói tập', 'pricingSection.membershipCard.description', p.membershipCard.description, 2)}
            <label class="block">
              <span class="block text-xs font-semibold text-ink-soft mb-1.5">Danh sách quyền lợi (mỗi dòng 1 ý)</span>
              <textarea rows="3" data-lines-bind="pricingSection.membershipCard.highlights" class="w-full rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink">${esc(p.membershipCard.highlights.join('\n'))}</textarea>
            </label>
            ${fieldInput('Nút đăng ký tư vấn', 'pricingSection.membershipCard.ctaLabel', p.membershipCard.ctaLabel)}
          </div>
        </div>
      </div>

      <!-- Testimonials -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display text-2xl font-semibold text-ink">Cảm nhận học viên (${p.testimonials.length})</h3>
          <button type="button" data-action="add-testimonial" class="cursor-pointer rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory hover:bg-sage">+ Thêm cảm nhận</button>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          ${fieldInput('Nhãn phía trên', 'pricingSection.reviewsEyebrow', p.reviewsEyebrow)}
          ${fieldInput('Tiêu đề mục đánh giá', 'pricingSection.reviewsTitle', p.reviewsTitle)}
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          ${p.testimonials
            .map(
              (t, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-4 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-ink">Đánh giá #${idx + 1}</span>
                <button type="button" data-action="delete-testimonial" data-index="${idx}" class="cursor-pointer text-xs font-semibold text-red-600 hover:underline">Xóa</button>
              </div>
              ${fieldTextarea('Lời nhận xét', `pricingSection.testimonials.${idx}.quote`, t.quote, 3)}
              ${fieldInput('Tên học viên', `pricingSection.testimonials.${idx}.author`, t.author)}
              ${fieldInput('Nguồn đánh giá', `pricingSection.testimonials.${idx}.source`, t.source)}
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- FAQs -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display text-2xl font-semibold text-ink">Câu hỏi thường gặp — FAQ (${p.faqs.length})</h3>
          <button type="button" data-action="add-faq" class="cursor-pointer rounded-full bg-sage-dark px-4 py-2 text-xs font-semibold text-ivory hover:bg-sage">+ Thêm câu hỏi</button>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          ${fieldInput('Nhãn nhỏ', 'pricingSection.faqEyebrow', p.faqEyebrow)}
          ${fieldInput('Tiêu đề FAQ', 'pricingSection.faqTitle', p.faqTitle)}
        </div>
        ${fieldInput('Đoạn giới thiệu FAQ', 'pricingSection.faqDescription', p.faqDescription)}

        <div class="space-y-3">
          ${p.faqs
            .map(
              (faq, idx) => `
            <div class="rounded-2xl border border-ink/10 bg-ivory/50 p-4 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-ink">Câu hỏi #${idx + 1}</span>
                <div class="flex items-center gap-1.5">
                  <button type="button" data-action="move-faq-up" data-index="${idx}" ${idx === 0 ? 'disabled' : ''} class="cursor-pointer rounded border border-ink/12 bg-surface px-2 py-0.5 text-xs disabled:opacity-35">↑</button>
                  <button type="button" data-action="move-faq-down" data-index="${idx}" ${idx === p.faqs.length - 1 ? 'disabled' : ''} class="cursor-pointer rounded border border-ink/12 bg-surface px-2 py-0.5 text-xs disabled:opacity-35">↓</button>
                  <button type="button" data-action="delete-faq" data-index="${idx}" class="cursor-pointer rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Xóa</button>
                </div>
              </div>
              ${fieldInput('Câu hỏi', `pricingSection.faqs.${idx}.question`, faq.question)}
              ${fieldTextarea('Câu trả lời', `pricingSection.faqs.${idx}.answer`, faq.answer, 3)}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderSiteTab(d: CmsData): string {
  const s = d.site;
  return `
    <div class="space-y-6">
      <!-- Brand & Logos -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <h2 class="font-display text-2xl font-semibold text-ink">Thương hiệu & Logo</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${fieldInput('Tên đầy đủ phòng tập', 'site.name', s.name)}
          ${fieldInput('Tên ngắn (Header)', 'site.shortName', s.shortName)}
          ${fieldInput('Dòng địa danh dưới Logo', 'site.headerSubtitle', s.headerSubtitle)}
          ${fieldInput('Khẩu hiệu (Tagline)', 'site.tagline', s.tagline)}
          ${fieldInput('Tên miền website (URL)', 'site.url', s.url)}
        </div>
        ${fieldInput('Câu châm ngôn (Footer)', 'site.motto', s.motto)}
        <div class="grid gap-4 lg:grid-cols-2">
          ${imageControl('Logo đầy đủ (Lịch tập & Footer)', 'site.logoImage', s.logoImage, { preservePng: true, maxDimension: 800 } as { preservePng?: boolean })}
          ${imageControl('Biểu tượng tròn (Header)', 'site.markImage', s.markImage, { preservePng: true })}
        </div>
      </div>

      <!-- Contact & Links -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-display text-2xl font-semibold text-ink">Số điện thoại, Zalo & Mạng xã hội</h3>
          <button
            type="button"
            data-action="sync-phone-links"
            class="cursor-pointer rounded-full border border-sage/30 bg-sage-soft px-3.5 py-1.5 text-xs font-semibold text-sage-dark hover:bg-sage hover:text-ivory"
          >
            Tự cập nhật link Gọi & Zalo từ SĐT
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${fieldInput('Số điện thoại hiển thị', 'site.contact.phoneDisplay', s.contact.phoneDisplay, { placeholder: '0847 684 539' })}
          ${fieldInput('Số điện thoại liền (không cách)', 'site.contact.phoneRaw', s.contact.phoneRaw, { placeholder: '0847684539' })}
          ${fieldInput('Email liên hệ', 'site.contact.email', s.contact.email)}
          ${fieldInput('Link Zalo', 'site.contact.zaloHref', s.contact.zaloHref)}
          ${fieldInput('Link Messenger', 'site.contact.messengerHref', s.contact.messengerHref)}
          ${fieldInput('Link Fanpage Facebook', 'site.contact.facebookUrl', s.contact.facebookUrl)}
          ${fieldInput('Link Phiếu đăng ký tư vấn', 'site.contact.consultFormUrl', s.contact.consultFormUrl)}
          ${fieldInput('Link mở Google Maps', 'site.contact.googleMapsUrl', s.contact.googleMapsUrl)}
          ${fieldInput('Link nhúng bản đồ (iframe src)', 'site.contact.googleMapsEmbedUrl', s.contact.googleMapsEmbedUrl)}
        </div>
      </div>

      <!-- Address & Hours -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <h3 class="font-display text-2xl font-semibold text-ink">Địa chỉ & Giờ mở cửa</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          ${fieldInput('Địa chỉ hiện tại', 'site.address.current', s.address.current)}
          ${fieldInput('Địa chỉ cũ (nếu muốn ghi chú)', 'site.address.legacy', s.address.legacy)}
          ${fieldInput('Điểm mốc dễ nhận biết', 'site.address.landmark', s.address.landmark)}
          ${fieldInput('Giờ mở cửa tóm tắt', 'site.hours.summary', s.hours.summary)}
          ${fieldInput('Ghi chú các ca tập', 'site.hours.classesSummary', s.hours.classesSummary)}
          ${fieldInput('Chú thích dưới bản đồ', 'site.footer.mapCaptionSubtitle', s.footer.mapCaptionSubtitle)}
        </div>
      </div>

      <!-- SEO -->
      <div class="rounded-3xl border border-ink/10 bg-surface p-5 shadow-2xs sm:p-6 space-y-4">
        <h3 class="font-display text-2xl font-semibold text-ink">Cài đặt SEO & Ảnh chia sẻ Zalo / Facebook</h3>
        ${fieldInput('Tiêu đề trang trên Google (Title)', 'site.seo.title', s.seo.title)}
        ${fieldTextarea('Mô tả trang trên Google (Meta Description)', 'site.seo.description', s.seo.description, 3)}
        <label class="block">
          <span class="block text-xs font-semibold text-ink-soft mb-1.5">Từ khóa SEO (cách nhau bằng dấu phẩy)</span>
          <textarea
            rows="3"
            data-csv-bind="site.seo.keywords"
            class="w-full rounded-xl border border-ink/12 bg-ivory/60 px-3.5 py-2.5 text-sm text-ink focus:border-sage focus:bg-surface focus:outline-none"
          >${esc(s.seo.keywords.join(', '))}</textarea>
        </label>
        ${imageControl('Ảnh đại diện khi gửi link qua Zalo / Facebook (OG Image)', 'site.seo.ogImage', s.seo.ogImage)}
      </div>
    </div>
  `;
}

// =========================================================================
// MODALS (SCHEDULE CELL EDITOR + IMAGE PICKER)
// =========================================================================

function renderSessionModal(): string {
  if (!state.editingCell || !state.data) return '';
  const { slotIdx, dayKey } = state.editingCell;
  const slot = state.data.scheduleSection.slots[slotIdx];
  if (!slot) return '';
  const dayObj = DAYS.find((d) => d.key === dayKey)!;
  const existing = slot.sessions.find((s) => s.dayKey === dayKey);
  const catalog = ensureClassCatalog(state.data);
  const teacherSuggestions = [
    ...state.data.teachersSection.masters.map((m) => m.name.replace(/^Master\s+/i, 'M. ')),
    'M. Govinda & M. Gauri',
  ];

  const sess: ScheduleSession = existing || {
    dayKey,
    day: dayObj.full,
    name: '',
    titleVi: '',
    titleEn: '',
    teacher: teacherSuggestions[0] || 'M. Govinda',
    seniorFriendly: true,
    special: false,
    note: '',
  };

  const matchedTemplate = existing ? findMatchingClassTemplate(catalog, sess.titleVi, sess.titleEn) : undefined;
  const isCustomMode = Boolean(existing && !matchedTemplate);
  const selectedId = matchedTemplate ? matchedTemplate.id : isCustomMode ? '__custom__' : '';

  return `
    <div id="session-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-xs">
      <div class="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink/10 bg-surface p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-ink/8 pb-3">
          <div>
            <p class="text-xs font-semibold tracking-wider text-clay uppercase">${esc(dayObj.full)} · ${esc(slot.time)}</p>
            <h3 class="mt-0.5 font-display text-2xl font-semibold text-ink">
              ${existing ? 'Chỉnh sửa ca tập' : 'Thêm ca tập mới'}
            </h3>
          </div>
          <button type="button" data-action="close-session-modal" class="cursor-pointer rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink hover:bg-beige">✕</button>
        </div>

        <form id="session-editor-form" class="mt-4 space-y-3.5">
          <!-- Bi-directional Synced Vietnamese <-> English Dropdowns -->
          <div class="rounded-2xl border border-sage/20 bg-sage-soft/30 p-3.5 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-semibold text-sage-dark">Chọn nhanh từ Danh mục bài tập</span>
              <button
                type="button"
                data-action="open-catalog-from-modal"
                class="cursor-pointer text-[11px] font-semibold text-clay underline-offset-2 hover:underline"
              >
                Quản lý danh mục (${catalog.length} lớp) →
              </button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="block text-xs font-semibold text-ink-soft mb-1">Bài tập (Tiếng Việt) *</span>
                <select
                  name="classViSelect"
                  class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm font-medium text-ink focus:border-sage focus:outline-none"
                >
                  <option value="" ${selectedId === '' ? 'selected' : ''}>-- Chọn bài tập tiếng Việt --</option>
                  ${catalog
                    .map(
                      (c) => `<option value="${esc(c.id)}" ${selectedId === c.id ? 'selected' : ''}>${esc(c.titleVi)}</option>`
                    )
                    .join('')}
                  <option value="__custom__" ${selectedId === '__custom__' ? 'selected' : ''}>✎ Tự nhập bài tập mới / khác...</option>
                </select>
              </label>

              <label class="block">
                <span class="block text-xs font-semibold text-ink-soft mb-1">Tên tiếng Anh / phụ</span>
                <select
                  name="classEnSelect"
                  class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm italic text-ink-soft focus:border-sage focus:outline-none"
                >
                  <option value="" ${selectedId === '' ? 'selected' : ''}>-- Chọn tên tiếng Anh --</option>
                  ${catalog
                    .map(
                      (c) => `<option value="${esc(c.id)}" ${selectedId === c.id ? 'selected' : ''}>${esc(c.titleEn || c.titleVi)}</option>`
                    )
                    .join('')}
                  <option value="__custom__" ${selectedId === '__custom__' ? 'selected' : ''}>✎ Tự nhập tên khác...</option>
                </select>
              </label>
            </div>

            <p class="text-[11px] text-ink-muted">
              Chọn 1 ô, ô ngôn ngữ còn lại sẽ tự động khớp theo đúng bài tập đã lưu.
            </p>
          </div>

          <!-- Custom Input Fallback (shown when selecting "__custom__") -->
          <div id="custom-class-fields" class="${isCustomMode ? '' : 'hidden'} rounded-2xl border border-clay/25 bg-clay-soft/35 p-3.5 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="block text-xs font-semibold text-ink-soft mb-1">Nhập tên tiếng Việt *</span>
                <input
                  name="titleVi"
                  value="${esc(sess.titleVi)}"
                  placeholder="VD: Yoga Trị Liệu Cổ Vai"
                  ${isCustomMode ? 'required' : ''}
                  class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none"
                />
              </label>
              <label class="block">
                <span class="block text-xs font-semibold text-ink-soft mb-1">Nhập tên tiếng Anh / phụ</span>
                <input
                  name="titleEn"
                  value="${esc(sess.titleEn)}"
                  placeholder="VD: Neck Therapy Yoga"
                  class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink focus:border-sage focus:outline-none"
                />
              </label>
            </div>
            <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
              <input type="checkbox" name="saveToCatalog" checked class="h-4 w-4 accent-sage-dark" />
              <span>Lưu bài tập mới này vào Danh mục để chọn nhanh cho các lần sau</span>
            </label>
          </div>

          <label class="block">
            <span class="block text-xs font-semibold text-ink-soft mb-1">Giáo viên hướng dẫn *</span>
            <input name="teacher" required value="${esc(sess.teacher)}" placeholder="VD: M. Gauri" class="w-full rounded-xl border border-ink/15 bg-ivory/60 px-3 py-2 text-sm text-ink focus:border-sage focus:bg-surface focus:outline-none" />
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              ${teacherSuggestions
                .map(
                  (t) => `<button type="button" data-pick-teacher="${esc(t)}" class="cursor-pointer rounded-full border border-ink/12 bg-cream px-2.5 py-0.5 text-[11px] font-medium text-ink-soft hover:border-sage hover:text-ink">${esc(t)}</button>`
                )
                .join('')}
            </div>
          </label>

          <label class="block">
            <span class="block text-xs font-semibold text-ink-soft mb-1">Ghi chú ngắn (hiện ở chế độ danh sách)</span>
            <input name="note" value="${esc(sess.note || '')}" placeholder="VD: Dịu nhẹ, an toàn khớp gối" class="w-full rounded-xl border border-ink/15 bg-ivory/60 px-3 py-2 text-sm text-ink focus:border-sage focus:bg-surface focus:outline-none" />
          </label>

          <div class="flex flex-wrap gap-4 pt-1">
            <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="seniorFriendly" ${sess.seniorFriendly ? 'checked' : ''} class="h-4 w-4 accent-sage-dark" />
              <span>Lớp nhẹ nhàng cho người lớn tuổi</span>
            </label>
            <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="special" ${sess.special ? 'checked' : ''} class="h-4 w-4 accent-clay" />
              <span>Lớp đặc biệt (nổi bật)</span>
            </label>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 pt-4">
            ${
              existing
                ? `<button type="button" data-action="remove-session" class="cursor-pointer rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Xóa lớp ô này</button>`
                : '<span></span>'
            }
            <div class="flex items-center gap-2">
              <button type="button" data-action="close-session-modal" class="cursor-pointer rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink">Hủy</button>
              <button type="submit" class="cursor-pointer rounded-full bg-sage-dark px-5 py-2 text-xs font-semibold text-ivory hover:bg-sage">Lưu ô lịch này</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderImagePickerModal(): string {
  if (!state.imagePickerCallback) return '';
  const allItems = [
    ...Array.from(state.pendingUploads.values()).map((u) => ({
      name: u.filename,
      path: u.publicPath,
      previewUrl: u.dataUrl,
      isNew: true,
    })),
    ...state.media
      .filter((m) => !state.pendingUploads.has(m.path) && !state.deletedImages.has(m.name))
      .map((m) => ({
        name: m.name,
        path: m.path,
        previewUrl: m.previewUrl,
        isNew: false,
      })),
  ];

  return `
    <div id="image-picker-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-xs">
      <div class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-ink/10 bg-surface p-6 shadow-2xl">
        <div class="flex items-center justify-between gap-3 border-b border-ink/8 pb-3">
          <div>
            <h3 class="font-display text-2xl font-semibold text-ink">Chọn ảnh từ kho</h3>
            <p class="text-xs text-ink-soft">Bấm vào ảnh muốn sử dụng hoặc tải ảnh mới trực tiếp từ máy.</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sage-dark px-3.5 py-2 text-xs font-semibold text-ivory hover:bg-sage">
              <span>↑ Tải ảnh mới</span>
              <input type="file" accept="image/*" class="hidden" data-picker-upload />
            </label>
            <button type="button" data-action="close-picker" class="cursor-pointer rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-ink hover:bg-beige">✕</button>
          </div>
        </div>

        <div class="mt-4 grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
          ${allItems
            .map(
              (item) => `
            <button
              type="button"
              data-pick-image="${esc(item.path)}"
              class="group cursor-pointer overflow-hidden rounded-2xl border border-ink/10 bg-ivory/50 text-left transition hover:border-sage hover:ring-2 hover:ring-sage/30"
            >
              <div class="aspect-[4/3] overflow-hidden bg-cream">
                <img src="${esc(item.previewUrl)}" alt="${esc(item.name)}" loading="lazy" class="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <p class="truncate px-2.5 py-2 text-[11px] font-medium text-ink">${esc(item.name)}</p>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// MAIN SCREEN RENDERERS
// =========================================================================

function renderLoginScreen(sess: SessionInfo): string {
  return `
    <div class="flex min-h-screen items-center justify-center bg-linen-glow px-4 py-10">
      <div class="w-full max-w-md rounded-[2rem] border border-ink/10 bg-surface p-7 shadow-xl sm:p-9">
        <div class="flex flex-col items-center text-center">
          <img src="/images/power-yoga-mark.png" alt="Power Yoga" class="h-16 w-16 rounded-full border border-clay/25 bg-ivory p-2 object-contain" />
          <h1 class="mt-4 font-display text-3xl font-semibold text-ink">Quản Trị Power Yoga</h1>
          <p class="mt-1 text-sm text-ink-soft">Đăng nhập để cập nhật lịch tập, giáo viên, hình ảnh & nội dung website.</p>
        </div>

        ${
          !sess.authConfigured
            ? `<div class="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
                 <strong>Chưa cấu hình mật khẩu:</strong> Vui lòng thiết lập biến môi trường <code>ADMIN_PASSWORD</code> và <code>GITHUB_TOKEN</code> trong cài đặt dự án Vercel.
               </div>`
            : ''
        }

        ${
          sess.usingDevFallback
            ? `<div class="mt-5 rounded-2xl border border-sage/30 bg-sage-soft/60 p-3 text-center text-xs text-sage-dark">
                 Chế độ phát triển cục bộ · Tài khoản mặc định: <strong>admin</strong> / <strong>poweryoga2026</strong>
               </div>`
            : ''
        }

        <form id="admin-login-form" class="mt-6 space-y-4">
          <label class="block">
            <span class="block text-xs font-semibold text-ink-soft mb-1.5">Tên đăng nhập</span>
            <input
              name="username"
              type="text"
              autocomplete="username"
              value="admin"
              required
              class="w-full rounded-xl border border-ink/15 bg-ivory/70 px-4 py-3 text-sm text-ink focus:border-sage focus:bg-surface focus:outline-none"
            />
          </label>
          <label class="block">
            <span class="block text-xs font-semibold text-ink-soft mb-1.5">Mật khẩu</span>
            <input
              name="password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="Nhập mật khẩu quản trị"
              class="w-full rounded-xl border border-ink/15 bg-ivory/70 px-4 py-3 text-sm text-ink focus:border-sage focus:bg-surface focus:outline-none"
            />
          </label>

          <p id="login-error" class="hidden rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"></p>

          <button
            type="submit"
            class="w-full cursor-pointer rounded-full bg-sage-dark py-3.5 text-sm font-semibold text-ivory shadow-md transition hover:bg-sage"
          >
            Đăng nhập vào trang quản trị
          </button>
        </form>

        <div class="mt-6 text-center">
          <a href="/" class="text-xs font-medium text-ink-muted hover:text-ink">← Quay về trang chủ Power Yoga</a>
        </div>
      </div>
    </div>
  `;
}

function updateTopBarStatus() {
  const badge = document.getElementById('dirty-badge');
  const publishBtn = document.getElementById('publish-btn') as HTMLButtonElement | null;
  if (badge) {
    const uploadCount = state.pendingUploads.size;
    const delCount = state.deletedImages.size;
    const extra = [
      uploadCount ? `+${uploadCount} ảnh mới` : '',
      delCount ? `-${delCount} ảnh xóa` : '',
    ]
      .filter(Boolean)
      .join(', ');

    if (state.isDirty) {
      badge.className = 'inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900';
      badge.textContent = `● Có thay đổi chưa xuất bản${extra ? ` (${extra})` : ''}`;
    } else {
      badge.className = 'inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage-dark';
      badge.textContent = '✓ Đã đồng bộ';
    }
  }

  if (publishBtn) {
    publishBtn.disabled = state.isPublishing || !state.isDirty;
    publishBtn.textContent = state.isPublishing ? 'Đang xuất bản...' : 'Xuất bản thay đổi';
  }
}

function renderDashboard(sess: SessionInfo, d: CmsData): string {
  let tabHtml = '';
  switch (state.activeTab) {
    case 'schedule':
      tabHtml = renderScheduleTab(d);
      break;
    case 'teachers':
      tabHtml = renderTeachersTab(d);
      break;
    case 'gallery':
      tabHtml = renderGalleryTab(d);
      break;
    case 'hero':
      tabHtml = renderHeroTab(d);
      break;
    case 'benefits':
      tabHtml = renderBenefitsAndStoryTab(d);
      break;
    case 'pricing':
      tabHtml = renderPricingTab(d);
      break;
    case 'site':
      tabHtml = renderSiteTab(d);
      break;
  }

  return `
    <div class="min-h-screen bg-ivory">
      <!-- Top Sticky Header -->
      <header class="sticky top-0 z-40 border-b border-ink/10 bg-surface/95 backdrop-blur-md">
        <div class="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex items-center gap-3">
            <img src="${esc(resolvePreview(d.site.markImage))}" alt="" class="h-9 w-9 rounded-full border border-clay/25 bg-ivory p-1 object-contain" />
            <div>
              <p class="font-display text-xl leading-none font-semibold text-ink">Quản Trị Power Yoga</p>
              <p class="mt-0.5 text-[11px] text-ink-muted">
                ${sess.storageMode === 'github' ? `Đồng bộ GitHub (${esc(sess.repo)} · ${esc(sess.branch)})` : 'Chế độ lưu cục bộ (Local Dev)'}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span id="dirty-badge"></span>

            <a href="/" target="_blank" rel="noopener noreferrer" class="rounded-full border border-ink/15 bg-ivory px-3.5 py-2 text-xs font-semibold text-ink hover:border-ink/40">
              Xem web ↗
            </a>

            <button type="button" data-action="export-json" title="Tải bản sao lưu JSON về máy" class="hidden cursor-pointer rounded-full border border-ink/15 bg-surface px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ink sm:inline-flex">
              Sao lưu
            </button>

            <label title="Khôi phục từ tệp sao lưu JSON" class="hidden cursor-pointer rounded-full border border-ink/15 bg-surface px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ink sm:inline-flex">
              <span>Khôi phục</span>
              <input type="file" accept="application/json,.json" class="hidden" data-import-json />
            </label>

            <button
              id="publish-btn"
              type="button"
              data-action="publish"
              class="cursor-pointer rounded-full bg-sage-dark px-4.5 py-2 text-xs font-semibold text-ivory shadow-sm transition hover:bg-sage disabled:cursor-not-allowed disabled:opacity-45"
            >
              Xuất bản thay đổi
            </button>

            <button type="button" data-action="logout" class="cursor-pointer rounded-full px-3 py-2 text-xs font-medium text-ink-muted hover:bg-cream hover:text-ink">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      ${
        sess.storageMode === 'unconfigured'
          ? `<div class="mx-auto mt-4 max-w-[1440px] px-4 sm:px-6">
               <div class="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
                 <strong>Thiếu cấu hình GitHub:</strong> Chưa có biến môi trường <code>GITHUB_TOKEN</code> trên Vercel nên chưa thể lưu thay đổi lên website.
               </div>
             </div>`
          : ''
      }

      ${
        state.lastPublishMsg
          ? `<div class="mx-auto mt-4 max-w-[1440px] px-4 sm:px-6">
               <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sage/30 bg-sage-soft px-4 py-3 text-xs font-medium text-sage-dark">
                 <span>✓ ${esc(state.lastPublishMsg.text)}</span>
                 <div class="flex items-center gap-3">
                   ${
                     state.lastPublishMsg.commitUrl
                       ? `<a href="${esc(state.lastPublishMsg.commitUrl)}" target="_blank" rel="noopener noreferrer" class="underline">Xem lịch sử lưu trên GitHub ↗</a>`
                       : ''
                   }
                   <button type="button" data-action="dismiss-banner" class="cursor-pointer font-bold">✕</button>
                 </div>
               </div>
             </div>`
          : ''
      }

      <!-- Workspace Layout -->
      <div class="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        <!-- Sidebar Tabs -->
        <aside class="lg:col-span-3 xl:col-span-2">
          <nav class="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:pb-0">
            ${TABS.map(
              (tab) => `
              <button
                type="button"
                data-tab="${tab.id}"
                class="shrink-0 cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${
                  state.activeTab === tab.id
                    ? 'border-sage-dark bg-sage-dark text-ivory shadow-sm'
                    : 'border-ink/8 bg-surface text-ink hover:border-ink/25'
                }"
              >
                <p class="text-sm font-semibold">${tab.label}</p>
                <p class="mt-0.5 hidden text-[11px] lg:block ${state.activeTab === tab.id ? 'text-ivory/80' : 'text-ink-muted'}">${tab.desc}</p>
              </button>
            `
            ).join('')}
          </nav>
        </aside>

        <!-- Active Editor Panel -->
        <main class="min-w-0 lg:col-span-9 xl:col-span-10">
          ${tabHtml}
        </main>
      </div>
    </div>

    ${renderSessionModal()}
    ${renderImagePickerModal()}
    ${renderPosterExportModal()}
  `;
}

function renderPosterExportModal(): string {
  if (!state.posterModalOpen || !state.data) return '';
  const defaultAddr =
    state.posterFooterAddress ||
    '71/81A QL51, KP.5, P. Long Hưng, TP.Đồng Nai';

  return `
    <div id="poster-export-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-xs sm:p-5">
      <div class="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-2xl">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4 sm:px-6">
          <div>
            <h3 class="font-display text-2xl font-semibold text-ink">Xuất ảnh Lịch Tập Tuần (Chuẩn Fanpage)</h3>
            <p class="text-xs text-ink-soft">Ảnh độ phân giải HD 1920×1080 kèm sẵn logo, 2 mã QR quét được và thông tin liên hệ.</p>
          </div>
          <button type="button" data-action="close-poster-modal" class="cursor-pointer rounded-full bg-cream px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-beige">✕</button>
        </div>

        <!-- Controls -->
        <div class="grid gap-3 border-b border-ink/8 bg-ivory/75 px-5 py-3.5 sm:grid-cols-12 sm:items-end sm:px-6">
          <div class="sm:col-span-4">
            <label class="block text-xs font-semibold text-ink-soft mb-1">Ngày Thứ 2 đầu tuần</label>
            <div class="flex items-center gap-1.5">
              <input
                type="date"
                id="poster-week-date"
                value="${esc(state.posterWeekStart)}"
                class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-sage focus:outline-none"
              />
              <button type="button" data-poster-week="this" class="shrink-0 cursor-pointer rounded-xl border border-ink/12 bg-surface px-2.5 py-2 text-[11px] font-semibold text-ink-soft hover:border-sage hover:text-ink">Tuần này</button>
              <button type="button" data-poster-week="next" class="shrink-0 cursor-pointer rounded-xl border border-ink/12 bg-surface px-2.5 py-2 text-[11px] font-semibold text-ink-soft hover:border-sage hover:text-ink">Tuần sau</button>
            </div>
          </div>

          <div class="sm:col-span-4">
            <label class="block text-xs font-semibold text-ink-soft mb-1">Địa chỉ gọn góc phải dưới</label>
            <input
              type="text"
              id="poster-footer-address"
              value="${esc(defaultAddr)}"
              class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-sage focus:outline-none"
            />
          </div>

          <div class="flex flex-wrap items-center gap-4 pb-1 sm:col-span-4 sm:justify-end">
            <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink">
              <input type="checkbox" id="poster-show-dates" ${state.posterShowDates ? 'checked' : ''} class="h-4 w-4 accent-sage-dark" />
              <span>Hiện ngày (DD/MM)</span>
            </label>
            <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink">
              <input type="checkbox" id="poster-show-qr" ${state.posterShowQr ? 'checked' : ''} class="h-4 w-4 accent-sage-dark" />
              <span>Hiện 2 mã QR</span>
            </label>
          </div>
        </div>

        <!-- Live Preview Stage -->
        <div class="flex-1 overflow-y-auto bg-[#E5E0D7] p-4 sm:p-6">
          <div class="mx-auto max-w-4xl">
            <div id="poster-preview-container" class="relative overflow-hidden rounded-2xl border border-ink/12 bg-[#F3F0E9] shadow-lg aspect-[16/9] flex items-center justify-center">
              <span class="text-sm text-ink-soft">Đang tạo bản xem trước chất lượng cao...</span>
            </div>
          </div>
        </div>

        <!-- Footer Download / Copy Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 bg-surface px-5 py-3.5 sm:px-6">
          <p class="text-xs text-ink-muted">
            Mẹo: Bấm <strong>Copy ảnh</strong> rồi nhấn <code>Ctrl + V</code> trực tiếp vào bài đăng Facebook hoặc Zalo!
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-action="copy-poster-png"
              class="cursor-pointer rounded-full border border-ink/15 bg-ivory px-4 py-2.5 text-xs font-semibold text-ink transition hover:border-ink/40"
            >
              Copy ảnh vào bộ nhớ tạm
            </button>
            <button
              type="button"
              data-action="download-poster-png"
              class="cursor-pointer rounded-full bg-sage-dark px-5 py-2.5 text-xs font-semibold text-ivory shadow-sm transition hover:bg-sage"
            >
              ↓ Tải ảnh PNG (1920×1080)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function updatePosterPreview() {
  if (!state.posterModalOpen || !state.data) return;
  const container = document.getElementById('poster-preview-container');
  if (!container) return;

  try {
    const canvas = await renderSchedulePosterCanvas(state.data, {
      weekStartDate: state.posterWeekStart,
      showDates: state.posterShowDates,
      showQrCodes: state.posterShowQr,
      footerAddress: state.posterFooterAddress || '71/81A QL51, KP.5, P. Long Hưng, TP.Đồng Nai',
      logoSrc: resolvePreview(state.data.site.logoImage),
    });
    state.lastPosterCanvas = canvas;

    // Only update if modal is still open
    const liveContainer = document.getElementById('poster-preview-container');
    if (!liveContainer) return;
    canvas.className = 'block h-full w-full object-contain';
    liveContainer.innerHTML = '';
    liveContainer.appendChild(canvas);
  } catch (err) {
    container.innerHTML = `<span class="p-4 text-sm text-red-700">Lỗi tạo ảnh: ${esc(err instanceof Error ? err.message : String(err))}</span>`;
  }
}

// =========================================================================
// RENDER & EVENT BINDING
// =========================================================================

function renderApp() {
  const root = document.getElementById('admin-root');
  if (!root || !state.session) return;

  if (!state.session.authenticated) {
    root.innerHTML = renderLoginScreen(state.session);
    bindLoginEvents();
    return;
  }

  if (!state.data) {
    root.innerHTML = `<div class="flex min-h-screen items-center justify-center bg-ivory text-sm text-ink-soft">Đang tải dữ liệu nội dung...</div>`;
    return;
  }

  root.innerHTML = renderDashboard(state.session, state.data);
  updateTopBarStatus();
  bindDashboardEvents();
  if (state.posterModalOpen) {
    void updatePosterPreview();
  }
}

function bindLoginEvents() {
  const form = document.getElementById('admin-login-form') as HTMLFormElement | null;
  const errEl = document.getElementById('login-error');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const username = String(fd.get('username') || '');
    const password = String(fd.get('password') || '');

    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang kiểm tra...';
    }
    errEl?.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Đăng nhập thất bại');
      }
      state.session = await fetchSession();
      await loadCmsAndMedia();
      renderApp();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err instanceof Error ? err.message : 'Lỗi đăng nhập';
        errEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Đăng nhập vào trang quản trị';
      }
    }
  });
}

function swapItems<T>(arr: T[], i: number, j: number) {
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function bindDashboardEvents() {
  const root = document.getElementById('admin-root');
  if (!root || !state.data) return;
  const d = state.data;

  // Tab switchers
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab as TabId;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Generic 2-way input binding
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-bind]').forEach((el) => {
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      const path = el.dataset.bind!;
      setByPath(d as unknown as Record<string, unknown>, path, el.value);
      markDirty();
    });
  });

  // Line-separated arrays
  root.querySelectorAll<HTMLTextAreaElement>('[data-lines-bind]').forEach((el) => {
    el.addEventListener('input', () => {
      const lines = el.value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      setByPath(d as unknown as Record<string, unknown>, el.dataset.linesBind!, lines);
      markDirty();
    });
  });

  // Comma-separated arrays (SEO keywords)
  root.querySelectorAll<HTMLTextAreaElement>('[data-csv-bind]').forEach((el) => {
    el.addEventListener('input', () => {
      const items = el.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setByPath(d as unknown as Record<string, unknown>, el.dataset.csvBind!, items);
      markDirty();
    });
  });

  // Image direct upload inputs
  root.querySelectorAll<HTMLInputElement>('[data-upload-bind]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const path = input.dataset.uploadBind!;
      const preservePng = input.dataset.preservePng === '1';
      await handleUploadImage(
        file,
        (publicPath) => {
          setByPath(d as unknown as Record<string, unknown>, path, publicPath);
          renderApp();
        },
        { preservePng }
      );
    });
  });

  // Bulk media library upload
  root.querySelectorAll<HTMLInputElement>('[data-bulk-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      for (const file of files) {
        await handleUploadImage(file, () => {});
      }
      renderApp();
    });
  });

  // Open image picker modal
  root.querySelectorAll<HTMLButtonElement>('[data-open-picker]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.dataset.openPicker!;
      state.imagePickerCallback = (publicPath) => {
        setByPath(d as unknown as Record<string, unknown>, path, publicPath);
        markDirty();
        state.imagePickerCallback = null;
        renderApp();
      };
      renderApp();
    });
  });

  // Image picker modal events
  root.querySelectorAll<HTMLButtonElement>('[data-pick-image]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.pickImage!;
      state.imagePickerCallback?.(chosen);
    });
  });
  root.querySelector<HTMLInputElement>('[data-picker-upload]')?.addEventListener('change', async (e) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    await handleUploadImage(file, (publicPath) => {
      state.imagePickerCallback?.(publicPath);
    });
  });

  // Schedule sub-tab switcher (Timetable grid <-> Yoga class catalog)
  root.querySelectorAll<HTMLButtonElement>('[data-schedule-subtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.scheduleSubTab = (btn.dataset.scheduleSubtab as 'grid' | 'catalog') || 'grid';
      renderApp();
    });
  });

  // Class catalog search & inline editing
  const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement | null;
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', () => {
      const pos = catalogSearchInput.selectionStart;
      state.catalogSearch = catalogSearchInput.value;
      renderApp();
      const refreshed = document.getElementById('catalog-search-input') as HTMLInputElement | null;
      if (refreshed) {
        refreshed.focus();
        if (pos !== null) refreshed.setSelectionRange(pos, pos);
      }
    });
  }

  const addCatalogForm = document.getElementById('add-class-catalog-form') as HTMLFormElement | null;
  if (addCatalogForm) {
    addCatalogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const catalog = ensureClassCatalog(d);
      const fd = new FormData(addCatalogForm);
      const titleVi = String(fd.get('titleVi') || '').trim();
      const titleEn = String(fd.get('titleEn') || '').trim();
      const defaultNote = String(fd.get('defaultNote') || '').trim();
      const defaultSeniorFriendly = fd.get('defaultSeniorFriendly') === 'on';
      const defaultSpecial = fd.get('defaultSpecial') === 'on';
      if (!titleVi) return;

      catalog.unshift({
        id: slugifyClassId(titleEn || titleVi),
        titleVi,
        titleEn,
        defaultNote,
        defaultSeniorFriendly,
        ...(defaultSpecial ? { defaultSpecial: true } : {}),
      });
      markDirty();
      renderApp();
      showToast(`Đã thêm bài tập "${titleVi}" vào danh mục.`, 'success');
    });
  }

  root.querySelectorAll<HTMLInputElement>('[data-catalog-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const catalog = ensureClassCatalog(d);
      const idx = Number(input.dataset.catalogIdx);
      const field = input.dataset.catalogField as 'titleVi' | 'titleEn' | 'defaultNote';
      if (catalog[idx]) {
        catalog[idx][field] = input.value;
        markDirty();
      }
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-catalog-check]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const catalog = ensureClassCatalog(d);
      const idx = Number(chk.dataset.catalogIdx);
      const field = chk.dataset.catalogCheck as 'defaultSeniorFriendly' | 'defaultSpecial';
      if (catalog[idx]) {
        catalog[idx][field] = chk.checked;
        markDirty();
      }
    });
  });

  // Schedule slot inline edits
  root.querySelectorAll<HTMLInputElement>('[data-slot-time]').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.slotTime);
      d.scheduleSection.slots[idx].time = input.value;
      markDirty();
    });
  });
  root.querySelectorAll<HTMLSelectElement>('[data-slot-period]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const idx = Number(sel.dataset.slotPeriod);
      d.scheduleSection.slots[idx].period = sel.value as ScheduleSlot['period'];
      markDirty();
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-slot-label]').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.slotLabel);
      d.scheduleSection.slots[idx].periodLabel = input.value;
      markDirty();
    });
  });

  // Open schedule cell editor
  root.querySelectorAll<HTMLButtonElement>('[data-edit-cell]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [slotStr, dayKey] = (btn.dataset.editCell || '').split(':');
      state.editingCell = { slotIdx: Number(slotStr), dayKey: dayKey as DayKey };
      renderApp();
    });
  });

  // Schedule cell modal form (with bi-directional Vi <-> En dropdown sync)
  const sessionForm = document.getElementById('session-editor-form') as HTMLFormElement | null;
  if (sessionForm && state.editingCell) {
    const catalog = ensureClassCatalog(d);
    const viSelect = sessionForm.elements.namedItem('classViSelect') as HTMLSelectElement | null;
    const enSelect = sessionForm.elements.namedItem('classEnSelect') as HTMLSelectElement | null;
    const customBox = document.getElementById('custom-class-fields');
    const titleViInput = sessionForm.elements.namedItem('titleVi') as HTMLInputElement | null;
    const titleEnInput = sessionForm.elements.namedItem('titleEn') as HTMLInputElement | null;
    const noteInput = sessionForm.elements.namedItem('note') as HTMLInputElement | null;
    const seniorChk = sessionForm.elements.namedItem('seniorFriendly') as HTMLInputElement | null;
    const specialChk = sessionForm.elements.namedItem('special') as HTMLInputElement | null;

    const allCatalogDefaultNotes = new Set(catalog.map((c) => (c.defaultNote || '').trim()).filter(Boolean));

    const syncClassSelection = (selectedId: string) => {
      if (viSelect && viSelect.value !== selectedId) viSelect.value = selectedId;
      if (enSelect && enSelect.value !== selectedId) enSelect.value = selectedId;

      const isCustom = selectedId === '__custom__';
      customBox?.classList.toggle('hidden', !isCustom);
      if (titleViInput) titleViInput.required = isCustom;

      if (!isCustom && selectedId) {
        const tpl = catalog.find((c) => c.id === selectedId);
        if (tpl) {
          if (titleViInput) titleViInput.value = tpl.titleVi;
          if (titleEnInput) titleEnInput.value = tpl.titleEn;
          if (seniorChk) seniorChk.checked = Boolean(tpl.defaultSeniorFriendly);
          if (specialChk) specialChk.checked = Boolean(tpl.defaultSpecial);
          if (noteInput) {
            const curNote = noteInput.value.trim();
            if (!curNote || allCatalogDefaultNotes.has(curNote)) {
              noteInput.value = tpl.defaultNote || '';
            }
          }
        }
      } else if (isCustom) {
        titleViInput?.focus();
      }
    };

    viSelect?.addEventListener('change', () => syncClassSelection(viSelect.value));
    enSelect?.addEventListener('change', () => syncClassSelection(enSelect.value));

    sessionForm.querySelectorAll<HTMLButtonElement>('[data-pick-teacher]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = sessionForm.elements.namedItem('teacher') as HTMLInputElement;
        if (input) input.value = btn.dataset.pickTeacher || '';
      });
    });

    sessionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.editingCell) return;
      const { slotIdx, dayKey } = state.editingCell;
      const slot = d.scheduleSection.slots[slotIdx];
      const dayObj = DAYS.find((x) => x.key === dayKey)!;
      const fd = new FormData(sessionForm);

      const selectedId = String(fd.get('classViSelect') || fd.get('classEnSelect') || '');
      let titleVi = '';
      let titleEn = '';

      if (!selectedId) {
        showToast('Vui lòng chọn 1 bài tập từ danh sách (hoặc chọn "Tự nhập bài tập mới").', 'error');
        viSelect?.focus();
        return;
      }

      if (selectedId === '__custom__') {
        titleVi = String(fd.get('titleVi') || '').trim();
        titleEn = String(fd.get('titleEn') || '').trim();
        if (!titleVi) {
          showToast('Vui lòng nhập tên bài tập tiếng Việt.', 'error');
          titleViInput?.focus();
          return;
        }
      } else {
        const tpl = catalog.find((c) => c.id === selectedId);
        if (!tpl) return;
        titleVi = tpl.titleVi;
        titleEn = tpl.titleEn;
      }

      const teacher = String(fd.get('teacher') || '').trim();
      const note = String(fd.get('note') || '').trim();
      const seniorFriendly = fd.get('seniorFriendly') === 'on';
      const special = fd.get('special') === 'on';

      // Optionally save new custom class straight into the catalog
      if (selectedId === '__custom__' && fd.get('saveToCatalog') === 'on') {
        const alreadyExists = findMatchingClassTemplate(catalog, titleVi, titleEn);
        if (!alreadyExists) {
          catalog.unshift({
            id: slugifyClassId(titleEn || titleVi),
            titleVi,
            titleEn,
            defaultNote: note,
            defaultSeniorFriendly: seniorFriendly,
            ...(special ? { defaultSpecial: true } : {}),
          });
          showToast(`Đã lưu thêm "${titleVi}" vào Danh mục bài tập.`, 'success');
        }
      }

      const newSession: ScheduleSession = {
        dayKey,
        day: dayObj.full,
        name: titleEn ? `${titleVi} (${titleEn})` : titleVi,
        titleVi,
        titleEn,
        teacher,
        seniorFriendly,
        ...(special ? { special: true } : {}),
        ...(note ? { note } : {}),
      };

      const existingIdx = slot.sessions.findIndex((s) => s.dayKey === dayKey);
      if (existingIdx >= 0) {
        slot.sessions[existingIdx] = newSession;
      } else {
        slot.sessions.push(newSession);
        // Keep sessions ordered Monday -> Sunday
        const dayOrder = DAYS.map((x) => x.key);
        slot.sessions.sort((a, b) => dayOrder.indexOf(a.dayKey) - dayOrder.indexOf(b.dayKey));
      }

      state.editingCell = null;
      markDirty();
      renderApp();
    });
  }

  // Poster export modal live controls
  if (state.posterModalOpen) {
    const weekInput = document.getElementById('poster-week-date') as HTMLInputElement | null;
    const addrInput = document.getElementById('poster-footer-address') as HTMLInputElement | null;
    const showDatesChk = document.getElementById('poster-show-dates') as HTMLInputElement | null;
    const showQrChk = document.getElementById('poster-show-qr') as HTMLInputElement | null;

    weekInput?.addEventListener('change', () => {
      state.posterWeekStart = weekInput.value || getDefaultMondayIso();
      void updatePosterPreview();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-poster-week]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const baseIso = getDefaultMondayIso();
        if (btn.dataset.posterWeek === 'next') {
          const [y, m, day] = baseIso.split('-').map(Number);
          const nextMon = new Date(y, m - 1, day + 7);
          state.posterWeekStart = `${nextMon.getFullYear()}-${String(nextMon.getMonth() + 1).padStart(2, '0')}-${String(nextMon.getDate()).padStart(2, '0')}`;
        } else {
          state.posterWeekStart = baseIso;
        }
        if (weekInput) weekInput.value = state.posterWeekStart;
        void updatePosterPreview();
      });
    });

    addrInput?.addEventListener('input', () => {
      state.posterFooterAddress = addrInput.value;
      void updatePosterPreview();
    });

    showDatesChk?.addEventListener('change', () => {
      state.posterShowDates = showDatesChk.checked;
      void updatePosterPreview();
    });

    showQrChk?.addEventListener('change', () => {
      state.posterShowQr = showQrChk.checked;
      void updatePosterPreview();
    });
  }

  // Import JSON backup
  root.querySelector<HTMLInputElement>('[data-import-json]')?.addEventListener('change', async (e) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CmsData;
      if (!parsed.site || !parsed.scheduleSection || !parsed.teachersSection) {
        throw new Error('Tệp JSON không đúng cấu trúc dữ liệu Power Yoga.');
      }
      if (!confirm('Khôi phục toàn bộ nội dung từ tệp sao lưu này? (Bạn vẫn cần bấm "Xuất bản thay đổi" để áp dụng lên web)')) {
        return;
      }
      state.data = parsed;
      ensureClassCatalog(state.data);
      markDirty();
      renderApp();
      showToast('Đã nạp dữ liệu từ tệp sao lưu. Hãy kiểm tra và bấm "Xuất bản thay đổi".', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Tệp sao lưu bị lỗi', 'error');
    }
  });

  // Action buttons
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action!;
      const idx = Number(btn.dataset.index);

      switch (action) {
        case 'publish': {
          await handlePublish();
          break;
        }
        case 'logout': {
          if (state.isDirty && !confirm('Bạn có thay đổi chưa xuất bản. Vẫn đăng xuất?')) return;
          await fetch('/api/admin/logout', { method: 'POST' });
          state.session = await fetchSession();
          state.data = null;
          state.isDirty = false;
          renderApp();
          break;
        }
        case 'dismiss-banner': {
          state.lastPublishMsg = null;
          renderApp();
          break;
        }
        case 'export-json': {
          const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `power-yoga-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
        case 'close-session-modal': {
          state.editingCell = null;
          renderApp();
          break;
        }
        case 'open-poster-modal': {
          state.posterModalOpen = true;
          if (!state.posterFooterAddress) {
            state.posterFooterAddress = '71/81A QL51, KP.5, P. Long Hưng, TP.Đồng Nai';
          }
          renderApp();
          break;
        }
        case 'close-poster-modal': {
          state.posterModalOpen = false;
          state.lastPosterCanvas = null;
          renderApp();
          break;
        }
        case 'download-poster-png': {
          const canvas = state.lastPosterCanvas;
          if (!canvas) {
            showToast('Đang tạo ảnh, vui lòng thử lại sau giây lát...', 'info');
            return;
          }
          const filename = buildPosterFilename(state.posterWeekStart, state.posterShowDates);
          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/png');
          link.click();
          showToast(`Đã tải xuống ảnh "${filename}" (1920×1080).`, 'success');
          break;
        }
        case 'copy-poster-png': {
          const canvas = state.lastPosterCanvas;
          if (!canvas) return;
          try {
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
              throw new Error('Trình duyệt không hỗ trợ copy ảnh trực tiếp — hãy dùng nút Tải ảnh PNG.');
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Đã copy ảnh Lịch Tập Tuần! Bạn có thể bấm Ctrl+V thẳng vào bài đăng Facebook.', 'success');
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Không copy được ảnh, hãy dùng nút Tải ảnh PNG.', 'error');
          }
          break;
        }
        case 'open-catalog-from-modal': {
          state.editingCell = null;
          state.scheduleSubTab = 'catalog';
          renderApp();
          break;
        }
        case 'delete-catalog-item': {
          const catalog = ensureClassCatalog(d);
          const target = catalog[idx];
          if (!target) return;
          if (!confirm(`Xóa bài tập "${target.titleVi}" khỏi danh mục? (Các ca đã xếp sẵn trên lịch sẽ không bị mất)`)) return;
          catalog.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'remove-session': {
          if (!state.editingCell) return;
          const slot = d.scheduleSection.slots[state.editingCell.slotIdx];
          slot.sessions = slot.sessions.filter((s) => s.dayKey !== state.editingCell!.dayKey);
          state.editingCell = null;
          markDirty();
          renderApp();
          break;
        }
        case 'close-picker': {
          state.imagePickerCallback = null;
          renderApp();
          break;
        }
        case 'add-slot': {
          d.scheduleSection.slots.push({
            time: '19:45 – 20:45',
            period: 'afternoon',
            periodLabel: 'Buổi tối',
            sessions: [],
          });
          markDirty();
          renderApp();
          break;
        }
        case 'delete-slot': {
          if (!confirm(`Xóa khung giờ "${d.scheduleSection.slots[idx]?.time}"?`)) return;
          d.scheduleSection.slots.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'add-teacher': {
          d.teachersSection.masters.push({
            name: 'Master Mới',
            role: 'Giáo viên chính từ Ấn Độ',
            specialty: 'Hatha Yoga · Gentle Yoga',
            description: 'Giới thiệu về phong cách giảng dạy và kinh nghiệm của giáo viên.',
            image: '/images/master-gauri.jpg',
            imageAlt: 'Giáo viên tại Power Yoga Đồng Nai',
          });
          markDirty();
          renderApp();
          break;
        }
        case 'move-teacher-up': {
          swapItems(d.teachersSection.masters, idx, idx - 1);
          markDirty();
          renderApp();
          break;
        }
        case 'move-teacher-down': {
          swapItems(d.teachersSection.masters, idx, idx + 1);
          markDirty();
          renderApp();
          break;
        }
        case 'delete-teacher': {
          if (!confirm(`Xóa giáo viên "${d.teachersSection.masters[idx]?.name}"?`)) return;
          d.teachersSection.masters.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'add-gallery': {
          d.gallerySection.items.push({
            image: '/images/studio-sunlit.jpg',
            alt: 'Khoảnh khắc luyện tập tại Power Yoga Đồng Nai',
            caption: 'Khoảnh khắc bình an tại lớp học Power Yoga Đồng Nai.',
            layout: 'third',
          });
          markDirty();
          renderApp();
          break;
        }
        case 'move-gallery-up': {
          swapItems(d.gallerySection.items, idx, idx - 1);
          markDirty();
          renderApp();
          break;
        }
        case 'move-gallery-down': {
          swapItems(d.gallerySection.items, idx, idx + 1);
          markDirty();
          renderApp();
          break;
        }
        case 'delete-gallery': {
          d.gallerySection.items.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'toggle-delete-media': {
          const filename = btn.dataset.filename || '';
          if (!filename) return;
          if (state.deletedImages.has(filename)) {
            state.deletedImages.delete(filename);
          } else {
            state.deletedImages.add(filename);
          }
          markDirty();
          renderApp();
          break;
        }
        case 'add-chapter': {
          const nextNum = String(d.storySection.chapters.length + 1).padStart(2, '0');
          d.storySection.chapters.push({
            number: nextNum,
            eyebrow: 'Tiện ích phòng tập',
            title: 'Tiêu đề chương mới',
            description: 'Mô tả chi tiết trải nghiệm dành cho học viên.',
            highlights: ['Điểm nổi bật 1', 'Điểm nổi bật 2'],
            image: '/images/studio-sunlit.jpg',
            imageAlt: 'Không gian Power Yoga Đồng Nai',
            caption: 'Chú thích hiển thị dưới ảnh.',
            imagePosition: 'center',
          });
          markDirty();
          renderApp();
          break;
        }
        case 'delete-chapter': {
          if (d.storySection.chapters.length <= 1) {
            showToast('Cần giữ lại ít nhất 1 chương câu chuyện.', 'error');
            return;
          }
          if (!confirm('Xóa chương này?')) return;
          d.storySection.chapters.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'add-testimonial': {
          d.pricingSection.testimonials.push({
            quote: 'Phòng tập thoáng mát, giáo viên tận tâm và rất dễ theo.',
            author: 'Học viên Power Yoga',
            source: 'Đánh giá trên Facebook Power Yoga Đồng Nai',
            date: '100% Đề xuất',
          });
          markDirty();
          renderApp();
          break;
        }
        case 'delete-testimonial': {
          d.pricingSection.testimonials.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'add-faq': {
          d.pricingSection.faqs.push({
            question: 'Câu hỏi mới của học viên?',
            answer: 'Câu trả lời chi tiết từ phòng tập Power Yoga Đồng Nai.',
          });
          markDirty();
          renderApp();
          break;
        }
        case 'move-faq-up': {
          swapItems(d.pricingSection.faqs, idx, idx - 1);
          markDirty();
          renderApp();
          break;
        }
        case 'move-faq-down': {
          swapItems(d.pricingSection.faqs, idx, idx + 1);
          markDirty();
          renderApp();
          break;
        }
        case 'delete-faq': {
          d.pricingSection.faqs.splice(idx, 1);
          markDirty();
          renderApp();
          break;
        }
        case 'sync-phone-links': {
          const digits = d.site.contact.phoneDisplay.replace(/\D/g, '');
          if (!digits) {
            showToast('Vui lòng nhập số điện thoại trước.', 'error');
            return;
          }
          d.site.contact.phoneRaw = digits;
          d.site.contact.telHref = `tel:${digits}`;
          d.site.contact.zaloHref = `https://zalo.me/${digits}`;
          d.site.contact.phoneIntl = digits.startsWith('0') ? `+84${digits.slice(1)}` : `+${digits}`;
          markDirty();
          renderApp();
          showToast('Đã tự động cập nhật SĐT cho link Gọi điện, Zalo và SEO.', 'success');
          break;
        }
      }
    });
  });

  // Unused helper reference guard
  void getByPath;
}

// =========================================================================
// BOOTSTRAP
// =========================================================================

window.addEventListener('beforeunload', (e) => {
  if (state.isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function init() {
  try {
    state.session = await fetchSession();
    if (state.session.authenticated) {
      await loadCmsAndMedia();
    }
    renderApp();
  } catch (err) {
    const root = document.getElementById('admin-root');
    if (root) {
      root.innerHTML = `<div class="p-8 text-center text-sm text-red-700">Lỗi khởi chạy trang quản trị: ${esc(err instanceof Error ? err.message : String(err))}</div>`;
    }
  }
}

init();
