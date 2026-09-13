// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/consts.ts';

// GitHub Pages 项目站点形如 https://<用户名>.github.io/<仓库名>/，必须设置 base。
// 绑定自定义域名后，把 base 改成 '/' 即可（见 DEPLOY.md）。
export default defineConfig({
  site: SITE.url,
  base: SITE.base,
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
