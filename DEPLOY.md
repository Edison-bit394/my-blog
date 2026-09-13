# 上线手册（Git + GitHub Pages，全程免费）

跟着做一遍，大约 20 分钟，之后每篇文章只需 `git push`。

---

## 第 0 步：改掉占位信息（先做这个）

打开 `src/consts.ts`，把这几项改成你自己的：

```ts
export const SITE = {
  title: '我的经验与思考',      // 改成你的站点名
  tagline: '工作经验 · 学习笔记 · 产品实践 · 生活随想',
  author: '你的名字',            // 改成你的名字
  url: 'https://YOURNAME.github.io/',   // 改成你的 GitHub 用户名
  base: '/my-blog/',             // 必须与 GitHub 仓库名完全一致
  bio: '记录解决问题的方法，也记录生活给出的答案。',
} as const;
```

三处必须保持一致，否则上线后样式和链接会 404：

| 位置 | 值 |
| --- | --- |
| `src/consts.ts` 的 `url` | `https://<你的用户名>.github.io/` |
| `src/consts.ts` 的 `base` | `/<仓库名>/` |
| GitHub 上的仓库名 | 与上面 `base` 去掉斜杠后一致 |

> 仓库名建议用 `blog`、`notes` 之类。也可以用 `<你的用户名>.github.io` 当仓库名，
> 那样 `url` 填 `https://<你的用户名>.github.io/`、`base` 填 `'/'`。

顺手把 `public/robots.txt` 里的 `Sitemap:` 那行也改成你的真实域名。

---

## 第 1 步：安装 Git

本机目前没有 Git，先装：

1. 打开 <https://git-scm.com/download/win>，下载 64 位安装包；
2. 一路默认下一步即可（默认编辑器选 Visual Studio Code 或 Notepad 都行）；
3. 装完**新开**一个 PowerShell 窗口，执行 `git --version` 能看到版本号就成功了。

装好后设置身份（只需一次）：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

---

## 第 2 步：本机跑起来看看

在这个 `site` 目录下执行：

```powershell
npm install          # 只做一次，安装依赖
npm run dev          # 启动本地预览
```

浏览器打开 <http://localhost:4321/my-blog/> 就能看到站点。
改 Markdown 或代码会立即生效，`Ctrl+C` 停止。

> **如果 PowerShell 报「禁止运行脚本」**：把 `npm` 换成 `npm.cmd`，
> 例如 `npm.cmd run dev`，`npx` 换成 `npx.cmd`。这是 Windows 执行策略导致的，不影响使用。

写一篇新文章：

```powershell
npm.cmd run new -- blog "今天想明白的一件事"
```

会在 `content/blog/` 下生成带 frontmatter 的文件。
`draft: true` 时只在本地可见，改成 `false` 才会发布。

---

## 第 3 步：创建 GitHub 仓库并推上去

1. 注册/登录 <https://github.com>；
2. 右上角 **+ → New repository**；
3. Repository name 填 `my-blog`（要和 `src/consts.ts` 的 `base` 一致）；
4. 选 **Public**（GitHub Pages 免费版需要公开仓库）；
5. **不要**勾选 "Add a README file"（我们本地已有内容）；
6. 点 **Create repository**。

然后在本机 `site` 目录执行（把 `YOURNAME` 换成你的用户名）：

```powershell
git init
git add .
git commit -m "初始化个人网站"
git branch -M main
git remote add origin https://github.com/YOURNAME/my-blog.git
git push -u origin main
```

第一次 push 会弹出浏览器要求授权，按提示登录即可。

> **重要**：`npm install` 之后一定要把 `package-lock.json` 一起提交
> （`git add .` 会自动包含它）。GitHub Actions 用 `npm ci` 安装依赖，缺这个文件会构建失败。

---

## 第 4 步：打开 GitHub Pages

