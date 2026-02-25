/**
 * Преобразует в тексте степени (3^7 → 3⁷ с <sup>) и дроби [2/3] или [3^7*8^5/24^4].
 * Дробь задаётся в квадратных скобках: [числитель/знаменатель].
 * Не трогает содержимое внутри блоков кода ```.
 */
const CODE_BLOCK = /```[\s\S]*?```/g;
const EXPONENT = /(\d+)\^(\d+)/g;
/** Дробь в скобках: [что угодно/что угодно], без вложенных ] */
const BRACKET_FRACTION = /\[([^\]/]+)\/([^\]]+)\]/g;

function processExponents(text: string): string {
  return text.replace(EXPONENT, (_, base, exp) => `${base}<sup>${exp}</sup>`);
}

function processBracketFractions(text: string): string {
  return text.replace(BRACKET_FRACTION, (_, num, den) => {
    const numHtml = processExponents(num.trim());
    const denHtml = processExponents(den.trim());
    return `<span class="math-frac"><span class="math-num">${numHtml}</span><span class="math-den">${denHtml}</span></span>`;
  });
}

export function mathInlineToHtml(markdown: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(CODE_BLOCK.source, 'g');
  while ((m = re.exec(markdown)) !== null) {
    parts.push(markdown.slice(lastIndex, m.index));
    parts.push(m[0]); // code block as-is
    lastIndex = m.index + m[0].length;
  }
  parts.push(markdown.slice(lastIndex));

  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // code block
      return processBracketFractions(processExponents(part));
    })
    .join('');
}
