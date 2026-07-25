type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type: string;
};

type TelegramMessage = {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
};

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type InlineKeyboardMarkup = {
  inline_keyboard: InlineButton[][];
};

type UserRow = {
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  balance: number;
  subscription_end: string | null;
  active_plan_title: string | null;
  setup_status:
    | "not-started"
    | "config-opened"
    | "checking"
    | "connected";
};

type TransactionRow = {
  title: string;
  amount_rub: number;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
};

type TicketCategory =
  | "connection"
  | "device"
  | "configuration"
  | "payment"
  | "telegram_stars"
  | "crypto"
  | "subscription"
  | "other";

type TicketRow = {
  id: number;
  requester_telegram_id: number;
  status:
    | "bot_helping"
    | "waiting_operator"
    | "operator_answered"
    | "waiting_user"
    | "closed";
  category: TicketCategory;
  operator_topic_id: number | null;
};

type TelegramForumTopic = {
  message_thread_id: number;
  name: string;
};

type AccountContext = {
  user: UserRow;
  devicesUsed: number;
  transactions: TransactionRow[];
};

const DEVICE_LIMIT = 5;

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
    throw new Error(`ENV_MISSING:${name}`);
  }

  return value;
}

function getSupabaseHeaders(
  extraHeaders: Record<string, string> = {},
) {
  const secretKey =
    getEnvironmentVariable("SUPABASE_SECRET_KEY");

  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function supabaseRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const supabaseUrl =
    getEnvironmentVariable("SUPABASE_URL");

  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: getSupabaseHeaders(
      (options.headers ?? {}) as Record<string, string>,
    ),
  });
}

async function readSupabaseRows<T>(
  path: string,
): Promise<T[]> {
  const response = await supabaseRequest(path);

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `SUPABASE_READ:${response.status}:${errorText}`,
    );
  }

  return (await response.json()) as T[];
}

async function telegramRequest<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const botToken =
    getEnvironmentVariable("SUPPORT_BOT_TOKEN");

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

  const result = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  if (!response.ok || !result.ok) {
    throw new Error(
      `TELEGRAM_API:${method}:${
        result.description ?? response.status
      }`,
    );
  }

  return result.result as T;
}

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  messageThreadId?: number,
) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup
      ? {
          reply_markup: replyMarkup,
        }
      : {}),
    ...(messageThreadId
      ? {
          message_thread_id: messageThreadId,
        }
      : {}),
  });
}

function getSupportGroupChatId() {
  const value = Number(
    getEnvironmentVariable("SUPPORT_GROUP_CHAT_ID"),
  );

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      "ENV_INVALID:SUPPORT_GROUP_CHAT_ID",
    );
  }

  return value;
}

