const toRoman = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n >= 4000) {
    return null;
  }

  const table = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remaining = Math.trunc(n);
  let out = "";
  for (const [num, roman] of table) {
    while (remaining >= num) {
      out += roman;
      remaining -= num;
    }
  }
  return out;
};

export const initYearRoman = ({ now = new Date() } = {}) => {
  const year = now.getFullYear();
  const roman = toRoman(year);
  if (!roman) {
    return;
  }

  const nodes = document.querySelectorAll('span[aria-label][data-year-roman], span[aria-label]');
  nodes.forEach((node) => {
    const label = node.getAttribute("aria-label") || "";
    const isYearish = /^\d{4}$/.test(label);
    const looksRoman = /^[MDCLXVI]+$/.test((node.textContent || "").trim());
    const explicit = node.hasAttribute("data-year-roman");

    if (!explicit && !(isYearish && looksRoman)) {
      return;
    }

    node.setAttribute("aria-label", String(year));
    node.textContent = roman;
  });
};
