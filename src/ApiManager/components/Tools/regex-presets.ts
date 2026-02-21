export interface RegexPresetItem {
  label: string;
  pattern: string;
  flags: string;
  desc: string;
  example: string;
}

export interface RegexPresetCategory {
  category: string;
  presets: RegexPresetItem[];
}

export const builtinRegexPresets: RegexPresetCategory[] = [
  {
    category: '数据校验',
    presets: [
      { label: '手机号', pattern: '1[3-9]\\d{9}', flags: 'g', desc: '中国大陆 11 位手机号', example: '13812345678' },
      { label: '固定电话', pattern: '0\\d{2,3}-?\\d{7,8}', flags: 'g', desc: '区号+号码，横线可选', example: '010-12345678' },
      { label: '邮箱', pattern: '[\\w.-]+@[\\w-]+(\\.[\\w-]+)+', flags: 'gi', desc: 'Email 地址', example: 'user@example.com' },
      { label: 'URL', pattern: 'https?://[^\\s"\'<>]+', flags: 'gi', desc: 'HTTP/HTTPS 链接', example: 'https://example.com/path?q=1' },
      { label: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', desc: 'IPv4 地址', example: '192.168.1.1' },
      { label: 'IPv6', pattern: '([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}', flags: 'g', desc: 'IPv6 完整地址', example: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' },
      { label: '身份证号', pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]', flags: 'g', desc: '18 位二代身份证号', example: '110101199003076515' },
      { label: '银行卡号', pattern: '\\b[1-9]\\d{15,18}\\b', flags: 'g', desc: '16-19 位银行卡号', example: '6222021234567890123' },
      { label: '车牌号', pattern: '[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9挂学警港澳]', flags: 'g', desc: '中国大陆车牌号', example: '京A12345' },
      { label: '邮政编码', pattern: '[1-9]\\d{5}', flags: 'g', desc: '6 位邮政编码', example: '100000' },
    ],
  },
  {
    category: '数字格式',
    presets: [
      { label: '整数', pattern: '-?\\d+', flags: 'g', desc: '正负整数', example: '42 和 -7 都是整数' },
      { label: '正整数', pattern: '[1-9]\\d*', flags: 'g', desc: '大于 0 的整数', example: '123' },
      { label: '浮点数', pattern: '-?\\d+\\.\\d+', flags: 'g', desc: '含小数点的数字', example: '3.14 和 -0.5' },
      { label: '金额', pattern: '\\d+(\\.\\d{1,2})?', flags: 'g', desc: '最多两位小数的金额', example: '99.99' },
      { label: '百分比', pattern: '\\d+(\\.\\d+)?%', flags: 'g', desc: '百分比数值', example: '85.5%' },
      { label: '科学计数法', pattern: '-?\\d+(\\.\\d+)?[eE][+-]?\\d+', flags: 'g', desc: '科学计数法表示', example: '1.23e10' },
    ],
  },
  {
    category: '日期时间',
    presets: [
      { label: 'YYYY-MM-DD', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', desc: 'ISO 日期格式', example: '2024-03-15' },
      { label: 'DD/MM/YYYY', pattern: '(?:0[1-9]|[12]\\d|3[01])/(?:0[1-9]|1[0-2])/\\d{4}', flags: 'g', desc: '日/月/年格式', example: '15/03/2024' },
      { label: 'YYYY/MM/DD', pattern: '\\d{4}/(?:0[1-9]|1[0-2])/(?:0[1-9]|[12]\\d|3[01])', flags: 'g', desc: '年/月/日格式', example: '2024/03/15' },
      { label: 'HH:mm:ss', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d', flags: 'g', desc: '24 小时制时间', example: '14:30:00' },
      { label: 'ISO 8601', pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?', flags: 'g', desc: 'ISO 8601 日期时间', example: '2024-03-15T14:30:00.000Z' },
      { label: '时间戳', pattern: '\\b\\d{10}(?:\\d{3})?\\b', flags: 'g', desc: '10 位秒 / 13 位毫秒时间戳', example: '1710489000' },
    ],
  },
  {
    category: '前端开发',
    presets: [
      { label: 'HTML 标签', pattern: '<[^>]+>', flags: 'g', desc: '匹配 HTML/XML 标签', example: '<div class="foo">内容</div>' },
      { label: 'HTML 注释', pattern: '<!--[\\s\\S]*?-->', flags: 'g', desc: 'HTML 注释块', example: '<!-- 这是注释 -->' },
      { label: '十六进制颜色', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'gi', desc: '3/6 位十六进制颜色', example: '#ff6600 或 #f60' },
      { label: 'RGB 颜色', pattern: 'rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*(?:,\\s*[\\d.]+\\s*)?\\)', flags: 'gi', desc: 'RGB/RGBA 颜色函数', example: 'rgba(255, 128, 0, 0.5)' },
      { label: 'import 语句', pattern: 'import\\s+.*?\\s+from\\s+[\\x27"][^\\x27"]+[\\x27"]', flags: 'gm', desc: 'ES Module import 声明', example: 'import { ref } from \'vue\'' },
      { label: 'CSS 尺寸值', pattern: '-?\\d+(\\.\\d+)?(px|em|rem|vw|vh|%)', flags: 'gi', desc: '带单位的 CSS 数值', example: '16px 2rem 100%' },
      { label: '图片链接', pattern: 'https?://[^\\s"\']+\\.(?:png|jpe?g|gif|svg|webp|ico)\\b', flags: 'gi', desc: '常见图片格式 URL', example: 'https://example.com/logo.png' },
    ],
  },
  {
    category: '后端开发',
    presets: [
      { label: '文件路径', pattern: '(?:/[\\w.-]+)+/?', flags: 'g', desc: 'Unix 风格文件路径', example: '/usr/local/bin/node' },
      { label: 'SemVer 版本号', pattern: '\\bv?\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?\\b', flags: 'g', desc: '语义化版本号', example: 'v2.1.0-beta.1' },
      { label: '环境变量', pattern: '\\$\\{?\\w+\\}?', flags: 'g', desc: 'Shell / 模板变量引用', example: '${NODE_ENV} 或 $HOME' },
      { label: '日志级别', pattern: '\\b(?:DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\\b', flags: 'gi', desc: '常见日志级别关键字', example: '[ERROR] Something failed' },
      { label: 'Cron 表达式', pattern: '(?:[\\d*,/-]+\\s+){4,5}[\\d*,/-]+', flags: 'g', desc: '5/6 段 Cron 定时表达式', example: '*/5 * * * *' },
      { label: 'Docker 镜像', pattern: '[\\w.-]+(?:/[\\w.-]+)*:[\\w.-]+', flags: 'g', desc: '镜像名:标签 格式', example: 'nginx:1.25-alpine' },
    ],
  },
  {
    category: '文本处理',
    presets: [
      { label: '中文字符', pattern: '[\\u4e00-\\u9fff]+', flags: 'g', desc: '连续中文汉字', example: '你好世界 Hello' },
      { label: '空行', pattern: '^\\s*$', flags: 'gm', desc: '仅含空白字符的行', example: '(空行)' },
      { label: '变量名', pattern: '[a-zA-Z_$][\\w$]*', flags: 'g', desc: '合法的 JS/TS 标识符', example: 'myVar_1 或 $el' },
      { label: '双引号字符串', pattern: '"[^"]*"', flags: 'g', desc: '双引号括起的内容', example: '"hello world"' },
      { label: '单引号字符串', pattern: "'[^']*'", flags: 'g', desc: '单引号括起的内容', example: "'hello'" },
      { label: 'Markdown 链接', pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)', flags: 'g', desc: '[text](url) 格式链接', example: '[Google](https://google.com)' },
      { label: '连续空格', pattern: ' {2,}', flags: 'g', desc: '两个及以上连续空格', example: 'a   b  c' },
    ],
  },
  {
    category: '安全相关',
    presets: [
      { label: '强密码', pattern: '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z0-9]).{8,}', flags: 'g', desc: '8+ 位含大小写+数字+特殊字符', example: 'P@ssw0rd!' },
      { label: 'JWT Token', pattern: 'eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+', flags: 'g', desc: 'JSON Web Token 格式', example: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.rg2e...' },
      { label: 'Base64', pattern: '[A-Za-z0-9+/]{4,}={0,2}', flags: 'g', desc: 'Base64 编码字符串', example: 'SGVsbG8gV29ybGQ=' },
      { label: 'MD5 哈希', pattern: '\\b[a-fA-F0-9]{32}\\b', flags: 'g', desc: '32 位十六进制 MD5 值', example: 'd41d8cd98f00b204e9800998ecf8427e' },
      { label: 'SHA256 哈希', pattern: '\\b[a-fA-F0-9]{64}\\b', flags: 'g', desc: '64 位十六进制 SHA-256 值', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4...' },
    ],
  },
];
