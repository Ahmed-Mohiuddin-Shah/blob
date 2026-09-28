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

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL?.trim());
}

/** Sampling caps — stops runaway “token repeat limit” loops on small GPUs. */
export type OllamaChatOptions = {
  /** Max new tokens (Ollama `num_predict`). */
  numPredict?: number;
  temperature?: number;
  repeatPenalty?: number;
};

export function ollamaChatOptions(kind: "describe" | "json"): OllamaChatOptions {
  if (kind === "json") {
    return { numPredict: 320, temperature: 0.1, repeatPenalty: 1.35 };
  }
  return { numPredict: 220, temperature: 0.2, repeatPenalty: 1.3 };
}

export function isOllamaRepeatLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /token repeat limit/i.test(msg);
}

export async function ollamaChat(input: {
  model: string;
  prompt: string;
  images?: string[];
  options?: OllamaChatOptions;
}): Promise<string> {
  const opt = input.options ?? ollamaChatOptions("describe");
  const res = await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: input.model,
      stream: false,
      messages: [
        {
          role: "user",
          content: input.prompt,
          ...(input.images?.length ? { images: input.images } : {}),
        },
      ],
      options: {
        num_predict: opt.numPredict ?? 220,
        temperature: opt.temperature ?? 0.2,
        repeat_penalty: opt.repeatPenalty ?? 1.3,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama chat ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
  };
  return data.message?.content?.trim() ?? "";
}

export async function ollamaEmbed(input: {
  model: string;
  text: string;
}): Promise<number[]> {
  const res = await fetch(`${baseUrl()}/api/embed`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: input.model, input: input.text }),
  });
  if (!res.ok) {
    throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { embeddings?: number[][] };
  const vec = data.embeddings?.[0];
  if (!vec?.length) throw new Error("Ollama embed returned empty vector");
  return vec;
}
