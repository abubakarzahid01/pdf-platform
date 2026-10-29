// Splits a PDF content stream into operators with their operands, remembering where
// each operator sits in the text so it can be removed or replaced later.
// The stream is handled as a "latin1" string: one character per byte.

export type Operand =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "string"; bytes: Uint8Array }
  | { kind: "array"; items: Operand[] }
  | { kind: "other"; raw: string };

export type ContentOp = {
  op: string;
  operands: Operand[];
  // Range in the content string covering the operands and the operator.
  start: number;
  end: number;
};

const WHITESPACE = new Set([" ", "\n", "\r", "\t", "\f", "\0"]);
const DELIMITERS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

export function tokenizeContent(content: string): ContentOp[] {
  const ops: ContentOp[] = [];
  let i = 0;
  let operands: Operand[] = [];
  let operandsStart = -1;

  const skipSpace = () => {
    while (i < content.length) {
      const c = content[i];
      if (WHITESPACE.has(c)) i++;
      else if (c === "%") while (i < content.length && content[i] !== "\n" && content[i] !== "\r") i++;
      else break;
    }
  };

  const readRegular = () => {
    const start = i;
    while (i < content.length && !WHITESPACE.has(content[i]) && !DELIMITERS.has(content[i])) i++;
    return content.slice(start, i);
  };

  const readLiteralString = (): Uint8Array => {
    i++; // (
    const bytes: number[] = [];
    let depth = 1;
    while (i < content.length) {
      const c = content[i];
      if (c === "\\") {
        const n = content[i + 1];
        const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
        if (n in simple) {
          bytes.push(simple[n]);
          i += 2;
        } else if (n >= "0" && n <= "7") {
          let oct = "";
          let j = i + 1;
          while (oct.length < 3 && content[j] >= "0" && content[j] <= "7") oct += content[j++];
          bytes.push(parseInt(oct, 8) & 255);
          i = j;
        } else if (n === "\r" || n === "\n") {
          // Line continuation: backslash + end of line is ignored.
          i += n === "\r" && content[i + 2] === "\n" ? 3 : 2;
        } else {
          i += 1;
        }
        continue;
      }
      if (c === "(") depth++;
      if (c === ")" && --depth === 0) {
        i++;
        break;
      }
      bytes.push(c.charCodeAt(0) & 255);
      i++;
    }
    return new Uint8Array(bytes);
  };

  const readHexString = (): Uint8Array => {
    i++; // <
    let hex = "";
    while (i < content.length && content[i] !== ">") {
      if (!WHITESPACE.has(content[i])) hex += content[i];
      i++;
    }
    i++; // >
    if (hex.length % 2) hex += "0";
    const bytes = new Uint8Array(hex.length / 2);
    for (let k = 0; k < bytes.length; k++) bytes[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
    return bytes;
  };

  const readOperand = (): Operand | null => {
    skipSpace();
    const c = content[i];
    if (c === undefined) return null;
    if (c === "(") return { kind: "string", bytes: readLiteralString() };
    if (c === "<" && content[i + 1] === "<") {
      // Inline dictionary (e.g. marked-content properties): keep it as raw text.
      const start = i;
      let depth = 0;
      while (i < content.length) {
        if (content.startsWith("<<", i)) {
          depth++;
          i += 2;
        } else if (content.startsWith(">>", i)) {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else i++;
      }
      return { kind: "other", raw: content.slice(start, i) };
    }
    if (c === "<") return { kind: "string", bytes: readHexString() };
    if (c === "[") {
      i++;
      const items: Operand[] = [];
      for (;;) {
        skipSpace();
        if (content[i] === "]" || i >= content.length) {
          i++;
          break;
        }
        const item = readOperand();
        if (!item) break;
        items.push(item);
      }
      return { kind: "array", items };
    }
    if (c === "/") {
      i++;
      return { kind: "name", value: readRegular() };
    }
    // Numbers and keywords inside arrays, e.g. the spacing values in [(Q)-2(uart)] TJ.
    if (!DELIMITERS.has(c)) {
      const word = readRegular();
      const value = Number(word);
      return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) && Number.isFinite(value) ? { kind: "number", value } : { kind: "other", raw: word };
    }
    return null;
  };

  while (i < content.length) {
    skipSpace();
    if (i >= content.length) break;
    const tokenStart = i;
    const c = content[i];

    if (c === "(" || c === "<" || c === "[" || c === "/") {
      if (operandsStart < 0) operandsStart = tokenStart;
      const operand = readOperand();
      if (operand) operands.push(operand);
      continue;
    }
    if (c === "]" || c === ">" || c === ")" || c === "{" || c === "}") {
      i++; // stray delimiter: skip it
      continue;
    }

    const word = readRegular();
    if (word === "") {
      i++;
      continue;
    }
    const num = Number(word);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) && Number.isFinite(num)) {
      if (operandsStart < 0) operandsStart = tokenStart;
      operands.push({ kind: "number", value: num });
      continue;
    }
    if (word === "true" || word === "false" || word === "null") {
      if (operandsStart < 0) operandsStart = tokenStart;
      operands.push({ kind: "other", raw: word });
      continue;
    }

    // An operator. Inline images carry raw binary data between ID and EI: skip it whole.
    if (word === "BI") {
      const idAt = content.indexOf("ID", i);
      const eiMatch = /\sEI(?=[\s]|$)/g;
      eiMatch.lastIndex = idAt < 0 ? i : idAt + 3;
      const found = eiMatch.exec(content);
      const end = found ? found.index + found[0].length : content.length;
      ops.push({ op: "BI", operands: [], start: tokenStart, end });
      i = end;
      operands = [];
      operandsStart = -1;
      continue;
    }

    ops.push({ op: word, operands, start: operandsStart >= 0 ? operandsStart : tokenStart, end: i });
    operands = [];
    operandsStart = -1;
  }
  return ops;
}

// Writes bytes as a PDF hex string, e.g. <002C0051>.
export function hexString(bytes: Uint8Array) {
  return `<${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}>`;
}
