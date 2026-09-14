import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
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
 *
 * ⚠ 关键点：必须同时存 body 和 rendered。
 *   `<Content />`（render(entry)）只读 entry.rendered.html，见 astro/dist/content/runtime.js 的
 *   renderEntry 实现。只塞 body 而不调用 renderMarkdown()，页面标题和日期都在、正文却整段空白，
 *   而且不报任何错——官方 glob() loader 正是因此才要自己 render。
 *
 * ⚠ 关键点：store.set() 的 filePath 必须是**相对于站点根目录**的路径。
 *   绝对路径在 Windows 上能侥幸通过（Astro 的校验里有个盘符分支），
 *   但在 Linux CI 上会直接报错：
 *     File path must be relative to the site root. Got: /home/runner/...
 *   这个坑只在部署时才暴露，本地永远测不出来。所以这里统一用 relative() 转一次。
 */
export function markdownDir(dir: string): Loader {
  const projectRoot = process.cwd();
  const absDir = resolve(projectRoot, dir);

  /** 把绝对路径转成 Astro 要求的「相对站点根目录」形式，并统一成正斜杠 */
  const toSiteRelative = (absolutePath: string) =>
    relative(projectRoot, absolutePath).split(sep).join('/');

  return {
    name: 'markdown-dir',
    load: async ({ store, logger, parseData, generateDigest, watcher, renderMarkdown }) => {
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

        const absolutePath = join(absDir, name);
        const relativePath = toSiteRelative(absolutePath);
        const raw = await readFile(absolutePath, 'utf8');

        // frontmatter 必须以文件开头，格式为 --- ... ---
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
        if (!match) {
          logger.warn(`缺少 frontmatter，已跳过：${name}`);
          continue;
        }

        const id = name.replace(/\.(md|mdx)$/i, '');
        const frontmatter = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
        const body = match[2];

        // parseData 做数据类型校验，同时需要能定位图片等资源，所以给绝对路径
        const data = await parseData({ id, data: frontmatter, filePath: absolutePath });

        // 把 Markdown 渲染成 HTML。fileURL 用于解析正文里的相对图片路径。
        // 少了这一步，文章页就只有标题和日期，正文是空白。
        const rendered = await renderMarkdown(body, { fileURL: pathToFileURL(absolutePath) });

        store.set({
          id,
          data,
          body,
          rendered,
          // 正文里引用的图片要登记，Astro 才会一并处理和输出
          assetImports: rendered.metadata?.imagePaths,
          digest: generateDigest(raw),
          // 这里必须是相对路径，否则 Linux 构建失败
          filePath: relativePath,
        });
      }
    },
  };
}
