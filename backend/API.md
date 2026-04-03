# 海龟汤后端 HTTP API

基址（本地开发）：`http://127.0.0.1:3000`  
前端经 Vite 代理时：`/api/*` 同源转发至上述服务。

## 通用约定

### 请求追踪

- 可选请求头：`X-Request-Id`（客户端传入则沿用，否则服务端生成）。
- 所有响应带回响应头：`X-Request-Id`。

### 访问日志（服务端控制台）

每条请求在响应结束后打 **一行 JSON**（`console.log`），字段示例：

| 字段 | 含义 |
|------|------|
| `ts` | ISO 时间 |
| `requestId` | 请求 ID |
| `method` | HTTP 方法 |
| `path` | 路径（不含 query） |
| `status` | HTTP 状态码 |
| `durationMs` | 耗时（毫秒） |
| `bodyKeys` | POST 时 body 的键名（**不记录**汤底/提问原文） |
| `storyFieldKeys` | 存在 `body.story` 对象时其字段名 |

### 错误响应（HTTP 4xx/5xx，以 `/api/chat` 为代表）

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "中文可读说明"
  },
  "requestId": "uuid",
  "message": "与 error.message 相同，兼容旧客户端"
}
```

**错误码 `error.code` 枚举**

| code | 典型 HTTP | 含义 |
|------|-----------|------|
| `INVALID_JSON` | 400 | 请求体 JSON 解析失败 |
| `VALIDATION_ERROR` | 400 | 参数缺失或非法 |
| `CONFIG_ERROR` | 500 | 服务端未配置必要环境（如 API Key） |
| `AI_TIMEOUT` | 504 | 上游 AI 超时 |
| `AI_UPSTREAM` | 502 | 上游 AI 4xx/5xx 等 |
| `AI_RATE_LIMIT` | 503 | 上游限流（如 429） |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

**说明**：手动提示类接口（`/api/hint`、`/api/manual-hint`）在业务错误时仍可能返回 **HTTP 200**，体为 `{ code: number, msg: string, requestId?: string }`，与联调前端逻辑一致；其中的 `code` 为业务码（200 成功，500 失败），勿与 HTTP 状态混淆。

---

## GET `/api/test`

健康探测。

**响应 200**

```json
{
  "message": "API is working",
  "status": "ok",
  "timestamp": "2026-03-30T12:00:00.000Z"
}
```

---

## GET `/api/capabilities`

列出当前服务暴露的接口路径（便于自检是否为本仓库 backend）。

**响应 200**

```json
{
  "ok": true,
  "post": ["/api/chat", "/api/manual-hint", "/api/hint"],
  "get": ["/api/test", "/api/capabilities"]
}
```

---

## POST `/api/chat`

海龟汤 **判题**（是/否/无关），可选阶段提示。

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | string | 与 `message` 二选一 | 玩家提问 |
| `message` | string | 与 `question` 二选一 | 兼容字段，同 `question` |
| `story` | object | 是 | `title`、`surface`、`bottom` 均为字符串 |
| `questionIndex` | number | 否 | 正整数；为 6 / 10 / 15 时可附带阶段提示（与前端回合逻辑配合） |

### 成功响应 200

```json
{
  "answer": "是",
  "proximityFeedback": ""
}
```

可选字段（阶段提示）：

```json
{
  "answer": "否",
  "proximityFeedback": "你已经接近真相了",
  "stageHint": "……",
  "stageTier": 6
}
```

- `answer`：`是` | `否` | `无关`
- `proximityFeedback`：仅允许约定枚举或空串（实现以服务端为准）

### 错误响应

见上文「错误响应」；常见：`VALIDATION_ERROR`、`CONFIG_ERROR`、`AI_TIMEOUT`、`AI_UPSTREAM`。

---

## POST `/api/manual-hint` 与 POST `/api/hint`

两者逻辑相同；`/api/hint` 为别名。

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `story` | object | 是 | `title`、`surface`、`bottom` |
| `questionCount` | number | 是 | 正整数；服务端映射档位：`<=6` → tier 6，`<=10` → 10，否则 15 |

### 成功响应 200

```json
{
  "code": 200,
  "hint": "提示正文",
  "tier": 6,
  "requestId": "uuid"
}
```

### 业务失败 200（HTTP 仍为 200）

```json
{
  "code": 500,
  "msg": "错误说明",
  "requestId": "uuid"
}
```

---

## 环境与配置

| 变量 | 说明 |
|------|------|
| `PORT` | 监听端口，默认 `3000` |
| `DEEPSEEK_API_KEY` | 判题与提示生成 |
| `DEEPSEEK_API_BASE_URL` | 可选，默认 `https://api.deepseek.com`，需能拼出 OpenAI 兼容路径 `/v1/chat/completions` |

**安全**：请勿在日志中打印 Key 或完整汤底；当前访问日志仅记录 body 键名。

---

## 请求体大小

JSON body 默认上限 **512KB**。
