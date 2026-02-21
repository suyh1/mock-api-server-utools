/**
 * generateDataTemplate.ts
 *
 * 将 JSON 数据或 TypeScript 接口/类型定义自动转换为 Mock.js dataTemplate 代码字符串。
 * 支持：
 *   - JSON 对象/数组（根据值的实际类型推断 Mock 规则）
 *   - TypeScript interface / type 定义（根据类型名推断 Mock 规则）
 */

// ======================== JSON → dataTemplate ========================

/**
 * 根据 JSON 值的 key 名和实际值，推断合适的 Mock.js 模板表达式
 */
function inferMockRule(key: string, value: unknown): { mockKey: string; mockValue: unknown } {
  const lk = key.toLowerCase();

  // --- 字符串类型 ---
  if (typeof value === 'string') {
    // id 类
    if (lk === 'id' || lk.endsWith('id') || lk.endsWith('_id')) {
      return { mockKey: `'${key}'`, mockValue: `'@string("0123456789abcdef", 16)'` };
    }
    // 名称
    if (lk === 'name' || lk === 'username' || lk === 'nickname' || lk.endsWith('name')) {
      return { mockKey: `'${key}'`, mockValue: `'@cname'` };
    }
    // 邮箱
    if (lk === 'email' || lk.endsWith('email')) {
      return { mockKey: `'${key}'`, mockValue: `'@email'` };
    }
    // 手机号
    if (lk === 'phone' || lk === 'mobile' || lk === 'tel') {
      return { mockKey: `'${key}'`, mockValue: `'@string("number", 11)'` };
    }
    // 头像 / 图片
    if (lk === 'avatar' || lk === 'image' || lk === 'img' || lk === 'photo' || lk === 'pic' || lk.endsWith('url') || lk.endsWith('image')) {
      return { mockKey: `'${key}'`, mockValue: `'@image("200x200")'` };
    }
    // 地址
    if (lk === 'address' || lk === 'addr') {
      return { mockKey: `'${key}'`, mockValue: `'@county(true)'` };
    }
    // 标题
    if (lk === 'title') {
      return { mockKey: `'${key}'`, mockValue: `'@ctitle(5, 15)'` };
    }
    // 描述 / 内容
    if (lk === 'desc' || lk === 'description' || lk === 'content' || lk === 'remark' || lk === 'summary') {
      return { mockKey: `'${key}'`, mockValue: `'@cparagraph(1, 3)'` };
    }
    // 日期时间
    if (lk.includes('time') || lk.includes('date') || lk === 'createdat' || lk === 'updatedat') {
      return { mockKey: `'${key}'`, mockValue: `'@datetime("yyyy-MM-dd HH:mm:ss")'` };
    }
    // 状态
    if (lk === 'status' || lk === 'state') {
      return { mockKey: `'${key}|1'`, mockValue: `['active', 'inactive', 'pending']` };
    }
    // 通用字符串
    return { mockKey: `'${key}'`, mockValue: `'@cword(3, 8)'` };
  }

  // --- 数字类型 ---
  if (typeof value === 'number') {
    if (lk === 'id' || lk.endsWith('id') || lk.endsWith('_id')) {
      return { mockKey: `'${key}|+1'`, mockValue: 1 };
    }
    if (lk === 'age') {
      return { mockKey: `'${key}|18-60'`, mockValue: 1 };
    }
    if (lk === 'total' || lk === 'count') {
      return { mockKey: `'${key}|1-100'`, mockValue: 1 };
    }
    if (lk === 'page' || lk === 'pagenum' || lk === 'pageno') {
      return { mockKey: `'${key}'`, mockValue: 1 };
    }
    if (lk === 'pagesize' || lk === 'size' || lk === 'limit') {
      return { mockKey: `'${key}'`, mockValue: 10 };
    }
    if (lk.includes('price') || lk.includes('amount') || lk.includes('money') || lk.includes('fee')) {
      return { mockKey: `'${key}|100-9999.2'`, mockValue: 1 };
    }
    // 通用数字
    if (Number.isInteger(value)) {
      return { mockKey: `'${key}|1-100'`, mockValue: 1 };
    }
    return { mockKey: `'${key}|1-100.2'`, mockValue: 1 };
  }

  // --- 布尔类型 ---
  if (typeof value === 'boolean') {
    return { mockKey: `'${key}|1'`, mockValue: true };
  }

  // --- null ---
  if (value === null) {
    return { mockKey: `'${key}'`, mockValue: null };
  }

  // --- 数组类型 ---
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      return { mockKey: `'${key}|5-10'`, mockValue: [convertJsonObject(value[0] as Record<string, unknown>)] };
    }
    if (value.length > 0 && typeof value[0] === 'string') {
      return { mockKey: `'${key}|5-10'`, mockValue: [`'@cword(2, 5)'`] };
    }
    if (value.length > 0 && typeof value[0] === 'number') {
      return { mockKey: `'${key}|5-10'`, mockValue: [`'@integer(1, 100)'`] };
    }
    return { mockKey: `'${key}|5-10'`, mockValue: [] };
  }

  // --- 对象类型 ---
  if (typeof value === 'object') {
    return { mockKey: `'${key}'`, mockValue: convertJsonObject(value as Record<string, unknown>) };
  }

  return { mockKey: `'${key}'`, mockValue: value };
}

