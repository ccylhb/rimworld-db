/**
 * SERP snippet builders for RimWorldDB.
 *
 * The old snippets were templates that assumed every entry had the same
 * fields, so they leaked placeholders wherever the wiki infobox was sparse:
 *
 *  - weapons read "X: ? damage, ? cell range, warmup ? ticks ..." — damage /
 *    range / warmup / cooldown are only ~70% populated (melee weapons carry
 *    meleeattack1dmg instead), so roughly a third of all weapon pages printed
 *    a bare "?".
 *  - apparel read "Bowler hat: ?% sharp armor — RimWorld apparel values." —
 *    armorsharp / armorblunt / insulation* are only 38% populated, and the 55
 *    missing rows are almost all headgear (hats, blindfolds, caps) which have
 *    no armour rating at all. Same defect class as Satisfactory's "? MW".
 *  - every category ended on a zero-information tail: "RimWorld weapon values."
 *
 * Rules here:
 *  - stats first: real numbers from the data, not adjectives
 *  - never print a placeholder; drop the clause, or switch to the fields that
 *    ARE populated (coverage/HP/layer for headgear, meleeattack1* for melee)
 *  - drop the "RimWorld ... values." tail — it answers nothing
 *  - keep the whole snippet inside the ~158 char SERP budget
 */

const SENTINELS = new Set(["", "none", "null", "n/a", "na", "-", "—", "?", "tbd"]);

/** Strip wiki markup / html and collapse whitespace. */
export const clean = (v: unknown): string =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\[\[[^\]]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\[\]]+)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\.\s*;\s*/g, ". ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

/** clean() + treat sentinel strings ("None", "N/A", "-") as empty. */
export const sane = (v: unknown): string => {
  const s = clean(v);
  return SENTINELS.has(s.toLowerCase()) ? "" : s;
};

/** First comma-separated tag: "Middle, Outer" -> "Middle", "Clothing, Armor" -> "Clothing". */
export const firstTag = (v: unknown): string => sane(v).split(",")[0].trim();

/** First n comma-separated tags, re-joined: coverage lists. */
export const firstTags = (v: unknown, n = 3): string =>
  sane(v)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, n)
    .join(", ");

/** Sentence-case a lower-case wiki value: "bullet" -> "Bullet", "omnivorous grazer" -> "Omnivorous grazer". */
export const cap = (v: unknown): string => {
  const s = sane(v);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

/**
 * Numeric value as a string, or "" when absent. Accepts the "32", "0.9",
 * "1,200" and "32 (something)" shapes the scrape produces. 0 is a real value
 * (an armour rating of 0% is information) and is returned as "0".
 */
export const num = (v: unknown): string => {
  const s = sane(v);
  if (!s) return "";
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? m[0] : "";
};

/** RimWorld tech-level labels: the wiki writes "Ultra" for "Ultratech". */
export const techLabel = (v: unknown): string => {
  const s = sane(v);
  if (!s) return "";
  return s === "Ultra" ? "Ultratech" : s;
};

/** "1 grow day" / "2 grow days" — keeps the snippet grammatical. */
export const plural = (n: string, word: string): string => {
  const v = Number(n);
  return `${n} ${word}${v === 1 ? "" : "s"}`;
};

/**
 * A rating of 0 carries no information ("0% sharp armour" on a headset is
 * noise), so treat it as absent for snippet purposes. Missing is different
 * from zero only for coverage/HP, which are printed separately.
 */
const positive = (v: unknown): string => {
  const s = num(v);
  return s && Number(s) > 0 ? s : "";
};

/** Hard-clip to the SERP budget without cutting mid-word. */
export const clip = (s: string, n = 158): string => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, "") + "…";
};

/* ------------------------------------------------------------- weapons -- */

/**
 * Ranged weapons carry damage / range / warmup / cooldown in the infobox;
 * melee weapons carry meleeattack1dmg / meleeattack1ap instead. Pick the
 * branch that actually has data instead of printing "?" for the other half.
 */
