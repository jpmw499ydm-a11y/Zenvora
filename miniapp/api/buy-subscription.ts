declare const process: {
  env: Record<string, string | undefined>;
};

type TelegramUser = {
  id: number;
  first_name: string;
};

type PlanId = "1" | "3" | "12";

type BuyResult = {
  balance: number;
  subscription_end: string;
  active_plan_title: string;
  setup_status:
    | "not-started"
    | "config-opened"
    | "checking"
    | "connected";
};

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

function getEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `На сервере не настроена переменная ${name}`,
    );
  }

  return value;
}

function toArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  const buffer = new ArrayBuffer(
    bytes.byteLength,
  );

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

async function createHmac(
  key: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const keyBuffer = toArrayBuffer(key);

  const textBuffer = toArrayBuffer(
    encoder.encode(text),
  );

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      textBuffer,
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

  const receivedHash =
    params.get("hash");

  if (!receivedHash) {
    throw new Error(
      "Telegram не передал подпись",
    );
  }

  params.delete("hash");

  const dataCheckString = Array.from(
    params.entries(),
  )
    .sort(([firstKey], [secondKey]) =>
      firstKey.localeCompare(secondKey),
    )
    .map(
      ([key, value]) =>
        `${key}=${value}`,
    )
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
    typeof user.first_name !== "string"
  ) {
    throw new Error(
      "Некорректный пользователь Telegram",
    );
  }

  return user;
}

async function buySubscription(
  telegramId: number,
  planId: PlanId,
): Promise<BuyResult> {
  const supabaseUrl =
    getEnvironmentVariable(
      "SUPABASE_URL",
    );

  const secretKey =
    getEnvironmentVariable(
      "SUPABASE_SECRET_KEY",
    );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/buy_subscription`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization:
          `Bearer ${secretKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        p_telegram_id: telegramId,
        p_plan_id: planId,
      }),
    },
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    if (
      responseText.includes(
        "INSUFFICIENT_BALANCE",
      )
    ) {
      throw new Error(
        "INSUFFICIENT_BALANCE",
      );
    }

    if (
      responseText.includes(
        "USER_NOT_FOUND",
      )
    ) {
      throw new Error(
        "USER_NOT_FOUND",
      );
    }

    if (
      responseText.includes(
        "INVALID_PLAN",
      )
    ) {
      throw new Error(
        "INVALID_PLAN",
      );
    }

    throw new Error(
      `Ошибка покупки подписки: ${responseText}`,
    );
  }

  const rows = JSON.parse(
    responseText,
  ) as BuyResult[];

  const result = rows[0];

  if (!result) {
    throw new Error(
      "Supabase не вернул обновлённую подписку",
    );
  }

  return result;
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

    try {
      const body =
        (await request.json()) as {
          initData?: unknown;
          planId?: unknown;
        };

      if (
        typeof body.initData !==
          "string" ||
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
        body.planId !== "1" &&
        body.planId !== "3" &&
        body.planId !== "12"
      ) {
        return sendJson(
          {
            ok: false,
            error:
              "Выбран неправильный тариф",
          },
          400,
        );
      }

      const telegramUser =
        await validateTelegramData(
          body.initData,
          getEnvironmentVariable(
            "TELEGRAM_BOT_TOKEN",
          ),
        );

      const result =
        await buySubscription(
          telegramUser.id,
          body.planId,
        );

      return sendJson({
        ok: true,
        subscription: {
          balance:
            result.balance,
          subscriptionEnd:
            result.subscription_end,
          activePlanTitle:
            result.active_plan_title,
          setupStatus:
            result.setup_status,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка сервера";

      if (
        message ===
        "INSUFFICIENT_BALANCE"
      ) {
        return sendJson(
          {
            ok: false,
            error:
              "Недостаточно средств",
          },
          409,
        );
      }

      if (
        message ===
          "USER_NOT_FOUND" ||
        message ===
          "INVALID_PLAN"
      ) {
        return sendJson(
          {
            ok: false,
            error:
              message ===
              "USER_NOT_FOUND"
                ? "Пользователь не найден"
                : "Выбран неправильный тариф",
          },
          400,
        );
      }

      console.error(
        "Ошибка /api/buy-subscription:",
        error,
      );

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