function buildTopicName(
  ticketId: number,
  requester: TelegramUser,
) {
  const name = [
    requester.first_name,
    requester.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const username = requester.username
    ? ` @${requester.username}`
    : "";

  return `#${ticketId} ${name || requester.id}${username}`.slice(
    0,
    128,
  );
}

async function createOperatorTopic(
  ticket: TicketRow,
  requester: TelegramUser,
) {
  if (ticket.operator_topic_id) {
    return ticket.operator_topic_id;
  }

  const groupChatId = getSupportGroupChatId();

  const topic = await telegramRequest<TelegramForumTopic>(
    "createForumTopic",
    {
      chat_id: groupChatId,
      name: buildTopicName(ticket.id, requester),
    },
  );

  const response = await supabaseRequest(
    `support_tickets?id=eq.${ticket.id}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        operator_topic_id: topic.message_thread_id,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `SUPPORT_TOPIC_SAVE:${await response.text()}`,
    );
  }

  ticket.operator_topic_id = topic.message_thread_id;

  return topic.message_thread_id;
}

async function sendOperatorCard(
  ticket: TicketRow,
  requester: TelegramUser,
  context: AccountContext,
  topicId: number,
) {
  const fullName = [
    context.user.first_name,
    context.user.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  await sendMessage(
    getSupportGroupChatId(),
    [
      `🆕 Обращение №${ticket.id}`,
      "",
      `Категория: ${getCategoryTitle(ticket.category)}`,
      `Пользователь: ${fullName}`,
      `Telegram ID: ${requester.id}`,
      `Username: ${
        requester.username
          ? `@${requester.username}`
          : "не указан"
      }`,
      `Подписка: ${
        isSubscriptionActive(
          context.user.subscription_end,
        )
          ? "активна"
          : "неактивна"
      }`,
      `Тариф: ${
        context.user.active_plan_title ?? "не выбран"
      }`,
      `Устройства: ${context.devicesUsed} из ${DEVICE_LIMIT}`,
      "",
      "Ответьте обычным сообщением в этой теме — бот отправит текст пользователю.",
      "Для закрытия обращения напишите /close.",
    ].join("\n"),
    undefined,
    topicId,
  );
}

async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(
    value,
  )} ₽`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "не оформлена";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "дата неизвестна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function calculateDaysLeft(value: string | null) {
  if (!value) {
    return 0;
  }

  const endDate = new Date(value);

  if (Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const difference =
    endDate.getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(difference / 86_400_000),
  );
}

function isSubscriptionActive(
  subscriptionEnd: string | null,
) {
  if (!subscriptionEnd) {
    return false;
  }

  const endDate = new Date(subscriptionEnd);

  return (
    !Number.isNaN(endDate.getTime()) &&
    endDate.getTime() > Date.now()
  );
}

function getTransactionStatusText(
  status: TransactionRow["status"],
) {
  if (status === "confirmed") {
    return "подтверждено";
  }

  if (status === "declined") {
    return "отклонено";
  }

  return "проверяется";
}

function getCategoryTitle(category: TicketCategory) {
  const titles: Record<TicketCategory, string> = {
    connection: "VPN не подключается",
    device: "Проблема с устройством",
    configuration: "Проблема с конфигурацией",
    payment: "Проблема с оплатой",
    telegram_stars: "Telegram Stars",
    crypto: "Crypto Bot",
    subscription: "Подписка и продление",
    other: "Другая проблема",
  };

  return titles[category];
}

function getAccountKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Да, это мой аккаунт",
          callback_data: "account:confirm",
        },
      ],
      [
        {
          text: "🔄 Обновить данные",
          callback_data: "account:refresh",
        },
      ],
    ],
  };
}

function getCategoriesKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "🔌 VPN не подключается",
          callback_data: "category:connection",
        },
      ],
      [
        {
          text: "📱 Проблема с устройством",
          callback_data: "category:device",
        },
      ],
      [
        {
          text: "📄 Конфигурация",
          callback_data: "category:configuration",
        },
      ],
      [
        {
          text: "💳 Оплата",
          callback_data: "category:payment",
        },
        {
          text: "📅 Подписка",
          callback_data: "category:subscription",
        },
      ],
      [
        {
          text: "⭐ Stars",
          callback_data: "category:telegram_stars",
        },
        {
          text: "💎 Crypto",
          callback_data: "category:crypto",
        },
      ],
      [
        {
          text: "💬 Другая проблема",
          callback_data: "category:other",
        },
      ],
    ],
  };
}

function getHelpResultKeyboard(
  category: TicketCategory,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Помогло",
          callback_data: "help:resolved",
        },
      ],
      [
        {
          text: "👨‍💻 Позвать оператора",
          callback_data: `operator:${category}`,
        },
      ],
      [
        {
          text: "◀️ Другой вопрос",
          callback_data: "menu:categories",
        },
      ],
    ],
  };
}

async function getAccountContext(
  telegramId: number,
): Promise<AccountContext | null> {
  const users = await readSupabaseRows<UserRow>(
    `users?telegram_id=eq.${telegramId}` +
      "&select=telegram_id,username,first_name,last_name,balance," +
      "subscription_end,active_plan_title,setup_status&limit=1",
  );

  const user = users[0];

  if (!user) {
    return null;
  }

  const [devices, transactions] = await Promise.all([
    readSupabaseRows<{ id: string }>(
      `vpn_devices?telegram_id=eq.${telegramId}` +
        "&status=eq.active&select=id",
    ),
    readSupabaseRows<TransactionRow>(
      `account_transactions?telegram_id=eq.${telegramId}` +
        "&select=title,amount_rub,status,created_at" +
        "&order=created_at.desc&limit=5",
    ),
  ]);

  return {
    user,
    devicesUsed: devices.length,
    transactions,
  };
}

