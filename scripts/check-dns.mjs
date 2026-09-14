#!/usr/bin/env node
/**
 * 检查域名解析是否正确指向了 GitHub Pages。
 *
 * 用法：
 *   node scripts/check-dns.mjs                                    # 默认查我们自己的域名
 *   node scripts/check-dns.mjs --domain example.com
 *   node scripts/check-dns.mjs --domain example.com --wait        # 每 20 秒重试，直到生效
 */
import { Resolver } from 'node:dns/promises';

const args = process.argv.slice(2);
const getOption = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const domain = getOption('domain', 'edison-bit394.online');
const cnameTarget = (getOption('target', 'Edison-bit394.github.io') ?? '').toLowerCase();
const WAIT = args.includes('--wait');

const GITHUB_IPV4 = new Set([
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153',
]);

// 用公共 DNS，避免本地缓存或运营商劫持干扰判断
const resolver = new Resolver({ timeout: 8000, tries: 2 });
resolver.setServers(['223.5.5.5', '119.29.29.29', '8.8.8.8']);

async function checkOnce() {
  const result = { apexOk: false, wwwOk: false, apexIps: [], wwwTargets: [], errors: [] };

  try {
    const ips = await resolver.resolve4(domain);
    result.apexIps = ips;
    result.apexOk = ips.some((ip) => GITHUB_IPV4.has(ip));
  } catch (error) {
    result.errors.push(`A 记录查询失败：${error.code ?? error.message}`);
  }

  try {
    const targets = await resolver.resolveCname(`www.${domain}`);
    result.wwwTargets = targets;
    result.wwwOk = targets.some((t) => t.toLowerCase().startsWith(cnameTarget));
  } catch (error) {
    result.errors.push(`www CNAME 查询失败：${error.code ?? error.message}`);
  }

  return result;
}

function printResult(result) {
  console.log('');
  console.log(`域名：${domain}`);
  console.log('');

  console.log(`  A 记录（裸域名）`);
  if (result.apexIps.length) {
    for (const ip of result.apexIps) {
      console.log(`    ${GITHUB_IPV4.has(ip) ? '✓' : '?'} ${ip}${GITHUB_IPV4.has(ip) ? '' : '   ← 不是 GitHub Pages 的 IP'}`);
    }
  } else {
    console.log('    （无记录）');
  }
  console.log(`    判定：${result.apexOk ? '✓ 正确指向 GitHub Pages' : '✗ 未正确指向'}`);

  console.log('');
  console.log(`  www 子域`);
  if (result.wwwTargets.length) {
    for (const t of result.wwwTargets) console.log(`    → ${t}`);
  } else {
    console.log('    （无记录）');
  }
  console.log(`    判定：${result.wwwOk ? '✓ 正确指向' : '✗ 未正确指向'}`);

  if (result.errors.length) {
    console.log('');
    console.log('  查询过程中的问题：');
    for (const e of result.errors) console.log(`    ${e}`);
  }
}

if (!WAIT) {
  const result = await checkOnce();
  printResult(result);
  const ok = result.apexOk && result.wwwOk;
  console.log('');
  console.log(ok ? '解析已就绪，可以去 GitHub 绑定域名了。' : '解析还没就绪。刚配好请等几分钟；配置正确的话下面给排查方向。');
  if (!ok) {
    console.log('');
    console.log('排查方向：');
    console.log('  · 刚添加记录：等 1～10 分钟，运营商 DNS 缓存可能更久');
    console.log('  · A 记录必须是 185.199.108~111.153 这 4 个');
    console.log('  · CNAME 的值不要带 https:// 和结尾的点');
    console.log('  · 确认记录加在了 edison-bit394.online 这个域名下，不是别的域名');
    console.log('  · 如果你刚改过 NS，可能需要更长时间传播');
  }
  process.exit(ok ? 0 : 1);
}

// --wait：轮询直到生效
const maxRounds = 30;
for (let round = 1; round <= maxRounds; round += 1) {
  const result = await checkOnce();
  const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const ok = result.apexOk && result.wwwOk;
  console.log(`[${stamp}] 第 ${round} 次：A ${result.apexOk ? '✓' : '✗'}  www ${result.wwwOk ? '✓' : '✗'}`);
  if (ok) {
    printResult(result);
    console.log('\n解析已就绪。');
    process.exit(0);
  }
  if (round < maxRounds) await new Promise((r) => setTimeout(r, 20000));
}

console.log('\n等待超时。解析仍未生效，请检查 DNSPod 里的记录配置。');
process.exit(1);