/**
 * 将一个 JSON 对象递归转换为 dataTemplate 对象结构
 */
function convertJsonObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const { mockKey, mockValue } = inferMockRule(key, value);
    result[mockKey] = mockValue;
  }
  return result;
}

/**
 * 将 dataTemplate 对象序列化为格式化的 JS 代码字符串
 */
function serializeTemplate(obj: unknown, indent: number = 2, level: number = 0): string {
  const pad = ' '.repeat(indent * level);
  const padInner = ' '.repeat(indent * (level + 1));

  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);

  // 带引号的 Mock 表达式（如 '@cname'）直接输出
  if (typeof obj === 'string') {
    // 如果是 Mock 表达式数组项（如 '@cword(2, 5)'），保持原样
    if (obj.startsWith("'@") || obj.startsWith("['")) {
      return obj;
    }
    return `'${obj}'`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => `${padInner}${serializeTemplate(item, indent, level + 1)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, value]) => {
      const serializedValue = serializeTemplate(value, indent, level + 1);
      return `${padInner}${key}: ${serializedValue}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }

  return String(obj);
}

/**
 * 从 JSON 字符串生成 dataTemplate 代码
 */
function fromJson(jsonStr: string): string {
  const parsed = JSON.parse(jsonStr);

  if (Array.isArray(parsed)) {
    // 如果是数组，取第一个元素作为模板
    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      const template = convertJsonObject(parsed[0] as Record<string, unknown>);
      return serializeTemplate(template, 4, 1).trim();
    }
    return '{}';
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const template = convertJsonObject(parsed as Record<string, unknown>);
    return serializeTemplate(template, 4, 1).trim();
  }

  return '{}';
}

// ======================== TypeScript → dataTemplate ========================

interface TsField {
  name: string;
  type: string;
  optional: boolean;
  isArray: boolean;
  children?: TsField[];
}

/** 解析后的 interface / type 定义 */
interface TsDefinition {
  name: string;
  kind: 'interface' | 'type-alias' | 'type-union';
  body: string;           // interface/type 对象体（花括号内的内容）
  literals?: string[];    // type 联合字面量，如 ['GET', 'POST']
}

/**
 * 从花括号内容中提取匹配的闭合花括号位置
 * 处理嵌套花括号的情况
 */
