declare const process: {
  env: Record<string, string | undefined>;
};

type CryptoInvoice = {
  invoice_id: number;
  status: "active" | "paid" | "expired";
  currency_type: "crypto" | "fiat";
  amount: string;
  fiat?: string;
  paid_asset?: string;
  paid_amount?: string;
  paid_at?: string;
  payload?: string;
};

type CryptoPayUpdate = {
  update_id: number;
  update_type: string;
  request_date: string;
  payload: CryptoInvoice;
};

type InvoicePayload = {
  version: number;
  provider: string;
  telegramId: number;
  rubAmount: number;
};

type CreditResult = {
  balance: number;
  credited: boolean;
};

const encoder = new TextEncoder();

const allowedAmounts = new Set([
  300,
  500,
  1000,
  2000,
]);

function sendJson(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
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

async function sha256(
  value: string,
): Promise<Uint8Array> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      toArrayBuffer(
        encoder.encode(value),
      ),
    );

  return new Uint8Array(digest);
}

async function createHmacHex(
  key: Uint8Array,
  value: string,
): Promise<string> {
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
        encoder.encode(value),
      ),
    );

  return Array.from(
    new Uint8Array(signature),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

function stringsAreEqual(
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

async function verifyCryptoPaySignature(
  rawBody: string,
  receivedSignature: string,
) {
  const token =
    getEnvironmentVariable(
      "CRYPTO_PAY_API_TOKEN",
    );

  const secretKey =
    await sha256(token);

  const calculatedSignature =
    await createHmacHex(
      secretKey,
      rawBody,
    );

  return stringsAreEqual(
    calculatedSignature.toLowerCase(),
    receivedSignature.toLowerCase(),
  );
}

function parseInvoicePayload(
  rawPayload: string | undefined,
): InvoicePayload {
  if (!rawPayload) {
    throw new Error(
      "В счёте отсутствует payload",
    );
  }

  let payload: InvoicePayload;

  try {
    payload = JSON.parse(
      rawPayload,
    ) as InvoicePayload;
  } catch {
    throw new Error(
      "Некорректный payload счёта",
    );
  }

  if (
    payload.version !== 1 ||
    payload.provider !==
      "crypto_pay" ||
    !Number.isSafeInteger(
      payload.telegramId,
    ) ||
    !allowedAmounts.has(
      payload.rubAmount,
    )
  ) {
    throw new Error(
      "Некорректные данные счёта",
    );
  }

  return payload;
}

function validateUpdateDate(
  requestDate: string,
) {
  const date = new Date(requestDate);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new Error(
      "Некорректная дата webhook",
    );
  }

  const difference = Math.abs(
    Date.now() - date.getTime(),
  );

  const maximumAge =
    24 * 60 * 60 * 1000;

  if (difference > maximumAge) {
    throw new Error(
      "Webhook слишком старый",
    );
  }
}

function validateInvoice(
  invoice: CryptoInvoice,
  payload: InvoicePayload,
) {
  if (
    !Number.isSafeInteger(
      invoice.invoice_id,
    )
  ) {
    throw new Error(
      "Некорректный invoice_id",
    );
  }

  if (invoice.status !== "paid") {
    throw new Error(
      "Счёт ещё не оплачен",
    );
  }

  if (
    invoice.currency_type !==
      "fiat" ||
    invoice.fiat !== "RUB"
  ) {
    throw new Error(
      "Неправильная валюта счёта",
    );
  }

  const invoiceAmount =
    Number(invoice.amount);

  if (
    !Number.isFinite(
      invoiceAmount,
    ) ||
    invoiceAmount !==
      payload.rubAmount
  ) {
    throw new Error(
      "Сумма счёта не совпадает",
    );
  }

  if (
    typeof invoice.paid_asset !==
      "string" ||
    invoice.paid_asset.length === 0
  ) {
    throw new Error(
      "Не указана оплаченная валюта",
    );
  }

  const paidAmount =
    Number(invoice.paid_amount);

  if (
    !Number.isFinite(paidAmount) ||
    paidAmount <= 0
  ) {
    throw new Error(
      "Некорректная сумма оплаты",
    );
  }
}

async function creditPayment(
  invoice: CryptoInvoice,
  payload: InvoicePayload,
): Promise<CreditResult> {
  const supabaseUrl =
    getEnvironmentVariable(
      "SUPABASE_URL",
    );

  const secretKey =
    getEnvironmentVariable(
      "SUPABASE_SECRET_KEY",
    );

  const paidAt =
    invoice.paid_at ??
    new Date().toISOString();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/credit_crypto_payment`,
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
        p_invoice_id:
          invoice.invoice_id,

        p_telegram_id:
          payload.telegramId,

        p_rub_amount:
          payload.rubAmount,

        p_paid_asset:
          invoice.paid_asset,

        p_paid_amount:
          Number(
            invoice.paid_amount,
          ),

        p_paid_at:
          paidAt,
      }),
    },
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase не начислил платёж: ${responseText}`,
    );
  }

  const rows = JSON.parse(
    responseText,
  ) as CreditResult[];

  const result = rows[0];

  if (!result) {
    throw new Error(
      "Supabase не вернул результат начисления",
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
      const url =
        new URL(request.url);

      const receivedSecret =
        url.searchParams.get(
          "secret",
        );

      const expectedSecret =
        getEnvironmentVariable(
          "CRYPTO_PAY_WEBHOOK_SECRET",
        );

      if (
        !receivedSecret ||
        !stringsAreEqual(
          receivedSecret,
          expectedSecret,
        )
      ) {
        return sendJson(
          {
            ok: false,
            error:
              "Неправильный секрет webhook",
          },
          403,
        );
      }

      const receivedSignature =
        request.headers.get(
          "crypto-pay-api-signature",
        );

      if (!receivedSignature) {
        return sendJson(
          {
            ok: false,
            error:
              "Отсутствует подпись Crypto Pay",
          },
          401,
        );
      }

      const rawBody =
        await request.text();

      const signatureIsValid =
        await verifyCryptoPaySignature(
          rawBody,
          receivedSignature,
        );

      if (!signatureIsValid) {
        return sendJson(
          {
            ok: false,
            error:
              "Подпись Crypto Pay недействительна",
          },
          401,
        );
      }

      let update: CryptoPayUpdate;

      try {
        update = JSON.parse(
          rawBody,
        ) as CryptoPayUpdate;
      } catch {
        return sendJson(
          {
            ok: false,
            error:
              "Некорректное тело webhook",
          },
          400,
        );
      }

      if (
        update.update_type !==
        "invoice_paid"
      ) {
        return sendJson({
          ok: true,
          ignored: true,
        });
      }

      validateUpdateDate(
        update.request_date,
      );

      const invoice =
        update.payload;

      const invoicePayload =
        parseInvoicePayload(
          invoice.payload,
        );

      validateInvoice(
        invoice,
        invoicePayload,
      );

      const result =
        await creditPayment(
          invoice,
          invoicePayload,
        );

      return sendJson({
        ok: true,
        credited:
          result.credited,
        balance:
          result.balance,
      });
    } catch (error) {
      console.error(
        "Ошибка /api/crypto-pay-webhook:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка сервера";

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