export const weaponDesc = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "This weapon";
  const cls = techLabel(f.class) || techLabel(f["tech level"]);
  const dmgType = cap(sane(f["damage type"]));
  const val = num(f.marketvalue);
  const mode = sane(f.mode);

  const dmg = num(f.damage);
  const rng = num(f.range);
  if (dmg) {
    let s = `${title} — `;
    if (cls) s += `${cls} `;
    s += `${dmg} ${dmgType || "damage"}`;
    if (rng) s += `, ${plural(rng, "cell")}`;
    const burst = num(f.burst);
    if (burst && Number(burst) > 1) s += `, ${burst}-shot burst`;
    const ap = positive(f.armorpenetration);
    if (ap) s += `, ${ap}% armour penetration`;
    if (mode) s += `, ${mode}`;
    s += ".";
    if (val) s += ` Market value ${val}.`;
    const mass = num(f["mass base"]);
    if (s.length < 60 && mass) s += ` ${mass} kg.`;
    return clip(s);
  }

  const mdmg = num(f.meleeattack1dmg);
  if (mdmg) {
    let s = `${title} — `;
    if (cls) s += `${cls} `;
    s += dmgType ? `melee ${mdmg} ${dmgType}` : `melee damage ${mdmg}`;
    const ap = positive(f.meleeattack1ap);
    if (ap) s += `, AP ${ap}`;
    s += ".";
    if (val) s += ` Market value ${val}.`;
    const mass = num(f["mass base"]);
    if (s.length < 60 && mass) s += ` ${mass} kg.`;
    const mdmg2 = num(f.meleeattack2dmg);
    if (s.length < 60 && mdmg2) {
      const t2 = cap(sane(f.meleeattack2type));
      const ap2 = positive(f.meleeattack2ap);
      s += ` Second hit ${mdmg2}${t2 ? ` ${t2}` : ""}${ap2 ? `, AP ${ap2}` : ""}.`;
    }
    return clip(s);
  }

  const kind = sane(f.type2)?.toLowerCase() || "weapon";
  return clip(`${title} — RimWorld ${kind}: damage, armour penetration, range and market value.`);
};

/* ------------------------------------------------------------- apparel -- */

/**
 * 33 of 88 apparel rows carry armour ratings; the other 55 are headgear and
 * similar pieces with no armour fields at all. For those, coverage and HP are
 * the numbers a player actually wants, so switch fields rather than print "?".
 */
export const apparelDesc = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "This apparel";
  const layer = firstTag(f.layer);
  const tech = techLabel(f["tech level"]);
  const hp = num(f.hp);
  const mass = num(f["mass base"]);

  let s = `${title} — `;
  if (tech) s += `${tech} `;
  s += layer ? `${layer.toLowerCase()} layer` : "apparel";
  if (hp) s += `, ${hp} HP`;
  s += ".";

  const sharp = positive(f.armorsharp);
  const blunt = positive(f.armorblunt);
  const cold = positive(f.insulationcold);
  const heat = positive(f.insulationheat);

  if (sharp || blunt) {
    const bits: string[] = [];
    if (sharp) bits.push(`${sharp}% sharp`);
    if (blunt) bits.push(`${blunt}% blunt`);
    s += ` ${bits.join(" / ")} armour.`;
    const ins: string[] = [];
    if (cold) ins.push(`${cold}°C cold`);
    if (heat) ins.push(`${heat}°C heat`);
    if (ins.length) s += ` ${ins.join(" / ")} insulation.`;
  } else {
    // Headgear, blindfolds, hats: no armour rating exists (or it is 0, which
    // says nothing). Coverage is the useful number instead.
    const cov = firstTags(f.coverage, 3);
    if (cov) s += ` Covers ${cov}.`;
  }

  if (mass) s += ` ${mass} kg.`;
  const out = clip(s);
  if (out.length >= 60) return out;

  const cov = firstTags(f.coverage, 3);
  return clip(
    cov
      ? `${title} — RimWorld apparel: ${cov} coverage, ${hp || "?"} HP, layer and mass.`
      : `${title} — RimWorld apparel: armour ratings, insulation, HP, layer and mass.`,
  );
};

/* ------------------------------------------------------------- animals -- */

const DIET_LABEL: Record<string, string> = {
  none: "no diet",
  "omnivorous (human)": "omnivorous",
};

export const animalDesc = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "This animal";
  const cp = num(f.combatpower);
  const spd = num(f.movespeed);
  const ad = num(f.attack1dmg);
  const at = cap(sane(f.attack1type));
  const wild = num(f.wildness);
  const diet = sane(f.diet);
  const val = num(f.marketvalue);

  let s = `${title} — `;
  if (cp) s += `${cp} combat power, `;
  if (spd) s += `${spd} cells/s, `;
  if (ad) s += `${ad} ${at || "damage"}`;
  s = s.replace(/,\s*$/, "").replace(/—\s*$/, "");
  if (s.endsWith(title)) s += "RimWorld animal";
  s += ".";

  if (wild !== "") {
    s += wild === "0" ? " Pre-tamed, wildness 0." : ` Wildness ${wild}.`;
  }
  if (diet) {
    const key = diet.toLowerCase();
    s += ` Diet: ${DIET_LABEL[key] || cap(diet)}.`;
  }
  if (val) s += ` Market value ${val}.`;
  return clip(s);
};

/* ---------------------------------------------------------------- food -- */

const PREF_LABEL: Record<string, string> = {
  desperate: "Desperate",
  raw: "Raw",
  rawtasty: "RawTasty",
  rawbad: "RawBad",
  simple: "Simple",
  fine: "Fine",
  lavish: "Lavish",
  awful: "Awful",
  terrible: "Terrible",
  plant: "Plant",
};

