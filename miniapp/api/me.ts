declare const process: {
  env: Record<string, string | undefined>;
};

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type DatabaseUser = {
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  balance: number;
  subscription_end: string | null;
  active_plan_title: string | null;
  setup_status:
    | "not-started"
    | "config-opened"
    | "checking"
    | "connected";
};

type DatabaseTransaction = {
  id: number | string;
  title: string;
  amount_rub: number;
  kind: "deposit" | "subscription";
  status: "pending" | "confirmed" | "declined";
  provider: string;
  external_id: string;
  created_at: string;
  updated_at: string;
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

function getEnvironmentVariable(name: string): string {
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
      first.charCodeAt(index) ^ second.charCodeAt(index);
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

async function supabaseRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const supabaseUrl = getEnvironmentVariable("SUPABASE_URL");
  const secretKey = getEnvironmentVariable("SUPABASE_SECRET_KEY");

  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function saveTelegramUser(
  telegramUser: TelegramUser,
): Promise<DatabaseUser> {
  const response = await supabaseRequest(
    "users?on_conflict=telegram_id&select=*",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        telegram_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name ?? null,
        photo_url: telegramUser.photo_url ?? null,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка сохранения пользователя: ${errorText}`);
  }

  const users = (await response.json()) as DatabaseUser[];
  const user = users[0];

  if (!user) {
    throw new Error("Supabase не вернул данные пользователя");
  }

  return user;
}

async function expireCryptoTransactions(
  telegramId: number,
): Promise<number> {
  const response = await supabaseRequest(
    "rpc/expire_crypto_transactions",
    {
      method: "POST",
      body: JSON.stringify({
        p_telegram_id: telegramId,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ошибка проверки просроченных платежей: ${errorText}`,
    );
  }

  const result = (await response.json()) as number;

  return Number.isFinite(result) ? result : 0;
}

async function loadTransactions(
  telegramId: number,
): Promise<DatabaseTransaction[]> {
  const query = new URLSearchParams({
    telegram_id: `eq.${telegramId}`,
    select:
      "id,title,amount_rub,kind,status,provider,external_id,created_at,updated_at",
    order: "created_at.desc",
    limit: "100",
  });

  const response = await supabaseRequest(
    `account_transactions?${query.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка загрузки истории: ${errorText}`);
  }

  return (await response.json()) as DatabaseTransaction[];
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

    let body: { initData?: unknown };

    try {
      body = (await request.json()) as {
        initData?: unknown;
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

    try {
      const telegramUser = await validateTelegramData(
        body.initData,
        getEnvironmentVariable("TELEGRAM_BOT_TOKEN"),
      );

      const user = await saveTelegramUser(telegramUser);

      await expireCryptoTransactions(telegramUser.id);

      const transactions = await loadTransactions(
        telegramUser.id,
      );

      return sendJson({
        ok: true,
        user: {
          telegramId: user.telegram_id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          photoUrl: user.photo_url,
          balance: user.balance,
          subscriptionEnd: user.subscription_end,
          activePlanTitle: user.active_plan_title,
          setupStatus: user.setup_status,
        },
        transactions: transactions.map((transaction) => ({
          id: String(transaction.id),
          title: transaction.title,
          amount: transaction.amount_rub,
          type: transaction.kind,
          status: transaction.status,
          provider: transaction.provider,
          externalId: transaction.external_id,
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at,
        })),
      });
    } catch (error) {
      console.error("Ошибка /api/me:", error);

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
