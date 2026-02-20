<script setup lang="ts">
import { ref, computed } from 'vue';
import CodeEditor from '../CodeEditor.vue';
import { escapeHtml, copyText } from './tools-utils';

defineProps<{
  activeTool: string;
  isDark: boolean;
}>();

/* ==================== 时间戳转换工具 ==================== */

const tsInput = ref('');
const tsOutput = ref('');
const nowTs = ref(Math.floor(Date.now() / 1000));
const nowTsMs = ref(Date.now());
const tsFormat = ref('default');
setInterval(() => { nowTs.value = Math.floor(Date.now() / 1000); nowTsMs.value = Date.now(); }, 1000);

const tsFormats: { label: string; value: string }[] = [
  { label: '默认格式', value: 'default' },
  { label: 'ISO 8601', value: 'iso' },
  { label: 'YYYY-MM-DD', value: 'date' },
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'datetime' },
  { label: 'YYYY/MM/DD HH:mm:ss', value: 'datetime2' },
  { label: 'Unix 秒级', value: 'unix' },
  { label: 'Unix 毫秒级', value: 'unixms' },
  { label: 'UTC 字符串', value: 'utc' },
  { label: '相对时间', value: 'relative' },
];

function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const Y = d.getFullYear(), M = pad(d.getMonth() + 1), D = pad(d.getDate());
  const h = pad(d.getHours()), m = pad(d.getMinutes()), s = pad(d.getSeconds());
  switch (fmt) {
    case 'iso': return d.toISOString();
    case 'date': return `${Y}-${M}-${D}`;
    case 'datetime': return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    case 'datetime2': return `${Y}/${M}/${D} ${h}:${m}:${s}`;
    case 'unix': return String(Math.floor(d.getTime() / 1000));
    case 'unixms': return String(d.getTime());
    case 'utc': return d.toUTCString();
    case 'relative': return getRelativeTime(d);
    default: return d.toLocaleString('zh-CN', { hour12: false });
  }
}

function getRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const suffix = diff > 0 ? '前' : '后';
  if (abs < 60000) return `${Math.floor(abs / 1000)} 秒${suffix}`;
  if (abs < 3600000) return `${Math.floor(abs / 60000)} 分钟${suffix}`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)} 小时${suffix}`;
  if (abs < 2592000000) return `${Math.floor(abs / 86400000)} 天${suffix}`;
  if (abs < 31536000000) return `${Math.floor(abs / 2592000000)} 个月${suffix}`;
  return `${Math.floor(abs / 31536000000)} 年${suffix}`;
}

function tsToDate() {
  const n = Number(tsInput.value);
  if (isNaN(n)) { tsOutput.value = '请输入有效数字'; return; }
  const ms = String(n).length > 10 ? n : n * 1000;
  const d = new Date(ms);
  const lines = [formatDate(d, tsFormat.value)];
  if (tsFormat.value === 'default') {
    lines.push(`ISO: ${d.toISOString()}`);
    lines.push(`UTC: ${d.toUTCString()}`);
    lines.push(`相对: ${getRelativeTime(d)}`);
    lines.push(`秒级: ${Math.floor(ms / 1000)}`);
    lines.push(`毫秒级: ${ms}`);
  }
  tsOutput.value = lines.join('\n');
}

function dateToTs() {
  const d = new Date(tsInput.value);
  if (isNaN(d.getTime())) { tsOutput.value = '请输入有效日期，如 2024-01-01 12:00:00'; return; }
  tsOutput.value = `秒级：${Math.floor(d.getTime() / 1000)}\n毫秒级：${d.getTime()}\nISO：${d.toISOString()}\n相对：${getRelativeTime(d)}`;
}

function tsNow() { tsInput.value = String(nowTs.value); tsToDate(); }
function tsNowMs() { tsInput.value = String(nowTsMs.value); tsToDate(); }

/* ==================== UUID / ID 生成工具 ==================== */

const uuidCount = ref(5);
const uuidOutput = ref('');
const uuidFormat = ref<'standard' | 'upper' | 'nodash' | 'braces'>('standard');
const uuidType = ref<'uuid' | 'nanoid' | 'objectid' | 'snowflake'>('uuid');
const nanoidLength = ref(21);
const nanoidAlphabet = ref('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-');

function generateUUID() {
  const results: string[] = [];
  for (let i = 0; i < uuidCount.value; i++) {
    if (uuidType.value === 'uuid') {
      let id: string = crypto.randomUUID();
      if (uuidFormat.value === 'upper') id = id.toUpperCase();
      else if (uuidFormat.value === 'nodash') id = id.replace(/-/g, '');
      else if (uuidFormat.value === 'braces') id = `{${id}}`;
      results.push(id);
    } else if (uuidType.value === 'nanoid') {
      const chars = nanoidAlphabet.value;
      const arr = new Uint8Array(nanoidLength.value);
      crypto.getRandomValues(arr);
      results.push(Array.from(arr, v => chars[v % chars.length]).join(''));
    } else if (uuidType.value === 'objectid') {
      const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
      results.push(ts + rand);
    } else if (uuidType.value === 'snowflake') {
      const ts = BigInt(Date.now() - 1288834974657);
      const rand = BigInt(Math.floor(Math.random() * 4096));
      const seq = BigInt(i % 4096);
      results.push(String((ts << 22n) | (rand << 12n) | seq));
    }
  }
  uuidOutput.value = results.join('\n');
}

/* ==================== 颜色转换工具 ==================== */

const colorHex = ref('#409EFF');
const colorR = ref(64);
const colorG = ref(158);
const colorB = ref(255);
const colorH = ref(210);
const colorS = ref(100);
const colorL = ref(63);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

const colorA = ref(100);
const colorPreview = computed(() => {
  const a = colorA.value / 100;
  return a < 1 ? `rgba(${colorR.value}, ${colorG.value}, ${colorB.value}, ${a})` : colorHex.value;
});
let colorSyncing = false;

function onColorHexInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  const rgb = hexToRgb(colorHex.value);
  if (rgb) {
    colorR.value = rgb.r; colorG.value = rgb.g; colorB.value = rgb.b;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    colorH.value = hsl.h; colorS.value = hsl.s; colorL.value = hsl.l;
  }
  colorSyncing = false;
}

function onColorRgbInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  colorHex.value = rgbToHex(colorR.value, colorG.value, colorB.value);
  const hsl = rgbToHsl(colorR.value, colorG.value, colorB.value);
  colorH.value = hsl.h; colorS.value = hsl.s; colorL.value = hsl.l;
  colorSyncing = false;
}

function onColorHslInput() {
  if (colorSyncing) return;
  colorSyncing = true;
  const rgb = hslToRgb(colorH.value, colorS.value, colorL.value);
  colorR.value = rgb.r; colorG.value = rgb.g; colorB.value = rgb.b;
  colorHex.value = rgbToHex(rgb.r, rgb.g, rgb.b);
  colorSyncing = false;
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

const colorContrastWhite = computed(() => {
  const l1 = luminance(colorR.value, colorG.value, colorB.value);
  return ((Math.max(l1, 1) + 0.05) / (Math.min(l1, 1) + 0.05)).toFixed(2);
});

const colorContrastBlack = computed(() => {
  const l1 = luminance(colorR.value, colorG.value, colorB.value);
  return ((Math.max(l1, 0) + 0.05) / (Math.min(l1, 0) + 0.05)).toFixed(2);
});

const colorPalette = computed(() => {
  const shades: { hex: string; label: string }[] = [];
  for (let i = 95; i >= 5; i -= 10) {
    const rgb = hslToRgb(colorH.value, colorS.value, i);
    shades.push({ hex: rgbToHex(rgb.r, rgb.g, rgb.b), label: `L${i}` });
  }
  return shades;
});

const colorPresets = [
  { label: 'Element Blue', hex: '#409EFF' }, { label: 'Success', hex: '#67C23A' },
  { label: 'Warning', hex: '#E6A23C' }, { label: 'Danger', hex: '#F56C6C' },
  { label: 'Info', hex: '#909399' }, { label: 'Tailwind Blue', hex: '#3B82F6' },
  { label: 'Tailwind Green', hex: '#22C55E' }, { label: 'Tailwind Purple', hex: '#A855F7' },
  { label: 'Ant Blue', hex: '#1677FF' }, { label: 'Material Teal', hex: '#009688' },
  { label: 'Material Amber', hex: '#FFC107' }, { label: 'Material Pink', hex: '#E91E63' },
];

function applyColorPreset(hex: string) {
  colorHex.value = hex;
  onColorHexInput();
}

/* ==================== 哈希生成工具 ==================== */

const hashInput = ref('');
const hashAlgo = ref('SHA-256');
const hashOutput = ref('');

async function generateHash() {
  if (!hashInput.value) { hashOutput.value = ''; return; }
  const data = new TextEncoder().encode(hashInput.value);
  const buffer = await crypto.subtle.digest(hashAlgo.value, data);
  hashOutput.value = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ==================== 进制转换工具 ==================== */

const radixBin = ref('');
const radixOct = ref('');
const radixDec = ref('');
const radixHexVal = ref('');
const radixError = ref('');

function onRadixInput(from: 'bin' | 'oct' | 'dec' | 'hex') {
  radixError.value = '';
  const baseMap = { bin: 2, oct: 8, dec: 10, hex: 16 } as const;
  const valMap = { bin: radixBin, oct: radixOct, dec: radixDec, hex: radixHexVal } as const;
  const input = valMap[from].value.trim();
  if (!input) { radixBin.value = ''; radixOct.value = ''; radixDec.value = ''; radixHexVal.value = ''; return; }
  const num = parseInt(input, baseMap[from]);
  if (isNaN(num)) { radixError.value = '输入不是有效的数值'; return; }
  if (from !== 'bin') radixBin.value = num.toString(2);
  if (from !== 'oct') radixOct.value = num.toString(8);
  if (from !== 'dec') radixDec.value = num.toString(10);
  if (from !== 'hex') radixHexVal.value = num.toString(16).toUpperCase();
}

/* ==================== 随机密码生成工具 ==================== */

const pwdLength = ref(16);
const pwdUppercase = ref(true);
const pwdLowercase = ref(true);
const pwdDigits = ref(true);
const pwdSpecial = ref(true);
const pwdOutput = ref('');

const pwdStrength = computed(() => {
  const pwd = pwdOutput.value;
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 2) return { level: 1, text: '弱', color: '#f56c6c' };
  if (score <= 3) return { level: 2, text: '中等', color: '#e6a23c' };
  if (score <= 4) return { level: 3, text: '强', color: '#409eff' };
  return { level: 4, text: '很强', color: '#67c23a' };
});

function generatePassword() {
  let chars = '';
  if (pwdUppercase.value) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (pwdLowercase.value) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (pwdDigits.value) chars += '0123456789';
  if (pwdSpecial.value) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) { pwdOutput.value = ''; return; }
  const arr = new Uint32Array(pwdLength.value);
  crypto.getRandomValues(arr);
  pwdOutput.value = Array.from(arr, v => chars[v % chars.length]).join('');
}

/* ==================== Mock 数据生成工具 ==================== */

const mockType = ref('preset');
const mockPreset = ref('name');
const mockCount = ref(10);
const mockOutput = ref('');
const mockCustomTpl = ref('');

const mockPresets: { label: string; key: string; category: string }[] = [
  { label: '中文姓名', key: 'name', category: '个人信息' },
  { label: '英文姓名', key: 'nameEn', category: '个人信息' },
  { label: '手机号', key: 'phone', category: '个人信息' },
  { label: '邮箱', key: 'email', category: '个人信息' },
  { label: '身份证号', key: 'idcard', category: '个人信息' },
  { label: '省市区地址', key: 'address', category: '个人信息' },
  { label: 'IPv4 地址', key: 'ip', category: '网络' },
  { label: 'URL', key: 'url', category: '网络' },
  { label: '域名', key: 'domain', category: '网络' },
  { label: '日期时间', key: 'datetime', category: '日期' },
  { label: '日期', key: 'date', category: '日期' },
  { label: '时间', key: 'time', category: '日期' },
  { label: '整数(0-9999)', key: 'integer', category: '数字' },
  { label: '浮点数', key: 'float', category: '数字' },
  { label: '布尔值', key: 'boolean', category: '数字' },
  { label: '中文段落', key: 'paragraph', category: '文本' },
  { label: '中文句子', key: 'sentence', category: '文本' },
  { label: '英文单词', key: 'word', category: '文本' },
  { label: '颜色 HEX', key: 'color', category: '其他' },
  { label: '图片URL', key: 'image', category: '其他' },
  { label: 'UUID', key: 'uuid', category: '其他' },
];

const mockPresetCategories = computed(() => {
  const map = new Map<string, typeof mockPresets>();
  for (const p of mockPresets) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return Array.from(map.entries());
});

function generateMockData() {
  const results: any[] = [];
  for (let i = 0; i < mockCount.value; i++) {
    if (mockType.value === 'preset') {
      results.push(generateMockValue(mockPreset.value));
    } else {
      try {
        const tpl = JSON.parse(mockCustomTpl.value);
        results.push(generateMockFromTemplate(tpl));
      } catch (e: any) {
        mockOutput.value = '模板 JSON 解析失败：' + e.message;
        return;
      }
    }
  }
  mockOutput.value = JSON.stringify(results, null, 2);
}

function generateMockFromTemplate(tpl: any): any {
  if (typeof tpl === 'string') {
    const m = tpl.match(/^@(\w+)$/);
    if (m) return generateMockValue(m[1]);
    return tpl.replace(/@(\w+)/g, (_: string, key: string) => String(generateMockValue(key)));
  }
  if (Array.isArray(tpl)) return tpl.map(item => generateMockFromTemplate(item));
  if (typeof tpl === 'object' && tpl !== null) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(tpl)) {
      result[key] = generateMockFromTemplate(val);
    }
    return result;
  }
  return tpl;
}

const _surnames = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董粱杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓';
const _names = '伟刚勇毅俊峰强军平保东文辉力明永健世广志义兴良海山仁波宁贵福生龙元全国胜学祥才发武新利清飞彬富顺信子杰涛昌成康星光天达安岩中茂进林有坚和彪博诚先敬震振壮会思群豪心邦承乐绍功松善厚庆磊民友裕河哲江超浩亮政谦亨奇固之轮翰朗伯宏言若鸣朋斌梦龙佳涵蕾欣瑶婷桂萍雪珍琳晶莹倩玲珊素娜静淑惠雅秀巧慧丽美华翠容仪娟芳茜琴兰凤洁诗桃玉萌岚';
const _provinces = ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '湖南', '山东', '河南', '福建', '重庆', '天津', '河北', '辽宁', '吉林', '安徽', '江西', '陕西', '广西', '云南', '贵州', '甘肃', '海南', '山西', '内蒙古', '黑龙江', '新疆', '西藏', '青海', '宁夏'];
const _cities = ['市区', '新城区', '开发区', '高新区', '经济区', '科技园区'];
const _roads = ['人民路', '中山路', '解放路', '建设路', '和平路', '文化路', '长江路', '南京路', '北京路', '上海路', '科技路', '创新路', '学府路', '民主路', '富强路'];
const _firstNames = ['James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Emily', 'Emma', 'Olivia', 'Ava', 'Sophia'];
const _lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark'];
const _domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'mock.dev', 'fake.co', 'data.app'];
const _words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'labore', 'et', 'magna', 'aliqua', 'ut', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation'];
const _cnWords = '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏闰余成岁律吕调阳云腾致雨露结为霜金生丽水玉出昆冈剑号巨阙珠称夜光果珍李柰菜重芥姜海咸河淡鳞潜羽翔龙师火帝鸟官人皇始制文字乃服衣裳推位让国有虞陶唐';

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(arr: string): string;
function randItem<T>(arr: T[]): T;
function randItem(arr: any[] | string): any { return arr[randInt(0, arr.length - 1)]; }
function randPhone() { return '1' + randItem('3456789') + Array.from({ length: 9 }, () => randInt(0, 9)).join(''); }
function randDate(start = 2020, end = 2025) {
  const y = randInt(start, end), m = randInt(1, 12), d = randInt(1, 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function randTime() { return `${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`; }

function generateMockValue(key: string): any {
  switch (key) {
    case 'name': return randItem(_surnames) + randItem(_names) + (Math.random() > 0.5 ? '' : String(randItem(_names)));
    case 'nameEn': return randItem(_firstNames) + ' ' + randItem(_lastNames);
    case 'phone': return randPhone();
    case 'email': return randItem(_firstNames).toString().toLowerCase() + randInt(10, 999) + '@' + randItem(_domains);
    case 'idcard': {
      const area = String(randInt(110000, 659999));
      const birth = randDate(1970, 2005).replace(/-/g, '');
      const seq = String(randInt(100, 999));
      const checkDigits = '0123456789X';
      return area + birth + seq + randItem(checkDigits);
    }
    case 'address': return randItem(_provinces) + '省' + randItem(_provinces) + randItem(_cities) + randItem(_roads) + randInt(1, 200) + '号';
    case 'ip': return `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
    case 'url': return `https://${randItem(_domains)}/${randItem(_words)}/${randItem(_words)}`;
    case 'domain': return randItem(['www', 'api', 'app', 'dev', 'test']) + '.' + randItem(_domains);
    case 'datetime': return randDate() + ' ' + randTime();
    case 'date': return randDate();
    case 'time': return randTime();
    case 'integer': return randInt(0, 9999);
    case 'float': return parseFloat((Math.random() * 10000).toFixed(2));
    case 'boolean': return Math.random() > 0.5;
    case 'paragraph': {
      const len = randInt(2, 5);
      return Array.from({ length: len }, () => {
        const sLen = randInt(8, 20);
        return Array.from({ length: sLen }, () => randItem(_cnWords)).join('') + '。';
      }).join('');
    }
    case 'sentence': {
      const sLen = randInt(8, 20);
      return Array.from({ length: sLen }, () => randItem(_cnWords)).join('') + '。';
    }
    case 'word': return randItem(_words);
    case 'color': return '#' + Array.from({ length: 6 }, () => '0123456789ABCDEF'[randInt(0, 15)]).join('');
    case 'image': return `https://picsum.photos/${randInt(2, 8) * 100}/${randInt(2, 6) * 100}`;
    case 'uuid': return crypto.randomUUID();
    default: return randItem(_words);
  }
}

