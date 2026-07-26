import {
  useEffect,
  useMemo,
  useState,
} from "react";
import "./App.css";

type Page = "home" | "connect" | "subscription" | "wallet" | "profile";

type PlanId = "1" | "3" | "12";

type TransactionStatus =
  | "pending"
  | "confirmed"
  | "declined";

type TransactionType = "deposit" | "subscription";

type SetupStatus =
  | "not-started"
  | "config-opened"
  | "checking"
  | "connected";

type DevicePlatform =
  | "ios"
  | "android"
  | "windows"
  | "macos"
  | "other";

type VpnDevice = {
  id: string;
  name: string;
  platform: DevicePlatform;
  status: "active" | "revoked";
  configUrl: string | null;
  createdAt: string;
};

type DeviceListPayload = {
  devices: VpnDevice[];
  used: number;
  limit: number;
};

type DevicesApiResponse =
  | {
      ok: true;
      devices: DeviceListPayload;
    }
  | {
      ok: true;
      device: VpnDevice & {
        used: number;
        limit: number;
      };
    }
  | {
      ok: true;
      result: {
        removed: boolean;
        id: string;
        used: number;
        limit: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

type Plan = {
  id: PlanId;
  months: number;
  title: string;
  price: number;
  oldPrice?: number;
  description: string;
  recommended?: boolean;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: TransactionType;
  status: TransactionStatus;
};

type ApiTransaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  provider: string;
  externalId: string;
  createdAt: string;
  updatedAt: string;
};

type ApiUser = {
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  balance: number;
  subscriptionEnd: string | null;
  activePlanTitle: string | null;
  setupStatus: SetupStatus;
};

type MeApiResponse =
  | {
      ok: true;
      user: ApiUser;
      transactions: ApiTransaction[];
    }
  | {
      ok: false;
      error: string;
    };

type BuySubscriptionApiResponse =
  | {
      ok: true;
      subscription: {
        balance: number;
        subscriptionEnd: string;
        activePlanTitle: string;
        setupStatus: SetupStatus;
      };
    }
  | {
      ok: false;
      error: string;
    };

type DepositAmount = 300 | 500 | 1000 | 2000;

type CreateCryptoInvoiceApiResponse =
  | {
      ok: true;
      invoice: {
        invoiceId: number;
        amount: DepositAmount;
        url: string;
        status: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

type InvoiceStatus =
  | "paid"
  | "cancelled"
  | "failed"
  | "pending";

type CreateStarsInvoiceApiResponse =
  | {
      ok: true;
      invoice: {
        amount: DepositAmount;
        stars: number;
        url: string;
        externalId: string;
        status: "pending";
      };
    }
  | {
      ok: false;
      error: string;
    };

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  openLink?: (url: string) => void;
  openInvoice?: (
    url: string,
    callback?: (status: InvoiceStatus) => void,
  ) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

let telegramSdkPromise:
  | Promise<TelegramWebApp | null>
  | null = null;

function loadTelegramSdk(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) {
    return Promise.resolve(window.Telegram.WebApp);
  }

  if (telegramSdkPromise) {
    return telegramSdkPromise;
  }

  telegramSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src =
      "https://telegram.org/js/telegram-web-app.js?59";

    script.async = true;
    script.dataset.telegramWebAppSdk = "true";

    script.onload = () => {
      resolve(window.Telegram?.WebApp ?? null);
    };

    script.onerror = () => {
      telegramSdkPromise = null;

      reject(
        new Error(
          "Не удалось загрузить Telegram Mini Apps SDK",
        ),
      );
    };

    document.head.appendChild(script);
  });

  return telegramSdkPromise;
}

const plans: Plan[] = [
  {
    id: "1",
    months: 1,
    title: "1 месяц",
    price: 299,
    description: "Чтобы попробовать Zenvora",
  },
  {
    id: "3",
    months: 3,
    title: "3 месяца",
    price: 749,
    oldPrice: 897,
    description: "Оптимальный вариант",
    recommended: true,
  },
  {
    id: "12",
    months: 12,
    title: "12 месяцев",
    price: 1990,
    oldPrice: 3588,
    description: "Максимальная выгода",
  },
];

const starsByDepositAmount: Record<DepositAmount, number> = {
  300: 160,
  500: 283,
  1000: 550,
  2000: 1000,
};

const devicePlatforms: Array<{
  id: DevicePlatform;
  icon: string;
  title: string;
}> = [
  { id: "ios", icon: "", title: "iPhone / iPad" },
  { id: "android", icon: "▶", title: "Android" },
  { id: "windows", icon: "▣", title: "Windows" },
  { id: "macos", icon: "⌘", title: "macOS" },
];

function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isTouchMac =
    userAgent.includes("macintosh") &&
    navigator.maxTouchPoints > 1;

  if (
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("ipod") ||
    isTouchMac
  ) {
    return "ios";
  }

  if (userAgent.includes("android")) {
    return "android";
  }

  if (userAgent.includes("windows")) {
    return "windows";
  }

  if (userAgent.includes("macintosh")) {
    return "macos";
  }

  return "other";
}

function getDevicePlatformLabel(
  platform: DevicePlatform,
) {
  return (
    devicePlatforms.find((item) => item.id === platform)
      ?.title ?? "Другое устройство"
  );
}

function getDevicePlatformIcon(
  platform: DevicePlatform,
) {
  return (
    devicePlatforms.find((item) => item.id === platform)
      ?.icon ?? "◇"
  );
}

function formatDeviceDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Дата неизвестна"
    : `Добавлено ${formatDate(date)}`;
}

function formatMoney(value: number) {
  return `${Math.abs(value).toLocaleString("ru-RU")} ₽`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function calculateDaysLeft(date: Date | null) {
  if (!date) {
    return 0;
  }

  const difference = date.getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(difference / (1000 * 60 * 60 * 24)),
  );
}

function parseSubscriptionDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function mapApiTransactions(
  apiTransactions: ApiTransaction[],
): Transaction[] {
  return apiTransactions.map((transaction) => {
    const createdAt = new Date(transaction.createdAt);
    const date = Number.isNaN(createdAt.getTime())
      ? transaction.createdAt
      : formatDateTime(createdAt);

    return {
      id: transaction.id,
      title: transaction.title,
      amount: transaction.amount,
      date,
      type: transaction.type,
      status: transaction.status,
    };
  });
}

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const [selectedPlanId, setSelectedPlanId] =
    useState<PlanId>("3");

  const [balance, setBalance] = useState(0);

  const [subscriptionEnd, setSubscriptionEnd] =
    useState<Date | null>(null);

  const [activePlanTitle, setActivePlanTitle] =
    useState("");

  const [setupStatus, setSetupStatus] =
    useState<SetupStatus>("not-started");

  const [telegramUser, setTelegramUser] =
    useState<ApiUser | null>(null);

  const [telegramInitData, setTelegramInitData] =
    useState("");

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [profileError, setProfileError] =
    useState<string | null>(null);

  const [purchaseLoading, setPurchaseLoading] =
    useState(false);

  const [purchaseError, setPurchaseError] =
    useState<string | null>(null);

  const [showDepositModal, setShowDepositModal] =
    useState(false);

  const [showSuccessModal, setShowSuccessModal] =
    useState(false);

  const [showBalanceModal, setShowBalanceModal] =
    useState(false);

  const [showTelegramModal, setShowTelegramModal] =
    useState(false);

  const [selectedDepositAmount, setSelectedDepositAmount] =
    useState<DepositAmount>(500);

  const [depositLoading, setDepositLoading] =
    useState(false);

  const [starsLoading, setStarsLoading] =
    useState(false);

  const [depositError, setDepositError] =
    useState<string | null>(null);

  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);

  const [devices, setDevices] = useState<VpnDevice[]>([]);

  const [deviceLimit, setDeviceLimit] = useState(5);

  const [devicesLoading, setDevicesLoading] =
    useState(false);

  const [deviceActionLoading, setDeviceActionLoading] =
    useState<string | null>(null);

  const [devicesError, setDevicesError] =
    useState<string | null>(null);

  const [deviceNotice, setDeviceNotice] =
    useState<string | null>(null);

  const [selectedDevicePlatform, setSelectedDevicePlatform] =
    useState<DevicePlatform>(() =>
      detectDevicePlatform(),
    );

  const [deviceName, setDeviceName] = useState(
    "Моё устройство",
  );

  const selectedPlan = useMemo(() => {
    return (
      plans.find((plan) => plan.id === selectedPlanId) ??
      plans[1]
    );
  }, [selectedPlanId]);

  const paymentLoading =
    depositLoading || starsLoading;

  const subscriptionActive =
    subscriptionEnd !== null &&
    subscriptionEnd.getTime() > Date.now();

  const daysLeft = calculateDaysLeft(subscriptionEnd);

  const pendingPayments = transactions.filter(
    (transaction) =>
      transaction.type === "deposit" &&
      transaction.status === "pending",
  );

  const profileName = telegramUser
    ? [telegramUser.firstName, telegramUser.lastName]
        .filter(Boolean)
        .join(" ")
    : "Пользователь";

  const profileInitial =
    telegramUser?.firstName
      .trim()
      .charAt(0)
      .toUpperCase() || "Z";

  const profileSubtitle = telegramUser
    ? telegramUser.username
      ? `@${telegramUser.username} · ID: ${telegramUser.telegramId}`
      : `Telegram ID: ${telegramUser.telegramId}`
    : profileLoading
      ? "Загружаем данные Telegram..."
      : "Откройте приложение через Telegram-бота";

  const avatarStyle = telegramUser?.photoUrl
    ? {
        backgroundImage: `url(${JSON.stringify(
          telegramUser.photoUrl,
        )})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }
    : undefined;

  useEffect(() => {
    const controller = new AbortController();

    async function loadTelegramProfile() {
      try {
        setProfileLoading(true);
        setProfileError(null);

        const telegramApp = await loadTelegramSdk();

        telegramApp?.ready();
        telegramApp?.expand();

        const initData = telegramApp?.initData ?? "";

        setTelegramInitData(initData);

        if (!initData) {
          setProfileError(null);
          setTelegramUser(null);
          return;
        }

        const response = await fetch("/api/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initData,
          }),
          signal: controller.signal,
        });

        const contentType =
          response.headers.get("content-type") ?? "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            `Сервер вернул ошибку ${response.status}`,
          );
        }

        const result =
          (await response.json()) as MeApiResponse;

        if (!response.ok || result.ok === false) {
          const message =
            result.ok === false
              ? result.error
              : "Не удалось загрузить профиль";

          throw new Error(message);
        }

        setTelegramUser(result.user);
        setBalance(result.user.balance);

        setSubscriptionEnd(
          parseSubscriptionDate(
            result.user.subscriptionEnd,
          ),
        );

        setActivePlanTitle(
          result.user.activePlanTitle ?? "",
        );

        setSetupStatus(result.user.setupStatus);
        setTransactions(
          mapApiTransactions(result.transactions),
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить профиль";

        setProfileError(message);
      } finally {
        if (!controller.signal.aborted) {
          setProfileLoading(false);
        }
      }
    }

    void loadTelegramProfile();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [page]);

  useEffect(() => {
    if (!telegramInitData || !subscriptionActive) {
      setDevices([]);
      return;
    }

    void loadDevices(telegramInitData);
  }, [telegramInitData, subscriptionActive]);

  useEffect(() => {
    if (
      !telegramInitData ||
      pendingPayments.length === 0
    ) {
      return;
    }

    let stopped = false;

    async function refreshPendingPayments() {
      if (
        stopped ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      try {
        await refreshProfileFromServer(
          telegramInitData,
        );
      } catch {
        // Следующая проверка повторит запрос.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshPendingPayments();
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshPendingPayments();
      }
    }

    function handleWindowFocus() {
      void refreshPendingPayments();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    void refreshPendingPayments();

    return () => {
      stopped = true;
      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );
    };
  }, [
    telegramInitData,
    pendingPayments.length,
  ]);

  function changePage(nextPage: Page) {
    setPage(nextPage);
    setPurchaseError(null);
  }

  function requireTelegram() {
    const currentInitData =
      telegramInitData ||
      window.Telegram?.WebApp?.initData ||
      "";

    if (currentInitData) {
      if (!telegramInitData) {
        setTelegramInitData(currentInitData);
      }

      return currentInitData;
    }

    setShowDepositModal(false);
    setShowBalanceModal(false);
    setShowTelegramModal(true);

    return null;
  }

  function openDepositModal() {
    const initData = requireTelegram();

    if (!initData) {
      return;
    }

    setDepositError(null);
    setShowDepositModal(true);
  }

  async function buySubscription() {
    const initData = requireTelegram();

    if (!initData || purchaseLoading) {
      return;
    }

    if (profileLoading) {
      setPurchaseError(
        "Дождитесь окончания загрузки профиля.",
      );

      return;
    }

    if (balance < selectedPlan.price) {
      setShowBalanceModal(true);
      return;
    }

    try {
      setPurchaseLoading(true);
      setPurchaseError(null);

      const response = await fetch(
        "/api/buy-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initData,
            planId: selectedPlan.id,
          }),
        },
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Сервер вернул ошибку ${response.status}`,
        );
      }

      const result =
        (await response.json()) as BuySubscriptionApiResponse;

      if (result.ok === false) {
        if (
          response.status === 409 ||
          result.error === "Недостаточно средств"
        ) {
          setShowBalanceModal(true);
          return;
        }

        throw new Error(result.error);
      }

      if (!response.ok) {
        throw new Error(
          `Сервер вернул ошибку ${response.status}`,
        );
      }

      const newSubscriptionEnd =
        parseSubscriptionDate(
          result.subscription.subscriptionEnd,
        );

      if (!newSubscriptionEnd) {
        throw new Error(
          "Сервер вернул неправильную дату подписки",
        );
      }

      setBalance(result.subscription.balance);

      setSubscriptionEnd(newSubscriptionEnd);

      setActivePlanTitle(
        result.subscription.activePlanTitle,
      );

      setSetupStatus(
        result.subscription.setupStatus,
      );

      setTransactions((currentTransactions) => [
        {
          id: `subscription-local:${Date.now()}`,
          title: `Подписка на ${selectedPlan.title}`,
          amount: -selectedPlan.price,
          date: formatDateTime(new Date()),
          type: "subscription",
          status: "confirmed",
        },
        ...currentTransactions,
      ]);

      void refreshProfileFromServer(initData);
      setShowSuccessModal(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось оформить подписку";

      setPurchaseError(message);
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function createCryptoInvoice() {
    const initData = requireTelegram();

    if (!initData || paymentLoading) {
      return;
    }

    try {
      setDepositLoading(true);
      setDepositError(null);

      const response = await fetch(
        "/api/create-crypto-invoice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initData,
            amount: selectedDepositAmount,
          }),
        },
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Сервер вернул ошибку ${response.status}`,
        );
      }

      const result =
        (await response.json()) as CreateCryptoInvoiceApiResponse;

      if (result.ok === false) {
        throw new Error(result.error);
      }

      if (!response.ok || !result.invoice.url) {
        throw new Error(
          `Не удалось создать счёт: ${response.status}`,
        );
      }

      setTransactions((currentTransactions) => [
        {
          id: `crypto:${result.invoice.invoiceId}`,
          title: "Пополнение через Crypto Bot",
          amount: selectedDepositAmount,
          date: formatDateTime(new Date()),
          type: "deposit",
          status: "pending",
        },
        ...currentTransactions,
      ]);

      setShowDepositModal(false);
      openExternalLink(result.invoice.url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось создать ссылку на оплату";

      setDepositError(message);
    } finally {
      setDepositLoading(false);
    }
  }

  async function refreshProfileFromServer(
    initData: string,
  ) {
    const response = await fetch("/api/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initData }),
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return;
    }

    const result =
      (await response.json()) as MeApiResponse;

    if (!response.ok || result.ok === false) {
      return;
    }

    setTelegramUser(result.user);
    setBalance(result.user.balance);
    setSubscriptionEnd(
      parseSubscriptionDate(result.user.subscriptionEnd),
    );
    setActivePlanTitle(
      result.user.activePlanTitle ?? "",
    );
    setSetupStatus(result.user.setupStatus);
    setTransactions(
      mapApiTransactions(result.transactions),
    );
  }

  async function declinePayment(
    initData: string,
    provider: "telegram_stars" | "crypto_bot",
    externalId: string,
  ) {
    const response = await fetch(
      "/api/decline-payment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          initData,
          provider,
          externalId,
        }),
      },
    );

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Сервер вернул ошибку ${response.status}`,
      );
    }

    const result = (await response.json()) as
      | {
          ok: true;
          result: unknown;
        }
      | {
          ok: false;
          error: string;
        };

    if (!response.ok || result.ok === false) {
      throw new Error(
        result.ok === false
          ? result.error
          : "Не удалось обновить статус платежа",
      );
    }
  }

  async function refreshAfterStarsPayment(
    initData: string,
  ) {
    for (const delay of [1200, 2500, 5000]) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, delay);
      });

      try {
        await refreshProfileFromServer(initData);
      } catch {
        // Следующая попытка обновит баланс.
      }
    }
  }

  async function createStarsInvoice() {
    const initData = requireTelegram();

    if (!initData || paymentLoading) {
      return;
    }

    const telegramApp = window.Telegram?.WebApp;

    if (!telegramApp?.openInvoice) {
      setDepositError(
        "Обновите Telegram: эта версия не поддерживает оплату Stars.",
      );
      return;
    }

    try {
      setStarsLoading(true);
      setDepositError(null);

      const response = await fetch(
        "/api/create-stars-invoice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initData,
            amount: selectedDepositAmount,
          }),
        },
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Сервер вернул ошибку ${response.status}`,
        );
      }

      const result =
        (await response.json()) as CreateStarsInvoiceApiResponse;

      if (result.ok === false) {
        throw new Error(result.error);
      }

      if (!response.ok || !result.invoice.url) {
        throw new Error(
          `Не удалось создать счёт: ${response.status}`,
        );
      }

      setTransactions((currentTransactions) => {
        const withoutDuplicate =
          currentTransactions.filter(
            (transaction) =>
              transaction.id !==
              `stars:${result.invoice.externalId}`,
          );

        return [
          {
            id: `stars:${result.invoice.externalId}`,
            title: "Пополнение через Telegram Stars",
            amount: result.invoice.amount,
            date: formatDateTime(new Date()),
            type: "deposit",
            status: "pending",
          },
          ...withoutDuplicate,
        ];
      });

      telegramApp.openInvoice(
        result.invoice.url,
        (status) => {
          setStarsLoading(false);
          setShowDepositModal(false);

          if (status === "paid" || status === "pending") {
            void refreshAfterStarsPayment(initData);
            return;
          }

          if (
            status === "cancelled" ||
            status === "failed"
          ) {
            void (async () => {
              try {
                await declinePayment(
                  initData,
                  "telegram_stars",
                  result.invoice.externalId,
                );

                await refreshProfileFromServer(
                  initData,
                );
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Не удалось обновить статус платежа";

                setDepositError(message);
              }
            })();

            if (status === "failed") {
              setDepositError(
                "Telegram не смог завершить платёж. Попробуйте ещё раз.",
              );
            }
          }
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось создать счёт Telegram Stars";

      setStarsLoading(false);
      setDepositError(message);
    }
  }

  function openExternalLink(url: string) {
    const telegramApp = window.Telegram?.WebApp;

    if (telegramApp?.openLink) {
      telegramApp.openLink(url);
      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openSupportBot() {
  const url = "https://t.me/Zenvorasupport_bot?start=miniapp";

  const telegramApp = window.Telegram?.WebApp as
    | {
        openTelegramLink?: (url: string) => void;
      }
    | undefined;

  if (telegramApp?.openTelegramLink) {
    telegramApp.openTelegramLink(url);
    return;
  }

  window.location.href = url;
}

  function openIphoneApp() {
    openExternalLink(
      "https://apps.apple.com/app/hiddify-proxy-vpn/id6596777532",
    );
  }

  function openAndroidApp() {
    openExternalLink(
      "https://play.google.com/store/apps/details?id=app.hiddify.com",
    );
  }

  function openInstruction() {
    setDeviceNotice(
      "Выберите платформу, назовите устройство и нажмите «Добавить устройство». После подключения VPN-сервера здесь появится персональная ссылка для импорта.",
    );
  }

  async function callDevicesApi(
    initData: string,
    payload: Record<string, unknown>,
  ) {
    const response = await fetch("/api/devices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initData,
        ...payload,
      }),
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Сервер вернул ошибку ${response.status}`,
      );
    }

    const result =
      (await response.json()) as DevicesApiResponse;

    if (!response.ok || result.ok === false) {
      throw new Error(
        result.ok === false
          ? result.error
          : "Не удалось выполнить операцию с устройством",
      );
    }

    return result;
  }

  async function loadDevices(initData: string) {
    try {
      setDevicesLoading(true);
      setDevicesError(null);

      const result = await callDevicesApi(initData, {
        action: "list",
      });

      if (!("devices" in result)) {
        throw new Error(
          "Сервер вернул неправильный список устройств",
        );
      }

      setDevices(result.devices.devices);
      setDeviceLimit(result.devices.limit);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить устройства";

      setDevicesError(message);
    } finally {
      setDevicesLoading(false);
    }
  }

  async function createDevice() {
    const initData = requireTelegram();

    if (!initData || deviceActionLoading) {
      return;
    }

    const normalizedName = deviceName.trim();

    if (!normalizedName) {
      setDevicesError("Введите название устройства.");
      return;
    }

    if (devices.length >= deviceLimit) {
      setDevicesError(
        `Достигнут лимит: можно подключить не больше ${deviceLimit} устройств.`,
      );
      return;
    }

    try {
      setDeviceActionLoading("create");
      setDevicesError(null);
      setDeviceNotice(null);

      const result = await callDevicesApi(initData, {
        action: "create",
        deviceName: normalizedName,
        platform: selectedDevicePlatform,
      });

      if (!("device" in result)) {
        throw new Error(
          "Сервер не вернул созданное устройство",
        );
      }

      setDevices((currentDevices) => [
        result.device,
        ...currentDevices.filter(
          (device) => device.id !== result.device.id,
        ),
      ]);

      setDeviceLimit(result.device.limit);
      setSetupStatus("config-opened");
      setDeviceName("");
      setDeviceNotice(
        `Устройство «${result.device.name}» добавлено. Место в лимите занято. Реальную конфигурацию подключим после настройки VPN-сервера.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось добавить устройство";

      setDevicesError(message);
    } finally {
      setDeviceActionLoading(null);
    }
  }

  async function revokeDevice(device: VpnDevice) {
    const initData = requireTelegram();

    if (!initData || deviceActionLoading) {
      return;
    }

    const confirmed = window.confirm(
      `Отвязать устройство «${device.name}»? Его место освободится.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeviceActionLoading(device.id);
      setDevicesError(null);
      setDeviceNotice(null);

      const result = await callDevicesApi(initData, {
        action: "revoke",
        deviceId: device.id,
      });

      if (!("result" in result)) {
        throw new Error(
          "Сервер не подтвердил удаление устройства",
        );
      }

      setDevices((currentDevices) =>
        currentDevices.filter(
          (currentDevice) =>
            currentDevice.id !== device.id,
        ),
      );

      setDeviceLimit(result.result.limit);

      if (result.result.used === 0) {
        setSetupStatus("not-started");
      }

      setDeviceNotice(
        `Устройство «${device.name}» отвязано. Теперь можно добавить другое.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось отвязать устройство";

      setDevicesError(message);
    } finally {
      setDeviceActionLoading(null);
    }
  }

  function checkConnection() {
    if (devices.length === 0) {
      setDevicesError(
        "Сначала добавьте хотя бы одно устройство.",
      );
      return;
    }

    setDevicesError(null);
    setSetupStatus("checking");

    window.setTimeout(() => {
      setSetupStatus("connected");
    }, 1800);
  }

  function getTransactionStatusText(
    status: TransactionStatus,
  ) {
    if (status === "confirmed") {
      return "Подтверждено";
    }

    if (status === "declined") {
      return "Отклонено";
    }

    return "Проверяем платёж";
  }

  function renderPublicHome() {
    return (
      <>
        <section className="hero">
          <div className="heroBadge">
            <span />
            Стабильное подключение
          </div>

          <h1>
            Надёжный и быстрый <strong>VPN</strong>
          </h1>

          <p>
            Высокая скорость, защита данных и доступ к
            нужным сервисам без лишних настроек.
          </p>

          <button
            className="primaryButton"
            type="button"
            onClick={() =>
              changePage("subscription")
            }
          >
            Оформить подписку
            <span>›</span>
          </button>
        </section>

        <section className="features">
          <article className="featureCard">
            <div className="featureIcon">⚡</div>

            <div>
              <strong>Высокая скорость</strong>
              <p>
                Стабильное соединение без ограничений
              </p>
            </div>
          </article>

          <article className="featureCard">
            <div className="featureIcon">🔒</div>

            <div>
              <strong>Защита данных</strong>
              <p>
                Безопасное использование любых сетей
              </p>
            </div>
          </article>

          <article className="featureCard">
            <div className="featureIcon">🌍</div>

            <div>
              <strong>Доступ к сайтам</strong>
              <p>
                Автоматический обход ограничений
              </p>
            </div>
          </article>
        </section>

        {pendingPayments.length > 0 && (
          <button
            className="paymentPendingBanner"
            type="button"
            onClick={() => changePage("wallet")}
          >
            <div className="pendingSpinner" />

            <div>
              <strong>Проверяем платёж</strong>

              <p>
                Баланс обновится автоматически после
                подтверждения.
              </p>
            </div>

            <span>›</span>
          </button>
        )}

        <section className="smallBalanceCard">
          <div>
            <span>Баланс</span>
            <strong>{formatMoney(balance)}</strong>
          </div>

          <button
            type="button"
            onClick={openDepositModal}
          >
            Пополнить
          </button>
        </section>
      </>
    );
  }

  function renderActiveHome() {
    const renewalWarning = daysLeft <= 7;
    const connectionReady = setupStatus === "connected";

    return (
      <section className="setupPage">
        <div className="setupTitle">
          <span>ПОДПИСКА АКТИВНА</span>

          <h1>Ваш Zenvora готов</h1>

          <p>
            Управляйте подпиской и подключайте до пяти
            устройств.
          </p>
        </div>

        {renewalWarning && (
          <section className="notificationCard">
            <span>⚠️</span>

            <p>
              Подписка закончится через {daysLeft} {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}.
              Продлите её заранее, чтобы VPN продолжил работать.
            </p>
          </section>
        )}

        <section className="connectedInfo">
          <div>
            <span>Статус</span>
            <strong className="greenText">Активна</strong>
          </div>

          <div>
            <span>Тариф</span>
            <strong>{activePlanTitle || "Zenvora Premium"}</strong>
          </div>

          <div>
            <span>Осталось</span>
            <strong>{daysLeft} дней</strong>
          </div>

          <div>
            <span>Действует до</span>
            <strong>
              {subscriptionEnd ? formatDate(subscriptionEnd) : "—"}
            </strong>
          </div>
        </section>

        <button
          className="primaryButton"
          type="button"
          onClick={() => changePage("connect")}
        >
          {connectionReady ? "Открыть подключение" : "Подключиться"}
          <span>›</span>
        </button>

        <button
          className="menuCard"
          type="button"
          onClick={() => changePage("connect")}
        >
          <span className="menuIcon">⌁</span>

          <div>
            <strong>Мои устройства</strong>
            <small>Использовано {devices.length} из {deviceLimit}</small>
          </div>

          <b>›</b>
        </button>

        <button
          className="menuCard"
          type="button"
          onClick={() => changePage("subscription")}
        >
          <span className="menuIcon">↻</span>

          <div>
            <strong>Продлить подписку</strong>
            <small>Новые дни добавятся к текущему сроку</small>
          </div>

          <b>›</b>
        </button>

        <section className="notificationCard">
          <span>🔔</span>

          <p>
            Бот предупредит вас за 7, 3 и 1 день до окончания
            подписки.
          </p>
        </section>
      </section>
    );
  }

  function renderConnectPage() {
    const limitReached = devices.length >= deviceLimit;

    return (
      <section className="setupPage">
        <div className="pageHeader">
          <button
            className="backButton"
            type="button"
            onClick={() => changePage("home")}
          >
            ‹
          </button>

          <div>
            <small>ПОДКЛЮЧЕНИЕ</small>
            <h2>Настройка VPN</h2>
          </div>
        </div>

        <div className="setupTitle">
          <span>ДО {deviceLimit} УСТРОЙСТВ</span>
          <h1>Подключите устройство</h1>
          <p>
            Каждое добавленное устройство занимает одно место.
            Ненужное устройство можно отвязать в любой момент.
          </p>
        </div>

        <div className="sectionTitle">
          <strong>Мои устройства</strong>
          <small>
            {devices.length} из {deviceLimit}
          </small>
        </div>

        {devicesLoading && (
          <section className="walletPendingCard">
            <div className="pendingSpinner" />
            <div>
              <strong>Загружаем устройства</strong>
              <p>Получаем актуальный список из Supabase.</p>
            </div>
          </section>
        )}

        {devicesError && (
          <section className="walletPendingCard">
            <span className="instructionIcon">!</span>
            <div>
              <strong>Не удалось выполнить действие</strong>
              <p>{devicesError}</p>
            </div>
          </section>
        )}

        {deviceNotice && (
          <section className="notificationCard">
            <span>✓</span>
            <p>{deviceNotice}</p>
          </section>
        )}

        {!devicesLoading && devices.length === 0 && (
          <div className="emptyState">
            Подключённых устройств пока нет
          </div>
        )}

        {devices.map((device) => (
          <article className="menuCard" key={device.id}>
            <span className="menuIcon">
              {getDevicePlatformIcon(device.platform)}
            </span>

            <div>
              <strong>{device.name}</strong>
              <small>
                {getDevicePlatformLabel(device.platform)} · {formatDeviceDate(device.createdAt)}
              </small>
            </div>

            <button
              type="button"
              onClick={() => void revokeDevice(device)}
              disabled={deviceActionLoading !== null}
              aria-busy={deviceActionLoading === device.id}
              style={{
                minWidth: "62px",
                padding: "9px 10px",
                border: "1px solid rgba(255, 107, 123, 0.22)",
                borderRadius: "12px",
                color: "#ff8e9b",
                background: "rgba(255, 78, 98, 0.07)",
                fontSize: "8px",
                fontWeight: 700,
              }}
            >
              {deviceActionLoading === device.id
                ? "Удаляем..."
                : "Отвязать"}
            </button>
          </article>
        ))}

        <div className="progressLine">
          <span className="active" />
          <span className="active" />
          <span
            className={
              devices.length > 0 ? "active" : ""
            }
          />
        </div>

        <div className="setupList">
          <article className="setupCard">
            <div className="stepNumber">1</div>
            <div className="stepContent">
              <small>ПЕРВЫЙ ШАГ</small>
              <h3>Установите приложение</h3>
              <p>
                Скачайте клиент для устройства, которое хотите
                подключить.
              </p>

              <div className="appButtons">
                <button
                  type="button"
                  onClick={openIphoneApp}
                >
                  <span className="appIcon"></span>
                  <div>
                    <small>Скачать для</small>
                    <strong>iPhone / iPad</strong>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={openAndroidApp}
                >
                  <span className="appIcon">▶</span>
                  <div>
                    <small>Скачать для</small>
                    <strong>Android</strong>
                  </div>
                </button>
              </div>
            </div>
          </article>

          <article className="setupCard">
            <div className="stepNumber">2</div>
            <div className="stepContent">
              <small>ВТОРОЙ ШАГ</small>
              <h3>Выберите устройство</h3>
              <p>
                Укажите платформу и понятное название, например
                «Мой iPhone» или «Ноутбук».
              </p>

              <div className="appButtons">
                {devicePlatforms.map((platform) => {
                  const selected =
                    selectedDevicePlatform === platform.id;

                  return (
                    <button
                      type="button"
                      key={platform.id}
                      onClick={() =>
                        setSelectedDevicePlatform(platform.id)
                      }
                      style={{
                        borderColor: selected
                          ? "rgba(112, 151, 255, 0.72)"
                          : undefined,
                        background: selected
                          ? "rgba(75, 112, 224, 0.18)"
                          : undefined,
                      }}
                    >
                      <span className="appIcon">
                        {platform.icon}
                      </span>
                      <div>
                        <small>
                          {selected ? "Выбрано" : "Платформа"}
                        </small>
                        <strong>{platform.title}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={deviceName}
                maxLength={60}
                placeholder="Название устройства"
                onChange={(event) =>
                  setDeviceName(event.target.value)
                }
                style={{
                  width: "100%",
                  marginTop: "11px",
                  padding: "13px 14px",
                  border: "1px solid rgba(99, 139, 255, 0.18)",
                  borderRadius: "15px",
                  outline: "none",
                  color: "#f7f8ff",
                  background: "rgba(66, 103, 216, 0.075)",
                  fontSize: "10px",
                }}
              />

              <button
                className="instructionCard"
                type="button"
                onClick={openInstruction}
                style={{ marginTop: "10px" }}
              >
                <span className="instructionIcon">?</span>
                <div>
                  <strong>Как это работает</strong>
                  <small>Показать короткое пояснение</small>
                </div>
                <b>›</b>
              </button>
            </div>
          </article>

          <article
            className={`setupCard ${
              devices.length > 0
                ? "setupCardCompleted"
                : ""
            }`}
          >
            <div className="stepNumber">
              {devices.length > 0 ? "✓" : "3"}
            </div>

            <div className="stepContent">
              <small>ПОСЛЕДНИЙ ШАГ</small>
              <h3>Добавьте конфигурацию</h3>
              <p>
                Сейчас создаётся запись устройства и занимается
                место в лимите. Реальную VPN-ссылку добавим после
                подключения сервера.
              </p>

              <button
                className="primaryButton"
                type="button"
                onClick={() => void createDevice()}
                disabled={
                  deviceActionLoading !== null || limitReached
                }
                aria-busy={deviceActionLoading === "create"}
              >
                {limitReached
                  ? "Лимит устройств достигнут"
                  : deviceActionLoading === "create"
                    ? "Добавляем..."
                    : "Добавить устройство"}
                <span>›</span>
              </button>

              {devices.length > 0 &&
                setupStatus !== "checking" &&
                setupStatus !== "connected" && (
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={checkConnection}
                    style={{ marginTop: "10px" }}
                  >
                    Проверить подключение
                  </button>
                )}

              {setupStatus === "checking" && (
                <div className="checkingBlock">
                  <div className="checkingSpinner" />
                  <div>
                    <strong>Проверяем подключение</strong>
                    <p>Это займёт несколько секунд</p>
                  </div>
                </div>
              )}

              {setupStatus === "connected" && (
                <div className="configNotice">
                  <span>✓</span>
                  <div>
                    <strong>Проверка завершена</strong>
                    <p>
                      Интерфейс работает. Настоящую проверку
                      включим после настройки VPN-сервера.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        <section className="subscriptionSummary">
          <div>
            <span>Устройства</span>
            <strong>
              {devices.length} из {deviceLimit}
            </strong>
          </div>
          <div>
            <span>Осталось</span>
            <strong>{daysLeft} дней</strong>
          </div>
        </section>
      </section>
    );
  }

  function renderHome() {
    if (!subscriptionActive) {
      return renderPublicHome();
    }

    return renderActiveHome();
  }

  return (
    <div className="app">
      <div className="backgroundOrb orbOne" />
      <div className="backgroundOrb orbTwo" />

      <main className="appContainer">
        <header className="topHeader">
          <button
            className="brandButton"
            type="button"
            onClick={() => changePage("home")}
          >
            <span className="logo">Z</span>

            <span className="brandText">
              <small>PREMIUM VPN</small>
              <strong>ZENVORA</strong>
            </span>
          </button>

          <button
            className="avatarButton"
            type="button"
            style={avatarStyle}
            onClick={() => changePage("profile")}
            aria-label="Открыть профиль"
          >
            {!telegramUser?.photoUrl &&
              profileInitial}
          </button>
        </header>

        <div className="pageContent">
          {profileLoading && (
            <section className="walletPendingCard">
              <div className="pendingSpinner" />

              <div>
                <strong>
                  Загружаем профиль
                </strong>

                <p>
                  Проверяем данные Telegram и
                  подключение.
                </p>
              </div>
            </section>
          )}

          {profileError && (
            <section className="walletPendingCard">
              <span className="instructionIcon">
                !
              </span>

              <div>
                <strong>
                  Профиль не загружен
                </strong>

                <p>{profileError}</p>
              </div>
            </section>
          )}

          {page === "home" && (
            <section className="page homePage">
              {renderHome()}
            </section>
          )}

          {page === "connect" && (
            <section className="page">
              {renderConnectPage()}
            </section>
          )}

          {page === "subscription" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() =>
                    changePage("home")
                  }
                >
                  ‹
                </button>

                <div>
                  <small>PREMIUM</small>
                  <h2>Выберите тариф</h2>
                </div>
              </div>

              <div className="plansList">
                {plans.map((plan) => {
                  const selected =
                    selectedPlanId === plan.id;

                  return (
                    <button
                      className={`planCard ${
                        selected
                          ? "planCardSelected"
                          : ""
                      }`}
                      type="button"
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setPurchaseError(null);
                      }}
                    >
                      <span className="planRadio">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="planContent">
                        <span className="planTitleRow">
                          <strong>
                            {plan.title}
                          </strong>

                          {plan.recommended && (
                            <small className="recommendedBadge">
                              ВЫГОДНО
                            </small>
                          )}
                        </span>

                        <small>
                          {plan.description}
                        </small>
                      </span>

                      <span className="planPrice">
                        {plan.oldPrice && (
                          <small>
                            {formatMoney(
                              plan.oldPrice,
                            )}
                          </small>
                        )}

                        <strong>
                          {formatMoney(plan.price)}
                        </strong>
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="orderCard">
                <div>
                  <span>
                    Выбранный тариф
                  </span>

                  <strong>
                    {selectedPlan.title}
                  </strong>
                </div>

                <div>
                  <span>К оплате</span>

                  <strong>
                    {formatMoney(
                      selectedPlan.price,
                    )}
                  </strong>
                </div>
              </section>

              <section className="walletNotice">
                <div>
                  <span>
                    Баланс кошелька
                  </span>

                  <strong>
                    {formatMoney(balance)}
                  </strong>
                </div>

                {balance <
                  selectedPlan.price && (
                  <p>
                    Недостаточно средств. Пополните
                    баланс перед оформлением.
                  </p>
                )}
              </section>

              {purchaseError && (
                <section className="walletPendingCard">
                  <span className="instructionIcon">
                    !
                  </span>

                  <div>
                    <strong>
                      Не удалось оформить подписку
                    </strong>

                    <p>{purchaseError}</p>
                  </div>
                </section>
              )}

              <button
                className="primaryButton"
                type="button"
                onClick={buySubscription}
                disabled={purchaseLoading}
                aria-busy={purchaseLoading}
              >
                {purchaseLoading
                  ? "Оформляем..."
                  : `Оформить за ${formatMoney(
                      selectedPlan.price,
                    )}`}

                <span>›</span>
              </button>
            </section>
          )}

          {page === "wallet" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() =>
                    changePage("home")
                  }
                >
                  ‹
                </button>

                <div>
                  <small>ФИНАНСЫ</small>
                  <h2>Кошелёк</h2>
                </div>
              </div>

              <section className="walletCard">
                <span>
                  Доступный баланс
                </span>

                <strong>
                  {formatMoney(balance)}
                </strong>

                <button
                  type="button"
                  onClick={openDepositModal}
                >
                  <span>＋</span>
                  Пополнить баланс
                </button>
              </section>

              {pendingPayments.length > 0 && (
                <section className="walletPendingCard">
                  <div className="pendingSpinner" />

                  <div>
                    <strong>
                      Платёж проверяется
                    </strong>

                    <p>
                      Баланс изменится автоматически
                      после подтверждения оплаты.
                    </p>
                  </div>
                </section>
              )}

              <div className="sectionTitle">
                <strong>
                  История операций
                </strong>

                <small>
                  {transactions.length} операций
                </small>
              </div>

              <div className="transactionsList">
                {transactions.length === 0 && (
                  <div className="emptyState">
                    Операций пока нет
                  </div>
                )}

                {transactions.map(
                  (transaction) => (
                    <article
                      className="transactionCard"
                      key={transaction.id}
                    >
                      <span
                        className={`transactionIcon ${
                          transaction.type ===
                          "deposit"
                            ? "depositIcon"
                            : "subscriptionIcon"
                        }`}
                      >
                        {transaction.type ===
                        "deposit"
                          ? "↓"
                          : "◇"}
                      </span>

                      <div className="transactionContent">
                        <strong>
                          {transaction.title}
                        </strong>

                        <span>
                          {transaction.date}
                        </span>

                        <small
                          className={`transactionStatus ${transaction.status}`}
                        >
                          {getTransactionStatusText(
                            transaction.status,
                          )}
                        </small>
                      </div>

                      <strong
                        className={
                          transaction.amount > 0
                            ? "positiveAmount"
                            : "negativeAmount"
                        }
                      >
                        {transaction.amount > 0
                          ? "+"
                          : "−"}

                        {formatMoney(
                          transaction.amount,
                        )}
                      </strong>
                    </article>
                  ),
                )}
              </div>
            </section>
          )}

          {page === "profile" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() =>
                    changePage("home")
                  }
                >
                  ‹
                </button>

                <div>
                  <small>АККАУНТ</small>
                  <h2>Профиль</h2>
                </div>
              </div>

              <section className="profileCard">
                <div
                  className="profileAvatar"
                  style={avatarStyle}
                >
                  {!telegramUser?.photoUrl &&
                    profileInitial}
                </div>

                <div className="profileName">
                  <strong>
                    {profileName}
                  </strong>

                  <span>
                    {profileSubtitle}
                  </span>
                </div>

                <small
                  className={
                    subscriptionActive
                      ? "premiumStatus"
                      : "inactiveStatus"
                  }
                >
                  {subscriptionActive
                    ? "PREMIUM"
                    : "БЕЗ ПОДПИСКИ"}
                </small>
              </section>

              <section className="profileBalance">
                <div>
                  <span>Баланс</span>

                  <strong>
                    {formatMoney(balance)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={openDepositModal}
                >
                  Пополнить
                </button>
              </section>

              <section className="subscriptionCard">
                <div className="subscriptionHeader">
                  <span>◇</span>

                  <div>
                    <small>
                      Статус подписки
                    </small>

                    <strong>
                      {subscriptionActive
                        ? "Подписка активна"
                        : "Подписка не оформлена"}
                    </strong>
                  </div>
                </div>

                {subscriptionActive &&
                subscriptionEnd ? (
                  <div className="subscriptionDetails">
                    <div>
                      <span>Тариф</span>

                      <strong>
                        {activePlanTitle}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Действует до
                      </span>

                      <strong>
                        {formatDate(
                          subscriptionEnd,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Осталось</span>

                      <strong>
                        {daysLeft} дней
                      </strong>
                    </div>

                    <div>
                      <span>VPN</span>

                      <strong
                        className={
                          setupStatus ===
                          "connected"
                            ? "greenText"
                            : ""
                        }
                      >
                        {setupStatus ===
                        "connected"
                          ? "Подключён"
                          : "Не настроен"}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() =>
                      changePage(
                        "subscription",
                      )
                    }
                  >
                    Оформить подписку
                  </button>
                )}
              </section>

              {subscriptionActive &&
                setupStatus !== "connected" && (
                  <button
                    className="menuCard"
                    type="button"
                    onClick={() =>
                      changePage("home")
                    }
                  >
                    <span className="menuIcon">
                      ⚙
                    </span>

                    <div>
                      <strong>
                        Настроить VPN
                      </strong>

                      <small>
                        Установка приложения и
                        конфигурации
                      </small>
                    </div>

                    <b>›</b>
                  </button>
                )}

              <button
                className="menuCard"
                type="button"
                onClick={() =>
                  changePage("wallet")
                }
              >
                <span className="menuIcon">
                  ₽
                </span>

                <div>
                  <strong>
                    Кошелёк и платежи
                  </strong>

                  <small>
                    Баланс и история операций
                  </small>
                </div>

                <b>›</b>
              </button>

              <button
                className="menuCard"
                type="button"
                onClick={openSupportBot}
              >
                <span className="menuIcon">
                  ?
                </span>

                <div>
                  <strong>Поддержка</strong>

                  <small>
                    Помощь и ответы на вопросы
                  </small>
                </div>

                <b>›</b>
              </button>

              <section className="notificationCard">
                <span>🔔</span>

                <p>
                  Бот уведомит вас за 7, 3 и 1 день
                  до окончания подписки.
                </p>
              </section>
            </section>
          )}
        </div>

        <nav className="bottomNavigation">
          <button
            className={
              page === "home"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              changePage("home")
            }
          >
            <span>⌂</span>
            <small>Главная</small>
          </button>

          <button
            className={
              page === "subscription"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              changePage("subscription")
            }
          >
            <span>◇</span>
            <small>Подписка</small>
          </button>

          <button
            className={
              page === "wallet"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              changePage("wallet")
            }
          >
            <span>₽</span>
            <small>Кошелёк</small>
          </button>

          <button
            className={
              page === "profile"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              changePage("profile")
            }
          >
            <span>○</span>
            <small>Профиль</small>
          </button>
        </nav>
      </main>

      {showDepositModal && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!paymentLoading) {
              setShowDepositModal(false);
            }
          }}
        >
          <section
            className="bottomModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modalHandle" />

            <div className="modalHeader">
              <div>
                <small>ПОПОЛНЕНИЕ</small>
                <h3>Выберите сумму</h3>
              </div>

              <button
                type="button"
                disabled={paymentLoading}
                onClick={() =>
                  setShowDepositModal(false)
                }
              >
                ×
              </button>
            </div>

            <p>
              Выберите сумму и удобный способ оплаты.
            </p>

            <div className="depositGrid">
              {([300, 500, 1000, 2000] as DepositAmount[]).map(
                (amount) => (
                  <button
                    className={
                      selectedDepositAmount === amount
                        ? "depositAmountSelected"
                        : ""
                    }
                    type="button"
                    key={amount}
                    disabled={paymentLoading}
                    onClick={() => {
                      setSelectedDepositAmount(amount);
                      setDepositError(null);
                    }}
                  >
                    {formatMoney(amount)}
                  </button>
                ),
              )}
            </div>

            <div className="paymentMethodSection">
              <div className="selectedDepositSummary">
                <span>Будет зачислено</span>
                <strong>
                  {formatMoney(selectedDepositAmount)}
                </strong>
              </div>

              {depositError && (
                <div className="depositError">
                  <span>!</span>
                  <p>{depositError}</p>
                </div>
              )}

              <button
                className="starsPaymentButton"
                type="button"
                disabled={paymentLoading}
                onClick={createStarsInvoice}
              >
                <span className="starsPaymentIcon">★</span>

                <span className="paymentMethodText">
                  <strong>
                    {starsLoading
                      ? "Создаём счёт..."
                      : `Оплатить ${
                          starsByDepositAmount[
                            selectedDepositAmount
                          ]
                        } Stars`}
                  </strong>

                  <small>
                    Встроенная оплата Telegram
                  </small>
                </span>

                <b>›</b>
              </button>

              <button
                className="cryptoBotPaymentButton"
                type="button"
                disabled={paymentLoading}
                onClick={createCryptoInvoice}
              >
                <span className="cryptoBotIcon">◇</span>

                <span className="paymentMethodText">
                  <strong>
                    {paymentLoading
                      ? "Создаём счёт..."
                      : "Оплатить через Crypto Bot"}
                  </strong>

                  <small>
                    USDT или TON через @send
                  </small>
                </span>

                <b>›</b>
              </button>

              <p className="paymentHint">
                Баланс будет начислен автоматически после
                подтверждения платежа Telegram.
              </p>
            </div>
          </section>
        </div>
      )}

      {showSuccessModal && (
        <div
          className="modalOverlay centeredModal"
          onClick={() =>
            setShowSuccessModal(false)
          }
        >
          <section
            className="messageModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="successModalIcon">
              ✓
            </div>

            <h3>Подписка оформлена</h3>

            <p>
              Тариф «{selectedPlan.title}» успешно
              активирован. Теперь настройте VPN.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                changePage("home");
              }}
            >
              Перейти к установке
              <span>›</span>
            </button>
          </section>
        </div>
      )}

      {showBalanceModal && (
        <div
          className="modalOverlay centeredModal"
          onClick={() =>
            setShowBalanceModal(false)
          }
        >
          <section
            className="messageModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="warningModalIcon">
              !
            </div>

            <h3>Недостаточно средств</h3>

            <p>
              Пополните баланс, чтобы оформить
              выбранную подписку.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowBalanceModal(false);

                const initData =
                  requireTelegram();

                if (!initData) {
                  return;
                }

                changePage("wallet");
                setShowDepositModal(true);
              }}
            >
              Пополнить баланс
              <span>›</span>
            </button>
          </section>
        </div>
      )}

      {showTelegramModal && (
        <div
          className="modalOverlay centeredModal"
          onClick={() =>
            setShowTelegramModal(false)
          }
        >
          <section
            className="messageModal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="warningModalIcon">
              !
            </div>

            <h3>Откройте через Telegram</h3>

            <p>
              Зайдите, пожалуйста, через
              Telegram-бота, чтобы пополнить баланс
              или оформить подписку.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() =>
                setShowTelegramModal(false)
              }
            >
              Понятно
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
