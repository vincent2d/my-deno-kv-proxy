// main.js - 纯内存轮询版本 (临时解决方案)

// 目标 API 地址
const TARGET_API_HOST = "https://generativelanguage.googleapis.com";

// --- 1. 从环境变量中安全地读取 API 密钥 (逻辑不变) ---
const keysString = Deno.env.get("API_KEYS") || "";
const API_KEYS = keysString.split(',').map(k => k.trim()).filter(k => k);

// --- 2. 使用内存变量进行轮询 ---
// 定义一个全局变量来跟踪当前密钥的索引。
// 注意：这个变量在服务重启或重新部署后会重置为 0。
let currentIndex = 0;

console.log("服务启动成功！(使用纯内存轮询模式)");
if (API_KEYS.length > 0) {
  console.log(`已成功从环境变量加载 ${API_KEYS.length} 个 API 密钥。`);
} else {
  console.warn("警告：未在环境变量中找到 API_KEYS。服务将无法处理请求。");
}

// --- 3. 启动服务 ---
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 根路径返回提示信息 (逻辑不变)
  if (url.pathname === '/') {
    return new Response(
      "“这是一个API URL, 你不能直接访问。请把这个地址填写在对应的API URL处~”",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 检查密钥是否已配置 (逻辑不变)
  if (API_KEYS.length === 0) {
    console.error("请求失败：服务器未配置 API_KEYS 环境变量。");
    return new Response(
      "“服务器配置错误: API 密钥未配置。请联系管理员检查环境变量。”",
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // --- 4. 实现内存中的密钥轮询 ---
  // 先获取当前要使用的密钥
  const currentApiKey = API_KEYS[currentIndex];
  console.log(`[In-Memory Rotation] Using API Key at index ${currentIndex}`);

  // 然后立即更新索引，为下一次请求做准备
  // 使用取模运算符 (%) 确保索引在数组范围内循环
  currentIndex = (currentIndex + 1) % API_KEYS.length;

  // --- 5. 路径重写和请求转发逻辑 (逻辑不变) ---
  let pathname = url.pathname;
  if (pathname.startsWith('/v1/')) {
    pathname = pathname.replace('/v1/', '/v1beta/');
    if (pathname.endsWith('/chat/completions')) {
      pathname = pathname.replace('/chat/completions', ':generateContent');
    }
  }

  const targetUrl = new URL(TARGET_API_HOST + pathname + url.search);
  targetUrl.searchParams.set('key', currentApiKey);

  const headers = new Headers(req.headers);
  headers.set("host", targetUrl.host);
  headers.delete("Authorization");

  const newRequest = new Request(targetUrl.toString(), {
    method: req.method,
    headers: headers,
    body: req.body,
    duplex: 'half',
  });

  return await fetch(newRequest);
});