import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { url } from '../lib/utils';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  // 部署在子路径（例如 /my-blog/）时，context.site 只到域名，不含子路径。
  // 所以 site 和 link 都必须手动带上 base，否则订阅者点开链接会 404。
  const siteUrl = context.site ?? new URL('http://localhost:4321/');
  const base = import.meta.env.BASE_URL || '/';
  const root = new URL(base, siteUrl).href;

  return rss({
    title: SITE.title,
    description: SITE.tagline,
    site: root,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      // 用统一的 url() 生成，保证与网站内其他链接一致
      link: url(`/blog/${post.id}/`),
      categories: post.data.tags,
      author: SITE.author,
    })),
    customData: '<language>zh-cn</language>',
  });
}
