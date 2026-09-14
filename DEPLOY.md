# 上线手册（Git + GitHub Pages，全程免费）

**重要变化：网址不需要你填了。** 用户名、仓库名由部署时自动识别，
所以不存在"填错 GitHub 用户名导致链接 404"的问题。你只需要做两件事：装 Git、建仓库。

全程约 30 分钟。

---

## 最快路径：运行上线助手

在 `site` 目录下执行：

```powershell
pwsh -ExecutionPolicy Bypass -File .\上线助手.ps1
```

它会：检查 Git 是否真的装好 → 配置你的提交身份 → 检查必需文件是否齐全
→ 初始化本地仓库并提交 → 打印出你接下来要复制的命令。

如果提示"禁止运行脚本"，就用上面这条带 `-ExecutionPolicy Bypass` 的命令。

> 只想检查不执行任何操作：加 `-CheckOnly`

---

## 第 1 步：装 Git（必须由你来装）

本机**目前还没有 Git**（我检查过 PATH 和三个常见安装位置都没有）。

1. 打开 <https://git-scm.com/download/win>，下载 64 位安装包；
2. 一路默认下一步即可；
3. **装完后必须关掉所有终端窗口，重新打开**——这是最常见的"装了但用不了"的原因；
4. 新窗口里执行 `git --version`，看到版本号才算成功。

设置提交身份（只需一次，建议邮箱用 GitHub 注册邮箱）：

```powershell
git config --global user.name "Edison Hu"
git config --global user.email "你的邮箱@example.com"
```

---

## 第 2 步：本地先看效果

```powershell
npm.cmd install      # 只做一次
npm.cmd run dev
```

浏览器打开 **<http://127.0.0.1:4321/>**

> 注意：开发模式的网址**不带** `/my-blog/`，直接访问根路径。
> 如果浏览器说"拒绝连接"，一定是服务没在运行——这个网站是静态的，
> 只有 `npm run dev`（或 `npm run preview`）运行期间才能访问，关掉窗口就没了。

改 Markdown 或代码会立即生效，`Ctrl+C` 停止。

写新文章：

```powershell
npm.cmd run new -- blog "今天想明白的一件事"
```

---

## 第 3 步：在 GitHub 创建仓库

1. 注册/登录 <https://github.com>（如果还没有账号）；
2. 打开 <https://github.com/new>；
3. Repository name 填 **`my-blog`**；
4. 选 **Public**（免费版 Pages 需要公开仓库）；
5. **不要**勾选 "Add a README file"（本地已经有内容了）；
6. 点 **Create repository**。

> 仓库名可以换成别的，但一旦确定就别改了——网址里会包含它。
> 想换还记得同时改 `package.json` 里的 `name`。

---

## 第 4 步：推上去

在 `site` 目录执行（把 `Edison-bit394` 换成你的用户名，注意是**连字符**）：

```powershell
git remote add origin https://github.com/Edison-bit394/my-blog.git
git push -u origin main
```

第一次 push 会弹出浏览器要求登录 GitHub，按提示授权。

> `package-lock.json` 必须一起提交（上线助手会检查这一点）。
> GitHub Actions 用 `npm ci` 安装依赖，缺这个文件构建必然失败。

---

## 第 5 步：打开 GitHub Pages

1. 打开 `https://github.com/Edison-bit394/my-blog/settings/pages`；
2. **Build and deployment → Source** 选 **GitHub Actions**
   （不要选 "Deploy from a branch"）；
3. 回到仓库 **Actions** 标签，能看到 "Deploy to GitHub Pages" 在运行；
4. 等 1～2 分钟变绿，访问：

   ```
   https://edison-bit394.github.io/my-blog/
   ```

之后每次 `git push`，网站自动更新。

---

## 绑定自己的域名（可选）

### 先买域名

域名必须你本人购买（涉及实名与付款，我无法代办）。国内厂商约 **¥30～60/年**：

| 厂商 | 地址 | 说明 |
| --- | --- | --- |
| 阿里云万网 | wanwang.aliyun.com | 国内主流，需实名认证 |
| 腾讯云 | cloud.tencent.com/product/domain | 同上 |
| Namecheap | namecheap.com | 国外，无需备案，支持支付宝 |

**选域名的建议**：用你的名字拼音，如 `edisonhu.com`。`.com` 最好记；
`.cn` 更便宜但需实名；`.dev` / `.me` 适合个人品牌。
不要买奇怪的后缀——别人记不住就等于没有。

> **关于备案**：用 GitHub Pages + 国外域名商**不需要备案**。
> 国内厂商买的域名如果只是解析到境外服务器，一般也不用备案，
> 但以厂商的实际要求为准。

