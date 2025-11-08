// main.ts (Test Code)

console.log("Starting deployment test...");
console.log("Checking for Deno.openKv availability...");

if (Deno.openKv) {
  console.log("[SUCCESS] Deno.openKv is available as a function!");
  try {
    // Let's try to actually open it to be 100% sure
    const kv = await Deno.openKv();
    console.log("[SUCCESS] Successfully executed Deno.openKv().");
    await kv.close();
  } catch (e) {
    console.error("[ERROR] Deno.openKv exists, but failed to execute:", e.message);
  }
} else {
  console.error("[FAILURE] Deno.openKv is NOT a function. The --unstable-kv flag was NOT applied by the runtime.");
}

console.log("Deployment test finished.");

// Keep the process alive briefly to ensure logs are captured.
// Deno Deploy might shut down the instance if it exits too quickly.
Deno.serve(() => new Response("Test complete. Check deployment logs."));
