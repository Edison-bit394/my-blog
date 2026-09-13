import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import type { Loader } from 'astro/loaders';

/**
 * 一个极简的内容 loader：用 node:fs 直接读取目录下的 Markdown 文件。
 *
 * 为什么不直接用官方的 glob()：
 * 官方 astro/loaders 依赖 picomatch（CommonJS 包），而 Astro 7 使用的 Vite 8
 * 会用 ESM 模块运行器内联它，抛出 "require is not defined"，
 * 导致 astro sync / build 全部失败（内容集合完全不可用）。
 * 本 loader 只用 node:fs + js-yaml，绕开那条依赖链，行为稳定可预期。
 *
 * frontmatter 由 js-yaml 解析，支持数组、日期、引号、多行等完整 YAML 语法。
 * 条目 id 就是文件名（不含扩展名），因此 URL 形如 /blog/文件名/。
 */
export function markdownDir(dir: string): Loader {
  const absDir = resolve(process.cwd(), dir);

  return {
    name: 'markdown-dir',
    load: async ({ store, logger, parseData, generateDigest, watcher }) => {
      watcher?.add(absDir);

      let files: string[];
      try {
        files = await readdir(absDir);
      } catch {
        logger.warn(`内容目录不存在，已跳过：${dir}`);
        return;
      }

      for (const name of files) {
        if (!/\.(md|mdx)$/i.test(name)) continue;

        const filePath = join(absDir, name);
        const raw = await readFile(filePath, 'utf8');

        // frontmatter 必须以文件开头，格式为 --- ... ---
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
        if (!match) {
          logger.warn(`缺少 frontmatter，已跳过：${name}`);
          continue;
        }

        const id = name.replace(/\.(md|mdx)$/i, '');
        const frontmatter = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
        const data = await parseData({ id, data: frontmatter, filePath });

        store.set({
          id,
          data,
          body: match[2],
          digest: generateDigest(raw),
          filePath,
        });
      }
    },
  };
}
