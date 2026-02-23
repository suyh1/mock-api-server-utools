import type { MockService, Project } from '@/types/mock';

export interface DocOptions {
  scope: 'all' | 'project' | 'service';
  projectId?: number | null;
  serviceId?: number | null;
  projects?: Project[];
  showDisabled?: boolean;
}

/**
 * Generate Markdown documentation from MockService data
 */
export function generateMarkdownDoc(services: MockService[], options: DocOptions): string {
  let targetServices = services;

  if (options.scope === 'project' && options.projectId) {
    targetServices = services.filter(s => s.projectId === options.projectId);
  } else if (options.scope === 'service' && options.serviceId) {
    targetServices = services.filter(s => s.id === options.serviceId);
  }

  const lines: string[] = [];
  const title = options.scope === 'project'
    ? options.projects?.find(p => p.id === options.projectId)?.name || '项目'
    : options.scope === 'service'
    ? targetServices[0]?.name || '服务'
    : 'API';

  lines.push(`# ${title} 接口文档`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // TOC
  lines.push('## 目录');
  lines.push('');
  for (const service of targetServices) {
    lines.push(`- **${service.name}**${service.description ? ` - ${service.description}` : ''}`);
    for (const group of service.groups) {
      lines.push(`  - **${group.name}**${group.description ? ` - ${group.description}` : ''}`);
      for (const rule of group.children) {
        if (!options.showDisabled && !rule.active) continue;
        const name = rule.name || rule.url;
        lines.push(`    - \`${rule.method}\` ${name}`);
      }
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Detail
  for (const service of targetServices) {
    lines.push(`## ${service.name}`);
    if (service.description) lines.push(`> ${service.description}`);
    lines.push('');

    for (const group of service.groups) {
      lines.push(`### ${group.name}`);
      if (group.description) lines.push(`> ${group.description}`);
      lines.push('');

      for (const rule of group.children) {
        if (!options.showDisabled && !rule.active) continue;
        const name = rule.name || rule.url;
        lines.push(`#### ${name}`);
        lines.push('');
        lines.push(`- **方法**: \`${rule.method}\``);
        lines.push(`- **路径**: \`${rule.url}\``);
        lines.push(`- **状态**: ${rule.active ? '启用' : '禁用'}`);
        if (rule.delay) lines.push(`- **延迟**: ${rule.delay}ms`);
        lines.push('');

        // Request headers
        const reqHeaders = rule.headers?.filter(h => h.key);
        if (reqHeaders?.length) {
          lines.push('##### 请求头');
          lines.push('');
          lines.push('| Key | Value | 必填 | 说明 |');
          lines.push('|-----|-------|------|------|');
          for (const h of reqHeaders) {
            lines.push(`| ${h.key} | ${h.value || '-'} | ${h.required ? '是' : '否'} | ${h.description || '-'} |`);
          }
          lines.push('');
        }

        // Query params
        const params = rule.params?.filter(p => p.key);
        if (params?.length) {
          lines.push('##### Query 参数');
          lines.push('');
          lines.push('| 参数名 | 示例值 | 必填 | 说明 |');
          lines.push('|--------|--------|------|------|');
          for (const p of params) {
            lines.push(`| ${p.key} | ${p.value || '-'} | ${p.required ? '是' : '否'} | ${p.description || '-'} |`);
          }
          lines.push('');
        }

        // Request body
        if (rule.body && rule.body.type !== 'none') {
          lines.push('##### 请求体');
          lines.push('');
          lines.push(`类型: \`${rule.body.type}\``);
          lines.push('');
          if (rule.body.type === 'json' && rule.body.raw) {
            lines.push('```json');
            try { lines.push(JSON.stringify(JSON.parse(rule.body.raw), null, 2)); }
            catch { lines.push(rule.body.raw); }
            lines.push('```');
          } else if (rule.body.formData?.length) {
            lines.push('| Key | Value | 说明 |');
            lines.push('|-----|-------|------|');
            for (const f of rule.body.formData.filter(f => f.key)) {
              lines.push(`| ${f.key} | ${f.value || '-'} | ${f.description || '-'} |`);
            }
          }
          lines.push('');
        }

        // Response
        lines.push('##### 响应');
        lines.push('');
        if (rule.responseMode === 'basic') {
          lines.push(`Content-Type: \`${rule.responseType || 'application/json'}\``);
          lines.push('');
          if (rule.responseBasic) {
            const lang = rule.responseType?.includes('json') ? 'json' : 'text';
            lines.push(`\`\`\`${lang}`);
            if (lang === 'json') {
              try { lines.push(JSON.stringify(JSON.parse(rule.responseBasic), null, 2)); }
              catch { lines.push(rule.responseBasic); }
            } else {
              lines.push(rule.responseBasic);
            }
            lines.push('```');
          }
        } else {
          lines.push('> 高级模式（脚本生成响应）');
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Wrap markdown content into a standalone HTML document with inline styles
 */
export function generateHtmlDoc(markdown: string): string {
  // Simple markdown to HTML conversion
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API 接口文档</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.8; }
  h1 { border-bottom: 2px solid #409EFF; padding-bottom: 8px; }
  h2 { color: #409EFF; margin-top: 2em; }
  h3 { margin-top: 1.5em; }
  code { background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f7fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #409EFF; padding-left: 12px; color: #666; margin-left: 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #ebeef5; padding: 8px 12px; text-align: left; }
  hr { border: none; border-top: 1px solid #ebeef5; margin: 24px 0; }
  li { margin: 2px 0; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}
