export type IrisMomentCity = {
  key: string;
  label: string;
  matchers: string[];
};

export const IRISMOMENT_CITIES: IrisMomentCity[] = [
  { key: "liezen", label: "Liezen", matchers: ["liezen"] },
  { key: "ried-im-innkreis", label: "Ried im Innkreis", matchers: ["ried im innkreis", "ried-im-innkreis", "ried |"] },
  { key: "krems-an-der-donau", label: "Krems an der Donau", matchers: ["krems an der donau", "krems-am-der-donau", "krems"] },
  { key: "voecklabruck", label: "Vöcklabruck", matchers: ["vocklabruck", "voecklabruck"] },
  { key: "spittal-an-der-drau", label: "Spittal an der Drau", matchers: ["spittal an der drau", "spittal"] }
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveIrisMomentCity(...values: Array<string | null | undefined>) {
  const haystack = normalize(values.filter(Boolean).join(" | "));
  if (!haystack) return null;
  return IRISMOMENT_CITIES.find((city) => city.matchers.some((matcher) => haystack.includes(normalize(matcher)))) ?? null;
}
