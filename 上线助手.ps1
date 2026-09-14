<#
.SYNOPSIS
    个人网站上线助手：检查环境 → 配置 Git 身份 → 初始化仓库 → 推送到 GitHub。

.DESCRIPTION
    这个脚本把 DEPLOY.md 里的步骤自动化，并且**每一步都会先检查再执行**，
    避免"命令敲了但没生效"这种让人困惑的情况。

    它做的事：
      1. 检查 Git 是否真的装好了（很多人装了但没重开终端）
      2. 检查你的身份信息，缺了就引导你填
      3. 检查必填文件是否齐全（缺了上线会失败）
      4. 初始化本地仓库并提交
      5. 给出创建 GitHub 仓库和推送的精确命令

.EXAMPLE
    .\上线助手.ps1
    按提示交互执行。

.EXAMPLE
    .\上线助手.ps1 -Email "you@example.com"
    直接指定邮箱，少一次交互。

.NOTES
    若提示"禁止运行脚本"，用这条命令启动：
        pwsh -ExecutionPolicy Bypass -File .\上线助手.ps1
#>
[CmdletBinding()]
param(
    # Git 提交用的邮箱（建议与 GitHub 账号一致）
    [string]$Email,

    # 仓库名。默认 my-blog，会决定网址里的 /my-blog/ 这部分
    [string]$RepoName = 'my-blog',

    # GitHub 用户名（不含空格，可用连字符）
    [string]$GitHubUser = 'Edison-bit394',

    # 只检查不执行任何写操作
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
Set-Location $siteRoot

function Write-Step($text) {
    Write-Host ''
    Write-Host ('━' * 60) -ForegroundColor DarkGray
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ('━' * 60) -ForegroundColor DarkGray
}

function Write-Ok($text)   { Write-Host "  ✓ $text" -ForegroundColor Green }
function Write-Bad($text)  { Write-Host "  ✗ $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host "    $text" -ForegroundColor Gray }
function Write-Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }

$problems = @()

# ── 第 1 步：Git 是否可用 ────────────────────────────────────────────────
Write-Step '第 1 步 / 共 5 步：检查 Git'

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Bad '找不到 git 命令。'
    Write-Info '可能的原因：'
    Write-Info '  1. Git 还没安装 —— 下载：https://git-scm.com/download/win'
    Write-Info '  2. 装完了但没重开终端 —— 关掉这个窗口，重新打开再试'
    Write-Info ''
    Write-Info '装好后在新窗口里执行 git --version，能看到版本号就说明好了。'
    $problems += 'Git 未安装或未生效'
}
else {
    $version = (& git --version 2>&1 | Out-String).Trim()
    Write-Ok "Git 可用：$version"
    Write-Info "位置：$($git.Source)"
}

# ── 第 2 步：身份信息 ────────────────────────────────────────────────────
Write-Step '第 2 步 / 共 5 步：配置 Git 身份'

if ($git) {
    $name = (& git config --global user.name 2>&1 | Out-String).Trim()
    $mail = (& git config --global user.email 2>&1 | Out-String).Trim()

    if (-not $name) {
        $name = 'Edison Hu'
        if (-not $CheckOnly) {
            & git config --global user.name $name
            Write-Ok "已设置 user.name = $name"
        }
    }
    else { Write-Ok "user.name = $name" }

    if (-not $mail) {
        if ($Email) { $mail = $Email }
        elseif (-not $CheckOnly) {
            Write-Warn '还没有设置提交邮箱（GitHub 用它把提交关联到你的账号）。'
            $mail = Read-Host '  请输入你的邮箱（直接用 GitHub 注册邮箱最省事）'
        }
        if ($mail -and -not $CheckOnly) {
            & git config --global user.email $mail
            Write-Ok "已设置 user.email = $mail"
        }
        elseif (-not $mail) { $problems += '提交邮箱未设置' }
    }
    else { Write-Ok "user.email = $mail" }
}
else {
    Write-Warn '跳过（Git 不可用）'
}

# ── 第 3 步：必填文件 ────────────────────────────────────────────────────
Write-Step '第 3 步 / 共 5 步：检查上线必需的文件'

$required = @(
    @{ Path = 'package.json';        Why = '定义依赖和构建命令' },
    @{ Path = 'package-lock.json';   Why = 'GitHub Actions 用 npm ci 安装依赖，缺它必然构建失败' },
    @{ Path = '.github/workflows/deploy.yml'; Why = '自动部署流水线' },
    @{ Path = 'astro.config.mjs';    Why = '站点配置' },
    @{ Path = 'src/consts.ts';       Why = '站点身份信息' },
    @{ Path = 'node_modules';        Why = '依赖已安装（用来生成 lock 文件）' }
)

