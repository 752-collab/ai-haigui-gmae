# 部署前检查清单（DEPLOY_CHECKLIST）

本文档汇总本仓库前端构建产物位置、后端启动方式，以及代码中实际读取的环境变量，便于在部署平台填写配置。

---

## 1. 前端构建

### 产物目录

- **目录**：`web/dist/`  
- 构建成功后应包含 `index.html` 与 `assets/` 下的静态资源。

### 在终端执行构建

在项目根目录打开终端，任选其一：

```bash
cd web
npm install
npm run build
```

或（若已在根目录且仅执行构建）：

```bash
npm --prefix web install
npm --prefix web run build
```

### 说明

- 所有以 `VITE_` 开头的变量会在 **`npm run build` 时写入前端包**，部署静态托管后一般**不能**仅靠平台「运行时环境变量」再改前端里的这些值；改动了 `VITE_*` 后需要**重新执行构建**。
- 本地开发命令为根目录 `npm run dev:web`（见根目录 `package.json`）。

---

## 2. 后端启动

### 入口与命令

- **入口文件**：`backend/server.js`  
- **推荐启动**（在 `backend` 目录下，且已配置 `.env`）：

```bash
cd backend
npm install
npm start
```

等价于执行 `node server.js`。

### 在项目根目录启动

```bash
npm run dev:backend
```

或：

```bash
npm run start:backend
```

（见根目录 `package.json`。）

### 监听端口

- 默认 **3000**，可通过环境变量 **`PORT`** 覆盖（见下文）。

### 说明

- 后端使用 `dotenv` 加载环境变量；通常将 **`backend/.env`** 放在 `backend` 目录下，与 `npm start` 的工作目录一致。示例模板见 **`backend/.env.example`**。

---

## 3. 环境变量清单（上线时需配置）

### 3.1 后端（Node / `backend`）

| 变量名 | 是否必填 | 说明 |
|--------|----------|------|
| `DEEPSEEK_API_KEY` | **生产必填**（无 Key 时相关 AI 能力不可用） | DeepSeek 兼容接口的 API Key，供判题/提示等路由调用模型。 |
| `PORT` | 可选 | HTTP 监听端口，默认 `3000`。 |
| `DEEPSEEK_API_BASE_URL` | 可选 | API 根地址，默认 `https://api.deepseek.com`（代码中会拼出 `/v1/chat/completions`）。 |

**代码引用位置摘要**：`backend/server.js`（`PORT`）、`backend/app.js`（`DEEPSEEK_API_KEY`、`DEEPSEEK_API_BASE_URL`）。

**说明**：当前仓库未发现 `DATABASE_URL` 等数据库连接变量；后端为 Express + 外部 HTTP API，无内置数据库配置项。

---

### 3.2 前端（Vite / `web`，均以 `VITE_` 开头）

以下变量在 **`web` 执行 `npm run build` 前** 生效（可放在**仓库根目录**或 **`web/`** 下的 `.env`、`.env.local` 等，与现有 Vite `envDir` 配置一致）。

| 变量名 | 是否必填 | 说明 |
|--------|----------|------|
| `VITE_API_BASE` | **生产强烈建议** | 自有海龟汤后端在浏览器可访问的 **HTTPS 基址**（如 `https://api.example.com`），用于将 `/api/chat` 等请求发到你的后端；详见 `web/src/api.ts` 注释。 |
| `VITE_API_BASE_URL` | 可选 | 公共配置用基址（`web/src/config/env.ts`）；是否与 `VITE_API_BASE` 同时设置取决于你的接入方式。 |
| `VITE_OPENAI_API_KEY` | 视部署方式 | 浏览器直连 OpenAI 兼容端时使用；**生产更推荐只暴露自有后端，不把模型 Key 打进前端包。** |
| `VITE_OPENAI_API_BASE_URL` | 视部署方式 | 与上配套，如 `https://api.openai.com/v1`。 |
| `VITE_OPENAI_MODEL` | 可选 | 直连时的模型名，默认逻辑见 `web/src/api.ts`。 |
| `VITE_API_KEY` | 别名 | 与 `VITE_OPENAI_API_KEY` 二选一（`vite.config.ts` / `vite-env.d.ts`）。 |
| `VITE_API_MODEL` | 别名 | 与 `VITE_OPENAI_MODEL` 二选一。 |
| `VITE_OPENAI_FORCE_DIRECT` | 可选 | 设为 `true` 时强制走直连逻辑（调试用，易遇 CORS）；见 `web/src/api.ts`。 |

**说明**：`import.meta.env.DEV` 等为 Vite 内置，无需在 `.env` 中配置。

---

## 4. 部署后建议自测

- 前端静态资源能打开，且网络请求指向预期的后端域名（`VITE_API_BASE` 等）。  
- 后端 `GET` 健康/探测类接口（如项目文档中的测试路径）返回正常。  
- CORS：若前后端不同域，需在后端为前端来源配置跨域。

---

*文档根据当前仓库代码扫描生成；若后续新增 `process.env` / `VITE_*` 引用，请同步更新本节。*
