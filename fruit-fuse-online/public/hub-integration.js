export function hubStartRoom(value) {
  const match = /^(?:corebelow__)?room_([A-Z0-9]{5})$/.exec(String(value || ""));
  return match?.[1] || "";
}

export function createHubBridge(hub, { onReady = () => {}, warn = console.warn } = {}) {
  let context = null;
  let currentRoom = "";
  let resolveReady;
  const ready = hub?.inHub ? new Promise(resolve => { resolveReady = resolve; }) : Promise.resolve();
  const call = (method, ...args) => {
    try {
      if (typeof hub?.[method] !== "function") return false;
      const result = hub[method](...args);
      if (result?.catch) result.catch(error => warn("[hub]", method, error.message));
      return true;
    } catch (error) {
      warn("[hub]", method, error.message);
      return false;
    }
  };
  if (typeof hub?.ready === "function") {
    try {
      hub.ready(ctx => {
        context = ctx || {};
        resolveReady?.();
        queueMicrotask(() => onReady(context));
      });
    } catch (error) {
      warn("[hub] ready", error.message);
      resolveReady?.();
    }
  } else {
    resolveReady?.();
  }
  const leave = () => {
    if (currentRoom && call("room", "")) currentRoom = "";
  };
  return {
    ready,
    get inHub() { return Boolean(hub?.inHub && context?.inHub !== false); },
    get context() { return context; },
    get startRoom() { return hubStartRoom(hub?.start || context?.start); },
    joinData(fallbackName) {
      if (!hub?.inHub || context?.inHub === false || !context?.initData) return { name: fallbackName };
      return { name: context.user?.first_name || fallbackName, initData: context.initData };
    },
    update(room) {
      const target = hub?.inHub && room?.hubAuthenticated && !room.tutorial ? `room_${room.code}` : "";
      if (!target) { leave(); return; }
      if (target !== currentRoom && call("room", target)) currentRoom = target;
    },
    leave,
    invite(code) {
      return Boolean(hub?.inHub && /^[A-Z0-9]{5}$/.test(code) && call("invite", `room_${code}`, "Заходи в Core Below: спасём реактор вместе!"));
    }
  };
}