function buildAccountSummary(context: AccountContext) {
  const { user, devicesUsed } = context;
  const active =
    isSubscriptionActive(user.subscription_end);
  const daysLeft =
    calculateDaysLeft(user.subscription_end);

  const fullName = [
    user.first_name,
    user.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "🔐 Аккаунт Zenvora найден",
    "",
    `Пользователь: ${fullName}`,
    `Telegram ID: ${user.telegram_id}`,
    `Подписка: ${
      active ? "активна" : "неактивна"
    }`,
    `Тариф: ${
      user.active_plan_title ?? "не выбран"
    }`,
    `Действует до: ${formatDate(
      user.subscription_end,
    )}`,
    `Осталось: ${daysLeft} дн.`,
    `Устройства: ${devicesUsed} из ${DEVICE_LIMIT}`,
    `Баланс: ${formatMoney(user.balance)}`,
    "",
    "Это ваш аккаунт?",
  ].join("\n");
}

function buildConnectionHelp(context: AccountContext) {
  const active = isSubscriptionActive(
    context.user.subscription_end,
  );

  if (!active) {
    return [
      "🔌 Проверка подключения",
      "",
      "Сейчас подписка неактивна. VPN не сможет подключиться, пока подписка не будет оформлена или продлена.",
      "",
      "Откройте Zenvora → Подписка и продлите доступ.",
    ].join("\n");
  }

  if (context.devicesUsed === 0) {
    return [
      "🔌 Проверка подключения",
      "",
      "Подписка активна, но к аккаунту ещё не добавлено ни одного устройства.",
      "",
      "Откройте Zenvora → Подключиться → Добавить устройство. После этого получите конфигурацию и импортируйте её в приложение VPN.",
    ].join("\n");
  }

  return [
    "🔌 Проверка подключения",
    "",
    `Подписка активна. Устройств: ${context.devicesUsed} из ${DEVICE_LIMIT}.`,
    "",
    "Проверьте по порядку:",
    "1. Устройство есть в списке Zenvora.",
    "2. Конфигурация импортирована в VPN-приложение.",
    "3. В VPN-приложении выбран профиль Zenvora.",
    "4. Выключите и снова включите VPN.",
    "5. Перезапустите VPN-приложение.",
    "",
    "Когда подключим реальный VPN-сервер, бот также будет проверять состояние конфигурации на сервере.",
  ].join("\n");
}

function buildDeviceHelp(context: AccountContext) {
  if (context.devicesUsed >= DEVICE_LIMIT) {
    return [
      "📱 Устройства",
      "",
      `Использовано ${context.devicesUsed} из ${DEVICE_LIMIT} мест.`,
      "",
      "Чтобы добавить новое устройство, откройте Zenvora → Подключиться и отвяжите устройство, которым больше не пользуетесь.",
    ].join("\n");
  }

  return [
    "📱 Устройства",
    "",
    `Использовано ${context.devicesUsed} из ${DEVICE_LIMIT} мест.`,
    "",
    "Новое устройство можно добавить через Zenvora → Подключиться → Добавить устройство.",
    "Ненужное устройство можно отвязать там же кнопкой «Отвязать».",
  ].join("\n");
}

function buildConfigurationHelp(
  context: AccountContext,
) {
  if (
    !isSubscriptionActive(
      context.user.subscription_end,
    )
  ) {
    return [
      "📄 Конфигурация",
      "",
      "Получение конфигурации доступно только при активной подписке.",
      "Сначала оформите или продлите подписку в Zenvora.",
    ].join("\n");
  }

  return [
    "📄 Конфигурация",
    "",
    "Проверьте:",
    "1. Устройство добавлено в Zenvora.",
    "2. Выбрано правильное приложение для вашей платформы.",
    "3. Конфигурация импортируется именно в VPN-приложение.",
    "",
    "Сейчас конфигурации работают в тестовом режиме до подключения реального VPN-сервера.",
  ].join("\n");
}

