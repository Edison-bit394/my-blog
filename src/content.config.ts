import { defineCollection, z } from 'astro:content';
import { markdownDir } from './loaders/markdown-dir';

/**
 * 所有内容集合都指向项目根目录下的 content/ 文件夹。
 * 这个目录可以整体替换为 Obsidian 仓库的「公开发布」目录（见 content/README.md）。
 *
 * 关于 loader：这里用自带的 markdownDir()，而不是官方的 glob()。
 * 原因见 src/loaders/markdown-dir.ts —— 官方 glob 依赖 picomatch（CommonJS），
 * 在 Astro 7 + Vite 8 下会内联失败并报 "require is not defined"。
 * 请勿改回 glob()，除非上游修复了该问题。
 *
 * ⚠ 不要把本文件备份成 content.config.ts.bak 之类放在 src/ 下！
 * Astro 会把同目录下多个 content.config.* 文件一起加载并**合并集合**，
 * 结果会出现"源文件已删除、页面却还在生成"的幽灵路由，极难排查。
 * 需要备份请放到项目外的目录。
 */
const base = {
  title: z.string(),
  description: z.string().default(''),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
};

export const collections = {
  blog: defineCollection({
    loader: markdownDir('content/blog'),
    schema: z.object(base),
  }),
  work: defineCollection({
    loader: markdownDir('content/work'),
    schema: z.object({
      ...base,
      company: z.string().default(''),
      role: z.string().default(''),
      period: z.string().default(''),
    }),
  }),
  products: defineCollection({
    loader: markdownDir('content/products'),
    schema: z.object({
      ...base,
      productName: z.string().default(''),
      status: z.enum(['在售', '内测', '已上线', '规划中', '已下线']).default('已上线'),
      link: z.string().default(''),
      highlights: z.array(z.string()).default([]),
    }),
  }),
  learn: defineCollection({
    loader: markdownDir('content/learn'),
    schema: z.object({
      ...base,
      source: z.string().default(''),
      progress: z.enum(['在读', '已读完', '待整理', '已实践']).default('在读'),
      rating: z.number().min(1).max(5).optional(),
    }),
  }),
};
