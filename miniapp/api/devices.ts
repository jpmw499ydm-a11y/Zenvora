type TelegramUser = {
  id: number;
  first_name: string;
};

type DevicePlatform =
  | "ios"
  | "android"
  | "windows"
  | "macos"
  | "other";

type DevicesAction = "list" | "create" | "revoke";

type RequestBody = {
  initData?: unknown;
  action?: unknown;
  deviceName?: unknown;
  platform?: unknown;
  deviceId?: unknown;
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

async function createHmac(
  key: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
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
    throw new Error("TELEGRAM_SIGNATURE_MISSING");
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
    throw new Error("TELEGRAM_SIGNATURE_INVALID");
  }

  const authDate = Number(params.get("auth_date"));
  const currentTime = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(authDate)) {
    throw new Error("TELEGRAM_AUTH_DATE_INVALID");
  }

  if (
    currentTime - authDate > 86400 ||
    authDate > currentTime + 60
  ) {
    throw new Error("TELEGRAM_DATA_EXPIRED");
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw new Error("TELEGRAM_USER_MISSING");
  }

  const user = JSON.parse(rawUser) as TelegramUser;

  if (
    !Number.isSafeInteger(user.id) ||
    typeof user.first_name !== "string" ||
    user.first_name.length === 0
  ) {
    throw new Error("TELEGRAM_USER_INVALID");
  }

  return user;
}

function getEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`ENV_MISSING:${name}`);
  }

  return value;
}

async function callSupabaseRpc(
  functionName: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const supabaseUrl = getEnvironmentVariable("SUPABASE_URL");
  const secretKey =
    getEnvironmentVariable("SUPABASE_SECRET_KEY");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const responseText = await response.text();

  let responseData: unknown = null;

  if (responseText) {
    try {
      responseData = JSON.parse(responseText) as unknown;
    } catch {
      responseData = responseText;
    }
  }

  if (!response.ok) {
    const details =
      typeof responseData === "object" &&
      responseData !== null &&
      "message" in responseData &&
      typeof responseData.message === "string"
        ? responseData.message
        : responseText || `HTTP_${response.status}`;

    throw new Error(`SUPABASE_RPC:${details}`);
  }

  return responseData;
}

function isDevicePlatform(
  value: unknown,
): value is DevicePlatform {
  return (
    value === "ios" ||
    value === "android" ||
    value === "windows" ||
    value === "macos" ||
    value === "other"
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function getErrorResponse(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : "UNKNOWN_ERROR";

  if (rawMessage.startsWith("ENV_MISSING:")) {
    return {
      status: 500,
      message:
        "На сервере отсутствует обязательная переменная окружения.",
    };
  }

  if (rawMessage.startsWith("TELEGRAM_")) {
    return {
      status: 401,
      message:
        "Не удалось проверить данные Telegram. Закройте Mini App и откройте его заново через бота.",
    };
  }

  if (rawMessage.includes("DEVICE_LIMIT_REACHED")) {
    return {
      status: 409,
      message:
        "Достигнут лимит: можно подключить не больше 5 устройств.",
    };
  }

  if (rawMessage.includes("SUBSCRIPTION_INACTIVE")) {
    return {
      status: 403,
      message:
        "Для управления устройствами нужна активная подписка.",
    };
  }

  if (rawMessage.includes("DEVICE_NOT_FOUND")) {
    return {
      status: 404,
      message:
        "Устройство не найдено или уже отвязано.",
    };
  }

  if (rawMessage.includes("USER_NOT_FOUND")) {
    return {
      status: 404,
      message: "Пользователь не найден.",
    };
  }

  if (rawMessage.includes("DEVICE_NAME_REQUIRED")) {
    return {
      status: 400,
      message: "Введите название устройства.",
    };
  }

  if (rawMessage.includes("DEVICE_NAME_TOO_LONG")) {
    return {
      status: 400,
      message:
        "Название устройства должно содержать не больше 60 символов.",
    };
  }

  if (rawMessage.includes("INVALID_DEVICE_PLATFORM")) {
    return {
      status: 400,
      message: "Выбрана неизвестная платформа.",
    };
  }

  console.error("Ошибка /api/devices:", error);

  return {
    status: 500,
    message: "Не удалось выполнить операцию с устройством.",
  };
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

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
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

    const action: DevicesAction =
      body.action === undefined ? "list" : (
        body.action as DevicesAction
      );

    if (
      action !== "list" &&
      action !== "create" &&
      action !== "revoke"
    ) {
      return sendJson(
        {
          ok: false,
          error: "Неизвестное действие",
        },
        400,
      );
    }

    try {
      const telegramUser = await validateTelegramData(
        body.initData,
        getEnvironmentVariable("TELEGRAM_BOT_TOKEN"),
      );

      if (action === "list") {
        const devices = await callSupabaseRpc(
          "list_vpn_devices",
          {
            p_telegram_id: telegramUser.id,
          },
        );

        return sendJson({
          ok: true,
          devices,
        });
      }

      if (action === "create") {
        if (
          typeof body.deviceName !== "string" ||
          body.deviceName.trim().length === 0
        ) {
          return sendJson(
            {
              ok: false,
              error: "Введите название устройства",
            },
            400,
          );
        }

        if (!isDevicePlatform(body.platform)) {
          return sendJson(
            {
              ok: false,
              error: "Выберите тип устройства",
            },
            400,
          );
        }

        const device = await callSupabaseRpc(
          "create_vpn_device",
          {
            p_telegram_id: telegramUser.id,
            p_device_name: body.deviceName.trim(),
            p_platform: body.platform,
          },
        );

        return sendJson(
          {
            ok: true,
            device,
          },
          201,
        );
      }

      if (!isUuid(body.deviceId)) {
        return sendJson(
          {
            ok: false,
            error: "Некорректный идентификатор устройства",
          },
          400,
        );
      }

      const result = await callSupabaseRpc(
        "revoke_vpn_device",
        {
          p_telegram_id: telegramUser.id,
          p_device_id: body.deviceId,
        },
      );

      return sendJson({
        ok: true,
        result,
      });
    } catch (error) {
      const response = getErrorResponse(error);

      return sendJson(
        {
          ok: false,
          error: response.message,
        },
        response.status,
      );
    }
  },
};
