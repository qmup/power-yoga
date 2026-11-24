import fs from 'node:fs/promises';
import path from 'node:path';
import type { CmsData } from '../data/types';

const DATA_REPO_PATH = 'src/data/cms-data.json';
const IMAGES_REPO_DIR = 'public/images';
const ALLOWED_IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif|gif)$/i;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB per compressed upload

function getEnv(key: string): string | undefined {
  return process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];
}

export interface StorageConfig {
  mode: 'github' | 'local' | 'unconfigured';
  owner?: string;
  repo?: string;
  branch: string;
  token?: string;
}

export function getStorageConfig(): StorageConfig {
  const isDev = Boolean(import.meta.env.DEV);
  const token = getEnv('GITHUB_TOKEN')?.trim();
  const repoFull = (getEnv('GITHUB_REPO') || 'qmup/power-yoga').trim();
  const branch = (getEnv('GITHUB_BRANCH') || 'main').trim();
  const [owner, repo] = repoFull.split('/');

  if (token && owner && repo) {
    return { mode: 'github', owner, repo, branch, token };
  }
  if (isDev) {
    return { mode: 'local', owner, repo, branch };
  }
  return { mode: 'unconfigured', owner, repo, branch };
}

async function githubFetch(cfg: StorageConfig, endpoint: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'power-yoga-admin-cms',
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface MediaFileItem {
  name: string;
  path: string;
  previewUrl: string;
  size: number;
}

export async function readCmsData(): Promise<{ data: CmsData; mode: StorageConfig['mode']; branch: string; repo?: string }> {
  const cfg = getStorageConfig();

  if (cfg.mode === 'github') {
    const json = await githubFetch(
      cfg,
      `/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_REPO_PATH}?ref=${encodeURIComponent(cfg.branch)}`
    );
    const decoded = Buffer.from(String(json.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    return {
      data: JSON.parse(decoded) as CmsData,
      mode: 'github',
      branch: cfg.branch,
      repo: `${cfg.owner}/${cfg.repo}`,
    };
  }

  if (cfg.mode === 'local') {
    const fullPath = path.join(process.cwd(), DATA_REPO_PATH);
    const raw = await fs.readFile(fullPath, 'utf8');
    return {
      data: JSON.parse(raw) as CmsData,
      mode: 'local',
      branch: cfg.branch,
      repo: cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : undefined,
    };
  }

  throw new Error('Chưa cấu hình biến môi trường GITHUB_TOKEN trên Vercel.');
}

export async function listMediaFiles(): Promise<MediaFileItem[]> {
  const cfg = getStorageConfig();

  if (cfg.mode === 'github') {
    const items = (await githubFetch(
      cfg,
      `/repos/${cfg.owner}/${cfg.repo}/contents/${IMAGES_REPO_DIR}?ref=${encodeURIComponent(cfg.branch)}`
    )) as Array<{ name: string; type: string; size: number; download_url?: string }>;

    return items
      .filter((item) => item.type === 'file' && ALLOWED_IMAGE_EXT.test(item.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        name: item.name,
        path: `/images/${item.name}`,
        previewUrl: item.download_url || `/images/${item.name}`,
        size: item.size || 0,
      }));
  }

  if (cfg.mode === 'local') {
    const dir = path.join(process.cwd(), IMAGES_REPO_DIR);
    await fs.mkdir(dir, { recursive: true });
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: MediaFileItem[] = [];
    for (const entry of entries) {
      if (entry.isFile() && ALLOWED_IMAGE_EXT.test(entry.name)) {
        const stat = await fs.stat(path.join(dir, entry.name));
        files.push({
          name: entry.name,
          path: `/images/${entry.name}`,
          previewUrl: `/images/${entry.name}`,
          size: stat.size,
        });
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  throw new Error('Chưa cấu hình biến môi trường GITHUB_TOKEN trên Vercel.');
}

export interface PendingUpload {
  filename: string;
  base64: string; // raw base64 without data: prefix
}

export function sanitizeImageFilename(raw: string): string {
  const base = path.basename(raw).toLowerCase();
  const extMatch = base.match(/(\.[a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '.webp';
  if (!ALLOWED_IMAGE_EXT.test(ext)) {
    throw new Error(`Định dạng ảnh không hợp lệ: ${raw}`);
  }
  const stem = base
    .slice(0, base.length - ext.length)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return `${stem || 'image'}${ext}`;
}

export function validateCmsData(data: unknown): CmsData {
  if (!data || typeof data !== 'object') {
    throw new Error('Dữ liệu nội dung không hợp lệ.');
  }
  const d = data as Partial<CmsData>;
  const requiredKeys: Array<keyof CmsData> = [
    'site',
    'hero',
    'manifesto',
    'benefitsSection',
    'storySection',
    'teachersSection',
    'scheduleSection',
    'gallerySection',
    'pricingSection',
  ];
  for (const key of requiredKeys) {
    if (!d[key] || typeof d[key] !== 'object') {
      throw new Error(`Thiếu mục dữ liệu bắt buộc: ${key}`);
    }
  }
  return d as CmsData;
}

export interface PublishPayload {
  data: CmsData;
  uploads?: PendingUpload[];
  deletedImages?: string[];
  commitMessage?: string;
}

export interface PublishResult {
  ok: true;
  mode: 'github' | 'local';
  commitSha?: string;
  commitUrl?: string;
  uploadedFiles: string[];
  deletedFiles: string[];
}

export async function publishCmsChanges(payload: PublishPayload): Promise<PublishResult> {
  const cfg = getStorageConfig();
  const validData = validateCmsData(payload.data);
  const jsonContent = JSON.stringify(validData, null, 2) + '\n';

  // Validate uploads
  const sanitizedUploads: Array<{ filename: string; buffer: Buffer; base64: string }> = [];
  for (const up of payload.uploads || []) {
    const filename = sanitizeImageFilename(up.filename);
    const cleanBase64 = up.base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new Error(`Ảnh "${filename}" vượt quá giới hạn 3MB hoặc bị lỗi.`);
    }
    sanitizedUploads.push({ filename, buffer, base64: cleanBase64 });
  }

  // Validate deletions (only allow filenames inside public/images)
  const sanitizedDeletes: string[] = [];
  for (const rawName of payload.deletedImages || []) {
    const name = path.basename(rawName);
    if (name !== rawName || !ALLOWED_IMAGE_EXT.test(name) || name.includes('..')) {
      continue;
    }
    sanitizedDeletes.push(name);
  }

  const commitMessage =
    (payload.commitMessage || '').trim() ||
    `cms: cập nhật nội dung Power Yoga (${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`;

  if (cfg.mode === 'local') {
    const dataPath = path.join(process.cwd(), DATA_REPO_PATH);
    await fs.writeFile(dataPath, jsonContent, 'utf8');

    const imgDir = path.join(process.cwd(), IMAGES_REPO_DIR);
    await fs.mkdir(imgDir, { recursive: true });
    for (const up of sanitizedUploads) {
      await fs.writeFile(path.join(imgDir, up.filename), up.buffer);
    }
    for (const del of sanitizedDeletes) {
      await fs.unlink(path.join(imgDir, del)).catch(() => {});
    }

    return {
      ok: true,
      mode: 'local',
      uploadedFiles: sanitizedUploads.map((u) => `/images/${u.filename}`),
      deletedFiles: sanitizedDeletes.map((d) => `/images/${d}`),
    };
  }

  if (cfg.mode === 'github') {
    const base = `/repos/${cfg.owner}/${cfg.repo}`;

    // 1. Get latest commit on target branch
    const refData = await githubFetch(cfg, `${base}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const latestCommitSha = refData.object.sha as string;

    // 2. Get base tree SHA
    const commitData = await githubFetch(cfg, `${base}/git/commits/${latestCommitSha}`);
    const baseTreeSha = commitData.tree.sha as string;

    // 3. Create blobs & tree entries for JSON + uploads + deletes in ONE atomic commit
    const treeEntries: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string | null;
    }> = [];

    const jsonBlob = await githubFetch(cfg, `${base}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: jsonContent, encoding: 'utf-8' }),
    });
    treeEntries.push({
      path: DATA_REPO_PATH,
      mode: '100644',
      type: 'blob',
      sha: jsonBlob.sha as string,
    });

    for (const up of sanitizedUploads) {
      const imgBlob = await githubFetch(cfg, `${base}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: up.base64, encoding: 'base64' }),
      });
      treeEntries.push({
        path: `${IMAGES_REPO_DIR}/${up.filename}`,
        mode: '100644',
        type: 'blob',
        sha: imgBlob.sha as string,
      });
    }

    for (const del of sanitizedDeletes) {
      treeEntries.push({
        path: `${IMAGES_REPO_DIR}/${del}`,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }

    const newTree = await githubFetch(cfg, `${base}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    });

    // 4. Create commit & update branch ref
    const newCommit = await githubFetch(cfg, `${base}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: [latestCommitSha],
      }),
    });

    await githubFetch(cfg, `${base}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return {
      ok: true,
      mode: 'github',
      commitSha: newCommit.sha as string,
      commitUrl: `https://github.com/${cfg.owner}/${cfg.repo}/commit/${newCommit.sha}`,
      uploadedFiles: sanitizedUploads.map((u) => `/images/${u.filename}`),
      deletedFiles: sanitizedDeletes.map((d) => `/images/${d}`),
    };
  }

  throw new Error('Chưa cấu hình biến môi trường GITHUB_TOKEN trên Vercel.');
}