1. 进入仓库页面 → **Settings** → 左侧 **Pages**；
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**；
3. 回到仓库 **Actions** 标签，能看到 "Deploy to GitHub Pages" 正在运行；
4. 等 1～2 分钟变成绿色勾，访问：

   ```
   https://YOURNAME.github.io/my-blog/
   ```

之后每次 `git push`，网站自动更新，不需要再做任何操作。

---

## 日常写作流程

```powershell
npm.cmd run new -- blog "标题"   # 1. 新建草稿
# 2. 用编辑器写内容，写完把 draft 改成 false
npm.cmd run dev                  # 3. 本地看一眼
git add .
git commit -m "新增：标题"
git push                         # 4. 上线，1 分钟后自动发布
```

---

## 绑定自己的域名（可选，约 ¥30～60/年）

1. 在域名商（阿里云、腾讯云、Namecheap 等）买一个域名；
2. 到仓库 **Settings → Pages → Custom domain** 填域名，保存；
3. 在你域名的 DNS 处添加记录：
   - 类型 `CNAME`，主机记录 `www`（或 `@`），记录值 `YOURNAME.github.io`
4. 回到 **Pages** 页面勾选 **Enforce HTTPS**（证书自动签发，可能要等几分钟）；
5. 把 `src/consts.ts` 改成：
   ```ts
   url: 'https://你的域名/',
   base: '/',
   ```
   同时更新 `public/robots.txt` 里的 Sitemap 地址，然后 push。

---

## 常见问题排查

### 构建报 `require is not defined`

这是 Astro 7 + Vite 8 的一个已知坑：官方 `astro/loaders` 的 `glob()` 依赖 `picomatch`
（CommonJS 包），会被内联进 ESM 模块运行器而崩溃。

**本项目已经绕开了它**：内容集合用的是自带的 `src/loaders/markdown-dir.ts`
（只用 `node:fs` + `js-yaml`，不碰 `picomatch`）。

所以：**不要把 `content.config.ts` 里的 `markdownDir()` 改回官方的 `glob()`**，
否则内容集合会整体不可用。等上游修复后再考虑切换。

### 构建报配置或类型错误，且提示 "This error is often caused by a syntax error"

检查文件是不是存成了**带 BOM 的 UTF-8**。BOM 会让 Vite 误判配置文件。
`.editorconfig` 已声明 `charset = utf-8`，VS Code 右下角编码选 **UTF-8**（不要选 "UTF-8 with BOM"）。

快速自查（在 `site` 目录执行）：

```powershell
Get-ChildItem src -Recurse -Include *.ts,*.astro | ForEach-Object {
  $b = [System.IO.File]::ReadAllBytes($_.FullName)
  if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { "BOM: $($_.Name)" }
}
```

有输出就把该文件另存为「UTF-8 无 BOM」。

### 页面能打开但没有样式

`base` 和仓库名不一致。用浏览器 F12 看 Network，若 CSS/JS 是 404，就回来核对
`src/consts.ts` 的 `base` 与仓库名。

### 源文件删了，页面还在生成（幽灵页面）

九成是 `src/` 下留了 `content.config.ts.bak` 之类的**备份文件**。
Astro 会把同目录下多个 `content.config.*` 一起加载并**合并集合**，
于是旧配置里的条目继续生成页面，而且日志里毫无提示，非常难排查。

```powershell
npm.cmd run preflight    # 会直接指出是哪几个文件
```

需要备份配置就放到项目目录外面，不要放在 `src/` 下。

### 修改了内容但网站没变化

先本地构建一次确认：

```powershell
npm.cmd run build
```

如果本地是对的，线上没变，检查是不是忘了 `git push`，或去仓库 **Actions** 看是否有失败的运行。

### Actions 里构建失败，报 `npm ci` 相关错误

`package-lock.json` 没提交。执行 `git add package-lock.json && git commit -m "补 lock 文件" && git push`。

### 想给文章配图

把图片放到 `public/images/`，在 Markdown 里写：

```markdown
![说明](/my-blog/images/图片名.png)
```

注意路径要包含 `base`（即 `/my-blog/`）。
