// Read balanced JSON assignments as data, never execute manufacturer JavaScript.
export function publishedJson(html: string, assignment: string, label = 'Published'): unknown {
  const escaped = assignment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*=\\s*(?=\\{)`).exec(html);
  if (!match) throw new Error(`${label} published JSON missing: ${assignment}`);
  const start = match.index + match[0].length;
  let depth = 0,
    quoted = false,
    escape = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error(`Truncated ${label} published JSON.`);
}
