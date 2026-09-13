// 站点全局配置：改这一个文件即可把站点变成你自己的。
export const SITE = {
  /** 站点标题（浏览器标签、页头、RSS 都用它） */
  title: '我的经验与思考',

  /** 一句话副标题 */
  tagline: '工作经验 · 学习笔记 · 产品实践 · 生活随想',

  /** 你的名字/昵称 */
  author: '你的名字',

  /** 站点部署地址，必须以 / 结尾 */
  url: 'https://YOURNAME.github.io/',

  /**
   * 部署子路径。
   * - 使用 https://YOURNAME.github.io/my-blog 这种项目站点时填 '/my-blog/'
   * - 使用 https://YOURNAME.github.io 仓库 或 自定义域名时填 '/'
   * 必须与 GitHub 仓库名保持一致。
   */
  base: '/my-blog/',

  /** 作者简介（关于页、页脚） */
  bio: '记录解决问题的方法，也记录生活给出的答案。',
} as const;
