import type { MockGroup, MockRule, KeyValueItem, BodyContent } from '@/types/mock';

interface OpenApiDoc {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, OpenApiSchema> };
  definitions?: Record<string, OpenApiSchema>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: OpenApiSchema }>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: OpenApiSchema; example?: any }>;
    schema?: OpenApiSchema;
  }>;
}

interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
  type?: string;
}

interface OpenApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  $ref?: string;
  example?: any;
  enum?: any[];
  default?: any;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
}

/**
 * Parse OpenAPI/Swagger JSON text into a structured doc object
 */
export function parseOpenApiInput(text: string): OpenApiDoc {
  const doc = JSON.parse(text);
  if (!doc.paths) throw new Error('Invalid OpenAPI document: missing "paths"');
  return doc;
}

/**
 * Resolve $ref references recursively
 */
function resolveRef(ref: string, doc: OpenApiDoc): OpenApiSchema {
  // e.g. "#/components/schemas/User" or "#/definitions/User"
  const parts = ref.replace('#/', '').split('/');
  let current: any = doc;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return {};
  }
  return current as OpenApiSchema;
}

/**
 * Generate a sample value from a schema
 */
function generateExample(schema: OpenApiSchema | undefined, doc: OpenApiDoc, depth = 0): any {
  if (!schema || depth > 5) return null;

  if (schema.$ref) {
    return generateExample(resolveRef(schema.$ref, doc), doc, depth + 1);
  }

  if (schema.allOf) {
    const merged: any = {};
    for (const sub of schema.allOf) {
      const val = generateExample(sub, doc, depth + 1);
      if (val && typeof val === 'object') Object.assign(merged, val);
    }
    return merged;
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
      return 'string';
    case 'integer':
    case 'number':
      return schema.format === 'float' || schema.format === 'double' ? 1.0 : 1;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items) {
        const item = generateExample(schema.items, doc, depth + 1);
        return item !== null ? [item] : [];
      }
      return [];
    case 'object':
      if (schema.properties) {
        const obj: Record<string, any> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExample(propSchema, doc, depth + 1);
        }
        return obj;
      }
      return {};
    default:
      if (schema.properties) {
        const obj: Record<string, any> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExample(propSchema, doc, depth + 1);
        }
        return obj;
      }
      return null;
  }
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

/**
 * Convert OpenAPI doc to MockGroup[] structure
 */
export function parseOpenApiToMockGroups(doc: OpenApiDoc, projectId?: number): MockGroup[] {
  const tagGroups = new Map<string, MockRule[]>();

  for (const [path, methods] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;
      const upperMethod = method.toUpperCase();
      if (!SUPPORTED_METHODS.includes(upperMethod)) continue;

      const op = operation as OpenApiOperation;
      const tag = op.tags?.[0] || 'Default';
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);

      // Build headers
      const headers: KeyValueItem[] = [];
      const params: KeyValueItem[] = [];

      for (const param of op.parameters || []) {
        const item: KeyValueItem = {
          key: param.name,
          value: '',
          required: param.required,
          description: param.description || '',
        };
        if (param.in === 'header') headers.push(item);
        else if (param.in === 'query') params.push(item);
      }

      // Build body
      const body: BodyContent = { type: 'none', raw: '', formData: [] };
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content['application/json'];
        const formContent = op.requestBody.content['application/x-www-form-urlencoded'] || op.requestBody.content['multipart/form-data'];
        if (jsonContent?.schema) {
          body.type = 'json';
          const example = generateExample(jsonContent.schema, doc);
          body.raw = example ? JSON.stringify(example, null, 2) : '{}';
        } else if (formContent?.schema) {
          body.type = 'form-data';
          const schema = formContent.schema.$ref ? resolveRef(formContent.schema.$ref, doc) : formContent.schema;
          if (schema.properties) {
            body.formData = Object.entries(schema.properties).map(([key, prop]) => ({
              key,
              value: String(generateExample(prop, doc) || ''),
              description: '',
            }));
          }
        }
      }

      // Build response
      let responseBasic = '{}';
      let responseType = 'application/json';
      const res200 = op.responses?.['200'] || op.responses?.['201'];
      if (res200) {
        if (res200.content) {
          const jsonRes = res200.content['application/json'];
          if (jsonRes) {
            if (jsonRes.example) {
              responseBasic = JSON.stringify(jsonRes.example, null, 2);
            } else if (jsonRes.schema) {
              const example = generateExample(jsonRes.schema, doc);
              if (example !== null) responseBasic = JSON.stringify(example, null, 2);
            }
          }
        } else if (res200.schema) {
          // Swagger 2.0
          const example = generateExample(res200.schema, doc);
          if (example !== null) responseBasic = JSON.stringify(example, null, 2);
        }
      }

      const now = Date.now() + Math.random() * 1000;
      const rule: MockRule = {
        id: Math.floor(now),
        name: op.summary || `${upperMethod} ${path}`,
        active: true,
        method: upperMethod as any,
        url: path,
        delay: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        headers,
        params,
        body,
        responseHeaders: [],
        responseMode: 'basic',
        responseType,
        responseBasic,
        responseAdvanced: '',
      };

      tagGroups.get(tag)!.push(rule);
    }
  }

  const groups: MockGroup[] = [];
  for (const [tag, rules] of tagGroups) {
    groups.push({
      id: Date.now() + Math.floor(Math.random() * 10000),
      name: tag,
      projectId,
      children: rules,
    });
  }

  return groups;
}
