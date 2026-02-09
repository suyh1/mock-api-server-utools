export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface MockRule {
    id: number;
    active: boolean;
    method: HttpMethod;
    url: string;
    response: string;
    delay: number;
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