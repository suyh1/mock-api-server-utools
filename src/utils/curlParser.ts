/**
 * @file curlParser.ts
 * @description cURL 命令解析工具函数，提取自 NetworkTools.vue
 */

export interface ParsedCurl {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  contentType: string;
}

/**
 * 将 cURL 命令字符串分词
 * 支持单引号、双引号、$'' ANSI-C 引用和转义字符
 */
export function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i++];
      let token = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && quote === '"') { i++; token += input[i] || ''; }
        else token += input[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else if (input[i] === '$' && input[i + 1] === "'") {
      i += 2;
      let token = '';
      while (i < input.length && input[i] !== "'") { token += input[i++]; }
      i++;
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && !/\s/.test(input[i])) {
        if (input[i] === '\\') { i++; token += input[i] || ''; }
        else token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * 解析 cURL 命令为结构化数据
 * @param input - cURL 命令字符串
 * @returns 解析结果，解析失败时返回 null
 */
export function parseCurl(input: string): ParsedCurl | null {
  let text = input.trim();
  if (!text) return null;

  // 处理多行连接符
  text = text.replace(/\\\n\s*/g, ' ').replace(/\\\r\n\s*/g, ' ');

  if (!text.toLowerCase().startsWith('curl')) return null;

  const tokens = tokenizeCurl(text);
  let i = 1; // skip 'curl'
  const headers: { key: string; value: string }[] = [];
  let method = '';
  let url = '';
  let body = '';

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      method = tokens[++i]?.toUpperCase() || '';
    } else if (t === '-H' || t === '--header') {
      const h = tokens[++i] || '';
      const colonIdx = h.indexOf(':');
      if (colonIdx > 0) headers.push({ key: h.slice(0, colonIdx).trim(), value: h.slice(colonIdx + 1).trim() });
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = tokens[++i] || '';
      if (!method) method = 'POST';
    } else if (t === '-G' || t === '--get') {
      method = 'GET';
    } else if (t === '-I' || t === '--head') {
      method = 'HEAD';
    } else if (t === '-u' || t === '--user') {
      const auth = tokens[++i] || '';
      headers.push({ key: 'Authorization', value: 'Basic ' + btoa(auth) });
    } else if (t === '-A' || t === '--user-agent') {
      headers.push({ key: 'User-Agent', value: tokens[++i] || '' });
    } else if (t === '-e' || t === '--referer') {
      headers.push({ key: 'Referer', value: tokens[++i] || '' });
    } else if (t === '-b' || t === '--cookie') {
      headers.push({ key: 'Cookie', value: tokens[++i] || '' });
    } else if (t === '--compressed' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-v' || t === '--verbose' || t === '-L' || t === '--location') {
      // 忽略这些标志
    } else if (!t.startsWith('-') && !url) {
      url = t;
    }
    i++;
  }

  const ct = headers.find(h => h.key.toLowerCase() === 'content-type');

  return {
    method: method || 'GET',
    url,
    headers,
    body,
    contentType: ct?.value || '',
  };
}
