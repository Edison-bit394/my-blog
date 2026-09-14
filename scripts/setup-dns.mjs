#!/usr/bin/env node
/**
 * 把 GitHub Pages 需要的 DNS 记录配到 DNSPod 上。
 *
 * 为什么需要它：绑定域名必须配 5 条解析记录（4 条 A + 1 条 CNAME），
 * 手工在控制台点容易漏掉其中一条 A 记录，漏了就可能出现"有时能开有时打不开"。
 *
 * 用法（推荐，密钥走环境变量，不出现在命令历史里）：
 *
 *   $env:DNSPOD_TOKEN = "你的ID,你的Token"
 *   node scripts/setup-dns.mjs --domain edison-bit394.online --dry-run
 *   node scripts/setup-dns.mjs --domain edison-bit394.online --yes
 *
 * 也支持参数传入（不推荐，会留在命令历史里）：
 *   node scripts/setup-dns.mjs --domain example.com --token "ID,Token" --yes
 *
 * 参数：
 *   --domain   你的域名（必填）
 *   --target   CNAME 指向的目标，默认 edison-bit394.github.io
 *   --sub      CNAME 的子域名，默认 www。传空字符串表示不加 CNAME
 *   --dry-run  只显示将要创建什么，不实际调用创建接口
 *   --yes      跳过确认（自动化用，手工跑建议不加）
 *
 * DNSPod 密钥获取：DNSPod 控制台 → 用户中心 → 密钥管理 → 创建密钥，
 * 拿到形如 123456,abcdef1234567890 的字符串（ID,Token）。
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/* ------------------------------------------------------------------ */
/* DNSPod 官方指定的 GitHub Pages 地址                                 */
/* ------------------------------------------------------------------ */

const GITHUB_PAGES_IPV4 = [
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153',
];

/* ------------------------------------------------------------------ */
/* 参数解析                                                            */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getOption = (name, fallback = undefined) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) return fallback;
  return value;
};

const domain = getOption('domain');
const token = getOption('token') ?? process.env.DNSPOD_TOKEN ?? '';
const target = getOption('target', 'Edison-bit394.github.io');
const subdomain = getOption('sub', 'www');
const DRY_RUN = hasFlag('dry-run');
const SKIP_CONFIRM = hasFlag('yes');

/**
 * 裸域名（apex）用几条 A 记录。
 *
 * GitHub Pages 官方推荐 4 条（4 个 IP 互为容灾），但**很多免费 DNS 套餐限制 A 记录条数**，
 * 例如 DNSPod 免费版只给 2 条。实测 1 条也能正常工作，只是少了容灾。
 *
 *   --apex single   只加 1 条（默认，兼容免费版限制）
 *   --apex multi    加满 4 条（DNS 服务商允许时推荐）
 */
const apexMode = getOption('apex', 'single');
if (!['single', 'multi'].includes(apexMode)) {
  console.error('--apex 只能是 single 或 multi');
  process.exit(1);
}

