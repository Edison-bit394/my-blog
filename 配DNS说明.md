# 配 DNS 解析（含 DNSPod 免费版限制的解法）

目标：让你的域名 `edison-bit394.online` 指向 GitHub Pages。

---

## 先搞清楚那个"只能加 2 个 A 记录"的限制

**这不是你操作错了，是 DNSPod 免费版的真实限制。** 免费套餐只允许有限条数的解析记录
（A 记录通常 2 条），加满了就会提示。

**关键认知：GitHub Pages 官方推荐 4 条 A 记录，是为了容灾，不是技术要求。**
那 4 个 IP（185.199.108~111.153）是同一组服务器，**只加 1 条网站照样能正常访问**，
只是万一 GitHub 那一台出问题，你没有备用 IP 可切。

所以最省事的方案是：**裸域名只用 1 条 A 记录，正好 2 个名额用满**。

| 主机记录 | 类型 | 记录值 | 占用名额 |
| --- | --- | --- | --- |
| `@` | A | `185.199.108.153` | 1 / 2 |
| `www` | CNAME | `Edison-bit394.github.io` | CNAME 名额 |

**只要这 2 条，网站就能正常跑。**

---

## 路线 A：手工在控制台点（2 分钟）

1. 打开 <https://console.dnspod.cn/> 登录；
2. 左侧 **我的域名** → 点 `edison-bit394.online`；
3. **记录管理** → **添加记录**，加两条：

   **第一条**
   - 主机记录：`@`
   - 记录类型：`A`
   - 记录值：`185.199.108.153`
   - 线路：默认，TTL：600（或默认）

   **第二条**
   - 主机记录：`www`
   - 记录类型：`CNAME`
   - 记录值：`Edison-bit394.github.io`
   - ⚠️ 不要带 `https://`，结尾不要加点

4. 保存后运行验证：

```powershell
cd "D:\AI\workspace\thesis\my experience\site"
node scripts/check-dns.mjs --wait
```

看到 `A ✓` 和 `www ✓` 就成功了。

> 如果之前已经加过 1 条 A 记录，且 IP 不在 `185.199.108~111.153` 里，
> 把它改掉或删掉再重加——**IP 必须是 GitHub 的这组**，填错网站打不开。

---

## 路线 B：脚本自动配

```powershell
cd "D:\AI\workspace\thesis\my experience\site"
$env:DNSPOD_TOKEN = "你的ID,你的Token"

# 先看要建什么（默认就是 1 条 A + 1 条 CNAME）
node scripts/setup-dns.mjs --domain edison-bit394.online --dry-run

# 真正创建
node scripts/setup-dns.mjs --domain edison-bit394.online --yes
```

密钥获取：<https://console.dnspod.cn/account/token> → 创建密钥 → 复制 `123456,abcdef...`。
**配完请把这个密钥删掉。**

如果你的 DNS 服务商不限制条数（比如 Cloudflare），想加满 4 条容灾：

```powershell
node scripts/setup-dns.mjs --domain edison-bit394.online --apex multi --yes
```

脚本会**跳过已存在的记录**，可以反复运行。

---

## 如果还是想用 4 条 A 记录

有三个选择：

| 做法 | 说明 |
| --- | --- |
| 升级 DNSPod 套餐 | 花钱解决，不推荐，为了容灾不值 |
| 换用 Cloudflare 免费 DNS | 免费且不限条数，还带 CDN 加速。但需要**改域名的 NS 服务器**，比加两条记录麻烦 |
| 就用 1 条 | **推荐**。容灾对个人博客的实际影响很小，GitHub Pages 本身可用性很高 |

---

## 配完 DNS 后的两步

### 1. 在 GitHub 绑定域名

打开 <https://github.com/Edison-bit394/my-blog/settings/pages>

- **Custom domain** 填 `edison-bit394.online` → **Save**
- 等 DNS 生效（几分钟），勾选 **Enforce HTTPS**

> 如果 GitHub 提示域名解析有问题（有时它对只用 1 条 A 记录的裸域名会警告），
> **改填 `www.edison-bit394.online`** 即可。我已经把 www 的 CNAME 配好了，
> 两种填法都能用，www 那条更稳。

### 2. 验证

```powershell
Resolve-DnsName edison-bit394.online -Type A
curl.exe -I https://edison-bit394.online/
```

---

## 我（AI）能代劳到哪一步

| 事情 | 状态 |
| --- | --- |
| 写好配置脚本、验证脚本 | ✅ 已完成并测试 |
| 查清免费版限制、给出适配方案 | ✅ 就是本文 |
| **用你的账号调 API 写记录** | ⚠️ 需要你把密钥给我，且我的网络出口可能访问不了 `dnsapi.cn`（实测 401） |
| 生成一个密钥 | ❌ 密钥绑定你的账号，只能你本人创建 |

不想给密钥就走路线 A 手工点两条，点完告诉我，我帮你验证有没有配对。
