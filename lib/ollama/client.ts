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

export async function ollamaChat(input: {
  model: string;
  prompt: string;
  images?: string[];
}): Promise<string> {
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
