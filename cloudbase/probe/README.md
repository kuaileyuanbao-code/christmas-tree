# 腾讯云后端连接测试

**当前 `index.js` 已适配控制台的HTTP服务器模板（Node.js 20.19，监听9000，含 `scf_bootstrap`），同时兼容CommonJS/ESM包类型。只替换控制台的 `index.js`，保留官方模板的 `package.json` 和 `scf_bootstrap`。此前生成的旧测试ZIP是旧入口形式，暂勿上传。**

目标环境：`kuaileyuanbao-1-d3fyvgay17a93790`，上海。环境来自树主人提供的控制台截图，体验版有效期至2026-12-05、自动续费未开启。续费或套餐升级由树主人另行决定。

本目录只用于最小连接测试，不是完整游戏后端，不包含数据库SDK、数据库写入、管理员密钥或任何生产数据。

- 建议函数名：`christmas-tree-probe`。
- 代码文件：`index.js`，使用Node内置HTTP服务器，默认9000端口。
- 无需填写 `index.main` 事件执行方法；保留当前HTTP函数的启动文件和监听端口，暂不创建云托管服务。
- 无依赖，无需填写SecretId、SecretKey、管理员密钥或数据库环境变量。
- 预期HTTP GET结果：状态200、JSON `{"ok":true,"service":"christmas-tree-probe"}`。
- 需要在HTTP网关配置独立测试路由后，才能验证公网HTTP访问；控制台内部测试成功不代表手机或GitHub Pages跨源调用成功。
- 浏览器允许来源为现有GitHub Pages源 `https://kuaileyuanbao-code.github.io`。不允许任意来源。
- 默认域名可能存在平台提示页、限频等限制，须实际验证HTTP响应和浏览器fetch，不能仅依据“能打开域名”判断成功。

树主人反馈添加跨域域名需付费升级。改用腾讯云文档明确支持的后端自定义CORS方式：先部署本文件，确认仍返回测试JSON，再仅对该 `/probe` 路由关闭网关「跨域设置」开关，让应用响应头生效。应用仍只允许现有GitHub Pages源；不使用 `*`，不关闭管理员鉴权（该探针本身不包含管理功能）。

必须再次检查真实HTTP响应及预检，然后在GitHub来源的真实浏览器中验证，不能仅凭本地测试宣称已解决平台套餐、默认域名或完整游戏共享问题。现有 `posts`、`profile`、Cloudflare数据库和游戏前端均保留。