function buildPaymentHelp(context: AccountContext) {
  if (context.transactions.length === 0) {
    return [
      "💳 Платежи",
      "",
      "В истории аккаунта пока нет операций.",
      "Пополнение можно запустить в Zenvora → Кошелёк.",
    ].join("\n");
  }

  const lines = context.transactions.map(
    (transaction) => {
      const sign =
        transaction.amount_rub > 0 ? "+" : "";

      return (
        `• ${transaction.title}: ` +
        `${sign}${formatMoney(
          transaction.amount_rub,
        )} — ${getTransactionStatusText(
          transaction.status,
        )}`
      );
    },
  );

  return [
    "💳 Последние операции",
    "",
    ...lines,
    "",
    "Если платёж долго остаётся в статусе «проверяется» или был отклонён, нажмите «Позвать оператора».",
  ].join("\n");
}

function buildSubscriptionHelp(
  context: AccountContext,
) {
  const active = isSubscriptionActive(
    context.user.subscription_end,
  );
  const daysLeft = calculateDaysLeft(
    context.user.subscription_end,
  );

  return [
    "📅 Подписка",
    "",
    `Статус: ${
      active ? "активна" : "неактивна"
    }`,
    `Тариф: ${
      context.user.active_plan_title ??
      "не выбран"
    }`,
    `Действует до: ${formatDate(
      context.user.subscription_end,
    )}`,
    `Осталось: ${daysLeft} дн.`,
    "",
    active
      ? "Продлить подписку можно заранее — оставшиеся дни сохранятся."
      : "Оформите новую подписку в Zenvora → Подписка.",
  ].join("\n");
}

function buildProviderHelp(
  provider: "telegram_stars" | "crypto",
  context: AccountContext,
) {
  const matching = context.transactions.filter(
    (transaction) => {
      const title =
        transaction.title.toLowerCase();

      return provider === "telegram_stars"
        ? title.includes("star")
        : title.includes("crypto");
    },
  );

  const title =
    provider === "telegram_stars"
      ? "⭐ Telegram Stars"
      : "💎 Crypto Bot";

  if (matching.length === 0) {
    return [
      title,
      "",
      "Подходящих операций в последних платежах не найдено.",
      "Откройте Zenvora → Кошелёк и повторите пополнение.",
    ].join("\n");
  }

  return [
    title,
    "",
    ...matching.map(
      (transaction) =>
        `• ${transaction.title} — ${getTransactionStatusText(
          transaction.status,
        )}`,
    ),
    "",
    "При спорном или зависшем платеже нажмите «Позвать оператора».",
  ].join("\n");
}

async function findOpenTicket(
  requesterTelegramId: number,
): Promise<TicketRow | null> {
  const tickets = await readSupabaseRows<TicketRow>(
    `support_tickets?requester_telegram_id=eq.${requesterTelegramId}` +
      "&status=neq.closed&select=id,requester_telegram_id,status,category,operator_topic_id" +
      "&order=created_at.desc&limit=1",
  );

  return tickets[0] ?? null;
}

async function findTicketByTopic(
  operatorTopicId: number,
): Promise<TicketRow | null> {
  const tickets = await readSupabaseRows<TicketRow>(
    `support_tickets?operator_topic_id=eq.${operatorTopicId}` +
      "&status=neq.closed&select=id,requester_telegram_id,status,category,operator_topic_id" +
      "&order=created_at.desc&limit=1",
  );

  return tickets[0] ?? null;
}

