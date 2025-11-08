// main.js - 生产环境最终版本 (使用环境变量)

// 目标 API 地址
const TARGET_API_HOST = "https://generativelanguage.googleapis.com";

// --- 1. 从环境变量中安全地读取 API 密钥 ---
// Deno.env.get("API_KEYS") 会读取你在 Deno Deploy 平台设置的环境变量
const keysString = Deno.env.get("API_KEYS") || "";


// 将逗号分隔的字符串转换为一个数组
// .filter(k => k.trim() !== "") 是一个健壮性处理，防止因多余的逗号产生空密钥
const API_KEYS = keysString.split(',').map(k => k.trim()).filter(k => k);

// --- 2. 初始化 Deno KV ---
// Deno KV 仍然只用来存储和同步轮询的索引
const kv = await Deno.openKv();
const KV_KEY = ["current_key_index"]; // 定义用于存储索引的 Key

console.log("服务启动成功！");
if (API_KEYS.length > 0) {
  console.log(`已成功从环境变量加载 ${API_KEYS.length} 个 API 密钥。`);
} else {
  console.warn("警告：未在环境变量中找到 API_KEYS。服务将无法处理请求。");
}

// --- 3. 启动服务 ---
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 根路径返回提示信息
  if (url.pathname === '/') {
    return new Response(
      "“这是一个API URL, 你不能直接访问。请把这个地址填写在对应的API URL处~”",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 检查密钥是否已在环境变量中配置
  if (API_KEYS.length === 0) {
    console.error("请求失败：服务器未配置 API_KEYS 环境变量。");
    return new Response(
      "“服务器配置错误: API 密钥未配置。请联系管理员检查环境变量。”",
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // --- 4. 使用 Deno KV 实现持久化和原子化的密钥轮询 (逻辑不变) ---
  const currentEntry = await kv.get<number>(KV_KEY);
  const currentIndex = currentEntry.value ?? 0; // 如果KV中没有值，从0开始

  const nextIndex = (currentIndex + 1) % API_KEYS.length;

  // 原子地更新索引，为下一次请求做准备
  const result = await kv.atomic()
    .check(currentEntry)
    .set(KV_KEY, nextIndex)
    .commit();

  // 如果原子操作失败（极小概率，例如并发冲突），则让客户端重试
  if (!result.ok) {
    console.error("[KV Error] Atomic operation failed, possibly due to a race condition.");
    return new Response(
      "“服务器繁忙，请稍后重试 (KV 原子操作失败)。”",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const currentApiKey = API_KEYS[currentIndex];
  console.log(`[Key Rotation] Using API Key at index ${currentIndex}`);

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
