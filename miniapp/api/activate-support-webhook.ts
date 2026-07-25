type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type WebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

function getEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не настроена переменная ${name}`);
  }

  return value;
}

function sendHtml(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPage(content: string) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <title>Zenvora Support Bot</title>
  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      background: #070911;
      color: #f7f8ff;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(
          circle at 15% 10%,
          rgba(64, 116, 255, 0.28),
          transparent 34%
        ),
        radial-gradient(
          circle at 90% 85%,
          rgba(135, 70, 255, 0.22),
          transparent 32%
        ),
        #070911;
    }

    main {
      width: min(100%, 520px);
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 28px;
      background: rgba(14, 18, 34, 0.92);
      box-shadow: 0 26px 80px rgba(0, 0, 0, 0.38);
    }

    .icon {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      margin-bottom: 20px;
      border-radius: 20px;
      font-size: 32px;
      background:
        linear-gradient(
          135deg,
          rgba(53, 169, 255, 0.25),
          rgba(123, 67, 255, 0.28)
        );
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.15;
    }

    p {
      margin: 0 0 18px;
      color: #b9bfd3;
      line-height: 1.55;
    }

    code {
      overflow-wrap: anywhere;
      color: #8fdcff;
    }

    button,
    a {
      width: 100%;
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 17px;
      font: inherit;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    button {
      color: white;
      background:
        linear-gradient(
          135deg,
          #328dff,
          #7047ff
        );
    }

    a {
      margin-top: 12px;
      color: #d9dded;
      background: rgba(255, 255, 255, 0.08);
    }

    .success {
      color: #78e6a7;
    }

    .error {
      color: #ff909d;
    }

    dl {
      display: grid;
      gap: 12px;
      margin: 22px 0 0;
    }

    div.row {
      padding: 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.055);
    }

    dt {
      margin-bottom: 5px;
      color: #8d96b4;
      font-size: 13px;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    ${content}
  </main>
</body>
</html>`;
}

async function callTelegram<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
  const token =
    getEnvironmentVariable("SUPPORT_BOT_TOKEN");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    },
  );

  return (await response.json()) as TelegramApiResponse<T>;
}

function getWebhookUrl() {
  const publicAppUrl =
    getEnvironmentVariable("PUBLIC_APP_URL")
      .trim()
      .replace(/\/+$/, "");

  if (!publicAppUrl.startsWith("https://")) {
    throw new Error(
      "PUBLIC_APP_URL должен начинаться с https://",
    );
  }

  return `${publicAppUrl}/api/support-bot-webhook`;
}

function validateWebhookSecret(secret: string) {
  if (
    secret.length < 1 ||
    secret.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(secret)
  ) {
    throw new Error(
      "SUPPORT_TELEGRAM_WEBHOOK_SECRET должен содержать только латинские буквы, цифры, _ и -, длина от 1 до 256 символов.",
    );
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      let webhookUrl: string;

      try {
        webhookUrl = getWebhookUrl();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось определить адрес webhook";

        return sendHtml(
          renderPage(`
            <div class="icon">⚙️</div>
            <h1 class="error">Не готово</h1>
            <p>${escapeHtml(message)}</p>
          `),
          500,
        );
      }

      return sendHtml(
        renderPage(`
          <div class="icon">🤖</div>
          <h1>Активация Zenvora Support</h1>
          <p>
            Telegram начнёт отправлять сообщения и нажатия
            кнопок на адрес:
          </p>
          <p><code>${escapeHtml(webhookUrl)}</code></p>

          <form method="post">
            <button type="submit">
              Активировать webhook
            </button>
          </form>
        `),
      );
    }

    if (request.method !== "POST") {
      return sendHtml(
        renderPage(`
          <div class="icon">⚠️</div>
          <h1 class="error">Метод не поддерживается</h1>
        `),
        405,
      );
    }

    try {
      const secret =
        getEnvironmentVariable(
          "SUPPORT_TELEGRAM_WEBHOOK_SECRET",
        );

      validateWebhookSecret(secret);

      const webhookUrl = getWebhookUrl();

      const setResult = await callTelegram<boolean>(
        "setWebhook",
        {
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: [
            "message",
            "callback_query",
          ],
        },
      );

      if (!setResult.ok || setResult.result !== true) {
        throw new Error(
          setResult.description ??
            "Telegram не подтвердил установку webhook",
        );
      }

      const infoResult =
        await callTelegram<WebhookInfo>(
          "getWebhookInfo",
        );

      if (!infoResult.ok || !infoResult.result) {
        throw new Error(
          infoResult.description ??
            "Не удалось проверить webhook",
        );
      }

      const info = infoResult.result;

      return sendHtml(
        renderPage(`
          <div class="icon">✅</div>
          <h1 class="success">Webhook активирован</h1>
          <p>
            Теперь откройте нового бота поддержки и
            отправьте ему команду <code>/start</code>.
          </p>

          <dl>
            <div class="row">
              <dt>Webhook URL</dt>
              <dd>${escapeHtml(info.url)}</dd>
            </div>

            <div class="row">
              <dt>Ожидающих обновлений</dt>
              <dd>${info.pending_update_count}</dd>
            </div>

            <div class="row">
              <dt>Последняя ошибка</dt>
              <dd>${
                info.last_error_message
                  ? escapeHtml(info.last_error_message)
                  : "нет"
              }</dd>
            </div>
          </dl>
        `),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка";

      console.error(
        "Ошибка активации support webhook:",
        error,
      );

      return sendHtml(
        renderPage(`
          <div class="icon">❌</div>
          <h1 class="error">Webhook не активирован</h1>
          <p>${escapeHtml(message)}</p>
          <a href="">Попробовать снова</a>
        `),
        500,
      );
    }
  },
};
