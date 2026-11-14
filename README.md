# 快乐源宝的圣诞树 · 多人共享版

现有温馨绘本界面、树体和树裙素材、十种DIY挂件、六种颜色、十道正式题目、正误反馈、计分分层、留言与上树动画保持不变。

**游戏网址：[快乐源宝的圣诞树](https://kuaileyuanbao-code.github.io/christmas-tree/)**

2026-11-14 经树主人确认，正式网页已使用 **GitHub Pages + 腾讯云 CloudBase HTTP 云函数及文档数据库**。原有挂件和删除记录已迁移，逐字段核对一致；原 Cloudflare Workers + D1 服务保留作回退。线上十题答题、7分上层、留言、提交、详情、刷新保存及管理员登录、移除和备份导出已验证，测试挂件已移除。手机真机在不同网络下的共享体验仍待树主人确认。

**部署、管理员工具、旧存档迁移及真机验收，见 [DEPLOYMENT.md](DEPLOYMENT.md)。**

首页「树主小屋」已发布：[树主小屋](https://kuaileyuanbao-code.github.io/christmas-tree/#admin)。输入管理密钥后可查看留言、逐个确认移除挂件及导出备份。无需打开其他网站；刷新或退出后需重新输入密钥。连接失败时会显示未连接提示，不会误报0人。

腾讯云真实写入已验证0、3、5、7、10分、后端重新计分、重复提交保护、内容长度校验和软删除；本地及CI的44项测试通过。部署与维护见 [腾讯云接入说明](cloudbase/api/README.md)。腾讯云控制台此前显示体验环境于2026-12-05到期，圣诞节继续使用前需由树主人确认有效期和套餐。

## 挂件位置与首页入口

- 成绩决定高度区域：9～10分树顶附近、7～8分上层、5～6分中上层、3～4分中下层、0～2分下层。每枚挂件独立抽取区域内的高度，因此同一区域内也要看运气。
- 高度从记录ID和云端创建时间稳定生成，不因刷新、换批次或手机/电脑而改变。碰撞避让只调整左右位置；空间不够时分批，不重新抽高度。同分不再使用固定排数或共享位置。
- 「目前挂得最高的是」从全树所有可见记录中按真实高度选出，点击即可切到所在批次并查看留言。固定树顶星星不参与比较；7分制旧记录继续按旧规则分层。
- 树下始终显示「全部挂件」「我的挂件」。全部挂件支持昵称搜索、跨批次定位和高亮；我的挂件记住当前浏览器在新版中成功提交的记录ID。旧提交、清除浏览器记录或换设备后，可按昵称查找，云端挂件不会因此丢失。
- 首页右上角「树主小屋」在当前网页进入 `#admin`，输入现有管理密钥即可查看留言、移除挂件和导出JSON。密钥不放进前端或网址。
- 每批最多电脑41枚、手机32枚；随机高度拥挤时会提前分批，保持挂件间距。可在本地开发调试中模拟30人同得7分及10/30/60/120人的密度。

## 本地完整运行

需要 Node.js 24。在项目目录运行：

```powershell
npm ci
npm start
```

打开 http://127.0.0.1:5173/ 。双击 `启动圣诞树.cmd` 也可以。首次会生成被Git忽略的本机配置、应用本地D1迁移，并启动前端与API。

分开运行时：

```powershell
npm run setup:local
npm run db:local
npm run api:dev  # 终端一，127.0.0.1:8787
npm run dev      # 终端二，127.0.0.1:5173
```

这里的API与D1均是本地模拟环境，不是线上服务。默认共享模式只读写API，连接失败不会回退到localStorage。缺少配置时会报错，不能假装共享成功。

## 验证与构建

```powershell
npm test           # 40项：题库、分层、D1/腾讯存储适配、防重、管理等
npm run check      # 前后端TypeScript检查
npm run test:cloud # 隔离Worker/D1 + 两个独立Edge浏览器 + Pages子路径联调
npm run build      # 必须有VITE_API_URL；产物dist
npm run preview    # 预览dist，默认4173端口
```

`setup:local` 创建 `.env.local`，因此可在本地构建。生产发布必须将公开的 `VITE_API_URL` 设置为实际HTTPS Worker源地址。GitHub工作流仅在树主人手动点击后发布，自动按仓库名设置Vite base。

浏览器联调需要本机Microsoft Edge，测试库在忽略目录 `.test-artifacts/`，不会写入平时本地库或线上库。结果见 `screenshots/cloud-verification.txt`。已验证刷新、关闭所有浏览器后重开、Worker重启仍可读取共享记录；真机与线上网络测试留待部署后执行。

## 数据与接口

- `src/storage.ts` 保留 `DecorationRepository.list()` / `add()`，新增可选答卷参数和服务端记录返回值。普通页面使用HTTP实现；localStorage实现只供旧存档或明确的离线开发验收使用。
- 公开 `GET /api/decorations` 读取同一棵树；`POST /api/decorations` 提交昵称、留言、设计、完整答卷、题库版本和稳定提交ID。后端不使用客户端分数。
- 私有 `GET /api/admin/export` 导出JSON；`DELETE /api/admin/decorations/:id` 移除挂件；`POST /api/admin/import` 迁移可信旧存档或恢复备份。均须Bearer管理员密钥。
- 同源校园Wi-Fi与单浏览器分别限流，计数持久化到D1；重复提交ID、并发重试、同浏览器同内容均有保护。
- 原始IP不保存，内部标识做HMAC；公开列表不返回答卷和内部哈希。
- 旧浏览器存档未删除，不会自动上传。管理员确认导入后，旧7分制原分数和原高度保留，新记录为10分制。导入不覆盖现有ID，也不复活已移除记录。

## 题库与位置

`src/config.ts` 为用户正式十题，3简单＋4中等＋3困难，仅用于内部组织；第2/7/9题按用户要求微调选项顺序，正确位置为 **C、A、B、C、B、D、A、B、A、D**。每题1分，答对绿勾、答错红叉，约0.65秒自动前进。修改题目或顺序时同步递增 `QUIZ_VERSION`。

| 正式成绩 | 区域 |
| --- | --- |
| 9～10 | 树顶星星下方 |
| 7～8 | 上层 |
| 5～6 | 中上层 |
| 3～4 | 中下层 |
| 0～2 | 下层 |

布局与分批算法沿用原版：电脑最多40枚朋友挂件，手机/窄平板最多28枚；各层分别分批，定位并高亮新挂件。彩灯、顶星与小礼物不占人数。记录稳定按服务端时间与ID排序。

## 目录

- `src/App.tsx`：原有页面和完整流程、共享数据刷新。
- `src/config.ts`：树名、题库、正确答案、题库版本。
- `src/model.ts`：计分、旧版兼容、分层与分批布局。
- `src/storage.ts`：HTTP与本地数据接口。
- `src/components/`、`src/style.css`、`public/assets/`：已认可的视觉与素材。
- `worker/index.ts`：Worker API；`worker/migrations/`：D1数据库迁移。
- `wrangler.jsonc`：已绑定本项目生产D1和Pages来源；本地开发使用 `.dev.vars` 覆盖本地来源。复用到其他账号时需替换绑定。
- `.github/workflows/pages.yml`：只手动触发的Pages构建发布。
- `scripts/admin.mjs`：导出、移除与导入命令，凭据不进入前端。
- `tests/`：40项自动测试。
- `DEPLOYMENT.md`：部署及跨设备验收步骤。

## 旧的离线开发模式

如需运行单机模式或历史UI验收，明确使用：

```powershell
npm run dev:offline
# 另一个终端（5174端口）
node scripts/verify.mjs
node scripts/verify-layout.mjs
node scripts/verify-compatibility.mjs
node scripts/capture.mjs
```

离线模式只在开发服务器生效，生产构建会拒绝该模式。旧的 `上线讨论说明.md` 是历史材料；桌面上之前导出的ZIP也是当时的单机版本，当前共享版以本目录源码为准。

管理员凭据仅在Worker Secrets；本地 `.dev.vars`、`.env.local`、D1状态、备份及依赖目录均被Git忽略。GitHub Pages仅需公开API地址，不需要Cloudflare管理员密钥。
