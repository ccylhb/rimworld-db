import weapons from "../data/rimworld_weapons.json";
import apparel from "../data/rimworld_apparel.json";
import food from "../data/rimworld_food.json";
import animals from "../data/rimworld_animals.json";
import plants from "../data/rimworld_plants.json";

export function GET() {
  const entries = [
    ...weapons.map((x: any) => ({
      title: x.title,
      href: `/weapons/${x.slug}/`,
      sub: `Weapon · ${x.fields?.damage || "?"} dmg · range ${x.fields?.range || "?"}`,
      icon: x.icon_file || "",
    })),
    ...apparel.map((x: any) => ({
      title: x.title,
      href: `/apparel/${x.slug}/`,
      sub: `Apparel · ${x.fields?.armorsharp || "?"}% sharp`,
      icon: x.icon_file || "",
    })),
    ...food.map((x: any) => ({
      title: x.title,
      href: `/food/${x.slug}/`,
      sub: `Food · ${x.fields?.nutrition || "?"} nutrition`,
      icon: x.icon_file || "",
    })),
    ...animals.map((x: any) => ({
      title: x.title,
      href: `/animals/${x.slug}/`,
      sub: `Animal · ${x.fields?.movespeed || "?"} c/s · CP ${x.fields?.combatpower || "?"}`,
      icon: x.icon_file || "",
    })),
    ...plants.map((x: any) => ({
      title: x.title,
      href: `/plants/${x.slug}/`,
      sub: `Plant · ${x.fields?.["grow days"] || "?"} grow days`,
      icon: x.icon_file || "",
    })),
  ].sort((a, b) => a.title.localeCompare(b.title));
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
