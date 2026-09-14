/**
 * 自动判断站点地址，避免手填 GitHub 用户名 / 仓库名填错导致链接 404。
 *
 * 优先级：
 *   1. SITE_URL + SITE_BASE 环境变量（绑定自定义域名时用）
 *   2. GitHub Actions 提供的仓库信息（CI 构建时自动正确）
 *   3. 本地兜底：localhost
 *
 * 这是 .mjs 而不是 .ts，因为它要在 Astro 配置加载阶段就被执行，
 * 用最朴素的 JavaScript 能避免各种转换环节出问题。
 */

const DEFAULT_BASE = '/';

function normalizeBase(value) {
  if (!value) return DEFAULT_BASE;
  let base = value.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function normalizeUrl(value) {
  if (!value) return '';
  let url = value.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!url.endsWith('/')) url = `${url}/`;
  return url;
}

export function detectSite(env = process.env) {
  // 1. 显式指定（绑自定义域名时最省事）
  if (env.SITE_URL) {
    return {
      url: normalizeUrl(env.SITE_URL),
      base: normalizeBase(env.SITE_BASE || DEFAULT_BASE),
      source: '环境变量 SITE_URL',
    };
  }

  // 2. GitHub Actions 里自动识别
  const repo = env.GITHUB_REPOSITORY; // 形如 "用户名/仓库名"
  const owner = env.GITHUB_REPOSITORY_OWNER || (repo ? repo.split('/')[0] : '');
  const repoName = repo ? repo.split('/')[1] : '';

  if (repoName && owner) {
    // 仓库名恰好是 <用户名>.github.io 时，站点在根路径，不需要 base
    const isUserSite = repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`;
    return {
      url: `https://${owner.toLowerCase()}.github.io/`,
      base: isUserSite ? DEFAULT_BASE : normalizeBase(repoName),
      source: `GitHub Actions（仓库 ${repo}）`,
    };
  }

  // 3. 本地开发兜底：网址不影响本地预览
  return {
    url: 'http://localhost:4321/',
    base: DEFAULT_BASE,
    source: '本地兜底（不影响本地预览）',
  };
}

export { normalizeBase, normalizeUrl };
