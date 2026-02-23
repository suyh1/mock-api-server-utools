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
    delayMax?: number;             // 延迟最大值（与 delay 组成范围，未设置时为固定延迟）
    createdAt?: number;            // 创建时间
    updatedAt?: number;            // 最后更新时间

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
    responsePresets?: ResponsePreset[];
    activePresetId?: number;           // undefined = 使用默认响应
    mockjsEnabled?: boolean;         // 基础模式是否启用 Mock.js 处理
    expectations?: MockExpectation[]; // 条件响应（Mock 期望）列表
    assertions?: ResponseAssertion[]; // 响应断言列表
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
    // 代理录制配置
    proxyEnabled?: boolean;  // 是否启用代理录制
    proxyTarget?: string;    // 代理目标地址
}

export interface MockGroup {
    id: number;
    name: string;
    description?: string;   // 分组描述
    projectId?: number;     // 所属项目 ID，undefined 表示"未分类"
    children: MockRule[];
    config?: ServiceConfig; // 分组的服务配置
}

// ==================== 项目管理 ====================

/** 项目成员角色 */
export type MemberRole = 'owner' | 'admin' | 'developer' | 'viewer';

/** 项目状态 */
export type ProjectStatus = 'active' | 'archived';

/** 项目成员 */
export interface ProjectMember {
    id: number;
    name: string;
    role: MemberRole;
    joinedAt: number;
}

/** 项目 */
export interface Project {
    id: number;
    name: string;                    // 项目名称
    description?: string;            // 项目介绍
    icon?: string;                   // 项目图标（emoji）
    status: ProjectStatus;           // 项目状态
    members: ProjectMember[];        // 项目成员
    tags?: string[];                 // 项目标签
    createdAt: number;
    updatedAt: number;
}

// ==================== 环境变量 ====================

export interface EnvVariable {
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface Environment {
  id: number;
  name: string;
  color?: string;
  variables: EnvVariable[];
  createdAt: number;
  updatedAt: number;
}

// 请求日志
export interface RequestLog {
  id: number;
  timestamp: number;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  mode: 'mock' | 'real';
  ruleId?: number;
  ruleName?: string;
  groupName?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
}

// 响应预设
export interface ResponsePreset {
  id: number;
  name: string;
  statusCode: number;
  responseMode: ResponseMode;
  responseType: string;
  responseBasic: string;
  responseAdvanced: string;
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

// ==================== WebSocket Mock ====================

/** WS 消息匹配类型 */
export type WsMatchType = 'exact' | 'contains' | 'regex' | 'any';

/** WS 响应模式 */
export type WsResponseMode = 'basic' | 'advanced';

/** WS 消息匹配规则 */
export interface WsRule {
    id: number;
    name: string;
    active: boolean;
    matchType: WsMatchType;
    matchPattern: string;        // 匹配模式（any 时可为空）
    delay: number;               // 延迟回复（ms）
    responseMode: WsResponseMode;
    responseBasic: string;       // 基础模式响应内容
    responseAdvanced: string;    // 高级模式脚本
}

/** WS 服务配置 */
export interface WsServer {
    id: number;
    name: string;
    port: number;
    path: string;                // WebSocket 路径，如 /ws
    description?: string;
    rules: WsRule[];
    onConnectMessage?: string;   // 客户端连接时自动发送的欢迎消息
    createdAt: number;
    updatedAt: number;
}

/** WS 消息日志方向 */
export type WsLogDirection = 'in' | 'out' | 'system';

/** WS 消息日志条目 */
export interface WsLogEntry {
    id: number;
    serverId: number;
    timestamp: number;
    direction: WsLogDirection;
    clientId: string;
    clientIp: string;
    message: string;
    matchedRule?: string;        // 匹配的规则名称
}

/** WS 已连接客户端信息 */
export interface WsClientInfo {
    clientId: string;
    clientIp: string;
    connectedAt: number;
}

// ==================== 条件响应（Mock 期望） ====================

/** 条件来源 */
export type ConditionSource = 'query' | 'header' | 'body' | 'pathParam';

/** 条件操作符 */
export type ConditionOperator = 'equals' | 'contains' | 'regex' | 'exists' | 'gt' | 'lt';

/** 期望条件 */
export interface ExpectationCondition {
    source: ConditionSource;
    key: string;          // 参数名（body 使用 JSON path，如 data.id）
    operator: ConditionOperator;
    value: string;        // 对比值（exists 操作符时可为空）
}

/** Mock 期望（条件响应） */
export interface MockExpectation {
    id: number;
    name: string;
    conditions: ExpectationCondition[];
    statusCode: number;
    responseMode: ResponseMode;
    responseType: string;
    responseBasic: string;
    responseAdvanced: string;
}

// ==================== 响应断言 ====================

/** 断言目标 */
export type AssertionTarget = 'status' | 'body' | 'header' | 'responseTime';

/** 响应断言 */
export interface ResponseAssertion {
    id: number;
    target: AssertionTarget;
    key?: string;           // header 名或 body JSON path
    operator: ConditionOperator;
    value: string;
}

/** 断言结果 */
export interface AssertionResult {
    assertion: ResponseAssertion;
    passed: boolean;
    actual: string;
    message: string;
}

// ==================== 测试用例 ====================

/** 测试用例 */
export interface TestCase {
    id: number;
    name: string;
    ruleId: number;
    groupId: number;
    method: HttpMethod;
    url: string;
    headers?: KeyValueItem[];
    params?: KeyValueItem[];
    body?: BodyContent;
    assertions: ResponseAssertion[];
    createdAt: number;
    updatedAt: number;
}

// ==================== 测试套件 ====================

/** 测试套件 */
export interface TestSuite {
    id: number;
    name: string;
    description?: string;
    testCaseIds: number[];
    createdAt: number;
    updatedAt: number;
}

/** 单个测试用例运行结果 */
export interface TestCaseResult {
    testCaseId: number;
    testCaseName: string;
    passed: boolean;
    status: number;
    duration: number;
    assertionResults: AssertionResult[];
    error?: string;
}

/** 测试套件运行结果 */
export interface TestSuiteResult {
    suiteId: number;
    suiteName: string;
    startTime: number;
    endTime: number;
    totalDuration: number;
    totalCases: number;
    passedCases: number;
    failedCases: number;
    results: TestCaseResult[];
}