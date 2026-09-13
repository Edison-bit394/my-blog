/** 统一生成站内链接：自动带上 base（子路径部署时必须有）。 */
export function url(path = '/'): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** 生成文章链接：/blog/slug/ */
export function postUrl(section: string, id: string): string {
  return url(`${section}/${id}/`);
}

/** 2026年2月14日 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

/** 2026-02-14 */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 按发布日期倒序排序（草稿由调用方过滤） */
export function byDateDesc<T extends { data: { pubDate: Date } }>(a: T, b: T): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

/** 统计标签出现次数，按频率倒序 */
export function countTags(entries: { data: { tags: string[] } }[]): [string, number][] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.data.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
}
