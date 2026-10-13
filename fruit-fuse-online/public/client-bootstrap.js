const sdkUrl = String(window.CORE_BELOW_HUB_SDK_URL || "").trim();
if (sdkUrl && !window.Hub) {
  await new Promise(resolve => {
    const script = document.createElement("script");
    const finish = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(() => {
      console.warn("[hub] SDK loading timed out");
      script.remove();
      finish();
    }, 5000);
    script.src = sdkUrl;
    script.onload = finish;
    script.onerror = () => { console.warn("[hub] SDK unavailable"); finish(); };
    document.head.append(script);
  });
}
await import("./client.js");