export const foodDesc = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "This food";
  const nut = num(f.nutrition);
  const rot = num(f["days to rot"]);
  const val = num(f.marketvalue);
  const pref = PREF_LABEL[String(f.preferability ?? "").toLowerCase()] || "";
  let ftype = cap(sane(f["food type"]));
  const type2 = cap(sane(f.type2));
  // "Meat — Meat" says nothing; fall back to the coarser type2 ("Raw food").
  if (ftype && ftype === title) ftype = type2 || "";
  const fpc = positive(f["food poison chance"]);

  let s = `${title} — `;
  s += ftype || type2 || "Food";
  if (nut !== "") s += `, ${nut} nutrition`;
  if (rot !== "") s += `, ${rot} days to rot`;
  if (fpc) {
    const pct = Number(fpc) < 1 ? Math.round(Number(fpc) * 100) : fpc;
    s += `, ${pct}% food poisoning`;
  }
  s += ".";
  if (pref) s += ` ${pref} preferability.`;
  if (val) s += ` Market value ${val}.`;
  return clip(s);
};

/* -------------------------------------------------------------- plants -- */

/** livesin_* infobox keys -> readable biome names. */
const BIOME_LABEL: Record<string, string> = {
  tropicalrainforest: "tropical rainforest",
  tropicalswamp: "tropical swamp",
  temperateforest: "temperate forest",
  borealforest: "boreal forest",
  tundra: "tundra",
  temperateswamp: "temperate swamp",
  coldbog: "cold bog",
  aridshrubland: "arid shrubland",
  desert: "desert",
  lavafield: "lava field",
  glacialplain: "glacial plain",
  grassland: "grassland",
  scarlands: "scarlands",
  glowforest: "glow forest",
  extremedesert: "extreme desert",
};

/** "tundra, cold bog" from the livesin_* keys that are actually non-zero. */
const biomes = (f: any, n = 3): string => {
  const out: string[] = [];
  for (const [k, v] of Object.entries(f)) {
    if (!k.startsWith("livesin_")) continue;
    const val = num(v);
    if (val === "" || Number(val) <= 0) continue;
    const label = BIOME_LABEL[k.slice(8)];
    if (label) out.push(label);
  }
  return out.slice(0, n).join(", ");
};

export const plantDesc = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "This plant";
  const gd = num(f["grow days"]);
  const prod = sane(f.product);
  const y = num(f.yield);
  const nut = num(f.nutrition);
  const fs = positive(f["fertility sensitivity"]);
  const hp = num(f.hp);
  const kind = sane(f.type2)?.toLowerCase();
  const where = biomes(f);

  let s = `${title} — `;
  s += gd !== "" ? plural(gd, "grow day") : kind ? `${kind} plant` : "plant";
  if (prod) s += y !== "" ? `, harvests ${y} ${prod}` : `, harvests ${prod}`;
  s += ".";
  if (nut !== "") s += ` ${nut} nutrition.`;
  if (fs) s += ` Fertility sensitivity ${fs}.`;
  if (where) s += ` Grows in ${where}.`;
  if (!prod) {
    // Decorative / wild plants with no harvest: toughness and looks are the
    // numbers a player actually wants.
    if (hp) s += ` ${hp} HP.`;
    const beauty = positive(f["beauty outdoors"]);
    if (s.length < 60 && beauty) s += ` Beauty +${beauty}.`;
    const flam = num(f.flammability);
    if (s.length < 60 && flam) s += ` Flammability ${flam}.`;
  }
  if (s.length < 60 && hp) s += ` ${hp} HP.`;
  return clip(s);
};

/* --------------------------------------------------------------- titles -- */

/**
 * <title> builders. The old templates appended "(damage ?, range ?)" — a "?"
 * in the SERP title is worse than no number at all, so the parenthetical is
 * only added when the underlying field is actually populated.
 */
export const weaponTitle = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "Weapon";
  const bits: string[] = [];
  const dmg = num(f.damage) || num(f.meleeattack1dmg);
  const rng = num(f.range);
  if (dmg) bits.push(`${dmg} damage`);
  if (rng) bits.push(`${rng} cells`);
  const tail = bits.length ? ` (${bits.join(", ")})` : "";
  return `${title} — RimWorld weapon stats${tail}`;
};

export const apparelTitle = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "Apparel";
  const hp = num(f.hp);
  const tail = hp ? ` (${hp} HP)` : "";
  return `${title} — RimWorld apparel stats${tail}`;
};

export const animalTitle = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "Animal";
  const cp = num(f.combatpower);
  const tail = cp ? ` (${cp} combat power)` : "";
  return `${title} — RimWorld animal stats${tail}`;
};

export const foodTitle = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "Food";
  const nut = num(f.nutrition);
  const tail = nut !== "" ? ` (${nut} nutrition)` : "";
  return `${title} — RimWorld food stats${tail}`;
};

export const plantTitle = (x: any): string => {
  const f = x?.fields || {};
  const title = sane(x?.title) || "Plant";
  const gd = num(f["grow days"]);
  const tail = gd !== "" ? ` (${plural(gd, "grow day")})` : "";
  return `${title} — RimWorld plant stats${tail}`;
};
