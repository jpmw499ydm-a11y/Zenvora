declare const process: {
  env: Record<string, string | undefined>;
};

type DepositAmount = 300 | 500 | 1000 | 2000;

type CryptoPayInvoice = {
  invoice_id: number;
  currency_type?: string;
  fiat?: string;
  amount: string;
  status: string;
  paid_asset?: string;
  paid_amount?: string;
  paid_at?: string;
  payload?: string;
};

type CryptoPayUpdate = {
  update_id: number;
  update_type: string;
  request_date: string;
  payload: CryptoPayInvoice;
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

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function signaturesAreEqual(first: string, second: string) {
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

async function calculateCryptoPaySignature(
  token: string,
  rawBody: string,
) {
  const tokenHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(token),
    ),
  );

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(tokenHash),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );

  return bytesToHex(new Uint8Array(signature));
}

async function verifyCryptoPaySignature(
  request: Request,
  rawBody: string,
) {
  const receivedSignature =
    request.headers.get("crypto-pay-api-signature")?.trim()
      .toLowerCase() ?? "";

  if (!/^[a-f0-9]{64}$/.test(receivedSignature)) {
    return false;
  }

  const calculatedSignature =
    await calculateCryptoPaySignature(
      getEnvironmentVariable("CRYPTO_PAY_API_TOKEN"),
      rawBody,
    );

  return signaturesAreEqual(
    calculatedSignature,
    receivedSignature,
  );
}

function isDepositAmount(value: number): value is DepositAmount {
  return (
    value === 300 ||
    value === 500 ||
    value === 1000 ||
    value === 2000
  );
}

function parseInvoiceAmount(value: string): DepositAmount {
  if (!/^\d+(?:\.0+)?$/.test(value)) {
    throw new Error("Некорректная сумма счёта");
  }

  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || !isDepositAmount(amount)) {
    throw new Error("Недоступная сумма пополнения");
  }

  return amount;
}

function parsePayload(payload: string | undefined) {
  if (!payload) {
    throw new Error("Crypto Pay не вернул payload");
  }

  let parsed: {
    v?: unknown;
    t?: unknown;
    r?: unknown;
  };

  try {
    parsed = JSON.parse(payload) as {
      v?: unknown;
      t?: unknown;
      r?: unknown;
    };
  } catch {
    throw new Error("Некорректный payload Crypto Pay");
  }

  if (
    parsed.v !== 1 ||
    !Number.isSafeInteger(parsed.t) ||
    typeof parsed.r !== "number" ||
    !Number.isSafeInteger(parsed.r) ||
    !isDepositAmount(parsed.r)
  ) {
    throw new Error("Некорректные данные счёта");
  }

  return {
    telegramId: parsed.t as number,
    rubAmount: parsed.r as DepositAmount,
    raw: payload,
  };
}

function validateRequestDate(value: string) {
  const requestDate = new Date(value);

  if (Number.isNaN(requestDate.getTime())) {
    throw new Error("Некорректная дата webhook");
  }

  const age = Math.abs(Date.now() - requestDate.getTime());

  if (age > 15 * 60 * 1000) {
    throw new Error("Webhook устарел");
  }
}

async function confirmPayment(
  invoice: CryptoPayInvoice,
  telegramId: number,
  rubAmount: DepositAmount,
  invoicePayload: string,
) {
  const supabaseUrl = getEnvironmentVariable(
    "SUPABASE_URL",
  );
  const secretKey = getEnvironmentVariable(
    "SUPABASE_SECRET_KEY",
  );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/confirm_crypto_payment_history`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_invoice_id: invoice.invoice_id,
        p_telegram_id: telegramId,
        p_rub_amount: rubAmount,
        p_invoice_payload: invoicePayload,
        p_paid_asset: invoice.paid_asset ?? "",
        p_paid_amount: invoice.paid_amount ?? "",
        p_paid_at: invoice.paid_at ?? null,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Не удалось подтвердить оплату: ${errorText}`,
    );
  }

  return response.json();
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

    const rawBody = await request.text();

    if (
      !(await verifyCryptoPaySignature(
        request,
        rawBody,
      ))
    ) {
      return sendJson(
        {
          ok: false,
          error: "Недействительная подпись Crypto Pay",
        },
        401,
      );
    }

    let update: CryptoPayUpdate;

    try {
      update = JSON.parse(rawBody) as CryptoPayUpdate;
    } catch {
      return sendJson(
        {
          ok: false,
          error: "Некорректный JSON",
        },
        400,
      );
    }

    try {
      validateRequestDate(update.request_date);

      if (update.update_type !== "invoice_paid") {
        return sendJson({
          ok: true,
          ignored: true,
        });
      }

      const invoice = update.payload;

      if (
        !Number.isSafeInteger(invoice.invoice_id) ||
        invoice.invoice_id <= 0
      ) {
        throw new Error("Некорректный invoice_id");
      }

      if (invoice.status !== "paid") {
        throw new Error("Счёт ещё не оплачен");
      }

      if (
        invoice.currency_type !== "fiat" ||
        invoice.fiat !== "RUB"
      ) {
        throw new Error("Некорректная валюта счёта");
      }

      const amountFromInvoice =
        parseInvoiceAmount(invoice.amount);

      const payload = parsePayload(invoice.payload);

      if (payload.rubAmount !== amountFromInvoice) {
        throw new Error(
          "Сумма счёта не совпадает с payload",
        );
      }

      const result = await confirmPayment(
        invoice,
        payload.telegramId,
        payload.rubAmount,
        payload.raw,
      );

      return sendJson({
        ok: true,
        result,
      });
    } catch (error) {
      console.error(
        "Ошибка /api/crypto-pay-webhook:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Не удалось обработать webhook Crypto Pay";

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
