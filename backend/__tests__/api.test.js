/**
 * HTTP 契约与可 Mock 的判题路径（不调用真实 DeepSeek 除显式 mock 外）。
 */
const request = require("supertest");
const axios = require("axios");
const app = require("../app");

describe("GET /api/test", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/test").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.message).toBe("API is working");
  });
});

describe("GET /api/capabilities", () => {
  it("lists routes", async () => {
    const res = await request(app).get("/api/capabilities").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.post).toEqual(
      expect.arrayContaining(["/api/chat", "/api/manual-hint", "/api/hint"]),
    );
    expect(res.body.get).toEqual(
      expect.arrayContaining(["/api/manual-hint"]),
    );
  });
});

describe("GET /api/manual-hint", () => {
  it("returns success and static hint", async () => {
    const res = await request(app).get("/api/manual-hint").expect(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.hint).toBe("string");
    expect(res.body.hint.length).toBeGreaterThan(0);
  });
});

describe("POST /api/chat validation", () => {
  it("400 when question missing", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ story: { title: "t", surface: "s", bottom: "b" } })
      .expect(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 when story missing", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ question: "是不是？" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 INVALID_JSON for broken body", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("Content-Type", "application/json")
      .send('{"x":')
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});

describe("POST /api/chat non-propositional (no axios)", () => {
  it('returns 无关 for "1" without calling DeepSeek', async () => {
    const postSpy = jest.spyOn(axios, "post");
    const res = await request(app)
      .post("/api/chat")
      .send({
        question: "1",
        story: { title: "t", surface: "s", bottom: "b" },
      })
      .expect(200);
    expect(res.body.answer).toBe("无关");
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });

  it('returns 无关 for "#" without calling DeepSeek', async () => {
    const postSpy = jest.spyOn(axios, "post");
    const res = await request(app)
      .post("/api/chat")
      .send({
        question: "#",
        story: { title: "t", surface: "s", bottom: "b" },
      })
      .expect(200);
    expect(res.body.answer).toBe("无关");
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });

  it("returns 无关 and moderationNotice for abusive text without calling DeepSeek", async () => {
    const postSpy = jest.spyOn(axios, "post");
    const res = await request(app)
      .post("/api/chat")
      .send({
        question: "你这傻逼",
        story: { title: "t", surface: "s", bottom: "b" },
      })
      .expect(200);
    expect(res.body.answer).toBe("无关");
    expect(res.body.moderationNotice).toBe(
      "请注意文明用语，围绕当前汤面理性提问。",
    );
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });
});

describe("POST /api/chat with mocked DeepSeek", () => {
  const story = { title: "t", surface: "s", bottom: "truth" };

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "sk-test-mock";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("parses JSON answer from model", async () => {
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [
          { message: { content: '{"answer":"否","proximityFeedback":""}' } },
        ],
      },
    });

    const res = await request(app)
      .post("/api/chat")
      .send({ question: "是否矛盾？", story })
      .expect(200);

    expect(res.body.answer).toBe("否");
    expect(res.body.answerQuality).toBe("ok");
  });

  it("fallback 无关 when model returns non-JSON", async () => {
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "抱歉，我认为是否" } }],
      },
    });

    const res = await request(app)
      .post("/api/chat")
      .send({ question: "是否有行人？", story })
      .expect(200);

    expect(res.body.answer).toBe("无关");
    expect(res.body.answerQuality).toBe("fallback");
    expect(res.body.reaskHint).toMatch(/格式不规范/);
  });

  it("fallback when JSON has invalid answer enum", async () => {
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: '{"answer":"也许","proximityFeedback":""}',
            },
          },
        ],
      },
    });

    const res = await request(app)
      .post("/api/chat")
      .send({ question: "是否有行人？", story })
      .expect(200);

    expect(res.body.answer).toBe("无关");
    expect(res.body.answerQuality).toBe("fallback");
  });

  it("fallback when JSON has extra keys", async () => {
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content:
                '{"answer":"否","proximityFeedback":"","reason":"x"}',
            },
          },
        ],
      },
    });

    const res = await request(app)
      .post("/api/chat")
      .send({ question: "是否有行人？", story })
      .expect(200);

    expect(res.body.answer).toBe("无关");
    expect(res.body.answerQuality).toBe("fallback");
  });

  it("does not cache fallback judge result", async () => {
    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: {
        choices: [{ message: { content: "not json" } }],
      },
    });

    await request(app)
      .post("/api/chat")
      .send({ question: "同一问？", story })
      .expect(200);
    await request(app)
      .post("/api/chat")
      .send({ question: "同一问？", story })
      .expect(200);

    expect(postSpy).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/chat CONFIG_ERROR", () => {
  it("500 when DEEPSEEK_API_KEY missing on judge path", async () => {
    const saved = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const res = await request(app)
        .post("/api/chat")
        .send({
          question: "是否有行人？",
          story: {
            title: "cfg",
            surface: "sf",
            bottom: "cfg-bottom-unique",
          },
        })
        .expect(500);
      expect(res.body.error.code).toBe("CONFIG_ERROR");
    } finally {
      if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved;
    }
  });
});

describe("X-Request-Id", () => {
  it("echoes client header in response and body", async () => {
    const res = await request(app)
      .get("/api/test")
      .set("X-Request-Id", "e2e-rid-999")
      .expect(200);
    expect(res.headers["x-request-id"]).toBe("e2e-rid-999");
  });
});

describe("POST /api/hint business validation", () => {
  it("returns business code 500 when questionCount invalid", async () => {
    const res = await request(app)
      .post("/api/hint")
      .send({
        story: { title: "a", surface: "b", bottom: "c" },
        questionCount: -1,
      })
      .expect(200);
    expect(res.body.code).toBe(500);
    expect(res.body.msg).toMatch(/questionCount/);
  });
});
