const STAPLE_PATTERNS = [
  /^(kosher |sea |table |flaky |fine )?salt$/,
  /^(freshly )?(ground )?(black )?pepper(corns)?$/,
  /^salt and (black )?pepper$/,
  /^water$/,
  /^ice$/,
  /^(extra[- ]virgin )?olive oil$/,
  /^(vegetable|canola|neutral|cooking) oil$/,
  /^(granulated |white )?sugar$/,
  /^(all[- ]purpose )?flour$/,
  /^cooking spray$/,
  /^nonstick spray$/,
];

export function isStaple(name: string): boolean {
  const n = name.toLowerCase().trim();
  return STAPLE_PATTERNS.some((p) => p.test(n));
}