function findMatchingBrace(str: string, startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 解析输入中的所有 interface 和 type 定义
 * 支持：
 *   - export interface Xxx { ... }
 *   - export type Xxx = { ... }
 *   - export type Xxx = 'a' | 'b' | 'c'
 */
function parseAllDefinitions(input: string): TsDefinition[] {
  const defs: TsDefinition[] = [];
  // 先移除块注释
  const cleaned = input.replace(/\/\*[\s\S]*?\*\//g, '');

  // 匹配 interface
  const interfaceRe = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+\w+(?:\s*,\s*\w+)*)?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = interfaceRe.exec(cleaned)) !== null) {
    const name = match[1];
    const braceStart = match.index + match[0].length - 1;
    const braceEnd = findMatchingBrace(cleaned, braceStart);
    if (braceEnd === -1) continue;
    const body = cleaned.slice(braceStart + 1, braceEnd);
    defs.push({ name, kind: 'interface', body });
  }

  // 匹配 type Xxx = { ... } (对象类型别名)
  const typeObjRe = /(?:export\s+)?type\s+(\w+)\s*=\s*\{/g;
  while ((match = typeObjRe.exec(cleaned)) !== null) {
    const name = match[1];
    const braceStart = match.index + match[0].length - 1;
    const braceEnd = findMatchingBrace(cleaned, braceStart);
    if (braceEnd === -1) continue;
    const body = cleaned.slice(braceStart + 1, braceEnd);
    defs.push({ name, kind: 'type-alias', body });
  }

  // 匹配 type Xxx = 'a' | 'b' | 'c' (字面量联合类型)
  const typeUnionRe = /(?:export\s+)?type\s+(\w+)\s*=\s*([^{][^;]*);/g;
  while ((match = typeUnionRe.exec(cleaned)) !== null) {
    const name = match[1];
    const unionStr = match[2].trim();
    // 解析字面量: 'a' | 'b' | "c" | 123
    const literals = unionStr.split('|').map(s => {
      const t = s.trim();
      // 去掉引号
      const strMatch = t.match(/^['"](.+)['"]$/);
      return strMatch ? strMatch[1] : t;
    }).filter(Boolean);
    if (literals.length > 0) {
      defs.push({ name, kind: 'type-union', body: '', literals });
    }
  }

  return defs;
}

/**
 * 构建类型名 → 定义的映射表
 */
function buildTypeMap(defs: TsDefinition[]): Map<string, TsDefinition> {
  const map = new Map<string, TsDefinition>();
  for (const def of defs) {
    map.set(def.name, def);
  }
  return map;
}

/**
 * 解析 interface/type 对象体中的字段列表
 * 支持嵌套花括号（内联对象类型）
 */
function parseTsFields(body: string): TsField[] {
  const fields: TsField[] = [];
  // 移除行注释
  const cleaned = body.replace(/\/\/.*$/gm, '');

  let i = 0;
  while (i < cleaned.length) {
    // 跳过空白
    while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
    if (i >= cleaned.length) break;

    // 匹配字段名
    const nameMatch = cleaned.slice(i).match(/^(\w+)(\?)?\s*:\s*/);
    if (!nameMatch) {
      // 跳过无法识别的字符直到下一个分号或换行
      const next = cleaned.indexOf(';', i);
      const nextNl = cleaned.indexOf('\n', i);
      i = Math.min(
        next === -1 ? cleaned.length : next + 1,
        nextNl === -1 ? cleaned.length : nextNl + 1
      );
      continue;
    }

    const fieldName = nameMatch[1];
    const optional = !!nameMatch[2];
    i += nameMatch[0].length;

    // 提取类型表达式（需要处理嵌套花括号）
    let typeExpr = '';
    let braceDepth = 0;
    let angleBracketDepth = 0;
    while (i < cleaned.length) {
      const ch = cleaned[i];
      if (ch === '{') { braceDepth++; typeExpr += ch; i++; continue; }
      if (ch === '}') {
        if (braceDepth > 0) { braceDepth--; typeExpr += ch; i++; continue; }
        break; // 到达外层闭合花括号
      }
      if (ch === '<') { angleBracketDepth++; typeExpr += ch; i++; continue; }
      if (ch === '>') { angleBracketDepth--; typeExpr += ch; i++; continue; }
      if ((ch === ';' || ch === '\n') && braceDepth === 0 && angleBracketDepth === 0) {
        i++;
        break;
      }
      typeExpr += ch;
      i++;
    }

    typeExpr = typeExpr.trim().replace(/,\s*$/, '');
    if (!typeExpr) continue;

    let type = typeExpr;
    let isArray = false;
    let children: TsField[] | undefined;

    // 检测数组: Type[] 或 Array<Type>
    if (type.endsWith('[]')) {
      isArray = true;
      type = type.slice(0, -2).trim();
    } else if (type.startsWith('Array<') && type.endsWith('>')) {
      isArray = true;
      type = type.slice(6, -1).trim();
    }

    // 内联对象类型: { key: string; value: string }
    if (type.startsWith('{') && type.endsWith('}')) {
      children = parseTsFields(type.slice(1, -1));
      type = 'object';
    }

    fields.push({ name: fieldName, type, optional, isArray, children });
  }

  return fields;
}

/**
 * 根据 TS 类型名和字段名推断 Mock 规则
 * typeMap 用于解析引用的其他 interface/type
 * visited 用于防止循环引用
 */
function inferMockFromTsType(
  name: string,
  type: string,
  isArray: boolean,
  children: TsField[] | undefined,
  typeMap: Map<string, TsDefinition>,
  visited: Set<string> = new Set()
): { mockKey: string; mockValue: unknown } {
  const lk = name.toLowerCase();

  // 如果有内联子字段，递归处理
  if (children && children.length > 0) {
    const childObj = tsFieldsToTemplate(children, typeMap, visited);
    if (isArray) {
      return { mockKey: `'${name}|5-10'`, mockValue: [childObj] };
    }
    return { mockKey: `'${name}'`, mockValue: childObj };
  }

  // 检查类型是否引用了其他已知定义
  const refDef = typeMap.get(type);
  if (refDef && !visited.has(type)) {
    visited.add(type);

    // 联合字面量类型 → 随机选一个
    if (refDef.kind === 'type-union' && refDef.literals) {
      const literals = refDef.literals;
      if (literals.every(l => /^\d+$/.test(l))) {
        // 全是数字
        if (isArray) {
          return { mockKey: `'${name}|5-10'`, mockValue: literals.map(Number) };
        }
        return { mockKey: `'${name}|1'`, mockValue: literals.map(Number) };
      }
      // 字符串字面量
      if (isArray) {
        return { mockKey: `'${name}|5-10'`, mockValue: literals };
      }
      return { mockKey: `'${name}|1'`, mockValue: literals };
    }

    // interface 或 type 对象别名 → 展开字段
    if (refDef.kind === 'interface' || refDef.kind === 'type-alias') {
      const refFields = parseTsFields(refDef.body);
      if (refFields.length > 0) {
        const childObj = tsFieldsToTemplate(refFields, typeMap, visited);
        if (isArray) {
          return { mockKey: `'${name}|5-10'`, mockValue: [childObj] };
        }
        return { mockKey: `'${name}'`, mockValue: childObj };
      }
    }

    visited.delete(type);
  }

  // 处理内联联合类型: 'a' | 'b' | 'c'
  if (type.includes('|')) {
    const parts = type.split('|').map(s => s.trim());
    // 检查是否全是字符串字面量
    const strLiterals = parts.map(p => {
      const m = p.match(/^['"](.+)['"]$/);
      return m ? m[1] : null;
    });
    if (strLiterals.every(s => s !== null)) {
      if (isArray) {
        return { mockKey: `'${name}|5-10'`, mockValue: strLiterals };
      }
      return { mockKey: `'${name}|1'`, mockValue: strLiterals };
    }
    // 检查是否全是数字字面量
    const numLiterals = parts.map(p => {
      const n = Number(p);
      return isNaN(n) ? null : n;
    });
    if (numLiterals.every(n => n !== null)) {
      if (isArray) {
        return { mockKey: `'${name}|5-10'`, mockValue: numLiterals };
      }
      return { mockKey: `'${name}|1'`, mockValue: numLiterals };
    }
    // 混合联合类型，取第一个非 undefined/null 的
    const firstUsable = parts.find(p => p !== 'undefined' && p !== 'null');
    if (firstUsable) {
      return inferMockFromTsType(name, firstUsable.replace(/['"]/g, ''), isArray, undefined, typeMap, visited);
    }
  }

  // 数组类型（基础类型数组）
  if (isArray) {
    const innerType = type.toLowerCase();
    if (innerType === 'string') {
      return { mockKey: `'${name}|5-10'`, mockValue: [`'@cword(2, 5)'`] };
    }
    if (innerType === 'number') {
      return { mockKey: `'${name}|5-10'`, mockValue: [`'@integer(1, 100)'`] };
    }
    if (innerType === 'boolean') {
      return { mockKey: `'${name}|5-10'`, mockValue: [true] };
    }
    return { mockKey: `'${name}|5-10'`, mockValue: [{}] };
  }

  const lt = type.toLowerCase();

  // string 类型 - 根据字段名推断
  if (lt === 'string') {
    if (lk === 'id' || lk.endsWith('id') || lk.endsWith('_id')) {
      return { mockKey: `'${name}'`, mockValue: `'@string("0123456789abcdef", 16)'` };
    }
    if (lk === 'name' || lk === 'username' || lk === 'nickname' || lk.endsWith('name')) {
      return { mockKey: `'${name}'`, mockValue: `'@cname'` };
    }
    if (lk === 'email' || lk.endsWith('email')) {
      return { mockKey: `'${name}'`, mockValue: `'@email'` };
    }
    if (lk === 'phone' || lk === 'mobile' || lk === 'tel') {
      return { mockKey: `'${name}'`, mockValue: `'@string("number", 11)'` };
    }
    if (lk === 'avatar' || lk === 'image' || lk === 'img' || lk === 'photo' || lk === 'pic' || lk.endsWith('url') || lk.endsWith('image')) {
      return { mockKey: `'${name}'`, mockValue: `'@image("200x200")'` };
    }
    if (lk === 'address' || lk === 'addr') {
      return { mockKey: `'${name}'`, mockValue: `'@county(true)'` };
    }
    if (lk === 'title') {
      return { mockKey: `'${name}'`, mockValue: `'@ctitle(5, 15)'` };
    }
    if (lk === 'desc' || lk === 'description' || lk === 'content' || lk === 'remark' || lk === 'summary') {
      return { mockKey: `'${name}'`, mockValue: `'@cparagraph(1, 3)'` };
    }
    if (lk.includes('time') || lk.includes('date') || lk === 'createdat' || lk === 'updatedat') {
      return { mockKey: `'${name}'`, mockValue: `'@datetime("yyyy-MM-dd HH:mm:ss")'` };
    }
    if (lk === 'status' || lk === 'state') {
      return { mockKey: `'${name}|1'`, mockValue: `['active', 'inactive', 'pending']` };
    }
    return { mockKey: `'${name}'`, mockValue: `'@cword(3, 8)'` };
  }

  // number 类型
  if (lt === 'number') {
    if (lk === 'id' || lk.endsWith('id') || lk.endsWith('_id')) {
      return { mockKey: `'${name}|+1'`, mockValue: 1 };
    }
    if (lk === 'age') {
      return { mockKey: `'${name}|18-60'`, mockValue: 1 };
    }
    if (lk === 'total' || lk === 'count') {
      return { mockKey: `'${name}|1-100'`, mockValue: 1 };
    }
    if (lk === 'page' || lk === 'pagenum' || lk === 'pageno') {
      return { mockKey: `'${name}'`, mockValue: 1 };
    }
    if (lk === 'pagesize' || lk === 'size' || lk === 'limit') {
      return { mockKey: `'${name}'`, mockValue: 10 };
    }
    if (lk.includes('price') || lk.includes('amount') || lk.includes('money') || lk.includes('fee')) {
      return { mockKey: `'${name}|100-9999.2'`, mockValue: 1 };
    }
    return { mockKey: `'${name}|1-100'`, mockValue: 1 };
  }

  // boolean 类型
  if (lt === 'boolean') {
    return { mockKey: `'${name}|1'`, mockValue: true };
  }

  // Record<string, xxx> 类型
  if (lt.startsWith('record<')) {
    return { mockKey: `'${name}'`, mockValue: {} };
  }

  // 其他未知类型
  return { mockKey: `'${name}'`, mockValue: `'@cword(3, 8)'` };
}

/**
 * 将解析后的 TS 字段列表转换为 dataTemplate 对象
 */
function tsFieldsToTemplate(
  fields: TsField[],
  typeMap: Map<string, TsDefinition>,
  visited: Set<string> = new Set()
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const { mockKey, mockValue } = inferMockFromTsType(
      field.name, field.type, field.isArray, field.children, typeMap, new Set(visited)
    );
    result[mockKey] = mockValue;
  }
  return result;
}

/**
 * 从 TypeScript 输入中提取所有可选的 interface/type 名称（仅对象类型）
 */
export function extractTsInterfaceNames(input: string): string[] {
  const defs = parseAllDefinitions(input);
  return defs
    .filter(d => d.kind === 'interface' || d.kind === 'type-alias')
    .map(d => d.name);
}

/**
 * 从 TypeScript 接口/类型定义生成 dataTemplate 代码
 * @param tsStr - 完整的 TS 输入（可包含多个 interface/type）
 * @param targetName - 要生成的目标 interface/type 名称，不传则取最后一个对象类型
 */
function fromTypeScript(tsStr: string, targetName?: string): string {
  const defs = parseAllDefinitions(tsStr);
  const typeMap = buildTypeMap(defs);

  // 找到目标定义
  const objectDefs = defs.filter(d => d.kind === 'interface' || d.kind === 'type-alias');
  if (objectDefs.length === 0) {
    throw new Error('无法识别 TypeScript 接口定义，请确保格式为 interface Xxx { ... } 或 type Xxx = { ... }');
  }

  let target: TsDefinition;
  if (targetName) {
    const found = objectDefs.find(d => d.name === targetName);
    if (!found) {
      throw new Error(`未找到名为 "${targetName}" 的接口定义`);
    }
    target = found;
  } else {
    // 默认取最后一个对象类型定义
    target = objectDefs[objectDefs.length - 1];
  }

  const fields = parseTsFields(target.body);
  if (fields.length === 0) {
    throw new Error(`接口 "${target.name}" 中未解析出任何字段`);
  }

  const visited = new Set<string>();
  visited.add(target.name);
  const template = tsFieldsToTemplate(fields, typeMap, visited);
  return serializeTemplate(template, 4, 1).trim();
}

// ======================== 自动检测 & 主入口 ========================

export type InputType = 'json' | 'typescript';

/**
 * 自动检测输入类型
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  if (trimmed.match(/^\s*(export\s+)?(interface|type)\s+/m)) {
    return 'typescript';
  }
  return 'json';
}

/**
 * 主入口：将用户输入（JSON 或 TS）转换为 dataTemplate 代码字符串
 * 返回可直接嵌入到模板 const dataTemplate = { ... } 中的内容
 * @param targetName - 当输入为 TS 且包含多个 interface 时，指定目标名称
 */
export function generateDataTemplate(input: string, targetName?: string): string {
  const type = detectInputType(input);
  if (type === 'typescript') {
    return fromTypeScript(input, targetName);
  }
  return fromJson(input);
}

/**
 * 将生成的 dataTemplate 嵌入到完整的高级模式模板中
 */
export function buildAdvancedTemplate(dataTemplateBody: string): string {
  return `/**
 * 通用 Mock 基础模板
 * 核心功能：提供标准的外层包装，你只需要修改 dataTemplate 即可
 */
function main(req, Mock) {

  // ==========================================
  // ▼▼▼ 1. 在这里手动填写你的数据结构 ▼▼▼
  // ==========================================

  const dataTemplate = ${dataTemplateBody};

  // ==========================================
  // ▲▲▲ 填写结束 ▲▲▲
  // ==========================================


  // 2. 执行 Mock 生成
  const resultData = Mock.mock(dataTemplate);

  // 3. 返回标准统一格式
  return {
    code: 200,          // 默认成功状态码
    message: 'success', // 默认提示
    data: resultData,   // 你的数据放在这里
    // timestamp: Date.now()
  };
}`;
}
