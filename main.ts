// main.ts - 最终诊断版本

console.log("启动最终诊断脚本...");

// 检查 Deno KV 的权限状态
async function checkKvPermissions() {
  try {
    const status = await Deno.permissions.query({ name: "kv" });
    console.log(`[诊断信息] Deno KV 权限状态: ${status.state}`);
    return status.state;
  } catch (e) {
    console.error(`[诊断信息] 查询 Deno KV 权限时出错: ${e.message}`);
    return "error";
  }
}

Deno.serve(async (req) => {
  console.log("接收到请求，开始诊断...");

  // 1. 检查权限
  await checkKvPermissions();

  // 2. 检查 Deno.openKv 的类型
  console.log(`[诊断信息] typeof Deno.openKv 的值是: "${typeof Deno.openKv}"`);

  // 3. 尝试调用
  if (typeof Deno.openKv === 'function') {
    try {
      console.log("尝试调用 Deno.openKv()...");
      const kv = await Deno.openKv();
      await kv.close();
      console.log("Deno.openKv() 调用成功！");
      return new Response("诊断成功: Deno.openKv 可用。");
    } catch (e) {
      console.error(`调用 Deno.openKv() 时发生错误: ${e.message}`);
      return new Response(`诊断失败: 调用时出错 - ${e.message}`, { status: 500 });
    }
  } else {
    console.error("最终确认: Deno.openKv 不是一个函数。");
    return new Response("诊断失败: Deno.openKv 不是一个函数。", { status: 500 });
  }
});
