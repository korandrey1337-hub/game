globalThis.fetch = async (url, options) => {
  process.send?.({ type: "hub-request", url, body: options.body, headers: options.headers });
  return new Response('{"ok":true}', { status: 200 });
};
