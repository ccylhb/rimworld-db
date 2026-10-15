// 预演 RimWorldDB C1 描述改造：直接 import 真实 src/lib/seo.ts，与页面实现零漂移。
// 判据：<60 字符 / >158 字符 / "?" 泄漏 / 脏模式 / 唯一性。
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const REPO = "C:/Users/梁会斌/Documents/Codex/rimworld-db";
const mod = await import(pathToFileURL(`${REPO}/src/lib/seo.ts`).href);
const { weaponDesc, apparelDesc, animalDesc, foodDesc, plantDesc } = mod;
const { weaponTitle, apparelTitle, animalTitle, foodTitle, plantTitle } = mod;

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const data = [
  ["weapons", `${REPO}/src/data/rimworld_weapons.json`, weaponDesc, weaponTitle],
  ["apparel", `${REPO}/src/data/rimworld_apparel.json`, apparelDesc, apparelTitle],
  ["animals", `${REPO}/src/data/rimworld_animals.json`, animalDesc, animalTitle],
  ["food", `${REPO}/src/data/rimworld_food.json`, foodDesc, foodTitle],
  ["plants", `${REPO}/src/data/rimworld_plants.json`, plantDesc, plantTitle],
];

const DIRTY = [/\?\s*[%,]/, /\?\s*(damage|range|armor|armour|cell|ticks|nutrition|grow)/i, /\bNone\b/, /\bundefined\b/, /\bNaN\b/, /,\s*\./, /\s{2,}/, /—\s*\./, /^\s*[,.;:]/];

const all = [];
let grand = 0;
for (const [name, path, fn, tfn] of data) {
  const rows = read(path);
  const out = rows.map((x) => ({ title: x.title, slug: x.slug, desc: fn(x), ptitle: tfn ? tfn(x) : "" }));
  const lens = out.map((o) => o.desc.length);
  const short = out.filter((o) => o.desc.length < 60);
  const long = out.filter((o) => o.desc.length > 158);
  const q = out.filter((o) => o.desc.includes("?"));
  const dirty = out.filter((o) => DIRTY.some((r) => r.test(o.desc)));
  const dupMap = new Map();
  for (const o of out) dupMap.set(o.desc, (dupMap.get(o.desc) || 0) + 1);
  const dups = [...dupMap.entries()].filter(([, c]) => c > 1);
  const tq = out.filter((o) => o.ptitle.includes("?")).length;
  const tlong = out.filter((o) => o.ptitle.length > 65).length;
  console.log(
    `${name.padEnd(9)} n=${String(rows.length).padStart(3)}  title"?"=${tq} title>65=${tlong}  ` +
      `len min=${Math.min(...lens)} avg=${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)} max=${Math.max(...lens)}  ` +
      `<60=${short.length}  >158=${long.length}  "?"=${q.length}  脏=${dirty.length}  唯一=${out.length - dups.reduce((a, [, c]) => a + c - 1, 0)}/${out.length}`,
  );
  for (const o of short.slice(0, 4)) console.log(`    <60 ${o.title}: ${o.desc}`);
  for (const o of out.filter((o) => o.ptitle.includes("?") || o.ptitle.length > 65).slice(0, 3)) console.log(`    title问题 ${o.ptitle}`);
  for (const o of q.slice(0, 4)) console.log(`    "?" ${o.title}: ${o.desc}`);
  for (const o of dirty.slice(0, 4)) console.log(`    脏  ${o.title}: ${o.desc}`);
  if (dups.length) for (const [d, c] of dups.slice(0, 3)) console.log(`    重复×${c}: ${d.slice(0, 90)}`);
  all.push(...out);
  grand += out.length;
}
console.log(`\n合计 ${grand} 条`);

// 每类抽 4 条样本
console.log("\n================ 样本 ================");
for (const [name] of data) {
  const rows = all.filter((o) => o.title);
  console.log(`\n--- ${name} ---`);
}
for (const [name, path, fn] of data) {
  const rows = read(path);
  console.log(`\n--- ${name} (前4条) ---`);
  for (const x of rows.slice(0, 4)) console.log(`  ${fn(x)}`);
}
// 重点：曾印 "?" 的条目
console.log("\n--- apparel 无护甲字段（原印 ?% sharp armor）---");
const app = read(`${REPO}/src/data/rimworld_apparel.json`);
for (const x of app.filter((y) => !(y.fields || {}).armorsharp).slice(0, 4)) console.log(`  ${apparelDesc(x)}`);
console.log("\n--- weapons 无 damage/range（原印 ? damage）---");
const wp = read(`${REPO}/src/data/rimworld_weapons.json`);
for (const x of wp.filter((y) => !(y.fields || {}).damage).slice(0, 5)) console.log(`  ${weaponDesc(x)}`);