if (!domain) {
  console.error('缺少 --domain 参数。例如：--domain edison-bit394.online');
  process.exit(1);
}
if (!token && !DRY_RUN) {
  console.error('缺少密钥。请先设置环境变量 DNSPOD_TOKEN，或用 --token 传入。');
  console.error('获取方式：DNSPod 控制台 → 用户中心 → 密钥管理 → 创建密钥');
  process.exit(1);
}
if (token && !/^\d+,[0-9a-fA-F]+$/.test(token)) {
  console.error('密钥格式不对，应该是「数字ID,十六进制Token」，形如 123456,abcdef1234567890');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* API 调用                                                            */
/* ------------------------------------------------------------------ */

/** 国内控制台的密钥走这个域名。注意：部分网络环境访问 dnsapi.cn 会 401。 */
const API_BASE = 'https://dnsapi.cn';

async function callApi(path, params = {}) {
  const body = new URLSearchParams({
    login_token: token,
    format: 'json',
    lang: 'cn',
    error_on_empty: 'no',
    ...params,
  });

  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'personal-site-dns-setup/1.0 (node)',
    },
    body,
  });

  const text = await res.text();

  if (res.status === 401) {
    throw new Error(
      '访问 dnsapi.cn 被拒绝（HTTP 401）。这通常是网络出口限制（例如公司代理或云主机出口）。\n' +
        '    解决办法：在你自己的电脑上、用普通家庭网络运行本脚本。'
    );
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`返回的不是 JSON：${text.slice(0, 200)}`);
  }

  const code = data?.status?.code;
  if (code !== '1') {
    const message = data?.status?.message ?? '未知错误';
    throw new Error(`DNSPod 返回错误 [${code}] ${message}`);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* 要创建的记录清单                                                    */
/* ------------------------------------------------------------------ */

const plannedRecords = [
  ...(apexMode === 'multi' ? GITHUB_PAGES_IPV4 : [GITHUB_PAGES_IPV4[0]]).map((ip) => ({
    name: '@',
    type: 'A',
    value: ip,
    why: '裸域名（不带 www）指向 GitHub Pages',
  })),
  ...(subdomain
    ? [
        {
          name: subdomain,
          type: 'CNAME',
          value: target,
          why: '带 www 的地址指向 GitHub Pages',
        },
      ]
    : []),
];

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

console.log('');
console.log('要给 GitHub Pages 配置的解析记录：');
console.log('');
console.log('  主机记录   类型     记录值');
console.log('  ' + '─'.repeat(58));
for (const r of plannedRecords) {
  console.log(`  ${r.name.padEnd(10)} ${r.type.padEnd(8)} ${r.value}`);
}
console.log('');
console.log(`域名：${domain}`);
console.log(`裸域名模式：${apexMode === 'multi' ? '4 条 A 记录（推荐，含容灾）' : '1 条 A 记录（兼容 DNSPod 免费版等限制）'}`);
if (apexMode === 'single') {
  console.log('  说明：GitHub Pages 官方推荐 4 条 A 记录互为容灾，但 1 条也能正常工作。');
  console.log('        如果你的 DNS 服务商不限条数，用 --apex multi 可以加满 4 条。');
}
if (DRY_RUN) console.log('模式：dry-run（只查看，不调用创建接口）');
console.log('');

if (DRY_RUN) {
  console.log('dry-run 结束。确认无误后去掉 --dry-run 再运行一次。');
  process.exit(0);
}

if (!SKIP_CONFIRM) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`确认要在 ${domain} 上创建这些记录吗？输入 yes 继续：`);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('已取消，没有做任何修改。');
    process.exit(0);
  }
}

// 先确认这个域名在账号里、并且能拿到记录列表
console.log('读取现有记录…');
let existing;
try {
  existing = await callApi('Record.List', { domain, length: '100' });
} catch (error) {
  console.error(`\n✗ 读取记录失败：${error.message}`);
  console.error('\n可能的原因：');
  console.error('  1. 域名不在这个 DNSPod 账号下（检查域名是否拼错）');
  console.error('  2. 密钥没有该域名的权限');
  process.exit(1);
}

const existingRecords = existing.records ?? [];
console.log(`  现有 ${existingRecords.length} 条记录`);

// 逐条创建，跳过已存在的
let created = 0;
let skipped = 0;
let failed = 0;

for (const record of plannedRecords) {
  const duplicate = existingRecords.find(
    (r) => r.name === record.name && r.type === record.type && r.value === record.value
  );

  if (duplicate) {
    console.log(`  ⊘ ${record.type.padEnd(6)} ${record.name.padEnd(6)} ${record.value}  （已存在，跳过）`);
    skipped += 1;
    continue;
  }

  try {
    await callApi('Record.Create', {
      domain,
      sub_domain: record.name,
      record_type: record.type,
      record_line: '默认',
      value: record.value,
      ttl: '600',
    });
    console.log(`  ✓ ${record.type.padEnd(6)} ${record.name.padEnd(6)} ${record.value}`);
    created += 1;
  } catch (error) {
    console.log(`  ✗ ${record.type.padEnd(6)} ${record.name.padEnd(6)} ${record.value}`);
    console.log(`      ${error.message}`);
    failed += 1;
  }
}

console.log('');
console.log(`完成：新建 ${created} 条，跳过 ${skipped} 条，失败 ${failed} 条。`);

if (failed === 0) {
  console.log('');
  console.log('接下来：');
  console.log('  1. 等 1～10 分钟让解析生效（DNSPod 一般很快）');
  console.log('  2. 验证：node scripts/check-dns.mjs --domain ' + domain);
  console.log('  3. 到 GitHub 仓库 Settings → Pages 里填写 Custom domain 并勾选 Enforce HTTPS');
} else {
  process.exit(1);
}
