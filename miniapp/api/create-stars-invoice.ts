declare const process: {
  env: Record<string, string | undefined>;
};

type TelegramUser = {
  id: number;
  first_name: string;
};

type DepositAmount = 300 | 500 | 1000 | 2000;

type TelegramApiResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      ok: false;
      description?: string;
      error_code?: number;
    };

const encoder = new TextEncoder();

const starsByDepositAmount: Record<DepositAmount, number> = {
  300: 160,
  500: 283,
  1000: 550,
  2000: 1000,
};

function sendJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `На сервере не настроена переменная ${name}`,
    );
  }

  return value;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function createHmac(
  key: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(text),
  );

  return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hashesAreEqual(first: string, second: string) {
  if (first.length !== second.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < first.length; index += 1) {
    difference |=
      first.charCodeAt(index) ^
      second.charCodeAt(index);
  }

  return difference === 0;
}

async function validateTelegramData(
  initData: string,
  botToken: string,
): Promise<TelegramUser> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    throw new Error("Telegram не передал подпись");
  }

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([firstKey], [secondKey]) =>
      firstKey.localeCompare(secondKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await createHmac(
    encoder.encode("WebAppData"),
    botToken,
  );

  const calculatedHash = bytesToHex(
    await createHmac(secretKey, dataCheckString),
  );

  if (
    !hashesAreEqual(
      calculatedHash.toLowerCase(),
      receivedHash.toLowerCase(),
    )
  ) {
    throw new Error("Подпись Telegram недействительна");
  }

  const authDate = Number(params.get("auth_date"));
  const currentTime = Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(authDate) ||
    currentTime - authDate > 86400 ||
    authDate > currentTime + 60
  ) {
    throw new Error("Данные Telegram устарели");
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw new Error("Telegram не передал пользователя");
  }

  const user = JSON.parse(rawUser) as TelegramUser;

  if (
    !Number.isSafeInteger(user.id) ||
    typeof user.first_name !== "string" ||
    user.first_name.length === 0
  ) {
    throw new Error("Некорректный пользователь Telegram");
  }

  return user;
}

function isDepositAmount(value: unknown): value is DepositAmount {
  return (
    value === 300 ||
    value === 500 ||
    value === 1000 ||
    value === 2000
  );
}

function getProductionBaseUrl(request: Request) {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  const baseUrl = configuredUrl || new URL(request.url).origin;

  return baseUrl.replace(/\/+$/, "");
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const result =
    (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || result.ok === false) {
    const description =
      result.ok === false
        ? result.description
        : undefined;

    throw new Error(
      description ||
        `Telegram API вернул ошибку ${response.status}`,
    );
  }

  return result.result;
}

async function ensureTelegramWebhook(
  request: Request,
  botToken: string,
) {
  const webhookSecret = getEnvironmentVariable(
    "TELEGRAM_WEBHOOK_SECRET",
  );

  if (!/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret)) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET должен содержать 16–256 латинских букв, цифр, _ или -",
    );
  }

  const webhookUrl = `${getProductionBaseUrl(
    request,
  )}/api/telegram-webhook`;

  await callTelegramApi<boolean>(
    botToken,
    "setWebhook",
    {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: [
        "message",
        "pre_checkout_query",
      ],
    },
  );
}

async function savePendingTransaction(
  telegramId: number,
  externalId: string,
  amount: DepositAmount,
  stars: number,
) {
  const supabaseUrl = getEnvironmentVariable(
    "SUPABASE_URL",
  );
  const secretKey = getEnvironmentVariable(
    "SUPABASE_SECRET_KEY",
  );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/upsert_account_transaction`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_telegram_id: telegramId,
        p_kind: "deposit",
        p_provider: "telegram_stars",
        p_title: "Пополнение через Telegram Stars",
        p_amount_rub: amount,
        p_status: "pending",
        p_external_id: externalId,
        p_metadata: {
          stars,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Не удалось сохранить операцию: ${errorText}`,
    );
  }

  const verifyQuery = new URLSearchParams({
    telegram_id: `eq.${telegramId}`,
    provider: "eq.telegram_stars",
    external_id: `eq.${externalId}`,
    select:
      "id,telegram_id,provider,external_id,status,amount_rub,created_at",
    limit: "1",
  });

  const verifyResponse = await fetch(
    `${supabaseUrl}/rest/v1/account_transactions?${verifyQuery.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!verifyResponse.ok) {
    const errorText = await verifyResponse.text();

    throw new Error(
      `Операция отправлена на сохранение, но проверка не удалась: ${errorText}`,
    );
  }

  const savedTransactions =
    (await verifyResponse.json()) as Array<{
      id: number | string;
      telegram_id: number;
      provider: string;
      external_id: string;
      status: string;
      amount_rub: number;
      created_at: string;
    }>;

  const savedTransaction = savedTransactions[0];

  if (!savedTransaction) {
    throw new Error(
      "Supabase не сохранил pending-транзакцию Telegram Stars",
    );
  }

  return savedTransaction;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return sendJson(
        {
          ok: false,
          error: "Используйте POST-запрос",
        },
        405,
      );
    }

    let body: {
      initData?: unknown;
      amount?: unknown;
    };

    try {
      body = (await request.json()) as {
        initData?: unknown;
        amount?: unknown;
      };
    } catch {
      return sendJson(
        {
          ok: false,
          error: "Некорректное тело запроса",
        },
        400,
      );
    }

    if (
      typeof body.initData !== "string" ||
      body.initData.length === 0
    ) {
      return sendJson(
        {
          ok: false,
          error: "Откройте Zenvora через Telegram-бота",
        },
        401,
      );
    }

    if (!isDepositAmount(body.amount)) {
      return sendJson(
        {
          ok: false,
          error: "Недоступная сумма пополнения",
        },
        400,
      );
    }

    try {
      const botToken = getEnvironmentVariable(
        "TELEGRAM_BOT_TOKEN",
      );

      const telegramUser = await validateTelegramData(
        body.initData,
        botToken,
      );

      await ensureTelegramWebhook(request, botToken);

      const stars = starsByDepositAmount[body.amount];
      const externalId = crypto.randomUUID();

      const payload = JSON.stringify({
        v: 1,
        i: externalId,
        t: telegramUser.id,
        r: body.amount,
        s: stars,
      });

      if (encoder.encode(payload).byteLength > 128) {
        throw new Error("Слишком длинные данные платежа");
      }

      const invoiceUrl = await callTelegramApi<string>(
        botToken,
        "createInvoiceLink",
        {
          title: "Пополнение Zenvora",
          description: `Зачисление ${body.amount} ₽ на баланс Zenvora`,
          payload,
          currency: "XTR",
          prices: [
            {
              label: `${body.amount} ₽ на баланс`,
              amount: stars,
            },
          ],
        },
      );

      const savedTransaction =
        await savePendingTransaction(
          telegramUser.id,
          externalId,
          body.amount,
          stars,
        );

      console.log(
        "Telegram Stars pending transaction saved:",
        {
          id: savedTransaction.id,
          telegramId: savedTransaction.telegram_id,
          externalId: savedTransaction.external_id,
          status: savedTransaction.status,
        },
      );

      return sendJson({
        ok: true,
        invoice: {
          amount: body.amount,
          stars,
          url: invoiceUrl,
          externalId,
          status: "pending",
          transactionSaved: true,
          transactionId: String(savedTransaction.id),
        },
      });
    } catch (error) {
      console.error(
        "Ошибка /api/create-stars-invoice:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Не удалось создать счёт Telegram Stars";

      return sendJson(
        {
          ok: false,
          error: message,
        },
        500,
      );
    }
  },
};