async function updateTicketStatus(
  ticketId: number,
  status: TicketRow["status"],
) {
  const response = await supabaseRequest(
    `support_tickets?id=eq.${ticketId}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `SUPPORT_TICKET_STATUS:${await response.text()}`,
    );
  }
}

async function ensureOperatorTopic(
  ticket: TicketRow,
  requester: TelegramUser,
  context: AccountContext,
) {
  const hadTopic = Boolean(ticket.operator_topic_id);
  const topicId = await createOperatorTopic(
    ticket,
    requester,
  );

  if (!hadTopic) {
    await sendOperatorCard(
      ticket,
      requester,
      context,
      topicId,
    );
  }

  return topicId;
}

async function createOrEscalateTicket(
  requester: TelegramUser,
  category: TicketCategory,
  problemSummary: string,
): Promise<TicketRow> {
  const currentTicket =
    await findOpenTicket(requester.id);

  if (currentTicket) {
    const response = await supabaseRequest(
      `support_tickets?id=eq.${currentTicket.id}&select=id,requester_telegram_id,status,category,operator_topic_id`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          category,
          status: "waiting_operator",
          subject: getCategoryTitle(category),
          problem_summary: problemSummary,
          last_user_message_at:
            new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `SUPPORT_TICKET_UPDATE:${await response.text()}`,
      );
    }

    const rows =
      (await response.json()) as TicketRow[];

    return rows[0] ?? currentTicket;
  }

  const response = await supabaseRequest(
    "support_tickets?select=id,requester_telegram_id,status,category,operator_topic_id",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        requester_telegram_id: requester.id,
        account_telegram_id: requester.id,
        category,
        status: "waiting_operator",
        subject: getCategoryTitle(category),
        problem_summary: problemSummary,
        last_user_message_at:
          new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `SUPPORT_TICKET_CREATE:${await response.text()}`,
    );
  }

  const rows = (await response.json()) as TicketRow[];
  const ticket = rows[0];

  if (!ticket) {
    throw new Error(
      "SUPPORT_TICKET_CREATE:NO_RESULT",
    );
  }

  return ticket;
}

async function saveSupportMessage(
  ticketId: number,
  senderType: "user" | "bot" | "operator" | "system",
  text: string,
  senderTelegramId?: number,
  sourceMessage?: TelegramMessage,
) {
  const response = await supabaseRequest(
    "support_messages",
    {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ticket_id: ticketId,
        sender_type: senderType,
        sender_telegram_id:
          senderTelegramId ?? null,
        message_text: text,
        source_chat_id:
          sourceMessage?.chat.id ?? null,
        source_message_id:
          sourceMessage?.message_id ?? null,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    if (
      !errorText.includes(
        "support_messages_source_unique_idx",
      )
    ) {
      throw new Error(
        `SUPPORT_MESSAGE_SAVE:${errorText}`,
      );
    }
  }
}

async function closeOpenTicket(
  requesterTelegramId: number,
) {
  const currentTicket =
    await findOpenTicket(requesterTelegramId);

  if (!currentTicket) {
    return;
  }

  const response = await supabaseRequest(
    `support_tickets?id=eq.${currentTicket.id}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "closed",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `SUPPORT_TICKET_CLOSE:${await response.text()}`,
    );
  }
}

async function showAccount(
  chatId: number,
  telegramId: number,
) {
  const context =
    await getAccountContext(telegramId);

  if (!context) {
    await sendMessage(
      chatId,
      [
        "Аккаунт Zenvora не найден.",
        "",
        `Ваш Telegram ID: ${telegramId}`,
        "",
        "Откройте основного бота Zenvora и запустите Mini App хотя бы один раз. После этого вернитесь сюда и нажмите /start.",
      ].join("\n"),
    );

    return;
  }

  await sendMessage(
    chatId,
    buildAccountSummary(context),
    getAccountKeyboard(),
  );
}

async function handleCategory(
  chatId: number,
  telegramId: number,
  category: TicketCategory,
) {
  const context =
    await getAccountContext(telegramId);

  if (!context) {
    await showAccount(chatId, telegramId);
    return;
  }

  let text: string;

  switch (category) {
    case "connection":
      text = buildConnectionHelp(context);
      break;
    case "device":
      text = buildDeviceHelp(context);
      break;
    case "configuration":
      text = buildConfigurationHelp(context);
      break;
    case "payment":
      text = buildPaymentHelp(context);
      break;
    case "subscription":
      text = buildSubscriptionHelp(context);
      break;
    case "telegram_stars":
      text = buildProviderHelp(
        "telegram_stars",
        context,
      );
      break;
    case "crypto":
      text = buildProviderHelp("crypto", context);
      break;
    default:
      text = [
        "💬 Другая проблема",
        "",
        "Опишите проблему одним сообщением. После этого нажмите «Позвать оператора», и обращение будет передано в поддержку.",
      ].join("\n");
      break;
  }

  await sendMessage(
    chatId,
    text,
    getHelpResultKeyboard(category),
  );
}

