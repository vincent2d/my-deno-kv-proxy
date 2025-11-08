// main.js - 生产环境最终版本 (使用惰性初始化)

// 目标 API 地址
const TARGET_API_HOST = "https://generativelanguage.googleapis.com";

// --- 1. 从环境变量中安全地读取 API 密钥 (逻辑不变) ---
const keysString = Deno.env.get("API_KEYS") || "";
const API_KEYS = keysString.split(',').map(k => k.trim()).filter(k => k);

// --- 2. 修改点：延迟 Deno KV 的初始化 ---
// 我们不再在顶层 await Deno.openKv()。
// 而是声明一个变量，在第一次请求时再初始化它。
let kv; 
const KV_KEY = ["current_key_index"]; // Key 的定义不变

// 这是一个辅助函数，确保我们总能拿到初始化后的 KV 实例
async function getKv() {
  // 如果 kv 变量还没有被赋值 (即第一次调用时)
  if (!kv) {
    console.log("正在进行首次 Deno KV 初始化...");
    // 执行真正的初始化，并赋值给全局的 kv 变量
    kv = await Deno.openKv();
    console.log("Deno KV 初始化成功！");
  }
  // 返回已经初始化好的实例
  return kv;
}

console.log("服务已准备就绪，等待请求...");
if (API_KEYS.length > 0) {
  console.log(`已成功从环境变量加载 ${API_KEYS.length} 个 API 密钥。`);
} else {
  console.warn("警告：未在环境变量中找到 API_KEYS。服务将无法处理请求。");
}

// --- 3. 启动服务 ---
Deno.serve(async (req) => {
  // ... (根路径 和 密钥未配置的错误处理逻辑不变)
  const url = new URL(req.url);
  if (url.pathname === '/') {
    return new Response("“这是一个API URL, 你不能直接访问。请把这个地址填写在对应的API URL处~”", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (API_KEYS.length === 0) {
    console.error("请求失败：服务器未配置 API_KEYS 环境变量。");
    return new Response("“服务器配置错误: API 密钥未配置。请联系管理员检查环境变量。”", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // --- 4. 修改点：通过辅助函数获取 KV 实例 ---
  // 只有在第一个请求进来时，这里才会真正执行 await Deno.openKv()
  const currentKv = await getKv();

  // --- 后续所有逻辑都使用 currentKv，完全不用改动 ---
  const currentEntry = await currentKv.get(KV_KEY);
  const currentIndex = currentEntry.value ?? 0;

  const nextIndex = (currentIndex + 1) % API_KEYS.length;

  const result = await currentKv.atomic()
    .check(currentEntry)
    .set(KV_KEY, nextIndex)
    .commit();

  if (!result.ok) {
    console.error("[KV Error] Atomic operation failed, possibly due to a race condition.");
    return new Response("“服务器繁忙，请稍后重试 (KV 原子操作失败)。”", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
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
