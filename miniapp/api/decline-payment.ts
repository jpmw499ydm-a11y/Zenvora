declare const process: {
  env: Record<string, string | undefined>;
};

type TelegramUser = {
  id: number;
  first_name: string;
};

type PaymentProvider =
  | "telegram_stars"
  | "crypto_bot";

const encoder = new TextEncoder();

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
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

function hashesAreEqual(
  first: string,
  second: string,
) {
  if (first.length !== second.length) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < first.length;
    index += 1
  ) {
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

  const dataCheckString = Array.from(
    params.entries(),
  )
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
    await createHmac(
      secretKey,
      dataCheckString,
    ),
  );

  if (
    !hashesAreEqual(
      calculatedHash.toLowerCase(),
      receivedHash.toLowerCase(),
    )
  ) {
    throw new Error(
      "Подпись Telegram недействительна",
    );
  }

  const authDate = Number(
    params.get("auth_date"),
  );

  const currentTime = Math.floor(
    Date.now() / 1000,
  );

  if (
    !Number.isFinite(authDate) ||
    currentTime - authDate > 86400 ||
    authDate > currentTime + 60
  ) {
    throw new Error(
      "Данные Telegram устарели",
    );
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw new Error(
      "Telegram не передал пользователя",
    );
  }

  const user = JSON.parse(
    rawUser,
  ) as TelegramUser;

  if (
    !Number.isSafeInteger(user.id) ||
    typeof user.first_name !== "string" ||
    user.first_name.length === 0
  ) {
    throw new Error(
      "Некорректный пользователь Telegram",
    );
  }

  return user;
}

function isPaymentProvider(
  value: unknown,
): value is PaymentProvider {
  return (
    value === "telegram_stars" ||
    value === "crypto_bot"
  );
}

function isExternalId(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 200
  );
}

async function declineTransaction(
  telegramId: number,
  provider: PaymentProvider,
  externalId: string,
) {
  const supabaseUrl =
    getEnvironmentVariable("SUPABASE_URL");

  const secretKey =
    getEnvironmentVariable(
      "SUPABASE_SECRET_KEY",
    );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/decline_account_transaction`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        p_telegram_id: telegramId,
        p_provider: provider,
        p_external_id:
          externalId.trim(),
      }),
    },
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Не удалось обновить статус: ${errorText}`,
    );
  }

  return response.json();
}

export default {
  async fetch(
    request: Request,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return sendJson(
        {
          ok: false,
          error:
            "Используйте POST-запрос",
        },
        405,
      );
    }

    let body: {
      initData?: unknown;
      provider?: unknown;
      externalId?: unknown;
    };

    try {
      body = (await request.json()) as {
        initData?: unknown;
        provider?: unknown;
        externalId?: unknown;
      };
    } catch {
      return sendJson(
        {
          ok: false,
          error:
            "Некорректное тело запроса",
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
          error:
            "Откройте Zenvora через Telegram-бота",
        },
        401,
      );
    }

    if (
      !isPaymentProvider(body.provider)
    ) {
      return sendJson(
        {
          ok: false,
          error:
            "Некорректный способ оплаты",
        },
        400,
      );
    }

    if (!isExternalId(body.externalId)) {
      return sendJson(
        {
          ok: false,
          error:
            "Некорректный номер операции",
        },
        400,
      );
    }

    try {
      const telegramUser =
        await validateTelegramData(
          body.initData,
          getEnvironmentVariable(
            "TELEGRAM_BOT_TOKEN",
          ),
        );

      const result =
        await declineTransaction(
          telegramUser.id,
          body.provider,
          body.externalId,
        );

      return sendJson({
        ok: true,
        result,
      });
    } catch (error) {
      console.error(
        "Ошибка /api/decline-payment:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Не удалось отклонить платёж";

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