async function handleCallbackQuery(
  callbackQuery: TelegramCallbackQuery,
) {
  const chatId =
    callbackQuery.message?.chat.id;

  if (!chatId) {
    await answerCallbackQuery(
      callbackQuery.id,
      "Чат не найден",
    );
    return;
  }

  const data = callbackQuery.data ?? "";

  await answerCallbackQuery(callbackQuery.id);

  if (
    data === "account:confirm" ||
    data === "menu:categories"
  ) {
    await sendMessage(
      chatId,
      "С чем нужна помощь?",
      getCategoriesKeyboard(),
    );
    return;
  }

  if (data === "account:refresh") {
    await showAccount(
      chatId,
      callbackQuery.from.id,
    );
    return;
  }

  if (data === "help:resolved") {
    await closeOpenTicket(
      callbackQuery.from.id,
    );

    await sendMessage(
      chatId,
      "Отлично! Обращение закрыто. При новой проблеме нажмите /start.",
    );
    return;
  }

  if (data.startsWith("category:")) {
    const category = data.slice(
      "category:".length,
    ) as TicketCategory;

    await handleCategory(
      chatId,
      callbackQuery.from.id,
      category,
    );
    return;
  }

  if (data.startsWith("operator:")) {
    const category = data.slice(
      "operator:".length,
    ) as TicketCategory;

    const context = await getAccountContext(
      callbackQuery.from.id,
    );

    if (!context) {
      await showAccount(
        chatId,
        callbackQuery.from.id,
      );
      return;
    }

    const ticket = await createOrEscalateTicket(
      callbackQuery.from,
      category,
      getCategoryTitle(category),
    );

    const topicId = await ensureOperatorTopic(
      ticket,
      callbackQuery.from,
      context,
    );

    await saveSupportMessage(
      ticket.id,
      "system",
      `Пользователь запросил оператора. Категория: ${getCategoryTitle(
        category,
      )}.`,
      callbackQuery.from.id,
    );

    await sendMessage(
      getSupportGroupChatId(),
      [
        "👤 Пользователь запросил оператора.",
        `Категория: ${getCategoryTitle(category)}`,
      ].join("\n"),
      undefined,
      topicId,
    );

    await sendMessage(
      chatId,
      [
        `Обращение №${ticket.id} создано.`,
        "",
        "Для него уже создана отдельная тема в группе поддержки.",
        "Напишите следующим сообщением, что произошло, на каком устройстве возникла проблема и какой текст ошибки вы видите.",
        "",
        "Ответ оператора придёт прямо сюда.",
      ].join("\n"),
    );

    return;
  }

  await sendMessage(
    chatId,
    "Команда устарела. Нажмите /start.",
  );
}

