type OpenAIOutputItem = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAIResponse = {
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getOutputText(
  response: OpenAIResponse,
): string {
  const parts: string[] = [];

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        content.type === "output_text" &&
        content.text
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

export default {
  async fetch(): Promise<Response> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model =
      process.env.OPENAI_MODEL || "gpt-5-mini";

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          error: "Переменная OPENAI_API_KEY не найдена",
        },
        500,
      );
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            store: false,
            max_output_tokens: 100,
            input:
              "Ответь строго одной фразой: ИИ поддержки Zenvora работает.",
          }),
        },
      );

      const result =
        (await response.json()) as OpenAIResponse;

      if (!response.ok) {
        return jsonResponse(
          {
            ok: false,
            status: response.status,
            error:
              result.error?.message ||
              "Ошибка OpenAI API",
          },
          500,
        );
      }

      const answer = getOutputText(result);

      return jsonResponse({
        ok: true,
        model,
        answer:
          answer || "Ответ получен, но текст пустой",
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка",
        },
        500,
      );
    }
  },
};
