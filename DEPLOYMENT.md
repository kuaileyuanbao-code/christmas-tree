# 快乐源宝的圣诞树 · 共享版部署说明

**游戏网址：[快乐源宝的圣诞树](https://kuaileyuanbao-code.github.io/christmas-tree/)**

2026-11-14 经树主人确认，正式后端已从 Cloudflare 迁移到腾讯云 CloudBase，GitHub Pages分享网址不变。原记录与删除状态迁移并核对成功，原服务保留作回退。线上完整答题、留言、提交、详情、刷新保存、素材加载及树主管理页登录、移除与导出均已验证，测试挂件已移除；手机真机跨网络共享仍待树主人验收。下面保留可复用的部署说明，已完成步骤无需重复执行，后续正式发布仍按树主人的确认要求进行。

## 1. 现在的结构

当前使用GitHub Pages前端、腾讯云CloudBase云函数和文档数据库后端。腾讯云接入及迁移顺序见 [cloudbase/api/README.md](cloudbase/api/README.md)。本文件后续Cloudflare部署步骤保留为原服务的维护与回退说明，不需要重新执行或删除旧服务。

| 部分 | 放在哪里 | 作用 |
| --- | --- | --- |
| 当前 React/Vite 页面及所有素材 | GitHub Pages | 同学访问的唯一网页地址 |
| HTTP API | 腾讯云 CloudBase HTTP云函数 | 校验、重新计分、读写挂件、鉴权管理 |
| 挂件、留言、答卷、限流与删除记录 | 腾讯云 CloudBase文档数据库 | 所有手机共享的持久数据库 |

无需电脑一直开机，也没有 Render 服务、定时保活或等待长期休眠进程启动的设计。页面可见且停留在树主页时，每30秒读取一次新挂件；回到页面或切回浏览器时立即刷新。答题、留言和动画不变。可直接手动刷新查看最新记录。

## 2. 先在本机试玩共享版

安装 **Node.js 24**。首次在项目目录运行：

```powershell
npm ci
npm start
```

`npm start` 会创建本机配置、应用**本地**D1迁移，并启动本地API与前端。如果两个服务已运行，会复用现有端口。打开 http://127.0.0.1:5173/ 。双击 `启动圣诞树.cmd` 也可以。

也可以分开启动，便于看日志：

```powershell
npm run setup:local
npm run db:local
# 终端一
npm run api:dev
# 终端二
npm run dev
```

本地API为 http://127.0.0.1:8787 。`--local` 只访问电脑中的D1模拟库，不登录Cloudflare、不创建线上资源。本地持久数据在 `.wrangler/state/`，关闭服务不会清空；不要删除这个目录。

`setup:local` 生成 `.dev.vars` 内的本机随机管理员凭据及IP哈希盐，也生成 `.env.local` 的公开API地址。不会显示密钥，不覆盖已有配置。这些文件都被Git忽略。若你后续把 `wrangler.jsonc` 改成线上来源，可在 `.dev.vars` 增加下面一行覆盖本地来源：

```text
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173
```

用一个普通窗口和一个隐私窗口访问同一地址，分别答题提交，能看到彼此的挂件。此时仍是**电脑上的本地联调**，手机不能通过127.0.0.1访问你的电脑，不等于已经上线。

## 3. 确认上线后：准备Cloudflare

本项目已完成本节操作；以下保留为以后维护或重新部署的参考，不要重复创建数据库或更换密钥。

1. 注册/登录Cloudflare，保持Free计划即可先按几十位同学的规模使用。
2. 在项目目录登录并创建D1：

```powershell
npx wrangler login
npx wrangler d1 create christmas-tree
```

3. 将返回的 `database_id` 写入 `wrangler.jsonc` 的DB配置，替换全零占位符。保留 `binding: "DB"`、`database_name: "christmas-tree"` 和 `migrations_dir`。
4. 在同一文件中设置 `vars.ALLOWED_ORIGINS` 为未来GitHub Pages的**来源**：

```json
"ALLOWED_ORIGINS": "https://你的GitHub用户名.github.io"
```

例如网页是 `https://alice.github.io/christmas-tree/`，这里填写 `https://alice.github.io`，**不含仓库子路径、不带结尾斜杠**。可用逗号添加多个明确来源，不使用 `*`。如果以后改自定义域名，同步更新这里。

5. 生成两个不同的随机密钥。以下命令每次生成一个；你自己保存输出，不要提交进Git、写进README或聊天：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

设置Worker Secrets，按提示粘贴刚生成的值：

```powershell
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put IP_HASH_SECRET
```

如果Wrangler提示是否创建同名Worker，需要你确认。管理员密钥仅保存在Worker Secrets及你自己的密码保管处，**不能使用VITE_前缀、不能放GitHub仓库Variables、不能写入公开前端**。IP_HASH_SECRET用于对限流标识做HMAC，不存储原始IP。不要随意更换它，否则已有浏览器的重复识别和短期限流会重新开始。

6. 应用线上迁移并发布API：

```powershell
npx wrangler d1 migrations apply DB --remote
npm run api:deploy
```

`api:deploy` 会先检查DB占位符和HTTPS来源，配置未完成会拒绝部署。保存Wrangler返回的API地址，例如 `https://happy-yuanbao-christmas-api.你的子域.workers.dev`。

7. 在浏览器打开 `API地址/api/health` 和 `API地址/api/decorations`，应得到JSON。第一次挂件列表为空是正常的。管理接口未鉴权应返回401。

## 4. 确认公开代码后：准备GitHub Pages

1. 创建一个用于此项目的GitHub仓库，例如 `christmas-tree`。若使用免费账户的公开仓库，代码和题库会公开；不要上传 `.dev.vars`、`.env.local`、`backups/` 或管理员凭据。它们已列入 `.gitignore`。
2. 确认后把本项目代码推送到仓库。本项目已获树主人明确授权创建公开仓库并上传源码；只上传核对过的文件，不使用包含本机存档的整目录上传。
3. 仓库 **Settings → Secrets and variables → Actions → Variables** 添加公开变量：

| 名称 | 值 |
| --- | --- |
| VITE_API_URL | 上一步Worker的HTTPS源地址，不带 `/api`、结尾斜杠可省略，不带密钥 |
| PAGES_BASE_PATH | 一般不用设置；普通仓库自动用 `/仓库名/`，`用户名.github.io`仓库自动用 `/` |

如果使用自定义域名或确实要根路径，设 `PAGES_BASE_PATH=/`。后台密钥不进入GitHub Actions，也不进入前端。

4. **Settings → Pages → Source** 选择 **GitHub Actions**。
5. 打开 **Actions → Publish Christmas Tree to GitHub Pages → Run workflow**，由你明确点击发布。工作流只支持手动触发，没有配置push自动发布。
6. 工作流执行 `npm ci`、32项自动测试、类型检查和Vite构建，然后发布 `dist`。构建缺少API地址会失败，不会发布一个偷偷使用localStorage的正式版本。
7. 分享工作流输出的 **GitHub Pages网址**，不是Worker API网址。所有同学用同一个页面地址。

素材地址已使用 `import.meta.env.BASE_URL`，Vite `base` 由仓库路径配置。已本地实测 `/christmas-tree-test/` 下的JS、CSS与树体加载。无需把图片路径手改回 `/assets/`。

## 5. 管理员删除、备份与旧存档迁移

### 独立树主管理页

本地已完成管理页，正式使用前需要确认发布包含本次修改的前端版本。发布后，打开游戏网址并在末尾加 `#admin`，例如 `https://kuaileyuanbao-code.github.io/christmas-tree/#admin`。首页没有管理按钮，知道这个地址也不等于具有管理权限；每次均由后端验证管理密钥。

输入现有 Worker 的 `ADMIN_TOKEN` 后，可以查看当前挂件与留言、刷新列表、导出JSON备份，并在核对昵称和留言后确认移除挂件。移除后公共列表不再显示该挂件，其他设备刷新或下次自动读取时同步；备份仍保留移除记录。该页面不提供一键清空或批量删除。

管理密钥只用于当前页面内存中的鉴权请求，不进入URL、localStorage、sessionStorage、前端源码或公开配置；刷新页面、退出管理后需要重新输入。不要把管理密钥发给同学，也不要将备份上传公开仓库。若其他手机看到“暂未连接共享圣诞树”，应先排查后端网络可达性，人数不能据此判断为0。

下面的命令行管理工具仍然保留，可用于旧存档迁移和维护。

在PowerShell中安全输入管理员密钥供本次终端使用：

```powershell
$treeAdminSecret = Read-Host "输入管理员密钥" -AsSecureString
$env:TREE_ADMIN_TOKEN = [System.Net.NetworkCredential]::new('', $treeAdminSecret).Password
New-Item -ItemType Directory -Force backups | Out-Null
```

导出JSON备份（文件名不要与已有文件重名，工具不覆盖）：

```powershell
npm run admin -- export --url https://你的API.workers.dev --out backups/tree-2026-11-13.json
```

备份包括挂件ID、昵称、留言、造型、成绩、答卷和移除状态，不含原始IP或管理员密钥。它属于私人备份，不要上传公开仓库。

核对备份中的昵称和ID后移除一枚挂件：

```powershell
npm run admin -- delete --url https://你的API.workers.dev --id 挂件ID --confirm
```

移除采用软删除，其他手机下一次读取时不再显示；重试旧提交不会让它复活。备份仍可看到移除记录。

**旧的localStorage挂件没有删除，但不会自动上传或与云端混合。** 若需要保留旧挂件：在原来存有挂件的浏览器、原网址打开开发者工具Console，运行下面的只读命令，复制输出为 `backups/old-local.json`：

```js
localStorage.getItem('my-christmas-tree:v1')
```

保存的是输出字符串的内容，即JSON数组本身；不要把Console显示的外层引号也复制进去。不要导入模拟预览数据。只有你确认后，才执行：

```powershell
npm run admin -- import --url https://你的API.workers.dev --file backups/old-local.json --confirm
```

同样可用 `import` 恢复导出的JSON备份。工具每批最多20条，不覆盖已有ID，重复执行不会重复导入或复活已移除的记录。无满分字段的旧记录按7分制保留原成绩、原高度，新的10分制记录保留10分制含义。管理员导入是对可信备份的操作；同学公开提交的接口仍只接受答卷并重新计分。

操作完成后清除本次终端变量：

```powershell
Remove-Item Env:TREE_ADMIN_TOKEN
Remove-Variable treeAdminSecret
```

## 6. 提交保护与维护边界

- 昵称1～12个Unicode字符，留言最多80个，造型和颜色仅接受已实现的白名单。答卷必须正好十个0～3的整数，题库版本要匹配。
- 服务端忽略客户端的分数、满分及创建时间，按当前正式题库重新计算；保留前端即时红叉/绿勾体验。前端仍含正确答案，因此这不是防止查看源码或构造答卷的考试系统。
- 同一个提交ID重试返回同一挂件；同浏览器同内容换ID也不会重复创建。不同内容复用同一ID返回409。网络失败时保持设计，可点击重试，云端失败不会回退成本地保存。
- 每个浏览器标识最多3份新提交/10分钟、10份/天；共享IP最多120份/10分钟、400份/天，另有180次提交尝试/10分钟的IP限制。返回429时提供Retry-After。计数在D1，Worker重启不清空，适当给同学共用校园Wi-Fi留余量。
- 浏览器标识不是登录身份，更换浏览器/IP仍可能绕开部分限制；这是几十人个人项目的基础防刷方案，没有新增验证码、账号或复杂风控。
- 公开API只返回展示所需字段，不返回答卷、IP哈希或内部重复检测字段。管理密钥不能通过URL参数传递。
- GitHub Pages域名需要在CORS允许列表中；CORS是浏览器来源约束，不能替代管理员鉴权。

当前免费额度以Cloudflare官方页面为准：Workers Free为100,000请求/天；D1 Free为500万行读取/天、10万行写入/天和5GB总存储。几十位同学正常试玩可先采用Free，但不是无限额度。页面隐藏和答题时不会持续轮询；仍建议上线后查看用量和错误日志。详情：[Workers限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1定价](https://developers.cloudflare.com/d1/platform/pricing/)。

## 7. 你需要完成的跨设备验收

正式部署完成后再做，不能用本地模拟代替：

1. 电脑打开最终Pages网址；手机使用移动网络打开同一网址，检查树体、挂件DIY、十题和按钮。
2. 手机提交一枚带独特昵称和留言的挂件，电脑回到网页或刷新，应看到同一个ID、成绩与留言；电脑再提交，手机也应看到。
3. 关闭所有浏览器，再用隐私窗口或另一台手机访问，挂件仍在。不需要启动本地终端或保持你的电脑开机。
4. 测试0/3/5/7/10分对应下层/中下/中上/上层/树顶；所有挂件应同时显示，允许重叠但不遮住固定星星，重叠处可选择查看。
5. 重复点提交、弱网后重试，不产生重复挂件；错误答卷、过长内容被拒绝；频繁提交出现等待提示。
6. 管理员导出备份、移除一条测试挂件，其他手机应同步消失；无密钥不能删除或导出。
7. 分别用校园Wi-Fi与移动网络验证Pages及Worker可访问性和实际等待时间；这是上线后需要真机确认的部分。

## 8. 本地验证命令与结果

```powershell
npm test
npm run check
npm run test:cloud
npm run build
```

`test:cloud` 使用本机Microsoft Edge，自动启动隔离的Worker/D1与子路径静态站点，关闭测试浏览器后重开、重启Worker，再检查共享和管理员删除。测试库在忽略目录 `.test-artifacts/`，不会写入你的正式数据库或平时本地D1。

32项自动测试通过。最初本地共享版联调结果保存在开发电脑的 `screenshots/cloud-verification.txt`，上线验收记录位于被Git忽略的 `backups/`。首次正式发布的完整线上流程已通过；树主人随后反馈手机微信和夸克无法连接后端，该网络可达性问题仍在定位，不应据电脑验收结果推断所有手机均已可用。

旧的单机UI验收脚本和素材历史仍保留。需要时先开 `npm run dev:offline`（5174端口），再运行旧的 `scripts/verify.mjs`、`verify-layout.mjs`、`verify-compatibility.mjs` 或 `capture.mjs`。离线模式仅允许开发，不能用于生产构建。

实现依据：[Vite的Pages部署说明](https://vite.dev/guide/static-deploy)、[D1本地开发](https://developers.cloudflare.com/d1/best-practices/local-development/)、[D1迁移](https://developers.cloudflare.com/d1/reference/migrations/)、[Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