/* ==================== 占位图生成工具 ==================== */

const phWidth = ref(400);
const phHeight = ref(300);
const phBgColor = ref('#CCCCCC');
const phTextColor = ref('#666666');
const phText = ref('');
const phFontSize = ref(0);
const phFormat = ref<'png' | 'svg'>('png');
const phDataUrl = ref('');

function generatePlaceholder() {
  const w = phWidth.value;
  const h = phHeight.value;
  const text = phText.value || `${w} × ${h}`;
  const fontSize = phFontSize.value || Math.max(12, Math.min(w, h) / 8);

  if (phFormat.value === 'svg') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${phBgColor.value}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="${fontSize}" fill="${phTextColor.value}">${escapeHtml(text)}</text>
</svg>`;
    phDataUrl.value = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = phBgColor.value;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = phTextColor.value;
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    phDataUrl.value = canvas.toDataURL('image/png');
  }
}

function downloadPlaceholder() {
  if (!phDataUrl.value) return;
  const a = document.createElement('a');
  a.href = phDataUrl.value;
  a.download = `placeholder-${phWidth.value}x${phHeight.value}.${phFormat.value}`;
  a.click();
}

/* ==================== 数字格式化工具 ==================== */

const numInput = ref('');

const numFormats = computed(() => {
  const s = numInput.value.trim();
  if (!s) return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  const abs = Math.abs(n);

  const thousands = n.toLocaleString('zh-CN');
  const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n);
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const scientific = n.toExponential();
  const percent = (n * 100).toFixed(2) + '%';
  const upperCny = numberToChineseUpper(n);
  const fileSize = formatFileSize(abs);
  const intN = Math.floor(abs);
  const bin = intN.toString(2);
  const oct = intN.toString(8);
  const hex = intN.toString(16).toUpperCase();
  const roman = intN > 0 && intN <= 3999 ? toRoman(intN) : '-';
  const chineseNum = numberToChinese(abs);

  return { thousands, cny, usd, scientific, percent, upperCny, fileSize, bin, oct, hex, roman, chineseNum };
});

function numberToChineseUpper(n: number): string {
  if (n === 0) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿', '兆'];
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);
  const jiao = Math.floor(decPart / 10);
  const fen = decPart % 10;

  let result = '';
  if (intPart === 0) {
    result = '零';
  } else {
    const str = String(intPart);
    const groups: string[] = [];
    for (let i = str.length; i > 0; i -= 4) groups.unshift(str.slice(Math.max(0, i - 4), i));
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      let groupStr = '';
      let hasZero = false;
      for (let i = 0; i < g.length; i++) {
        const d = parseInt(g[i]);
        const unitIdx = g.length - 1 - i;
        if (d === 0) { hasZero = true; }
        else { if (hasZero) { groupStr += '零'; hasZero = false; } groupStr += digits[d] + units[unitIdx]; }
      }
      if (groupStr) result += groupStr + bigUnits[groups.length - 1 - gi];
    }
  }

  result += '元';
  if (jiao === 0 && fen === 0) { result += '整'; }
  else {
    if (jiao > 0) result += digits[jiao] + '角';
    else if (fen > 0) result += '零';
    if (fen > 0) result += digits[fen] + '分';
  }
  return (isNeg ? '负' : '') + result;
}

function numberToChinese(n: number): string {
  if (n === 0) return '零';
  const digits = '零一二三四五六七八九';
  const units = ['', '十', '百', '千'];
  const bigUnits = ['', '万', '亿'];
  const intPart = Math.floor(n);
  const str = String(intPart);
  const groups: string[] = [];
  for (let i = str.length; i > 0; i -= 4) groups.unshift(str.slice(Math.max(0, i - 4), i));
  let result = '';
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    let groupStr = '';
    let hasZero = false;
    for (let i = 0; i < g.length; i++) {
      const d = parseInt(g[i]);
      const unitIdx = g.length - 1 - i;
      if (d === 0) { hasZero = true; }
      else { if (hasZero) { groupStr += '零'; hasZero = false; } groupStr += digits[d] + units[unitIdx]; }
    }
    if (groupStr) result += groupStr + bigUnits[groups.length - 1 - gi];
  }
  if (result.startsWith('一十')) result = result.slice(1);
  return result;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

function toRoman(num: number): string {
  const map: [number, string][] = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let result = '';
  for (const [val, sym] of map) { while (num >= val) { result += sym; num -= val; } }
  return result;
}

/* ==================== 二维码生成工具 ==================== */

const qrText = ref('');
const qrSize = ref(256);
const qrErrorLevel = ref<'L' | 'M' | 'Q' | 'H'>('M');
const qrFgColor = ref('#000000');
const qrBgColor = ref('#FFFFFF');
const qrDataUrl = ref('');

function generateQrCode() {
  if (!qrText.value) return;
  const modules = encodeQR(qrText.value, qrErrorLevel.value);
  if (!modules) { qrDataUrl.value = ''; return; }
  const size = qrSize.value;
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = qrBgColor.value;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = qrFgColor.value;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        ctx.fillRect(Math.round(c * cellSize), Math.round(r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }
  qrDataUrl.value = canvas.toDataURL('image/png');
}

function encodeQR(text: string, ecLevel: string): boolean[][] | null {
  const data = new TextEncoder().encode(text);
  const version = selectVersion(data.length, ecLevel);
  if (version < 1 || version > 10) return null;
  const size = version * 4 + 17;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  placeFinder(modules, 0, 0);
  placeFinder(modules, size - 7, 0);
  placeFinder(modules, 0, size - 7);
  placeTiming(modules, size);
  if (version >= 2) placeAlignment(modules, version);

  reserveFormatArea(modules, size);

  const encoded = encodeData(data, version, ecLevel);
  if (!encoded) return null;

  placeData(modules, encoded, size);
  applyMask(modules, size, 0);
  writeFormatInfo(modules, size, ecLevel, 0);

  return modules.map(row => row.map(v => v === true));
}

function selectVersion(dataLen: number, ecLevel: string): number {
  const caps: Record<string, number[]> = {
    'L': [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
    'M': [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
    'Q': [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
    'H': [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
  };
  const cap = caps[ecLevel] || caps['M'];
  for (let i = 0; i < cap.length; i++) { if (dataLen <= cap[i]) return i + 1; }
  return -1;
}

function placeFinder(modules: (boolean | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || cc < 0 || rr >= modules.length || cc >= modules.length) continue;
      const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      modules[rr][cc] = isBlack;
    }
  }
}

function placeTiming(modules: (boolean | null)[][], size: number) {
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
    if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
  }
}

function placeAlignment(modules: (boolean | null)[][], version: number) {
  const positions = getAlignmentPositions(version);
  for (const r of positions) {
    for (const c of positions) {
      if (modules[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          modules[r + dr][c + dc] = isBlack;
        }
      }
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const positions: number[][] = [[], [6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  return positions[version] || [];
}

function reserveFormatArea(modules: (boolean | null)[][], size: number) {
  for (let i = 0; i < 8; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
    if (modules[8][size - 1 - i] === null) modules[8][size - 1 - i] = false;
    if (modules[size - 1 - i][8] === null) modules[size - 1 - i][8] = false;
  }
  modules[size - 8][8] = true;
}

function encodeData(data: Uint8Array, version: number, ecLevel: string): Uint8Array | null {
  const bits: number[] = [];
  bits.push(0, 1, 0, 0);
  const countBits = version <= 9 ? 8 : 16;
  for (let i = countBits - 1; i >= 0; i--) bits.push((data.length >> i) & 1);
  for (const byte of data) { for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1); }
  const totalDataBits = getDataCapacityBits(version, ecLevel);
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    for (let i = 7; i >= 0; i--) bits.push((padBytes[padIdx] >> i) & 1);
    padIdx = (padIdx + 1) % 2;
  }
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    dataBytes.push(byte);
  }
  const ecInfo = getEcInfo(version, ecLevel);
  const result: number[] = [];
  let offset = 0;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (const block of ecInfo.blocks) {
    for (let b = 0; b < block.count; b++) {
      const blockData = dataBytes.slice(offset, offset + block.dataCodewords);
      offset += block.dataCodewords;
      dataBlocks.push(blockData);
      ecBlocks.push(generateEC(blockData, ecInfo.ecCodewordsPerBlock));
    }
  }
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  const maxEcLen = ecInfo.ecCodewordsPerBlock;
  for (let i = 0; i < maxDataLen; i++) { for (const block of dataBlocks) { if (i < block.length) result.push(block[i]); } }
  for (let i = 0; i < maxEcLen; i++) { for (const block of ecBlocks) { if (i < block.length) result.push(block[i]); } }
  const resultBits = new Uint8Array(result.length * 8);
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < 8; j++) resultBits[i * 8 + j] = (result[i] >> (7 - j)) & 1;
  }
  return resultBits;
}

function getDataCapacityBits(version: number, ecLevel: string): number {
  const table: Record<string, number[]> = {
    'L': [152,272,440,640,864,1088,1248,1552,1856,2192],
    'M': [128,224,352,512,688,864,992,1232,1456,1728],
    'Q': [104,176,272,384,496,608,704,880,1056,1232],
    'H': [72,128,208,288,368,480,528,688,800,976],
  };
  return (table[ecLevel] || table['M'])[version - 1] || 0;
}

function getEcInfo(version: number, ecLevel: string): { ecCodewordsPerBlock: number; blocks: { count: number; dataCodewords: number }[] } {
  const table: Record<string, { ec: number; blocks: [number, number][] }[]> = {
    'L': [
      { ec: 7, blocks: [[1,19]] }, { ec: 10, blocks: [[1,34]] }, { ec: 15, blocks: [[1,55]] },
      { ec: 20, blocks: [[1,80]] }, { ec: 26, blocks: [[1,108]] }, { ec: 18, blocks: [[2,68]] },
      { ec: 20, blocks: [[2,78]] }, { ec: 24, blocks: [[2,97]] }, { ec: 30, blocks: [[2,116]] },
      { ec: 18, blocks: [[2,68],[2,69]] },
    ],
    'M': [
      { ec: 10, blocks: [[1,16]] }, { ec: 16, blocks: [[1,28]] }, { ec: 26, blocks: [[1,44]] },
      { ec: 18, blocks: [[2,32]] }, { ec: 24, blocks: [[2,43]] }, { ec: 16, blocks: [[4,27]] },
      { ec: 18, blocks: [[4,31]] }, { ec: 22, blocks: [[2,38],[2,39]] }, { ec: 22, blocks: [[3,36],[2,37]] },
      { ec: 26, blocks: [[4,43],[1,44]] },
    ],
    'Q': [
      { ec: 13, blocks: [[1,13]] }, { ec: 22, blocks: [[1,22]] }, { ec: 18, blocks: [[2,17]] },
      { ec: 26, blocks: [[2,24]] }, { ec: 18, blocks: [[2,15],[2,16]] }, { ec: 24, blocks: [[4,19]] },
      { ec: 18, blocks: [[2,14],[4,15]] }, { ec: 22, blocks: [[4,18],[2,19]] }, { ec: 20, blocks: [[4,16],[4,17]] },
      { ec: 24, blocks: [[6,19],[2,20]] },
    ],
    'H': [
      { ec: 17, blocks: [[1,9]] }, { ec: 28, blocks: [[1,16]] }, { ec: 22, blocks: [[2,13]] },
      { ec: 16, blocks: [[4,9]] }, { ec: 22, blocks: [[2,11],[2,12]] }, { ec: 28, blocks: [[4,15]] },
      { ec: 26, blocks: [[4,13],[1,14]] }, { ec: 26, blocks: [[4,14],[2,15]] }, { ec: 24, blocks: [[4,12],[4,13]] },
      { ec: 28, blocks: [[6,15],[2,16]] },
    ],
  };
  const info = (table[ecLevel] || table['M'])[version - 1];
  return {
    ecCodewordsPerBlock: info.ec,
    blocks: info.blocks.map(([count, data]) => ({ count, dataCodewords: data })),
  };
}

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x = (x << 1) ^ (x & 0x80 ? 0x11D : 0); }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generateEC(data: number[], ecCount: number): number[] {
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }
  const result = new Array(ecCount).fill(0);
  const msg = [...data, ...result];
  for (let i = 0; i < data.length; i++) {
    const coeff = msg[i];
    if (coeff !== 0) {
      for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coeff);
    }
  }
  return msg.slice(data.length);
}

function placeData(modules: (boolean | null)[][], bits: Uint8Array, size: number) {
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0) continue;
        if (modules[row][c] !== null) continue;
        modules[row][c] = bitIdx < bits.length ? bits[bitIdx++] === 1 : false;
      }
    }
    upward = !upward;
  }
}

function applyMask(modules: (boolean | null)[][], size: number, mask: number) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunction(modules, r, c, size)) continue;
      let swap = false;
      switch (mask) {
        case 0: swap = (r + c) % 2 === 0; break;
        case 1: swap = r % 2 === 0; break;
        case 2: swap = c % 3 === 0; break;
        case 3: swap = (r + c) % 3 === 0; break;
      }
      if (swap) modules[r][c] = !modules[r][c];
    }
  }
}

function isFunction(modules: (boolean | null)[][], r: number, c: number, size: number): boolean {
  if ((r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9)) return true;
  if (r === 6 || c === 6) return true;
  return false;
}

function writeFormatInfo(modules: (boolean | null)[][], size: number, ecLevel: string, mask: number) {
  const ecBits: Record<string, number> = { 'L': 1, 'M': 0, 'Q': 3, 'H': 2 };
  const formatData = (ecBits[ecLevel] << 3) | mask;
  const formatStrings: number[] = [
    0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
    0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
    0x1689, 0x13BE, 0x1CE7, 0x19D0, 0x0762, 0x0255, 0x0D0C, 0x083B,
    0x355F, 0x3068, 0x3F31, 0x3A06, 0x24B4, 0x2183, 0x2EDA, 0x2BED,
  ];
  const info = formatStrings[formatData] || 0;
  for (let i = 0; i < 8; i++) {
    const bit = (info >> (14 - i)) & 1;
    modules[8][i <= 5 ? i : i + 1] = bit === 1;
    modules[size - 1 - i][8] = bit === 1;
  }
  for (let i = 8; i < 15; i++) {
    const bit = (info >> (14 - i)) & 1;
    modules[14 - i <= 5 ? 14 - i : 15 - i][8] = bit === 1;
    modules[8][size - 15 + i] = bit === 1;
  }
}

function downloadQrCode() {
  if (!qrDataUrl.value) return;
  const a = document.createElement('a');
  a.href = qrDataUrl.value;
  a.download = 'qrcode.png';
  a.click();
}
</script>

<template>
  <div>
    <!-- 时间戳转换 -->
    <template v-if="activeTool === 'timestamp'">
      <div class="tool-hint">
        当前时间戳 — 秒：<code>{{ nowTs }}</code>　毫秒：<code>{{ nowTsMs }}</code>
      </div>
      <div class="tool-row">
        <div class="tool-col">
          <label>输入（时间戳或日期字符串）</label>
          <el-input v-model="tsInput" placeholder="如 1700000000 或 2024-01-01 12:00:00" />
        </div>
        <div class="tool-col" style="flex: 0 0 180px;">
          <label>输出格式</label>
          <el-select v-model="tsFormat" size="default">
            <el-option v-for="f in tsFormats" :key="f.value" :label="f.label" :value="f.value" />
          </el-select>
        </div>
      </div>
      <div class="tool-col">
        <label>输出</label>
        <el-input v-model="tsOutput" type="textarea" :rows="4" readonly />
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="tsToDate">时间戳 → 日期</el-button>
        <el-button type="primary" @click="dateToTs">日期 → 时间戳</el-button>
        <el-button @click="tsNow">填入当前秒级</el-button>
        <el-button @click="tsNowMs">填入当前毫秒级</el-button>
        <el-button @click="copyText(tsOutput)" :disabled="!tsOutput">复制结果</el-button>
      </div>
    </template>

    <!-- UUID 生成 -->
    <template v-if="activeTool === 'uuid'">
      <div class="tool-row" style="align-items: flex-start;">
        <div class="tool-col" style="flex: 0 0 auto;">
          <label>ID 类型</label>
          <el-radio-group v-model="uuidType" size="small">
            <el-radio-button value="uuid">UUID v4</el-radio-button>
            <el-radio-button value="nanoid">NanoID</el-radio-button>
            <el-radio-button value="objectid">ObjectID</el-radio-button>
            <el-radio-button value="snowflake">Snowflake</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="uuidType === 'uuid'" class="tool-col" style="flex: 0 0 auto;">
          <label>UUID 格式</label>
          <el-radio-group v-model="uuidFormat" size="small">
            <el-radio-button value="standard">标准</el-radio-button>
            <el-radio-button value="upper">大写</el-radio-button>
            <el-radio-button value="nodash">无横线</el-radio-button>
            <el-radio-button value="braces">带括号</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="uuidType === 'nanoid'" class="tool-col" style="flex: 0 0 140px;">
          <label>长度</label>
          <el-input-number v-model="nanoidLength" :min="4" :max="64" size="small" />
        </div>
        <div class="tool-col" style="flex: 0 0 140px;">
          <label>生成数量</label>
          <el-input-number v-model="uuidCount" :min="1" :max="100" size="small" />
        </div>
      </div>
      <div v-if="uuidType === 'nanoid'" class="tool-col" style="margin-bottom: 12px;">
        <label>字符集</label>
        <el-input v-model="nanoidAlphabet" placeholder="自定义字符集" size="small" />
      </div>
      <div class="tool-col">
        <label>结果</label>
        <el-input v-model="uuidOutput" type="textarea" :rows="8" readonly />
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="generateUUID">生成</el-button>
        <el-button @click="copyText(uuidOutput)" :disabled="!uuidOutput">复制结果</el-button>
      </div>
    </template>

    <!-- 颜色转换 -->
    <template v-if="activeTool === 'color'">
      <div class="color-presets-row">
        <span v-for="p in colorPresets" :key="p.label"
          class="color-preset-swatch" :style="{ background: p.hex }"
          :title="p.label" @click="applyColorPreset(p.hex)"
        ></span>
      </div>
      <div class="color-tool-layout">
        <div class="color-inputs">
          <div class="tool-col">
            <label>HEX</label>
            <el-input v-model="colorHex" placeholder="#409EFF" @input="onColorHexInput" />
          </div>
          <div class="tool-col">
            <label>RGB (R, G, B)</label>
            <div class="color-rgb-row">
              <el-input-number v-model="colorR" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
              <el-input-number v-model="colorG" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
              <el-input-number v-model="colorB" :min="0" :max="255" controls-position="right" @change="onColorRgbInput" />
            </div>
          </div>
          <div class="tool-col">
            <label>HSL (H, S%, L%)</label>
            <div class="color-rgb-row">
              <el-input-number v-model="colorH" :min="0" :max="360" controls-position="right" @change="onColorHslInput" />
              <el-input-number v-model="colorS" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
              <el-input-number v-model="colorL" :min="0" :max="100" controls-position="right" @change="onColorHslInput" />
            </div>
          </div>
          <div class="tool-col">
            <label>Alpha (不透明度)</label>
            <el-slider v-model="colorA" :min="0" :max="100" :format-tooltip="(v: number) => v + '%'" />
          </div>
        </div>
        <div class="color-preview-area">
          <div class="color-preview" :style="{ background: colorPreview }"></div>
          <div class="color-contrast-info">
            <div>白色文字对比度: <b>{{ colorContrastWhite }}:1</b> <span :style="{ color: Number(colorContrastWhite) >= 4.5 ? '#67c23a' : '#f56c6c' }">{{ Number(colorContrastWhite) >= 4.5 ? 'AA Pass' : 'Fail' }}</span></div>
            <div>黑色文字对比度: <b>{{ colorContrastBlack }}:1</b> <span :style="{ color: Number(colorContrastBlack) >= 4.5 ? '#67c23a' : '#f56c6c' }">{{ Number(colorContrastBlack) >= 4.5 ? 'AA Pass' : 'Fail' }}</span></div>
          </div>
        </div>
      </div>
      <div class="color-palette-row">
        <label>色阶调色板</label>
        <div class="color-palette">
          <div v-for="s in colorPalette" :key="s.label"
            class="color-palette-swatch"
            :style="{ background: s.hex }"
            :title="`${s.label}: ${s.hex}`"
            @click="applyColorPreset(s.hex)"
          >
            <span class="color-palette-label">{{ s.hex }}</span>
          </div>
        </div>
      </div>
      <div class="tool-toolbar">
        <el-button @click="copyText(colorHex)">复制 HEX</el-button>
        <el-button @click="copyText(`rgb(${colorR}, ${colorG}, ${colorB})`)">复制 RGB</el-button>
        <el-button @click="copyText(`rgba(${colorR}, ${colorG}, ${colorB}, ${(colorA / 100).toFixed(2)})`)">复制 RGBA</el-button>
        <el-button @click="copyText(`hsl(${colorH}, ${colorS}%, ${colorL}%)`)">复制 HSL</el-button>
      </div>
    </template>

    <!-- 进制转换 -->
    <template v-if="activeTool === 'radix'">
      <div class="tool-row">
        <div class="tool-col">
          <label>二进制 (BIN)</label>
          <el-input v-model="radixBin" placeholder="如 11111111" @input="onRadixInput('bin')" />
        </div>
        <div class="tool-col">
          <label>八进制 (OCT)</label>
          <el-input v-model="radixOct" placeholder="如 377" @input="onRadixInput('oct')" />
        </div>
      </div>
      <div class="tool-row">
        <div class="tool-col">
          <label>十进制 (DEC)</label>
          <el-input v-model="radixDec" placeholder="如 255" @input="onRadixInput('dec')" />
        </div>
        <div class="tool-col">
          <label>十六进制 (HEX)</label>
          <el-input v-model="radixHexVal" placeholder="如 FF" @input="onRadixInput('hex')" />
        </div>
      </div>
      <div v-if="radixError" class="tool-error">{{ radixError }}</div>
    </template>

    <!-- 哈希生成 -->
    <template v-if="activeTool === 'hash'">
      <div class="tool-row">
        <div class="tool-col">
          <label>输入文本</label>
          <el-input v-model="hashInput" type="textarea" :rows="6" placeholder="输入要计算哈希的文本..." />
        </div>
        <div class="tool-col">
          <label>哈希结果</label>
          <el-input v-model="hashOutput" type="textarea" :rows="6" readonly />
        </div>
      </div>
      <div class="tool-toolbar">
        <el-select v-model="hashAlgo" style="width: 140px;">
          <el-option label="SHA-1" value="SHA-1" />
          <el-option label="SHA-256" value="SHA-256" />
          <el-option label="SHA-512" value="SHA-512" />
        </el-select>
        <el-button type="primary" @click="generateHash">生成</el-button>
        <el-button @click="copyText(hashOutput)" :disabled="!hashOutput">复制结果</el-button>
      </div>
    </template>

    <!-- 随机密码生成 -->
    <template v-if="activeTool === 'password'">
      <div class="tool-row" style="align-items: flex-start;">
        <div class="tool-col" style="flex: 0 0 220px;">
          <label>密码长度：{{ pwdLength }}</label>
          <el-slider v-model="pwdLength" :min="4" :max="64" />
        </div>
        <div class="tool-col">
          <label>字符类型</label>
          <div class="pwd-options">
            <el-checkbox v-model="pwdUppercase">大写字母 (A-Z)</el-checkbox>
            <el-checkbox v-model="pwdLowercase">小写字母 (a-z)</el-checkbox>
            <el-checkbox v-model="pwdDigits">数字 (0-9)</el-checkbox>
            <el-checkbox v-model="pwdSpecial">特殊字符 (!@#$...)</el-checkbox>
          </div>
        </div>
      </div>
      <div v-if="pwdOutput" class="tool-col" style="margin-top: 12px;">
        <label>生成结果</label>
        <el-input v-model="pwdOutput" readonly />
        <div class="pwd-strength-bar">
          <div class="pwd-strength-track">
            <div
              v-for="i in 4" :key="i"
              class="pwd-strength-segment"
              :style="{ background: i <= pwdStrength.level ? pwdStrength.color : 'var(--border-color)' }"
            ></div>
          </div>
          <span class="pwd-strength-text" :style="{ color: pwdStrength.color }">{{ pwdStrength.text }}</span>
        </div>
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="generatePassword">生成密码</el-button>
        <el-button @click="copyText(pwdOutput)" :disabled="!pwdOutput">复制密码</el-button>
      </div>
    </template>

    <!-- Mock 数据生成 -->
    <template v-if="activeTool === 'mockdata'">
      <div class="tool-row" style="align-items: flex-start;">
        <div class="tool-col" style="flex: 0 0 auto;">
          <label>生成模式</label>
          <el-radio-group v-model="mockType" size="small">
            <el-radio-button value="preset">预设类型</el-radio-button>
            <el-radio-button value="template">自定义模板</el-radio-button>
          </el-radio-group>
        </div>
        <div class="tool-col" style="flex: 0 0 140px;">
          <label>生成数量</label>
          <el-input-number v-model="mockCount" :min="1" :max="100" size="small" />
        </div>
      </div>
      <div v-if="mockType === 'preset'" class="mock-presets">
        <div v-for="[cat, presets] in mockPresetCategories" :key="cat" class="mock-preset-group">
          <label>{{ cat }}</label>
          <div class="mock-preset-list">
            <span
              v-for="p in presets" :key="p.key"
              class="regex-preset-tag"
              :class="{ 'preset-active': mockPreset === p.key }"
              @click="mockPreset = p.key"
            >{{ p.label }}</span>
          </div>
        </div>
      </div>
      <div v-else class="tool-col" style="margin-top: 12px;">
        <label>自定义 JSON 模板（使用 @type 占位符）</label>
        <el-input
          v-model="mockCustomTpl"
          type="textarea" :rows="6"
          placeholder='如 {"name": "@name", "phone": "@phone", "email": "@email", "age": "@integer"}'
        />
        <div class="tool-hint" style="margin-top: 4px;">
          支持的占位符：@name @nameEn @phone @email @idcard @address @ip @url @domain @datetime @date @time @integer @float @boolean @paragraph @sentence @word @color @image @uuid
        </div>
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="generateMockData">生成</el-button>
        <el-button @click="copyText(mockOutput)" :disabled="!mockOutput">复制结果</el-button>
      </div>
      <div v-if="mockOutput" class="tool-col" style="margin-top: 12px;">
        <label>生成结果</label>
        <div class="editor-box" style="height: 350px;">
          <CodeEditor v-model="mockOutput" language="json" :isDark="isDark" :readonly="true" />
        </div>
      </div>
    </template>

    <!-- 数字格式化 -->
    <template v-if="activeTool === 'number'">
      <div class="tool-col">
        <label>输入数字</label>
        <el-input v-model="numInput" placeholder="如 12345678.9" size="large" />
      </div>
      <div v-if="numFormats" class="num-formats">
        <div class="num-format-item" @click="copyText(numFormats.thousands)">
          <span class="num-format-label">千分位</span>
          <span class="num-format-value">{{ numFormats.thousands }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.cny)">
          <span class="num-format-label">人民币</span>
          <span class="num-format-value">{{ numFormats.cny }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.usd)">
          <span class="num-format-label">美元</span>
          <span class="num-format-value">{{ numFormats.usd }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.upperCny)">
          <span class="num-format-label">大写金额</span>
          <span class="num-format-value">{{ numFormats.upperCny }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.chineseNum)">
          <span class="num-format-label">中文数字</span>
          <span class="num-format-value">{{ numFormats.chineseNum }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.scientific)">
          <span class="num-format-label">科学计数</span>
          <span class="num-format-value">{{ numFormats.scientific }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.percent)">
          <span class="num-format-label">百分比</span>
          <span class="num-format-value">{{ numFormats.percent }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.fileSize)">
          <span class="num-format-label">文件大小</span>
          <span class="num-format-value">{{ numFormats.fileSize }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.roman)">
          <span class="num-format-label">罗马数字</span>
          <span class="num-format-value">{{ numFormats.roman }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.bin)">
          <span class="num-format-label">二进制</span>
          <span class="num-format-value mono">{{ numFormats.bin }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.oct)">
          <span class="num-format-label">八进制</span>
          <span class="num-format-value mono">{{ numFormats.oct }}</span>
        </div>
        <div class="num-format-item" @click="copyText(numFormats.hex)">
          <span class="num-format-label">十六进制</span>
          <span class="num-format-value mono">{{ numFormats.hex }}</span>
        </div>
      </div>
      <div v-if="numFormats" class="tool-hint" style="margin-top: 8px;">点击任意项可复制</div>
    </template>

    <!-- 占位图生成 -->
    <template v-if="activeTool === 'placeholder'">
      <div class="tool-row">
        <div class="tool-col" style="flex: 0 0 130px;">
          <label>宽度 (px)</label>
          <el-input-number v-model="phWidth" :min="10" :max="2000" />
        </div>
        <div class="tool-col" style="flex: 0 0 130px;">
          <label>高度 (px)</label>
          <el-input-number v-model="phHeight" :min="10" :max="2000" />
        </div>
        <div class="tool-col" style="flex: 0 0 100px;">
          <label>背景色</label>
          <el-color-picker v-model="phBgColor" />
        </div>
        <div class="tool-col" style="flex: 0 0 100px;">
          <label>文字色</label>
          <el-color-picker v-model="phTextColor" />
        </div>
        <div class="tool-col" style="flex: 0 0 130px;">
          <label>字号 (0=自动)</label>
          <el-input-number v-model="phFontSize" :min="0" :max="200" />
        </div>
        <div class="tool-col" style="flex: 0 0 auto;">
          <label>格式</label>
          <el-radio-group v-model="phFormat" size="small">
            <el-radio-button value="png">PNG</el-radio-button>
            <el-radio-button value="svg">SVG</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <div class="tool-col">
        <label>自定义文字（留空则显示尺寸）</label>
        <el-input v-model="phText" placeholder="如 Logo / Banner / 400x300" />
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="generatePlaceholder">生成</el-button>
        <el-button @click="downloadPlaceholder" :disabled="!phDataUrl">下载图片</el-button>
        <el-button @click="copyText(phDataUrl)" :disabled="!phDataUrl">复制 DataURL</el-button>
      </div>
      <div v-if="phDataUrl" class="ph-preview">
        <label>预览</label>
        <img :src="phDataUrl" alt="placeholder" />
      </div>
    </template>

    <!-- 二维码生成 -->
    <template v-if="activeTool === 'qrcode'">
      <div class="tool-col">
        <label>文本内容</label>
        <el-input v-model="qrText" type="textarea" :rows="3" placeholder="输入文本或 URL..." />
      </div>
      <div class="tool-row" style="margin-top: 12px;">
        <div class="tool-col" style="flex: 0 0 130px;">
          <label>尺寸 (px)</label>
          <el-input-number v-model="qrSize" :min="64" :max="1024" :step="64" />
        </div>
        <div class="tool-col" style="flex: 0 0 auto;">
          <label>纠错级别</label>
          <el-radio-group v-model="qrErrorLevel" size="small">
            <el-radio-button value="L">L (7%)</el-radio-button>
            <el-radio-button value="M">M (15%)</el-radio-button>
            <el-radio-button value="Q">Q (25%)</el-radio-button>
            <el-radio-button value="H">H (30%)</el-radio-button>
          </el-radio-group>
        </div>
        <div class="tool-col" style="flex: 0 0 80px;">
          <label>前景色</label>
          <el-color-picker v-model="qrFgColor" />
        </div>
        <div class="tool-col" style="flex: 0 0 80px;">
          <label>背景色</label>
          <el-color-picker v-model="qrBgColor" />
        </div>
      </div>
      <div class="tool-toolbar">
        <el-button type="primary" @click="generateQrCode">生成二维码</el-button>
        <el-button @click="downloadQrCode" :disabled="!qrDataUrl">下载 PNG</el-button>
        <el-button @click="copyText(qrDataUrl)" :disabled="!qrDataUrl">复制 DataURL</el-button>
      </div>
      <div v-if="qrDataUrl" class="ph-preview">
        <label>预览</label>
        <img :src="qrDataUrl" alt="QR Code" />
      </div>
    </template>
  </div>
</template>

<style scoped>
@import './tools-common.css';

/* ==================== 颜色转换 ==================== */

.color-tool-layout {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}
.color-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.color-rgb-row {
  display: flex;
  gap: 8px;
}
.color-rgb-row .el-input-number { flex: 1; }
.color-preview {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
  align-self: center;
}
.color-presets-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.color-preset-swatch {
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  border: 2px solid transparent; transition: all 0.2s;
}
.color-preset-swatch:hover { border-color: var(--primary-color); transform: scale(1.15); }
.color-preview-area { display: flex; flex-direction: column; align-items: center; gap: 12px; flex-shrink: 0; }
.color-contrast-info { font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px; }
.color-contrast-info b { color: var(--text-primary); }
.color-palette-row { margin-top: 12px; }
.color-palette-row > label { font-size: 12px; color: var(--text-secondary); font-weight: 500; display: block; margin-bottom: 6px; }
.color-palette { display: flex; gap: 2px; border-radius: 8px; overflow: hidden; }
.color-palette-swatch {
  flex: 1; height: 48px; display: flex; align-items: flex-end;
  justify-content: center; cursor: pointer; transition: transform 0.15s;
}
.color-palette-swatch:hover { transform: scaleY(1.15); }
.color-palette-label { font-size: 9px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5); padding-bottom: 4px; }

/* ==================== 随机密码 ==================== */

.pwd-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.pwd-strength-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.pwd-strength-track {
  display: flex;
  gap: 4px;
  flex: 1;
}

.pwd-strength-segment {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  transition: background 0.3s;
}

.pwd-strength-text {
  font-size: 12px;
  font-weight: 600;
  min-width: 32px;
}

/* ==================== Mock 数据生成 ==================== */

.mock-presets {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mock-preset-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mock-preset-group > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.mock-preset-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ==================== 占位图生成 ==================== */

.ph-preview {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ph-preview > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.ph-preview img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  object-fit: contain;
  align-self: flex-start;
}

/* ==================== 数字格式化 ==================== */

.num-formats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.num-format-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px; background: var(--bg-hover); border-radius: 8px;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.num-format-item:hover { border-color: var(--primary-color); background: var(--primary-bg); }
.num-format-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.num-format-value { font-size: 15px; font-weight: 600; color: var(--text-primary); word-break: break-all; }
.num-format-value.mono { font-family: 'Courier New', Courier, monospace; font-size: 13px; }
</style>
