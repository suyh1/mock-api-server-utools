export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'json' | 'text' | 'xml';

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


export interface MockRule {
    id: number;
    active: boolean;
    method: HttpMethod;
    url: string;
    delay: number;

    // --- 新增字段 ---
    headers: KeyValueItem[];       // 请求头校验
    params: KeyValueItem[];        // Query 参数校验
    body: BodyContent;             // 请求体定义
    responseHeaders: KeyValueItem[]; // 自定义响应头
    response: string; // 响应体
}

export interface ServiceConfig {
    port: number;
    prefix: string;
    running: boolean; // 前端状态，需与后端同步
}

export interface MockGroup {
    id: number;
    name: string;
    children: MockRule[];
    config?: ServiceConfig; // 分组的服务配置
}