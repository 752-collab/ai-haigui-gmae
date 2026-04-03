const express = require("express");
const cors = require("cors");
const axios = require("axios");

const {
  ErrorCodes,
  requestLogger,
  sendHttpError,
  mapChatAxiosError,
} = require("./lib/httpSupport");

const app = express();
const judgeCache = new Map();
const hintCache = new Map();
const MAX_CACHE_SIZE = 1000;
const MAX_HINT_CACHE_SIZE = 200;

const JUDGE_ENUM = new Set(["是", "否", "无关"]);
const PROXIMITY_ENUM = new Set([
  "",
  "你已经接近真相了",
  "方向对了，但还差关键点",
]);
const JUDGE_FALLBACK_REASK_HINT =
  "本次模型回答格式不规范，已按「无关」处理且不记入缓存。请改用更短的是非问句（如「是不是……」「有没有……」）重新提问。";

/** GET /api/manual-hint：无题目上下文时的通用玩法提示（不指向任何具体汤底） */
const STATIC_MANUAL_HINT_TEXT =
  "优先用「是不是」「有没有」这类可判真假的是非问句；抓住汤面里反常或矛盾的一处，追问原因、信息与认知是否一致；先理清人物关系与时间线，再逐步缩小到关键动机。";

/**
 * 仅接受严格 JSON：字段仅限 answer / proximityFeedback；answer 必须是 是|否|无关；
 * proximityFeedback 只能为空或两条固定文案。用于模型输出校验，失败则走兜底。
 */
function strictParseJudgeJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k !== "answer" && k !== "proximityFeedback") return null;
  }
  const ansRaw = obj.answer;
  if (typeof ansRaw !== "string") return null;
  const answer = ansRaw.trim();
  if (!JUDGE_ENUM.has(answer)) return null;
  let proximityFeedback = "";
  if (Object.prototype.hasOwnProperty.call(obj, "proximityFeedback")) {
    const p = obj.proximityFeedback;
    if (p === null || p === undefined) {
      proximityFeedback = "";
    } else if (typeof p !== "string") {
      return null;
    } else {
      proximityFeedback = p.trim();
      if (!PROXIMITY_ENUM.has(proximityFeedback)) return null;
    }
  }
  return { answer, proximityFeedback };
}

function isNonPropositionalQuestion(text) {
  const t = String(text || "")
    .trim()
    .replace(/\s+/g, "");
  if (!t) return true;
  return /^\d+$/.test(t) || /^[\p{P}\p{S}]+$/u.test(t);
}

const ABUSIVE_SNIPPETS = [
  "傻逼",
  "傻b",
  "白痴",
  "弱智",
  "去死",
  "操你",
  "草你",
  "操你妈",
  "草你妈",
  "nmsl",
  "尼玛币",
];

function containsAbusiveLanguage(text) {
  const raw = String(text || "");
  if (!raw.trim()) return false;
  for (let i = 0; i < ABUSIVE_SNIPPETS.length; i++) {
    if (raw.includes(ABUSIVE_SNIPPETS[i])) return true;
  }
  return false;
}

