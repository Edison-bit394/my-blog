// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { detectSite } from './src/lib/site-url.mjs';

/**
 * 网址（site / base）是自动判断的，你不需要手填。
 *
 * 判断顺序：
 *   1. 环境变量 SITE_URL / SITE_BASE
 *      - 线上：GitHub 仓库变量（见 .github/workflows/deploy.yml）
 *      - 本地：site/.env 文件
 *   2. GitHub Actions 里自动读仓库信息 → https://<用户名>.github.io/<仓库名>/
 *   3. 本地兜底：localhost
 *
 * 注意：Astro 不会把 .env 的内容放进 process.env，必须用 Vite 的 loadEnv 显式读取，
 * 否则 .env 里写了也不生效（这个坑我踩过）。
 */
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const fileEnv = loadEnv(mode, process.cwd(), 'SITE_');

const { url, base, source } = detectSite({ ...fileEnv, ...process.env });

console.log(`[site] 网址判定：${url}${base.replace(/^\//, '')}\n       依据：${source}`);

export default defineConfig({
  site: url,
  base,
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  build: {
    format: 'directory',
  },
});
