/**
 * Ollama chat with tools — bounded agent loops.
 */
import {
  ollamaChatOptions,
  type OllamaChatOptions,
} from "@/lib/ollama/client";

function baseUrl(): string {
  const u = process.env.OLLAMA_BASE_URL?.trim();
  if (!u) throw new Error("OLLAMA_BASE_URL is not set");
  return u.replace(/\/$/, "");
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

export type OllamaToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
};

export type ToolCall = {
  id?: string;
  function: { name: string; arguments: string | Record<string, unknown> };
};

export type ChatWithToolsResult = {
  content: string;
  toolCalls: ToolCall[];
  message: ChatMessage;
};

export async function ollamaChatWithTools(input: {
  model: string;
  messages: ChatMessage[];
  tools?: OllamaToolDef[];
  options?: OllamaChatOptions;
}): Promise<ChatWithToolsResult> {
  const opt = input.options ?? ollamaChatOptions("json");
  const res = await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: input.model,
      stream: false,
      messages: input.messages,
      ...(input.tools?.length ? { tools: input.tools } : {}),
      options: {
        num_predict: opt.numPredict ?? 320,
        temperature: opt.temperature ?? 0.1,
        repeat_penalty: opt.repeatPenalty ?? 1.35,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama chat ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    message?: {
      content?: string;
      tool_calls?: ToolCall[];
      role?: string;
    };
  };
  const message = data.message ?? { content: "" };
  return {
    content: (message.content ?? "").trim(),
    toolCalls: message.tool_calls ?? [],
    message: {
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls,
    },
  };
}

export function parseToolArgs(
  args: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof args === "object" && args) return args;
  try {
    return JSON.parse(String(args || "{}")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