### 买完之后的配置（两步）

**第一步：设置 DNS 解析**（在域名商的控制台里）

添加一条 CNAME 记录：

| 类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| CNAME | `www` | `edison-bit394.github.io` |

想用裸域名（`edisonhu.com` 不带 www）就再加四条 A 记录，指向 GitHub Pages 的 IP：

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**第二步：告诉 GitHub 和网站**

1. 到 `https://github.com/Edison-bit394/my-blog/settings/pages`；
2. **Custom domain** 填你的域名，点 Save；
3. 等 DNS 生效（几分钟到几小时），勾选 **Enforce HTTPS**（证书自动签发）；
4. 打开 `site/astro.config.mjs`，把 `detectSite()` 换成你想要的地址——
   **最省事的做法**是设置环境变量，见下面。

### 绑域名后怎么让链接正确

`astro.config.mjs` 会自动判断网址，绑了域名后有两种改法：

**做法 A（推荐）：设置环境变量**，代码不用改

在 GitHub 仓库 → **Settings → Secrets and variables → Actions → Variables** 里新增：

| 名称 | 值 |
| --- | --- |
| `SITE_URL` | `https://你的域名/` |
| `SITE_BASE` | `/` |

然后改 `.github/workflows/deploy.yml`，在构建那一步加上环境变量：

```yaml
      - name: 构建站点
        run: npm run build
        env:
          SITE_URL: ${{ vars.SITE_URL }}
          SITE_BASE: ${{ vars.SITE_BASE }}
```

**做法 B：直接写死在配置里**

把 `astro.config.mjs` 里的 `const { url, base } = detectSite();` 改成：

```js
const { url, base } = { url: 'https://你的域名/', base: '/' };
```

改完 push，网站就会用新域名生成所有链接。

---

## 日常写作流程

```powershell
npm.cmd run new -- blog "标题"    # 1. 新建草稿
# 2. 写内容，把 draft 改成 false
npm.cmd run publish               # 3. 若笔记在 Obsidian 知识库里，先同步
npm.cmd run dev                   # 4. 本地确认
git add . ; git commit -m "新增：标题" ; git push   # 5. 上线
```

---

## 常见问题排查

### 该填的网址在哪？

**不用填。** `astro.config.mjs` 通过 `src/lib/site-url.mjs` 自动判断：

1. 有环境变量 `SITE_URL` → 用它（绑域名后用这个）
2. 在 GitHub Actions 里 → 用仓库信息自动算出 `https://用户名.github.io/仓库名/`
3. 本地开发 → 用 localhost（不影响预览）

### 浏览器显示"拒绝连接"

服务没在运行。这个网站是静态的，必须开着服务才能访问：

```powershell
npm.cmd run dev        # 开发模式，网址是 http://127.0.0.1:4321/
```

### 构建报 `require is not defined`

Astro 7 + Vite 8 的已知坑：官方 `astro/loaders` 的 `glob()` 依赖 `picomatch`（CommonJS），
会被内联进 ESM 模块运行器而崩溃。

**本项目已经绕开了**：内容集合用的是自带的 `src/loaders/markdown-dir.ts`。
**不要把 `content.config.ts` 里的 `markdownDir()` 改回官方 `glob()`。**

### 源文件删了，页面还在生成（幽灵页面）

九成是 `src/` 下留了 `content.config.ts.bak` 之类的**备份文件**。
Astro 会把同目录下多个 `content.config.*` 一起加载并**合并集合**，
旧配置里的条目继续生成页面，日志里毫无提示，极难排查。

```powershell
npm.cmd run preflight    # 会直接指出是哪几个文件
```

### 构建报语法错误 / 提示 "This error is often caused by a syntax error"

检查文件是否存成了**带 BOM 的 UTF-8**。`npm.cmd run preflight` 会列出所有带 BOM 的文件。
VS Code 右下角编码选 **UTF-8**（不要选 "UTF-8 with BOM"）。

### 页面能打开但没有样式

`base` 判断错了，通常是没有正确识别仓库名。检查仓库名是否为 `my-blog`，
或临时用环境变量 `SITE_BASE=/my-blog/` 强制指定。

### Actions 里构建失败，报 `npm ci` 相关错误

`package-lock.json` 没提交。执行：

```powershell
git add package-lock.json ; git commit -m "补 lock 文件" ; git push
```

### 附件图片

图片放到 `public/images/`，Markdown 里写：

```markdown
![说明](/my-blog/images/图片名.png)
```

注意路径要包含仓库名（即 `base`）。
