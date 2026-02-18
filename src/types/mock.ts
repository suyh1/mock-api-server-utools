export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'json' | 'text' | 'xml';
export type ResponseMode = 'basic' | 'advanced'; // 新增响应模式

export interface KeyValueItem {
    key: string;
    value: string;
    required?: boolean; // 是否必填
    description?: string;
}

export interface BodyContent {
    type: BodyType;
    raw: string; // 用于 json, text, xml
    formData: KeyValueItem[]; // 用于 form-data, x-www-form-urlencoded
}

// 真实接口地址配置（接口级别覆盖）
export interface RealUrlConfig {
    protocol?: string;  // http | https
    host?: string;      // IP 或域名
    port?: string;      // 端口
    prefix?: string;    // 接口前缀
    path?: string;      // 前缀后的路径
}

export interface MockRule {
    id: number;
    name?: string;                 // 接口名称（可选，用于在侧边栏显示更友好的标识）
    active: boolean;
    method: HttpMethod;
    url: string;
    realUrl?: string;              // 兼容旧数据（废弃，改用 realConfig）
    realConfig?: RealUrlConfig;    // 接口级别的真实地址覆盖配置
    delay: number;

    // --- 新增字段 ---
    headers: KeyValueItem[];       // 请求头校验
    params: KeyValueItem[];        // Query 参数校验
    body: BodyContent;             // 请求体定义
    responseHeaders: KeyValueItem[]; // 自定义响应头

    // --- 响应配置升级 ---
    responseMode: ResponseMode;      // 模式：基础 | 高级
    responseType: string;            // Content-Type (基础模式用)
    responseBasic: string;           // 基础模式内容 (原 response)
    responseAdvanced: string;        // 高级模式脚本
    responseFile?: string;           // 二进制类型的本地文件路径
}

export interface ServiceConfig {
    port: number;
    prefix: string;
    running: boolean; // 前端状态，需与后端同步
    // 真实接口地址配置（分组级别）
    realProtocol?: string;  // http | https
    realHost?: string;      // IP 或域名
    realPort?: string;      // 端口
    realPrefix?: string;    // 接口前缀
}

export interface MockGroup {
    id: number;
    name: string;
    children: MockRule[];
    config?: ServiceConfig; // 分组的服务配置
}

// 测试结果中的文件信息（用于二进制响应下载）
export interface TestResultFile {
    filename: string;
    size: number;
    contentType: string;
    blobUrl: string;
}

// 测试结果元信息
export interface TestResultMeta {
    mode: 'mock' | 'real';
    method: string;
    url: string;
    status: number;
    statusText: string;
    time: number;
    headers: Record<string, string>;
}

// 【新增】模板数据结构
export interface MockTemplate {
    id: number;
    name: string;
    mode: ResponseMode;      // 模板类型：基础 or 高级
    contentType?: string;    // 仅基础模式需要 (Content-Type)
    content: string;         // 模板内容 (代码字符串)
    createdAt: number;
}