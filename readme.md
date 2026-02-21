# Mock API Server — uTools 插件

一款集 Mock 服务、接口管理与开发工具于一体的 uTools 插件。支持多分组管理、自定义响应数据、真实接口代理调试、数据模板复用、场景切换、请求日志，以及 30+ 实用开发工具。

---

## 目录

- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [安装与使用](#安装与使用)
- [核心模块](#核心模块)
  - [项目管理](#项目管理)
  - [接口管理](#接口管理)
  - [数据模板](#数据模板)
  - [开发工具](#开发工具)
  - [请求日志](#请求日志)
  - [场景管理](#场景管理)
  - [全局设置](#全局设置)
- [开发指南](#开发指南)
- [许可证](#许可证)

---

## 功能概览

| 模块 | 说明 |
|------|------|
| 项目管理 | 创建/编辑/归档项目，成员角色管理，项目级接口统计 |
| 接口管理 | 分组管理、接口 CRUD、Mock 服务启停、真实接口代理、接口调试 |
| 数据模板 | 可复用的响应模板，支持基础模式和高级 JS 脚本模式 |
| 开发工具 | 30+ 工具：格式化、编码转换、数据生成、文本处理、网络工具、速查表 |
| 请求日志 | 自动记录所有 Mock/真实请求，支持按方法、状态码、URL 过滤 |
| 场景管理 | 快速切换接口响应预设（成功、空数据、参数错误、未授权、服务端错误等） |
| 全局设置 | 编辑器配置、默认参数、深色模式、数据导入/导出、缓存清理 |

---

## 技术栈

**前端：** Vue 3 + TypeScript + Element Plus + CodeMirror 6 + Less

**后端（preload）：** Express 5 + MockJS + Node.js (fs/path/net/vm)

**构建工具：** Vite 6

---

## 安装与使用

### 直接安装（推荐）

前往 [Releases](../../releases) 页面下载最新的 `.upxs` 插件包，选中该文件后唤出 uTools 超级面板，点击「安装当前插件」即可导入。**完全离线可用，无需任何额外依赖。**

### 从源码构建

```bash
# 克隆仓库
git clone <repository-url>
cd mock-api-server-utools

# 安装前端依赖
npm install

# 安装后端依赖
cd public/preload
npm install
cd ../..

# 构建插件
npm run build
```

### 在 uTools 中加载

1. 打开 uTools → 进入插件开发模式
2. 选择构建后的 `dist` 目录（或开发模式下选择项目根目录下的 `public/plugin.json`）
3. 在 uTools 搜索栏输入 `api`、`mock` 或 `接口管理` 启动插件

### 开发模式

```bash
npm run dev
```

启动后在 uTools 中加载 `public/plugin.json`，开发服务器运行在 `http://localhost:5173`。

---

## 核心模块

### 项目管理

管理多个项目，将接口分组归属到不同项目下。

**操作步骤：**

1. 点击左侧活动栏的「项目」图标进入项目面板
2. 点击「新建项目」，填写项目名称、描述、图标（Emoji）、标签
3. 项目创建后可查看关联的分组数量和接口数量
4. 支持编辑项目信息、归档/取消归档、删除项目
5. 成员管理：可添加成员并设置角色（拥有者/管理员/开发者/查看者）

### 接口管理

插件的核心模块，包含分组管理、接口配置、Mock 服务和接口调试。

#### 分组与接口

1. 左侧边栏展示接口分组树，支持按项目筛选
2. 点击「新建分组」创建接口分组，填写名称和描述，可关联项目
3. 在分组内点击「新建接口」创建 API 规则
4. 接口支持搜索、复制、移动到其他分组、拖拽排序

#### 接口配置

每条接口规则包含三个标签页：

- **请求配置：** HTTP 方法（GET/POST/PUT/DELETE）、URL 路径、请求头、Query 参数、请求体
- **响应配置：** 两种模式
  - *基础模式* — 直接编写 JSON/文本响应内容
  - *高级模式* — 编写 JS 函数，可使用 `Mock` 对象生成动态数据，接收 `req` 参数
- **调试面板：** 发送请求并查看响应结果、状态码、耗时、响应头

#### Mock 服务

1. 选择一个分组，在右侧面板点击「服务配置」
2. 设置端口号和 URL 前缀（如 `/api`）
3. 点击「启动服务」，Mock 服务开始监听
4. 使用 `http://<本机IP>:<端口><前缀><接口路径>` 访问 Mock 接口

#### 真实接口代理

1. 在服务配置中填写真实后端地址（协议、主机、端口、前缀）
2. 调试面板中切换到「真实模式」即可向真实后端发送请求
3. 支持对比 Mock 响应与真实响应

### 数据模板

创建可复用的响应数据模板，在多个接口间共享。

**操作步骤：**

1. 点击活动栏的「模板」图标进入模板管理
2. 点击「新建模板」，填写名称并编写模板内容
3. 支持基础模式（JSON/文本）和高级模式（JS 脚本）
4. 在接口的响应配置中可引用已创建的模板

### 开发工具

内置 30+ 实用开发工具，分为以下类别：

#### 格式化（Format）
- **JSON 工具** — 格式化/压缩/校验/统计/CSV 转换
- **JSON → TypeScript** — JSON 转 TypeScript 接口定义
- **JSONPath** — JSONPath 表达式查询
- **JSON Diff** — 深度结构对比

#### 编码转换（Encode）
- **URL** — 编码/解码/参数解析
- **Base64** — 编码/解码/图片转 DataURL
- **HTML 实体** — 编码/解码
- **AES 加密** — AES-CBC / AES-GCM 加解密
- **Unicode** — 字符查看与转换

#### 数据工具（Data）
- **时间戳** — 时间戳与日期互转，支持多种格式和时区
- **UUID** — UUID v4 / NanoID / 自定义格式批量生成
- **Mock 数据** — 可视化生成姓名、地址、手机号等模拟数据
- **颜色工具** — HEX/RGB/HSL/RGBA 转换、调色板、对比度检测
- **数字格式化** — 千分位、大写金额、文件大小、科学计数法
- **进制转换** — 二进制/八进制/十进制/十六进制互转
- **哈希生成** — SHA-1 / SHA-256 / SHA-512
- **随机密码** — 可配置长度和字符类型
- **占位图** — 自定义尺寸和颜色的占位图生成
- **二维码** — 文本转二维码生成

#### 文本工具（Text）
- **文本转换** — 命名风格转换（camelCase/snake_case 等）、大小写、排序、去重、加前后缀
- **正则测试** — 正则匹配/替换、高亮显示、内置常用预设
- **文本 Diff** — 基于 LCS 的逐行对比
- **Markdown** — 实时预览 + 表格生成器
- **文本统计** — 字符数、词数、行数、段落数、阅读时间

#### 网络工具（Network）
- **cURL 解析** — cURL 命令解析与多语言代码生成
- **HTTP 状态码** — 状态码速查与说明
- **JWT 解码** — Header + Payload 解码查看

#### 速查工具（Reference）
- **ASCII 码表** — 可搜索的 ASCII 字符表
- **Cron 表达式** — 解析为中文描述并预测执行时间
- **CSS 单位转换** — px/rem/em/vw/vh/pt 互转

### 请求日志

自动记录所有经过 Mock 服务和真实代理的请求。

**操作步骤：**

1. 点击活动栏的「日志」图标进入日志面板
2. 日志列表显示时间戳、方法、URL、状态码、耗时、模式（Mock/真实）
3. 使用顶部筛选条件过滤日志：按方法、状态码范围、URL 关键字
4. 点击日志条目展开查看详情：请求头、请求体、响应头、响应体
5. 支持一键清空全部日志（最多保留 200 条记录）

### 场景管理

为每个接口配置多套响应预设，快速切换接口行为。

**操作步骤：**

1. 点击活动栏的「场景」图标进入场景面板
2. 内置快捷预设：成功（200）、空数据、参数错误（400）、未授权（401）、服务端错误（500）
3. 可为每个接口创建自定义响应预设
4. 点击预设即可切换该接口的当前响应
5. 支持批量重置所有接口到默认响应

### 全局设置

**操作步骤：**

1. 点击活动栏底部的齿轮图标进入设置
2. **编辑器配置：** 设置代码编辑器字体大小和缩进宽度
3. **默认配置：** 设置默认端口号、URL 前缀、HTTP 方法、响应延迟
4. **深色模式：** 点击顶部标题栏的主题切换按钮
5. **导入/导出：** 将数据导出为 JSON 文件（支持全量/按项目/按分组导出），导入时支持覆盖或追加模式
6. **缓存管理：** 清除接口调试的缓存结果

---

## 开发指南

### 项目结构

```
src/
├── main.ts                   # 应用入口
├── App.vue                   # 根路由组件
├── ApiManager/
│   ├── index.vue             # 主布局（活动栏 + 顶栏 + 内容区）
│   └── components/
│       ├── ActivityBar.vue   # 左侧导航栏
│       ├── ApiHeader.vue     # 顶部标题栏
│       ├── CodeEditor.vue    # CodeMirror 编辑器封装
│       ├── Api/              # 接口管理相关组件
│       ├── Template/         # 数据模板组件
│       ├── Tools/            # 开发工具组件
│       ├── Project/          # 项目管理组件
│       ├── Log/              # 请求日志组件
│       ├── Scenario/         # 场景管理组件
│       └── Settings/         # 全局设置组件
├── composables/              # Vue 组合式函数
└── types/                    # TypeScript 类型定义

public/
├── plugin.json               # uTools 插件配置
├── logo.png                  # 插件图标
└── preload/
    └── services.js           # 后端服务（Express + Mock 服务 + 数据持久化）
```

### 数据持久化

- **uTools DB：** 分组、接口规则、项目、模板（key: `mock_rules_v1`）
- **localStorage：** 主题偏好、全局设置、调试缓存、请求日志、当前项目

---

## 许可证

[GNU General Public License v3.0](LICENSE)

---
---

# Mock API Server — uTools Plugin

[English]

A comprehensive uTools plugin that integrates Mock API services, API management, and developer tools. Features include multi-group management, custom response data, real API proxy debugging, reusable data templates, scenario switching, request logging, and 30+ built-in developer utilities.

---

## Table of Contents

- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Installation & Usage](#installation--usage)
- [Core Modules](#core-modules)
  - [Project Management](#project-management)
  - [API Management](#api-management)
  - [Data Templates](#data-templates)
  - [Developer Tools](#developer-tools)
  - [Request Logs](#request-logs)
  - [Scenario Management](#scenario-management)
  - [Global Settings](#global-settings)
- [Development Guide](#development-guide)
- [License](#license)

---

## Feature Overview

| Module | Description |
|--------|-------------|
| Project Management | Create/edit/archive projects, member roles, project-level API stats |
| API Management | Group management, API CRUD, Mock service start/stop, real API proxy, API debugging |
| Data Templates | Reusable response templates with basic mode and advanced JS script mode |
| Developer Tools | 30+ tools: formatting, encoding, data generation, text processing, network tools, reference sheets |
| Request Logs | Auto-capture all Mock/real requests, filter by method, status code, and URL |
| Scenario Management | Quickly switch API response presets (success, empty, parameter error, unauthorized, server error, etc.) |
| Global Settings | Editor config, default parameters, dark mode, data import/export, cache management |

---

## Tech Stack

**Frontend:** Vue 3 + TypeScript + Element Plus + CodeMirror 6 + Less

**Backend (preload):** Express 5 + MockJS + Node.js (fs/path/net/vm)

**Build Tool:** Vite 6

---

## Installation & Usage

### Direct Install (Recommended)

Go to the [Releases](../../releases) page and download the latest `.upxs` plugin package. Select the file, invoke the uTools Super Panel, and click "Install Current Plugin" to import. **Fully offline, no additional dependencies required.**

### Build from Source

```bash
# Clone the repository
git clone <repository-url>
cd mock-api-server-utools

# Install frontend dependencies
npm install

# Install backend dependencies
cd public/preload
npm install
cd ../..

# Build the plugin
npm run build
```

### Load in uTools

1. Open uTools → Enter plugin development mode
2. Select the built `dist` directory (or `public/plugin.json` in the project root for development mode)
3. Type `api`, `mock`, or `接口管理` in the uTools search bar to launch the plugin

### Development Mode

```bash
npm run dev
```

After starting, load `public/plugin.json` in uTools. The dev server runs at `http://localhost:5173`.

---

## Core Modules

### Project Management

Manage multiple projects and organize API groups under different projects.

**Steps:**

1. Click the "Project" icon in the left activity bar
2. Click "New Project", fill in the name, description, icon (emoji), and tags
3. After creation, view the number of associated groups and APIs
4. Edit project info, archive/unarchive, or delete projects
5. Member management: add members with roles (Owner / Admin / Developer / Viewer)

### API Management

The core module of the plugin, including group management, API configuration, Mock service, and API debugging.

#### Groups & APIs

1. The left sidebar displays the API group tree, filterable by project
2. Click "New Group" to create a group with a name, description, and optional project association
3. Click "New API" within a group to create an API rule
4. APIs support searching, copying, moving between groups, and drag-to-reorder

#### API Configuration

Each API rule has three tabs:

- **Request Config:** HTTP method (GET/POST/PUT/DELETE), URL path, headers, query parameters, body
- **Response Config:** Two modes
  - *Basic Mode* — Write JSON/text response content directly
  - *Advanced Mode* — Write a JS function with access to the `Mock` object for dynamic data and the `req` parameter for request info
- **Debug Panel:** Send requests and view response results, status codes, timing, and response headers

#### Mock Service

1. Select a group, then click "Service Config" in the right panel
2. Set the port number and URL prefix (e.g., `/api`)
3. Click "Start Service" to begin listening
4. Access Mock APIs at `http://<local-IP>:<port><prefix><api-path>`

#### Real API Proxy

1. In service config, fill in the real backend address (protocol, host, port, prefix)
2. Switch to "Real Mode" in the debug panel to send requests to the real backend
3. Compare Mock responses with real responses side by side

### Data Templates

Create reusable response data templates shared across multiple APIs.

**Steps:**

1. Click the "Template" icon in the activity bar
2. Click "New Template", provide a name and write the template content
3. Supports basic mode (JSON/text) and advanced mode (JS script)
4. Reference created templates in any API's response configuration

### Developer Tools

30+ built-in developer tools organized into the following categories:

#### Format
- **JSON Tools** — Format / compress / validate / stats / CSV conversion
- **JSON → TypeScript** — Convert JSON to TypeScript interface definitions
- **JSONPath** — JSONPath expression queries
- **JSON Diff** — Deep structural comparison

#### Encode
- **URL** — Encode / decode / parameter parsing
- **Base64** — Encode / decode / image to DataURL
- **HTML Entities** — Encode / decode
- **AES Encryption** — AES-CBC / AES-GCM encrypt & decrypt
- **Unicode** — Character inspection and transformation

#### Data
- **Timestamp** — Timestamp ↔ date conversion with multiple formats and timezones
- **UUID** — UUID v4 / NanoID / custom format batch generation
- **Mock Data** — Visual mock data generator (names, addresses, phone numbers, etc.)
- **Color Tools** — HEX/RGB/HSL/RGBA conversion, palette, contrast checker
- **Number Formatting** — Thousands separator, uppercase currency, file size, scientific notation
- **Radix Conversion** — Binary / octal / decimal / hexadecimal conversion
- **Hash Generation** — SHA-1 / SHA-256 / SHA-512
- **Random Password** — Configurable length and character types
- **Placeholder Image** — Generate placeholder images with custom size and color
- **QR Code** — Generate QR codes from text

#### Text
- **Text Transform** — Naming convention conversion (camelCase/snake_case, etc.), case change, sorting, deduplication, prefix/suffix
- **Regex Tester** — Match / replace with highlighting and built-in presets
- **Text Diff** — LCS-based line-by-line comparison
- **Markdown** — Live preview + table generator
- **Text Statistics** — Character count, word count, line count, paragraph count, reading time

#### Network
- **cURL Parser** — Parse cURL commands and generate multi-language code
- **HTTP Status Codes** — Status code reference with descriptions
- **JWT Decoder** — Decode and inspect Header + Payload

#### Reference
- **ASCII Table** — Searchable ASCII character table
- **Cron Expression** — Parse to human-readable description and predict execution times
- **CSS Unit Converter** — px / rem / em / vw / vh / pt conversion

### Request Logs

Automatically captures all requests passing through Mock services and real proxies.

**Steps:**

1. Click the "Log" icon in the activity bar
2. The log list shows timestamp, method, URL, status code, duration, and mode (Mock/Real)
3. Use the top filters to narrow results by method, status code range, or URL keyword
4. Click a log entry to expand details: request headers, request body, response headers, response body
5. Clear all logs with one click (up to 200 entries retained)

### Scenario Management

Configure multiple response presets per API for quick behavior switching.

**Steps:**

1. Click the "Scenario" icon in the activity bar
2. Built-in quick presets: Success (200), Empty Data, Parameter Error (400), Unauthorized (401), Server Error (500)
3. Create custom response presets for each API
4. Click a preset to switch the API's current response
5. Batch reset all APIs to their default responses

### Global Settings

**Steps:**

1. Click the gear icon at the bottom of the activity bar
2. **Editor Config:** Set code editor font size and tab width
3. **Default Config:** Set default port, URL prefix, HTTP method, and response delay
4. **Dark Mode:** Toggle via the theme switch button in the top header bar
5. **Import/Export:** Export data as JSON (full export, by project, or by group); import supports overwrite or append mode
6. **Cache Management:** Clear API debug result cache

---

## Development Guide

### Project Structure

```
src/
├── main.ts                   # App entry point
├── App.vue                   # Root router component
├── ApiManager/
│   ├── index.vue             # Main layout (activity bar + header + content)
│   └── components/
│       ├── ActivityBar.vue   # Left navigation bar
│       ├── ApiHeader.vue     # Top header bar
│       ├── CodeEditor.vue    # CodeMirror editor wrapper
│       ├── Api/              # API management components
│       ├── Template/         # Data template components
│       ├── Tools/            # Developer tools components
│       ├── Project/          # Project management components
│       ├── Log/              # Request log components
│       ├── Scenario/         # Scenario management components
│       └── Settings/         # Global settings components
├── composables/              # Vue composables
└── types/                    # TypeScript type definitions

public/
├── plugin.json               # uTools plugin configuration
├── logo.png                  # Plugin icon
└── preload/
    └── services.js           # Backend service (Express + Mock server + data persistence)
```

### Data Persistence

- **uTools DB:** Groups, API rules, projects, templates (key: `mock_rules_v1`)
- **localStorage:** Theme preference, global settings, debug cache, request logs, current project

---

## License

[GNU General Public License v3.0](LICENSE)
