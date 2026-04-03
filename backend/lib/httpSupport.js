/**
 * 请求日志（结构化单行 JSON，不落库汤底/提问原文）与统一错误响应。
 */
const crypto = require("crypto");

const ErrorCodes = {
  INVALID_JSON: "INVALID_JSON",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
  AI_TIMEOUT: "AI_TIMEOUT",
  AI_UPSTREAM: "AI_UPSTREAM",
  AI_RATE_LIMIT: "AI_RATE_LIMIT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

function createRequestId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

/** Express 中间件：requestId、X-Request-Id、finish 时打一行访问日志 */
function requestLogger(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId =
    typeof incoming === "string" && incoming.trim()
      ? incoming.trim().slice(0, 64)
      : createRequestId();
  res.setHeader("X-Request-Id", req.requestId);

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - start) / 1e4) / 100;
    const line = {
      ts: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: (req.originalUrl || req.url || "").split("?")[0],
      status: res.statusCode,
      durationMs,
    };
    if (req.method === "POST" && req.body && typeof req.body === "object") {
      line.bodyKeys = Object.keys(req.body);
      if (
        req.body.story &&
        typeof req.body.story === "object" &&
        !Array.isArray(req.body.story)
      ) {
        line.storyFieldKeys = Object.keys(req.body.story);
      }
    }
    console.log(JSON.stringify(line));
  });
  next();
}

/**
 * 标准 HTTP 错误 JSON（成功体仍为各路由原样，避免破坏现有前端）。
 * 始终包含 requestId；兼容旧字段顶层 message。
 */
function sendHttpError(req, res, httpStatus, code, message) {
  const requestId = req.requestId || "unknown";
  res.status(httpStatus).json({
    ok: false,
    error: { code, message },
    requestId,
    message,
  });
}

/** /api/chat 专用：将 axios 错误映射为对外安全文案（不暴露 Key 与上游原文） */
function mapChatAxiosError(error) {
  const code = error?.code;
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
    return {
      httpStatus: 504,
      errCode: ErrorCodes.AI_TIMEOUT,
      message: "AI 服务调用超时，请稍后重试",
    };
  }
  const st = error.response?.status;
  if (st === 401 || st === 403) {
    return {
      httpStatus: 502,
      errCode: ErrorCodes.AI_UPSTREAM,
      message: "AI 服务鉴权失败，请检查服务端配置",
    };
  }
  if (st === 429) {
    return {
      httpStatus: 503,
      errCode: ErrorCodes.AI_RATE_LIMIT,
      message: "AI 服务繁忙，请稍后重试",
    };
  }
  if (st >= 400 && st < 500) {
    return {
      httpStatus: 502,
      errCode: ErrorCodes.AI_UPSTREAM,
      message: "AI 服务请求被拒绝，请稍后重试",
    };
  }
  if (st >= 500) {
    return {
      httpStatus: 502,
      errCode: ErrorCodes.AI_UPSTREAM,
      message: "AI 服务暂时不可用，请稍后重试",
    };
  }
  return {
    httpStatus: 500,
    errCode: ErrorCodes.INTERNAL_ERROR,
    message: "服务器内部错误，请稍后重试",
  };
}

module.exports = {
  ErrorCodes,
  createRequestId,
  requestLogger,
  sendHttpError,
  mapChatAxiosError,
};
