# content/ —— 网站的内容源（可整体替换为 Obsidian 仓库链接）

这是网站的 Markdown 内容根目录。约定如下：

| 目录 | 作用 | 出现在网站 |
|---|---|---|
| `content/blog/` | 随笔、心得、人生感悟、长文 | `/blog/` |
| `content/work/` | 工作经验、复盘、方法论 | `/work/` |
| `content/products/` | 公司产品展示（每个产品一个文件） | `/products/` |
| `content/learn/` | 学习资料/课程笔记（可公开的部分） | `/learn/` |
| `content/pages/` | 独立页面（关于我等，可选） | `/pages/` |

## 两种使用方式

**方式 A（默认，最省事）**：直接把笔记写在这个目录里。

**方式 B（推荐，与 Obsidian 知识库打通）**：用同步脚本把知识库 `90-发布` 目录搬过来。
不用配 junction，跨盘也能用，而且脚本会替你挡住会导致构建失败的坏数据：

```powershell
cd site
npm.cmd run publish            # 同步（校验 frontmatter、强制 draft:false、去掉 BOM）
npm.cmd run publish:check      # 只体检，不写文件
npm.cmd run publish -- --dry-run   # 预览会发生什么
```

知识库路径的查找顺序：`--vault` 参数 > `PUBLISH_VAULT` 环境变量 >
`publish.config.json` 的 `vault` 字段 > 默认位置（含本项目的 `../vault`）。

想改成"改完立刻生效"也可以用目录联接（仅限同一盘符）：

```powershell
Remove-Item -Recurse -Force .\content
New-Item -ItemType Junction -Path .\content -Target "D:\Knowledge\vault\90-发布"
```

## Frontmatter 字段

```yaml
---
title: 文章标题
description: 一句话摘要（会用于 SEO 与列表页）
pubDate: 2026-02-14
updatedDate: 2026-03-01   # 可选
tags: [职业成长, 方法论]
draft: false              # true 则本地可见、线上不构建
featured: true            # 可选，首页精选
---
```

> 保密提醒：给公司产品写内容时，只写可公开信息；敏感内容放在知识库的私有目录，不要放进 `content/`。
