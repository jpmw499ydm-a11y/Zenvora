declare const process: {
  env: Record<string, string | undefined>;
};

type TelegramUser = {
  id: number;
  first_name: string;
};

type AllowedAmount = 300 | 500 | 1000 | 2000;

type CryptoPayInvoice = {
  invoice_id: number;
  status: "active" | "paid" | "expired";
  amount: string;
  fiat?: string;
  payload?: string;
  bot_invoice_url: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
};

type CryptoPayResponse =
  | {
      ok: true;
      result: CryptoPayInvoice;
    }
  | {
      ok: false;
      error?: {
        name?: string;
        code?: number;
      };
    };

const encoder = new TextEncoder();

const allowedAmounts = new Set<AllowedAmount>([
  300,
  500,
  1000,
  2000,
]);

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
  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(key),
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
      toArrayBuffer(
        encoder.encode(text),
      ),
    );

  return new Uint8Array(signature);
}

function bytesToHex(
  bytes: Uint8Array,
) {
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
  const params =
    new URLSearchParams(initData);

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
    typeof user.first_name !== "string" ||
    user.first_name.length === 0
  ) {
    throw new Error(
      "Некорректный пользователь Telegram",
    );
  }

  return user;
}

async function createCryptoPayInvoice(
  telegramId: number,
  amount: AllowedAmount,
  returnUrl: string,
): Promise<CryptoPayInvoice> {
  const token =
    getEnvironmentVariable(
      "CRYPTO_PAY_API_TOKEN",
    );

  const payload = JSON.stringify({
    version: 1,
    provider: "crypto_pay",
    telegramId,
    rubAmount: amount,
  });

  const response = await fetch(
    "https://pay.crypt.bot/api/createInvoice",
    {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token":
          token,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        currency_type: "fiat",
        fiat: "RUB",
        amount: String(amount),

        accepted_assets:
          "USDT,TON",

        description:
          `Пополнение баланса Zenvora на ${amount} ₽`,

        hidden_message:
          "Оплата получена. Вернитесь в Zenvora — баланс обновится после подтверждения.",

        paid_btn_name: "callback",
        paid_btn_url: returnUrl,

        payload,

        allow_comments: false,
        allow_anonymous: false,

        expires_in: 3600,
      }),
    },
  );

  const result =
    (await response.json()) as CryptoPayResponse;

  if (
    !response.ok ||
    result.ok === false
  ) {
    const errorName =
      result.ok === false
        ? result.error?.name ??
          "UNKNOWN_CRYPTO_PAY_ERROR"
        : `HTTP_${response.status}`;

    throw new Error(
      `Crypto Pay не создал счёт: ${errorName}`,
    );
  }

  return result.result;
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
          amount?: unknown;
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
        typeof body.amount !==
          "number" ||
        !allowedAmounts.has(
          body.amount as AllowedAmount,
        )
      ) {
        return sendJson(
          {
            ok: false,
            error:
              "Выбрана неправильная сумма пополнения",
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

      const origin =
        new URL(request.url).origin;

      const invoice =
        await createCryptoPayInvoice(
          telegramUser.id,
          body.amount as AllowedAmount,
          origin,
        );

      const invoiceUrl =
        invoice.mini_app_invoice_url ??
        invoice.bot_invoice_url ??
        invoice.web_app_invoice_url;

      if (!invoiceUrl) {
        throw new Error(
          "Crypto Pay не вернул ссылку на оплату",
        );
      }

      return sendJson({
        ok: true,
        invoice: {
          invoiceId:
            invoice.invoice_id,
          amount:
            body.amount,
          url:
            invoiceUrl,
          status:
            invoice.status,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка сервера";

      console.error(
        "Ошибка /api/create-crypto-invoice:",
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