async function handleMessage(
  message: TelegramMessage,
) {
  const sender = message.from;

  if (!sender || sender.is_bot) {
    return;
  }

  const text = message.text?.trim() ?? "";

  const command =
    text.split(/\s+/)[0]?.toLowerCase() ?? "";
  const commandName = command.split("@")[0];

  if (commandName === "/id") {
    const topicId = message.message_thread_id;

    await telegramRequest("sendMessage", {
      chat_id: message.chat.id,
      text: [
        "🆔 Данные этого чата",
        "",
        `Chat ID: ${message.chat.id}`,
        `Topic ID: ${
          topicId ??
          "нет — сообщение отправлено вне темы"
        }`,
        `Тип чата: ${message.chat.type}`,
      ].join("\n"),
      disable_web_page_preview: true,
      ...(topicId
        ? {
            message_thread_id: topicId,
          }
        : {}),
    });

    return;
  }

  const supportGroupChatId =
    getSupportGroupChatId();

  if (message.chat.id === supportGroupChatId) {
    const topicId = message.message_thread_id;

    if (!topicId || !text) {
      return;
    }

    const ticket = await findTicketByTopic(topicId);

    if (!ticket) {
      await sendMessage(
        supportGroupChatId,
        "Для этой темы не найдено активное обращение.",
        undefined,
        topicId,
      );
      return;
    }

    if (commandName === "/close") {
      await updateTicketStatus(
        ticket.id,
        "closed",
      );

      await saveSupportMessage(
        ticket.id,
        "system",
        `Оператор ${sender.id} закрыл обращение.`,
        sender.id,
        message,
      );

      await sendMessage(
        ticket.requester_telegram_id,
        [
          `Обращение №${ticket.id} закрыто оператором.`,
          "",
          "При новой проблеме нажмите /start.",
        ].join("\n"),
      );

      await sendMessage(
        supportGroupChatId,
        `✅ Обращение №${ticket.id} закрыто.`,
        undefined,
        topicId,
      );

      try {
        await telegramRequest("closeForumTopic", {
          chat_id: supportGroupChatId,
          message_thread_id: topicId,
        });
      } catch (error) {
        console.error(
          "Не удалось закрыть тему:",
          error,
        );
      }

      return;
    }

    await sendMessage(
      ticket.requester_telegram_id,
      [
        "👨‍💻 Ответ поддержки Zenvora",
        "",
        text,
      ].join("\n"),
    );

    await saveSupportMessage(
      ticket.id,
      "operator",
      text,
      sender.id,
      message,
    );

    await updateTicketStatus(
      ticket.id,
      "waiting_user",
    );

    return;
  }

  if (
    text === "/start" ||
    text.startsWith("/start ")
  ) {
    await showAccount(
      message.chat.id,
      sender.id,
    );
    return;
  }

  const openTicket =
    await findOpenTicket(sender.id);

  if (openTicket && text) {
    const context =
      await getAccountContext(sender.id);

    if (!context) {
      await showAccount(
        message.chat.id,
        sender.id,
      );
      return;
    }

    const topicId = await ensureOperatorTopic(
      openTicket,
      sender,
      context,
    );

    await saveSupportMessage(
      openTicket.id,
      "user",
      text,
      sender.id,
      message,
    );

    const response = await supabaseRequest(
      `support_tickets?id=eq.${openTicket.id}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "waiting_operator",
          last_user_message_at:
            new Date().toISOString(),
          problem_summary: text.slice(0, 1000),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `SUPPORT_TICKET_MESSAGE_UPDATE:${await response.text()}`,
      );
    }

    await sendMessage(
      supportGroupChatId,
      [
        "👤 Сообщение пользователя",
        "",
        text,
      ].join("\n"),
      undefined,
      topicId,
    );

    await sendMessage(
      message.chat.id,
      [
        `Сообщение отправлено оператору в обращение №${openTicket.id}.`,
        "",
        "Ответ придёт в этот чат.",
      ].join("\n"),
    );

    return;
  }

  await showAccount(
    message.chat.id,
    sender.id,
  );
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

    const expectedSecret =
      getEnvironmentVariable(
        "SUPPORT_TELEGRAM_WEBHOOK_SECRET",
      );

    const receivedSecret =
      request.headers.get(
        "x-telegram-bot-api-secret-token",
      );

    if (
      !receivedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return sendJson(
        {
          ok: false,
          error: "Неверный секрет webhook",
        },
        401,
      );
    }

    let update: TelegramUpdate;

    try {
      update =
        (await request.json()) as TelegramUpdate;
    } catch {
      return sendJson(
        {
          ok: false,
          error: "Некорректное обновление Telegram",
        },
        400,
      );
    }

    try {
      if (update.callback_query) {
        await handleCallbackQuery(
          update.callback_query,
        );
      } else if (update.message) {
        await handleMessage(update.message);
      }

      return sendJson({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Ошибка support-bot-webhook:",
        error,
      );

      return sendJson({
        ok: true,
      });
    }
  },
};
