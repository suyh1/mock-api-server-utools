// src/types/index.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface MockRule {
    id: number;
    active: boolean;
    method: HttpMethod;
    url: string;
    response: string; // json字符串
    delay: number;
}

export interface MockGroup {
    id: number;
    name: string;
    expand?: boolean; // 前端 UI 状态，可选
    children: MockRule[];
}