var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function normalizeMode(mode) {
  if (!mode || typeof mode !== "string") {
    return "generate-text";
  }
  let normalized = mode.toLowerCase().trim();
  normalized = normalized.replace(/[_\s]+/g, "-");
  normalized = normalized.replace(/-+/g, "-");
  normalized = normalized.replace(/^-+|-+$/g, "");
  const modeMap = {
    "generate-task": "generate-task",
    "generate_task": "generate-task",
    "generatetask": "generate-task",
    "generate-task-with-ai": "generate-task",
    "generate-theory": "generate-theory",
    "generate_theory": "generate-theory",
    "generatetheory": "generate-theory",
    "generate-theory-with-ai": "generate-theory",
    "generate-quiz": "generate-quiz",
    "generate_quiz": "generate-quiz",
    "generatequiz": "generate-quiz",
    "generate-quiz-with-ai": "generate-quiz",
    "generate-task-condition": "generate-task-condition",
    "generate_task_condition": "generate-task-condition",
    "generatetaskcondition": "generate-task-condition",
    "generate-task-template": "generate-task-template",
    "generate_task_template": "generate-task-template",
    "generatetasktemplate": "generate-task-template",
    "generate-test-data": "generate-test-data",
    "generate_test_data": "generate-test-data",
    "generatetestdata": "generate-test-data",
    "generate-test-data-with-ai": "generate-test-data",
    "generate-text": "generate-text",
    "generate_text": "generate-text",
    "generatetext": "generate-text",
    "generate-json": "generate-json",
    "generate_json": "generate-json",
    "generatejson": "generate-json"
  };
  if (modeMap[normalized]) {
    return modeMap[normalized];
  }
  return normalized || "generate-text";
}
__name(normalizeMode, "normalizeMode");
function getOptimalMaxTokens(mode, requestedMaxTokens) {
  if (requestedMaxTokens && requestedMaxTokens > 0) {
    return Math.min(requestedMaxTokens, 8192);
  }
  const modeMaxTokens = {
    "generate-task": 4e3,
    "generate-theory": 6e3,
    "generate-quiz": 3e3,
    "generate-task-condition": 2e3,
    "generate-task-template": 1e3,
    "generate-test-data": 3e3,
    "generate-text": 2e3,
    "generate-json": 2e3
  };
  return modeMaxTokens[mode] || 2e3;
}
__name(getOptimalMaxTokens, "getOptimalMaxTokens");
function validateAIResponse(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Empty AI response");
  }
  const trimmed = content.trim();
  if (trimmed.length < 10) {
    throw new Error(`AI response too short (${trimmed.length} chars). Minimum 10 characters required.`);
  }
}
__name(validateAIResponse, "validateAIResponse");
function strictJSONParse(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Cannot parse JSON: content is not a string");
  }
  let cleaned = content.trim();
  if (cleaned.includes("```")) {
    const jsonMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    } else {
      const startIdx = cleaned.indexOf("{");
      const endIdx = cleaned.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
      } else {
        const startIdxArr = cleaned.indexOf("[");
        const endIdxArr = cleaned.lastIndexOf("]");
        if (startIdxArr !== -1 && endIdxArr !== -1 && endIdxArr > startIdxArr) {
          cleaned = cleaned.substring(startIdxArr, endIdxArr + 1);
        }
      }
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(`Failed to parse JSON: ${parseError.message}. Content preview: ${cleaned.substring(0, 100)}`);
  }
}
__name(strictJSONParse, "strictJSONParse");
async function callCloudflareAI(env, prompt, systemPrompt, options = {}) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials not configured");
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });
  const requestBody = {
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2e3
  };
  if (options.schema) {
    requestBody.response_format = { type: "json_object" };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare AI API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  if (!data.result || !data.result.response) {
    throw new Error("Invalid response from Cloudflare AI API");
  }
  return data.result.response;
}
__name(callCloudflareAI, "callCloudflareAI");
var index_default = {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    try {
      const body = await request.json();
      if (!body.mode || !body.params || !body.params.prompt) {
        return new Response(
          JSON.stringify({ error: "Invalid request: mode and params.prompt are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const normalizedMode = normalizeMode(body.mode);
      const optimalMaxTokens = getOptimalMaxTokens(normalizedMode, body.params.maxTokens);
      let aiResponse;
      try {
        aiResponse = await callCloudflareAI(
          env,
          body.params.prompt,
          body.params.systemPrompt,
          {
            temperature: body.params.temperature,
            maxTokens: optimalMaxTokens,
            schema: body.params.schema
          }
        );
      } catch (aiError) {
        console.error("[Worker] Cloudflare AI error:", aiError);
        return new Response(
          JSON.stringify({
            error: `AI generation failed: ${aiError.message || "Unknown error"}`
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        validateAIResponse(aiResponse);
      } catch (validationError) {
        console.error("[Worker] AI response validation failed:", validationError);
        return new Response(
          JSON.stringify({
            error: `AI response validation failed: ${validationError.message}`
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (normalizedMode === "generate-json" || body.params.schema) {
        try {
          const parsed = strictJSONParse(aiResponse);
          return new Response(
            JSON.stringify({ content: JSON.stringify(parsed) }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (parseError) {
          console.error("[Worker] JSON parse failed:", parseError);
          return new Response(
            JSON.stringify({
              error: `JSON parse failed: ${parseError.message}`
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      return new Response(
        JSON.stringify({ content: aiResponse }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[Worker] Unexpected error:", error);
      return new Response(
        JSON.stringify({
          error: `Internal server error: ${error.message || "Unknown error"}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