function resolveDeepSeekChatCompletionsUrl() {
  let base = String(
    process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com"
  ).replace(/\/+$/, "");
  if (/\/v1$/i.test(base)) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

async function tryGenerateStageHint(apiKey, story, tier, options = {}) {
  const forManualRoute = Boolean(options.forManualRoute);
  if (tier !== 6 && tier !== 10 && tier !== 15) {
    if (forManualRoute) {
      throw new Error("阶段提示 tier 仅支持 6、10、15");
    }
    return "";
  }
  const key = String(apiKey || "").trim();
  if (!key) {
    if (forManualRoute) {
      throw new Error("未配置有效的 DEEPSEEK_API_KEY");
    }
    return "";
  }

  const hintKey = `${story.title}|${story.surface}|${tier}`;
  if (hintCache.has(hintKey)) {
    return hintCache.get(hintKey);
  }
  let instruction = "";
  if (tier === 6) {
    instruction = [
      "【第1档·最浅】只根据「汤面」输出一句中文（25-40字），给氛围或思考方向的极轻点拨。",
      "要求：仅触及意象、场景或情绪，不写因果、不提供情节串联；不得出现「其实/原来是/真相/谜底/关键在于」等剧透式表述。",
      "严禁：写出唯一答案、死因手法、身份反转、与汤底等价的一句话概括。不要引号或前缀。",
    ].join("");
  } else if (tier === 10) {
    instruction = [
      "【第2档·中等】只根据「汤面」输出一句中文（28-50字），比第1档更聚焦推理维度，但仍不能落到答案。",
      "要求：可提示「更值得追问的一类关系或细节」（如时间与认知、他人视角盲区），必须保留核心悬念。",
      "严禁：点破具体事实结局、写出汤底结论、用陈述句交代关键反转。禁止「其实…」「原来是…」式揭秘。不要引号或前缀。",
    ].join("");
  } else {
    instruction = [
      "【第3档·最深仍不揭秘】只根据「汤面」输出一条字符串：含2-3个问句，用「/」分隔，每句以？结尾，供玩家用是/否继续问。",
      "问句要一层比一层更贴近矛盾核心，但每句都不得蕴含唯一正确答案或把汤底说穿；不得用反问直接公布谜底。",
      "严禁：在问句里嵌入结论性事实（谁做了什么导致结局）、或任何一句能单独还原完整真相的表述。不要换行。",
    ].join("");
  }
  const userContent = [
    instruction,
    "",
    `标题：${story.title}`,
    `汤面：${story.surface}`,
  ].join("\n");
  const url = resolveDeepSeekChatCompletionsUrl();
  try {
    const response = await axios.post(
      url,
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: userContent }],
        temperature: 0.35,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    const raw = response.data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      if (forManualRoute) {
        throw new Error("AI 未返回提示内容");
      }
      return "";
    }
    const cleaned = raw
      .replace(/^["'`「」]|["'`「」]$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) {
      if (forManualRoute) {
        throw new Error("AI 返回内容无效或为空");
      }
      return "";
    }
    if (hintCache.size >= MAX_HINT_CACHE_SIZE) {
      const first = hintCache.keys().next().value;
      if (first) hintCache.delete(first);
    }
    hintCache.set(hintKey, cleaned);
    return cleaned;
  } catch (err) {
    if (forManualRoute) {
      if (err instanceof Error && err.message && !err.response) {
        const known =
          err.message.startsWith("阶段提示") ||
          err.message.startsWith("未配置") ||
          err.message.startsWith("AI ");
        if (known) throw err;
      }
      if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
        throw new Error("AI 服务请求超时，请稍后重试");
      }
      const st = err.response?.status;
      const dataMsg = err.response?.data?.error?.message;
      if (st === 401 || st === 403) {
        throw new Error("DeepSeek API Key 无效或未授权，请检查 DEEPSEEK_API_KEY");
      }
      if (st === 429) {
        throw new Error("AI 服务限流，请稍后重试");
      }
      if (st === 404) {
        throw new Error(
          "DeepSeek 请求地址无效，请检查 DEEPSEEK_API_BASE_URL（需可拼出 /v1/chat/completions）"
        );
      }
      if (st >= 500) {
        throw new Error("AI 服务暂时不可用，请稍后重试");
      }
      if (typeof dataMsg === "string" && dataMsg.trim()) {
        throw new Error(`AI 服务错误：${dataMsg.trim().slice(0, 200)}`);
      }
      throw new Error("调用 AI 生成提示失败，请稍后重试");
    }
    return "";
  }
}

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposedHeaders: ["X-Request-Id"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

app.use(requestLogger);
app.use(express.json({ limit: "512kb" }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return sendHttpError(
      req,
      res,
      400,
      ErrorCodes.INVALID_JSON,
      "请求体不是有效的 JSON",
    );
  }
  return next(err);
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "ai-haigui-game-api",
    message:
      "后端仅提供接口，无游戏页面。请在仓库 web 目录运行 npm run dev 后打开 http://localhost:5173",
    health: "/api/test",
    capabilities: "/api/capabilities",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/manual-hint", (req, res) => {
  res.json({
    success: true,
    hint: STATIC_MANUAL_HINT_TEXT,
  });
});

app.get("/api/capabilities", (req, res) => {
  res.json({
    ok: true,
    post: ["/api/chat", "/api/manual-hint", "/api/hint"],
    get: ["/", "/api/test", "/api/capabilities", "/api/manual-hint"],
  });
});