foreach ($item in $required) {
    if (Test-Path (Join-Path $siteRoot $item.Path)) {
        Write-Ok "$($item.Path)"
    }
    else {
        Write-Bad "$($item.Path)  —— $($item.Why)"
        $problems += "缺少 $($item.Path)"
    }
}

# package-lock.json 不存在时提示怎么生成
if (-not (Test-Path (Join-Path $siteRoot 'package-lock.json'))) {
    Write-Info '生成方法：在本目录执行  npm.cmd install'
}

# ── 第 4 步：本地仓库 ────────────────────────────────────────────────────
Write-Step '第 4 步 / 共 5 步：初始化本地仓库'

if ($git) {
    $isRepo = Test-Path (Join-Path $siteRoot '.git')

    if ($isRepo) {
        Write-Ok '已经是 Git 仓库，跳过初始化'
        $status = (& git status --porcelain 2>&1 | Out-String).Trim()
        if ($status) {
            Write-Info '有未提交的改动：'
            (& git status --short 2>&1) | ForEach-Object { Write-Info $_ }
        }
        else { Write-Info '工作区干净，没有需要提交的改动' }
    }
    elseif ($CheckOnly) {
        Write-Warn '还没初始化（-CheckOnly 模式，不执行）'
    }
    else {
        & git init | Out-Null
        Write-Ok '已执行 git init'

        # 确认关键文件确实会被纳入版本控制
        $ignored = (& git check-ignore package-lock.json 2>&1 | Out-String).Trim()
        if ($ignored) {
            Write-Bad 'package-lock.json 被 .gitignore 忽略了，线上构建会失败！'
            $problems += 'package-lock.json 被忽略'
        }
        else { Write-Ok 'package-lock.json 会被提交（重要）' }

        & git add -A
        $staged = (& git diff --cached --name-only 2>&1 | Measure-Object).Count
        Write-Ok "已暂存 $staged 个文件"

        & git commit -m '初始化个人网站' | Out-Null
        Write-Ok '已创建首次提交'

        & git branch -M main
        Write-Ok '分支已设为 main'
    }
}
else {
    Write-Warn '跳过（Git 不可用）'
}

# ── 第 5 步：下一步怎么做 ────────────────────────────────────────────────
Write-Step '第 5 步 / 共 5 步：接下来你要做的'

if ($problems.Count -gt 0) {
    Write-Host ''
    Write-Bad "有 $($problems.Count) 个问题需要先解决："
    foreach ($p in $problems) { Write-Info "- $p" }
    Write-Host ''
    Write-Host '解决后重新运行本脚本即可。' -ForegroundColor Yellow
    return
}

if (-not $GitHubUser) { $GitHubUser = 'Edison-bit394' }

Write-Host ''
Write-Host '【1】在浏览器里创建仓库' -ForegroundColor Cyan
Write-Info '打开 https://github.com/new'
Write-Info "Repository name 填：$RepoName"
Write-Info '选 Public（免费版 Pages 需要公开仓库）'
Write-Info '不要勾选 Add a README file（本地已经有内容了）'
Write-Info '点 Create repository'

Write-Host ''
Write-Host '【2】把本地代码推上去（在本目录执行）' -ForegroundColor Cyan
Write-Host ''
Write-Host "    git remote add origin https://github.com/$GitHubUser/$RepoName.git" -ForegroundColor White
Write-Host '    git push -u origin main' -ForegroundColor White
Write-Host ''
Write-Info '第一次推送会弹出浏览器要求登录 GitHub，按提示授权即可。'

Write-Host ''
Write-Host '【3】打开 GitHub Pages' -ForegroundColor Cyan
Write-Info "打开 https://github.com/$GitHubUser/$RepoName/settings/pages"
Write-Info 'Source 选 GitHub Actions（不要选 Deploy from a branch）'
Write-Info '然后去 Actions 标签页看部署进度，等 1～2 分钟变绿'

Write-Host ''
Write-Host '【4】访问你的网站' -ForegroundColor Cyan
Write-Host ''
Write-Host "    https://$($GitHubUser.ToLower()).github.io/$RepoName/" -ForegroundColor Green
Write-Host ''
Write-Info '网址不需要你在配置里填——部署时脚本会自动识别你的用户名和仓库名。'

Write-Host ''
Write-Host '以后发布新文章：' -ForegroundColor Cyan
Write-Host '    git add . ; git commit -m "新增文章" ; git push' -ForegroundColor White
Write-Host ''
