declare const process: {
  env: Record<string, string | undefined>;
};

type DepositAmount = 300 | 500 | 1000 | 2000;

type PaymentPayload = {
  v: 1;
  t: number;
  r: DepositAmount;
  s: number;
};

type TelegramUser = {
  id: number;
};

type PreCheckoutQuery = {
  id: string;
  from: TelegramUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
};

type SuccessfulPayment = {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
};

type TelegramUpdate = {
  update_id?: number;
  pre_checkout_query?: PreCheckoutQuery;
  message?: {
    from?: TelegramUser;
    successful_payment?: SuccessfulPayment;
  };
};

type TelegramApiResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      ok: false;
      description?: string;
    };

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

function stringsAreEqual(first: string, second: string) {
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

function isDepositAmount(value: unknown): value is DepositAmount {
  return (
    value === 300 ||
    value === 500 ||
    value === 1000 ||
    value === 2000
  );
}

function parsePaymentPayload(rawPayload: string) {
  let payload: unknown;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new Error("Некорректные данные счёта");
  }

  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    throw new Error("Некорректные данные счёта");
  }

  const candidate = payload as Partial<PaymentPayload>;

  if (
    candidate.v !== 1 ||
    !Number.isSafeInteger(candidate.t) ||
    !isDepositAmount(candidate.r) ||
    !Number.isSafeInteger(candidate.s) ||
    candidate.s !== starsByDepositAmount[candidate.r]
  ) {
    throw new Error("Счёт не прошёл проверку");
  }

  return candidate as PaymentPayload;
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

async function answerPreCheckoutQuery(
  botToken: string,
  queryId: string,
  ok: boolean,
  errorMessage?: string,
) {
  await callTelegramApi<boolean>(
    botToken,
    "answerPreCheckoutQuery",
    {
      pre_checkout_query_id: queryId,
      ok,
      ...(ok
        ? {}
        : {
            error_message:
              errorMessage ||
              "Не удалось проверить платёж",
          }),
    },
  );
}

function validatePaymentData(
  telegramId: number,
  currency: string,
  totalAmount: number,
  invoicePayload: string,
) {
  const payload = parsePaymentPayload(invoicePayload);

  if (currency !== "XTR") {
    throw new Error("Неверная валюта платежа");
  }

  if (payload.t !== telegramId) {
    throw new Error(
      "Этот счёт создан для другого пользователя",
    );
  }

  if (totalAmount !== payload.s) {
    throw new Error("Неверная сумма Telegram Stars");
  }

  return payload;
}

async function creditStarsPayment(
  telegramId: number,
  payload: PaymentPayload,
  payment: SuccessfulPayment,
) {
  const supabaseUrl = getEnvironmentVariable(
    "SUPABASE_URL",
  );

  const secretKey = getEnvironmentVariable(
    "SUPABASE_SECRET_KEY",
  );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/credit_stars_payment`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_telegram_payment_charge_id:
          payment.telegram_payment_charge_id,
        p_provider_payment_charge_id:
          payment.provider_payment_charge_id,
        p_telegram_id: telegramId,
        p_stars_amount: payload.s,
        p_rub_amount: payload.r,
        p_invoice_payload: payment.invoice_payload,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ошибка начисления Stars: ${errorText}`,
    );
  }
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

    try {
      const webhookSecret = getEnvironmentVariable(
        "TELEGRAM_WEBHOOK_SECRET",
      );

      const receivedSecret =
        request.headers.get(
          "X-Telegram-Bot-Api-Secret-Token",
        ) ?? "";

      if (
        !stringsAreEqual(
          webhookSecret,
          receivedSecret,
        )
      ) {
        return sendJson(
          {
            ok: false,
            error: "Неверный секрет webhook",
          },
          401,
        );
      }

      const update =
        (await request.json()) as TelegramUpdate;

      const botToken = getEnvironmentVariable(
        "TELEGRAM_BOT_TOKEN",
      );

      if (update.pre_checkout_query) {
        const query = update.pre_checkout_query;

        try {
          validatePaymentData(
            query.from.id,
            query.currency,
            query.total_amount,
            query.invoice_payload,
          );

          await answerPreCheckoutQuery(
            botToken,
            query.id,
            true,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Не удалось проверить платёж";

          await answerPreCheckoutQuery(
            botToken,
            query.id,
            false,
            message,
          );
        }

        return sendJson({ ok: true });
      }

      const payment =
        update.message?.successful_payment;
      const telegramId = update.message?.from?.id;

      if (payment && Number.isSafeInteger(telegramId)) {
        const payload = validatePaymentData(
          telegramId as number,
          payment.currency,
          payment.total_amount,
          payment.invoice_payload,
        );

        await creditStarsPayment(
          telegramId as number,
          payload,
          payment,
        );
      }

      return sendJson({ ok: true });
    } catch (error) {
      console.error(
        "Ошибка /api/telegram-webhook:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка webhook";

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
