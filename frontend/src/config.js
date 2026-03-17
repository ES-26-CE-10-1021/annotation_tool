export let CONFIG = null;

export async function loadConfig() {
  const res = await fetch("/api/config");
  CONFIG = await res.json();
}