async function handleManualStageHintRoute(req, res) {
  try {
    const { story, questionCount } = req.body || {};
    const normalizedStory =
      typeof story === "string" && story.trim()
        ? {
            title: "未命名题目",
            surface: story.trim(),
            bottom: story.trim(),
          }
        : story &&
          typeof story === "object" &&
          typeof story.title === "string" &&
          typeof story.surface === "string" &&
          typeof story.bottom === "string"
        ? {
            title: story.title.trim() || "未命名题目",
            surface: story.surface.trim(),
            bottom: story.bottom.trim(),
          }
        : null;
    const rawCount = Number(questionCount);
    const tier =
      Number.isInteger(rawCount) && rawCount >= 1
        ? rawCount <= 6
          ? 6
          : rawCount <= 10
            ? 10
            : 15
        : null;
    const rid = req.requestId || "";
    if (!normalizedStory || !normalizedStory.surface?.trim()) {
      return res.json({
        code: 500,
        msg: "参数错误：请提供含 title、surface、bottom 的 story，且汤面 surface 不能为空",
        requestId: rid,
      });
    }
    if (!normalizedStory.bottom) {
      return res.json({
        code: 500,
        msg: "参数错误：story.bottom（汤底）不能为空",
        requestId: rid,
      });
    }
    if (tier == null) {
      return res.json({
        code: 500,
        msg: "参数错误：questionCount 须为正整数",
        requestId: rid,
      });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
      return res.json({
        code: 500,
        msg: "服务未配置 DEEPSEEK_API_KEY，无法生成提示",
        requestId: rid,
      });
    }
    const hintRaw = await tryGenerateStageHint(
      apiKey,
      normalizedStory,
      tier,
      { forManualRoute: true }
    );
    const hint =
      typeof hintRaw === "string" && hintRaw.trim() ? hintRaw.trim() : "";
    if (!hint) {
      return res.json({
        code: 500,
        msg: "生成失败：未得到有效提示文案",
        requestId: rid,
      });
    }
    return res.json({ code: 200, hint, tier, requestId: rid });
  } catch (err) {
    const msg =
      err instanceof Error && typeof err.message === "string" && err.message
        ? err.message
        : "生成失败：未知错误";
    return res.json({
      code: 500,
      msg,
      requestId: req.requestId || "",
    });
  }
}

app.post("/api/manual-hint", handleManualStageHintRoute);
app.post("/api/hint", handleManualStageHintRoute);

