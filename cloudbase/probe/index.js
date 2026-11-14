// 整段替换测试云函数的 index.js，保留模板的其他文件。
// 仅返回连接状态，不访问数据库、不使用管理密钥。
(async function () {
  const { createServer } = await import('node:http');
  const allowedOrigin = 'https://kuaileyuanbao-code.github.io';
  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    };
    if (origin && origin !== allowedOrigin) {
      res.writeHead(403, headers);
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }
    if (origin === allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = allowedOrigin;
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      headers['Access-Control-Max-Age'] = '600';
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD, OPTIONS' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, service: 'christmas-tree-probe' }));
  });
  server.listen(Number(process.env.PORT || 9000), '0.0.0.0', () => {
    console.log('Christmas probe listening on port ' + server.address().port);
  });
  server.on('error', () => { console.error('Christmas probe could not start'); process.exitCode = 1; });
})().catch(() => { console.error('Christmas probe could not start'); process.exitCode = 1; });
