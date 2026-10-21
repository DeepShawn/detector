// 关卡加载：levels/index.json 列出关卡顺序，每关一个 JSON 文件。

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败：${url}（${res.status}）`);
  return res.json();
}

export async function loadAllLevels() {
  const manifest = await fetchJson('levels/index.json');
  return Promise.all(manifest.levels.map((id) => fetchJson(`levels/${id}.json`)));
}
