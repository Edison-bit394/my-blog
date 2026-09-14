# 配 DNS 解析（两条路，任选一条）

目标：让你的域名 `edison-bit394.online` 指向 GitHub Pages。

需要 **5 条记录**：

| 主机记录 | 类型 | 记录值 |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `Edison-bit394.github.io` |

> 这 4 个 A 记录 IP 是 GitHub Pages 官方公布的，必须全加（作用是容灾，
> 只加一个的话 GitHub 那台机器出问题时你的网站就打不开）。

---

## 路线 A：手工在控制台点（约 2 分钟，最简单）

1. 打开 <https://console.dnspod.cn/> 并登录（腾讯云账号）；
2. 左侧 **我的域名** → 找到 `edison-bit394.online` → 点它；
3. 进入 **记录管理** 页，点 **添加记录**，按上表加 5 条：
   - 主机记录填 `@` 表示裸域名，填 `www` 表示 www 子域；
   - 记录类型在**国内线路**下选 A 或 CNAME；
   - 记录值照抄，**CNAME 的值不要带 `https://`，结尾也不要加点**；
   - 线路类型保持默认，TTL 填 600 或默认值即可；
4. 全部加完后，运行验证：

```powershell
cd "D:\AI\workspace\thesis\my experience\site"
node scripts/check-dns.mjs
```

看到 `A ✓` 和 `www ✓` 就成功了。没生效就等几分钟再试，或加 `--wait` 自动轮询：

```powershell
node scripts/check-dns.mjs --wait
```

---

## 路线 B：用脚本自动配（需要 DNSPod 密钥）

### 第 1 步：拿密钥

1. 打开 <https://console.dnspod.cn/account/token>（或：控制台右上角头像 →
   **密钥管理**）；
2. 点 **创建密钥**；
3. 填写备注（比如 `dns-setup`），权限可以先给默认的；
4. **复制生成的密钥**，格式是 `数字ID,一串字母数字`，例如：

   ```
   123456,abcdef1234567890abcdef1234567890
   ```

   ⚠️ 这串东西**等同于你的账号权限**，不要发给任何人，也不要提交到 Git。
   它只会出现在你自己的终端里。

### 第 2 步：先 dry-run 看一眼要建什么

```powershell
cd "D:\AI\workspace\thesis\my experience\site"
$env:DNSPOD_TOKEN = "粘贴你的密钥"
node scripts/setup-dns.mjs --domain edison-bit394.online --dry-run
```

这会列出将要创建的 5 条记录，**不会真的创建**。

### 第 3 步：真正创建

```powershell
node scripts/setup-dns.mjs --domain edison-bit394.online --yes
```

脚本会：
- 先读出你现有的记录，**已存在的不重复创建**（可以反复运行）；
- 逐条创建，并报告成功/失败原因；
- 最后提醒你去验证。

### 第 4 步：验证

```powershell
node scripts/check-dns.mjs --wait
```

### 用完请删掉这个密钥

配完 DNS 后，回到 <https://console.dnspod.cn/account/token> 把刚才那个密钥**删除**。
以后需要再建一个即可——最小暴露原则。

---

## 如果脚本报 `HTTP 401`

说明当前网络访问 `dnsapi.cn` 被拦截（企业代理、云主机出口、部分校园网会这样）。
**这不影响你手工配置**，走路线 A 即可。

---

## 我（AI）能代劳到哪一步

| 事情 | 能不能代做 |
| --- | --- |
| 写好配置脚本、验证脚本 | ✅ 已完成 |
| 告诉你要加哪 5 条记录 | ✅ 就是上面那张表 |
| **用你的账号调 DNSPod API 写记录** | ⚠️ 需要你把密钥给我 |
| 拿不到密钥时自己生成一个 | ❌ 密钥绑定你的账号，只能你本人创建 |

如果你不想把密钥给我（合理的选择，它权限很大），就走路线 A 手工点，
点完告诉我，我帮你验证解析是否生效、有没有漏记录。

---

## 配完之后

DNS 生效后，还有两步（见 `上线清单.md`）：

1. GitHub 仓库 → Settings → Pages → Custom domain 填 `edison-bit394.online` → Save；
2. 等证书签发后勾选 **Enforce HTTPS**。