app.post("/api/chat", async (req, res) => {
  try {
    const { question, story, message } = req.body || {};
    const normalizedQuestion =
      typeof question === "string" && question.trim()
        ? question.trim()
        : typeof message === "string" && message.trim()
        ? message.trim()
        : "";
    const normalizedStory =
      typeof story === "string" && story.trim()
        ? {
            title: "未命名题目",
            surface: story.trim(),
            bottom: story.trim(),
          }
        : story &&
          typeof story === "object" &&
          typeof story.title === "string" &&
          typeof story.surface === "string" &&
          typeof story.bottom === "string"
        ? {
            title: story.title.trim() || "未命名题目",
            surface: story.surface.trim(),
            bottom: story.bottom.trim(),
          }
        : null;

    if (!normalizedQuestion) {
      return sendHttpError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "请提供 question 或 message 字段作为提问内容",
      );
    }
    if (!normalizedStory || !normalizedStory.bottom) {
      return sendHttpError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "请提供完整 story（含 title、surface、bottom）",
      );
    }

    const rawQIdx = req.body?.questionIndex;
    const qIdxParsed = Number(rawQIdx);
    const questionIndex =
      Number.isInteger(qIdxParsed) && qIdxParsed > 0 ? qIdxParsed : null;

    const cacheKey = [
      normalizedStory.title,
      normalizedStory.surface,
      normalizedStory.bottom,
      normalizedQuestion,
    ].join("||");
    let judged;
    if (containsAbusiveLanguage(normalizedQuestion)) {
      judged = {
        answer: "无关",
        proximityFeedback: "",
        answerQuality: "ok",
        moderationNotice:
          "请注意文明用语，围绕当前汤面理性提问。",
      };
    } else if (judgeCache.has(cacheKey)) {
      judged = { ...judgeCache.get(cacheKey) };
    } else {
      judged = null;
    }
    if (!judged && isNonPropositionalQuestion(normalizedQuestion)) {
      judged = {
        answer: "无关",
        proximityFeedback: "",
        answerQuality: "ok",
      };
      if (judgeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = judgeCache.keys().next().value;
        if (oldestKey) judgeCache.delete(oldestKey);
      }
      judgeCache.set(cacheKey, judged);
    }
    if (judged) {
      const out = { ...judged };
      if (!out.answerQuality) out.answerQuality = "ok";
      const envKey = process.env.DEEPSEEK_API_KEY;
      if (
        envKey &&
        (questionIndex === 6 ||
          questionIndex === 10 ||
          questionIndex === 15)
      ) {
        const stageHint = await tryGenerateStageHint(
          envKey,
          normalizedStory,
          questionIndex
        );
        if (stageHint) {
          out.stageHint = stageHint;
          out.stageTier = questionIndex;
        }
      }
      return res.json(out);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return sendHttpError(
        req,
        res,
        500,
        ErrorCodes.CONFIG_ERROR,
        "服务未配置 AI 密钥，无法判题",
      );
    }

    const prompt = [
      "你是海龟汤裁判。只根据「汤底」判断玩家命题真假，不得臆造汤底未出现的事实。",
      "同一题目下同一问句的判定必须自洽、可复现；禁止前后矛盾。",
      "",
      "【输出（仅此一段，且必须是合法 JSON，禁止 markdown 代码块、禁止前后缀说明）】",
      '{"answer":"是|否|无关","proximityFeedback":"字符串"}',
      "- answer 只能是汉字：是、否、无关 三者之一，不得含标点或英文。",
      "- proximityFeedback：通常填 \"\"；仅在玩家非常接近核心谜底又未点破时，才可填以下二者之一：",
      "  「你已经接近真相了」或「方向对了，但还差关键点」。禁止其它文案、禁止剧透真相细节。",
      "- JSON 里只允许这两个键，不要 extra 字段。",
      "",
      "【判定规则】",
      "- 命题与汤底一致或为真：answer=是",
      "- 命题与汤底矛盾或为假：answer=否",
      "- 汤底无法判断真伪、或问题与推理链无关、或不是可判真假的是非命题：answer=无关",
      "- 若用语为辱骂、人身攻击或与推理无关的骚扰：answer=无关",
      "- 若命题与当前汤面情境及推理链毫无关联（明显跑题、闲聊他事）：answer=无关",
      "- 复合问句（且/或/先…再…）：须全真才为「是」；任一子命题与汤底矛盾则为「否」；若汤底无法判断其中关键子命题则为「无关」",
      "- 不要输出解释、理由、反问；不要复述汤底。",
      "",
      "【示例（输出内容必须与格式一致，换行仅为说明，实际输出一行 JSON）】",
      '{"answer":"否","proximityFeedback":""}',
      '{"answer":"是","proximityFeedback":""}',
      '{"answer":"无关","proximityFeedback":""}',
      '{"answer":"否","proximityFeedback":"方向对了，但还差关键点"}',
      "",
      "【当前题目】",
      `标题：${normalizedStory.title}`,
      `汤面：${normalizedStory.surface}`,
      `汤底：${normalizedStory.bottom}`,
      "",
      `【用户提问】${normalizedQuestion}`,
      "",
      "只输出一行 JSON：",
    ].join("\n");

    const judgeUrl = resolveDeepSeekChatCompletionsUrl();
    const response = await axios.post(
      judgeUrl,
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 96,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const aiRaw = response.data?.choices?.[0]?.message?.content?.trim();
    const strict = strictParseJudgeJson(aiRaw);
    if (strict) {
      judged = {
        answer: strict.answer,
        proximityFeedback: strict.proximityFeedback,
        answerQuality: "ok",
      };
    } else {
      judged = {
        answer: "无关",
        proximityFeedback: "",
        answerQuality: "fallback",
        reaskHint: JUDGE_FALLBACK_REASK_HINT,
      };
    }

    if (judged.answerQuality === "ok") {
      if (judgeCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = judgeCache.keys().next().value;
        if (oldestKey) judgeCache.delete(oldestKey);
      }
      judgeCache.set(cacheKey, judged);
    }

    const out = { ...judged };
    if (
      questionIndex === 6 ||
      questionIndex === 10 ||
      questionIndex === 15
    ) {
      const stageHint = await tryGenerateStageHint(
        apiKey,
        normalizedStory,
        questionIndex
      );
      if (stageHint) {
        out.stageHint = stageHint;
        out.stageTier = questionIndex;
      }
    }

    return res.json(out);
  } catch (error) {
    const mapped = mapChatAxiosError(error);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        requestId: req.requestId,
        event: "chat_judge_error",
        errCode: error?.code,
        upstreamStatus: error.response?.status,
        mappedCode: mapped.errCode,
      }),
    );
    return sendHttpError(
      req,
      res,
      mapped.httpStatus,
      mapped.errCode,
      mapped.message,
    );
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return;
  }
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      requestId: req.requestId,
      event: "unhandled_error",
      name: err?.name,
      message: err?.message,
    }),
  );
  return sendHttpError(
    req,
    res,
    500,
    ErrorCodes.INTERNAL_ERROR,
    "服务器内部错误，请稍后重试",
  );
});

module.exports = app;
