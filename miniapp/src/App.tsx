import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Page = "home" | "subscription" | "wallet" | "profile";
type PlanId = "1" | "3" | "12";

type Plan = {
  id: PlanId;
  title: string;
  price: number;
  oldPrice?: number;
  description: string;
  recommended?: boolean;
};

type TransactionStatus = "confirmed" | "pending" | "declined";
type TransactionType = "deposit" | "subscription";

type Transaction = {
  id: number;
  type: TransactionType;
  title: string;
  amount: number;
  date: string;
  status: TransactionStatus;
};

type ConnectionStatus =
  | "not-installed"
  | "config-opened"
  | "checking"
  | "connected";

const plans: Plan[] = [
  {
    id: "1",
    title: "1 месяц",
    price: 299,
    description: "Подойдёт, чтобы попробовать сервис",
  },
  {
    id: "3",
    title: "3 месяца",
    price: 749,
    oldPrice: 897,
    description: "Выгодный тариф на несколько месяцев",
    recommended: true,
  },
  {
    id: "12",
    title: "12 месяцев",
    price: 1990,
    oldPrice: 3588,
    description: "Максимальная выгода на целый год",
  },
];

function formatMoney(value: number) {
  return `${Math.abs(value).toLocaleString("ru-RU")} ₽`;
}

function getCurrentDateTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getDaysLeft(date: Date | null) {
  if (!date) {
    return 0;
  }

  const difference = date.getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(difference / (1000 * 60 * 60 * 24)),
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("3");

  /*
    Пока это тестовый баланс интерфейса.

    Чтобы проверить оформление подписки без настоящей платёжной
    системы, можешь временно изменить 0 на 2500.

    После подключения базы данных баланс будет загружаться с сервера.
  */
  const [balance, setBalance] = useState(0);

  const [subscriptionEnd, setSubscriptionEnd] =
    useState<Date | null>(null);

  const [activePlanTitle, setActivePlanTitle] =
    useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("not-installed");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] =
    useState(false);

  const [showInsufficientBalance, setShowInsufficientBalance] =
    useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      type: "deposit",
      title: "Пополнение баланса",
      amount: 500,
      date: "23.07.2026, 21:40",
      status: "pending",
    },
  ]);

  const currentPlan = useMemo(() => {
    return (
      plans.find((plan) => plan.id === selectedPlan) ?? plans[1]
    );
  }, [selectedPlan]);

  const subscriptionActive =
    subscriptionEnd !== null &&
    subscriptionEnd.getTime() > Date.now();

  const pendingPayments = transactions.filter(
    (transaction) =>
      transaction.type === "deposit" &&
      transaction.status === "pending",
  );

  const daysLeft = getDaysLeft(subscriptionEnd);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [page]);

  function openPage(nextPage: Page) {
    setPage(nextPage);
  }

  function buySubscription() {
    if (balance < currentPlan.price) {
      setShowInsufficientBalance(true);
      return;
    }

    const months = Number(currentPlan.id);

    const startingDate =
      subscriptionEnd &&
      subscriptionEnd.getTime() > Date.now()
        ? subscriptionEnd
        : new Date();

    const newEndDate = addMonths(startingDate, months);

    setBalance((currentBalance) => {
      return currentBalance - currentPlan.price;
    });

    setSubscriptionEnd(newEndDate);
    setActivePlanTitle(currentPlan.title);
    setConnectionStatus("not-installed");

    setTransactions((currentTransactions) => [
      {
        id: Date.now(),
        type: "subscription",
        title: `Оплата подписки на ${currentPlan.title}`,
        amount: -currentPlan.price,
        date: getCurrentDateTime(),
        status: "confirmed",
      },
      ...currentTransactions,
    ]);

    setShowSubscriptionSuccess(true);
  }

  function createDeposit(amount: number) {
    setTransactions((currentTransactions) => [
      {
        id: Date.now(),
        type: "deposit",
        title: "Пополнение баланса",
        amount,
        date: getCurrentDateTime(),
        status: "pending",
      },
      ...currentTransactions,
    ]);

    setShowPaymentModal(false);
  }

  function openExternalLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openAppDownload() {
    /*
      Позже сюда вставим настоящую ссылку на приложение.

      Для iPhone это может быть App Store.
      Для Android — Google Play или APK.
    */

    openExternalLink("https://example.com/download");
  }

  function openInstallationGuide() {
    /*
      Позже заменим ссылку на настоящую инструкцию Zenvora.
    */

    openExternalLink("https://example.com/instruction");
  }

  function installVpnConfiguration() {
    /*
      Позже сервер будет выдавать каждому пользователю
      его персональную ссылку на VPN-конфигурацию.

      Например:
      vless://...
      wireguard://...
      https://zenvora.ru/config/USER_TOKEN
    */

    setConnectionStatus("config-opened");

    openExternalLink("https://example.com/vpn-config");
  }

  function checkVpnConnection() {
    setConnectionStatus("checking");

    /*
      Это временная демонстрация интерфейса.

      Позже здесь будет запрос на сервер:
      GET /api/vpn/check

      Сервер проверит, подключался ли пользователь
      через выданную ему конфигурацию.
    */

    window.setTimeout(() => {
      setConnectionStatus("connected");
    }, 1800);
  }

  function getTransactionStatus(status: TransactionStatus) {
    if (status === "confirmed") {
      return "Подтверждено";
    }

    if (status === "pending") {
      return "Проверяем платёж";
    }

    return "Отклонено";
  }

  function renderHomeContent() {
    if (!subscriptionActive) {
      return (
        <>
          <section className="hero">
            <span className="heroBadge">
              <span className="heroBadgeDot" />
              Стабильное подключение
            </span>

            <h1>
              Надёжный и
              <br />
              быстрый <span>VPN</span>
            </h1>

            <p>
              Безопасный доступ к интернету, высокая скорость и
              автоматический обход блокировок.
            </p>

            <button
              className="primaryButton heroButton"
              type="button"
              onClick={() => openPage("subscription")}
            >
              Оформить подписку
              <span>›</span>
            </button>
          </section>

          <div className="advantages">
            <article className="advantageCard">
              <span className="advantageIcon">⚡</span>

              <div>
                <strong>Высокая скорость</strong>
                <p>Быстрое и стабильное соединение</p>
              </div>
            </article>

            <article className="advantageCard">
              <span className="advantageIcon">🔒</span>

              <div>
                <strong>Защита данных</strong>
                <p>Безопасность в любой сети</p>
              </div>
            </article>

            <article className="advantageCard">
              <span className="advantageIcon">🇪🇺</span>

              <div>
                <strong>Обход блокировок</strong>
                <p>Автоматический режим подключения</p>
              </div>
            </article>
          </div>

          {pendingPayments.length > 0 && (
            <div className="pendingPaymentBanner">
              <span className="pendingPaymentIcon">◷</span>

              <div>
                <strong>Проверяем платёж</strong>
                <p>
                  Баланс обновится автоматически после подтверждения
                  оплаты.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openPage("wallet")}
              >
                ›
              </button>
            </div>
          )}

          <div className="homeWalletCard">
            <div>
              <span>Ваш баланс</span>
              <strong>{formatMoney(balance)}</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
            >
              Пополнить
            </button>
          </div>
        </>
      );
    }

    if (connectionStatus === "connected") {
      return (
        <section className="connectedHome">
          <div className="connectedIcon">✓</div>

          <span className="connectedBadge">
            VPN ПОДКЛЮЧЁН
          </span>

          <h1>Всё готово!</h1>

          <p>
            Zenvora успешно настроена и готова к работе. Желаем
            приятного и безопасного пользования!
          </p>

          <div className="connectionInformationCard">
            <div>
              <span>Статус</span>
              <strong className="connectedText">
                Подключение защищено
              </strong>
            </div>

            <div>
              <span>Режим</span>
              <strong>Автоматический</strong>
            </div>

            <div>
              <span>Подписка до</span>
              <strong>
                {subscriptionEnd
                  ? formatDate(subscriptionEnd)
                  : "—"}
              </strong>
            </div>
          </div>

          <button
            className="secondaryButton"
            type="button"
            onClick={() => openPage("profile")}
          >
            Открыть профиль
          </button>
        </section>
      );
    }

    return (
      <section className="setupHome">
        <div className="setupHeading">
          <span className="setupBadge">
            ПОДПИСКА АКТИВНА
          </span>

          <h1>Настройте VPN</h1>

          <p>
            Выполните три простых шага, чтобы начать пользоваться
            Zenvora.
          </p>
        </div>

        <div className="setupProgress">
          <span className="active" />
          <span
            className={
              connectionStatus !== "not-installed"
                ? "active"
                : ""
            }
          />
          <span
            className={
              connectionStatus === "checking" ? "active" : ""
            }
          />
        </div>

        <div className="setupSteps">
          <article className="setupStep">
            <span className="stepNumber">1</span>

            <div className="setupStepContent">
              <span className="stepLabel">ПЕРВЫЙ ШАГ</span>
              <h3>Установите приложение</h3>

              <p>
                Скачайте приложение, через которое будет работать
                VPN.
              </p>

              <div className="downloadButtons">
                <button
                  type="button"
                  onClick={openAppDownload}
                >
                  <span></span>

                  <div>
                    <small>Скачать для</small>
                    <strong>iPhone</strong>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={openAppDownload}
                >
                  <span>◉</span>

                  <div>
                    <small>Скачать для</small>
                    <strong>Android</strong>
                  </div>
                </button>
              </div>
            </div>
          </article>

          <article className="setupStep">
            <span className="stepNumber">2</span>

            <div className="setupStepContent">
              <span className="stepLabel">ВТОРОЙ ШАГ</span>
              <h3>Откройте инструкцию</h3>

              <p>
                Посмотрите короткую инструкцию по установке и
                настройке приложения.
              </p>

              <button
                className="instructionButton"
                type="button"
                onClick={openInstallationGuide}
              >
                <span>?</span>

                <div>
                  <strong>Инструкция по установке</strong>
                  <small>Пошаговое руководство</small>
                </div>

                <b>›</b>
              </button>
            </div>
          </article>

          <article
            className={`setupStep ${
              connectionStatus !== "not-installed"
                ? "completedStep"
                : ""
            }`}
          >
            <span className="stepNumber">
              {connectionStatus !== "not-installed"
                ? "✓"
                : "3"}
            </span>

            <div className="setupStepContent">
              <span className="stepLabel">ПОСЛЕДНИЙ ШАГ</span>
              <h3>Установите VPN</h3>

              <p>
                Нажмите кнопку ниже и разрешите открытие
                персональной конфигурации Zenvora.
              </p>

              {connectionStatus === "not-installed" && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={installVpnConfiguration}
                >
                  Установить VPN
                  <span>›</span>
                </button>
              )}

              {connectionStatus === "config-opened" && (
                <div className="connectionCheckBlock">
                  <div className="configurationOpened">
                    <span>✓</span>

                    <div>
                      <strong>Конфигурация открыта</strong>
                      <p>
                        Установите её в приложении и вернитесь сюда.
                      </p>
                    </div>
                  </div>

                  <button
                    className="primaryButton"
                    type="button"
                    onClick={checkVpnConnection}
                  >
                    Проверить подключение
                    <span>›</span>
                  </button>

                  <button
                    className="repeatConfigButton"
                    type="button"
                    onClick={installVpnConfiguration}
                  >
                    Открыть конфигурацию ещё раз
                  </button>
                </div>
              )}

              {connectionStatus === "checking" && (
                <div className="checkingConnection">
                  <span className="loadingCircle" />

                  <div>
                    <strong>Проверяем подключение</strong>
                    <p>Это займёт несколько секунд</p>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="subscriptionMiniCard">
          <div>
            <span>Активный тариф</span>
            <strong>{activePlanTitle}</strong>
          </div>

          <div>
            <span>Осталось</span>
            <strong>{daysLeft} дней</strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="app">
      <div className="backgroundGlow backgroundGlowOne" />
      <div className="backgroundGlow backgroundGlowTwo" />

      <main className="phone">
        <header className="header">
          <button
            className="brand"
            type="button"
            onClick={() => openPage("home")}
          >
            <span className="brandLogo">Z</span>

            <span className="brandText">
              <small>PREMIUM VPN</small>
              <strong>ZENVORA</strong>
            </span>
          </button>

          <button
            className="avatar"
            type="button"
            onClick={() => openPage("profile")}
            aria-label="Открыть профиль"
          >
            D
          </button>
        </header>

        <div className="pageContent">
          {page === "home" && (
            <section className="homePage">
              {renderHomeContent()}
            </section>
          )}

          {page === "subscription" && (
            <section className="page subscriptionPage">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Вернуться назад"
                >
                  ‹
                </button>

                <div>
                  <span>PREMIUM</span>
                  <h2>Выберите тариф</h2>
                </div>
              </div>

              <div className="plans">
                {plans.map((plan) => {
                  const selected = selectedPlan === plan.id;

                  return (
                    <button
                      className={`planCard ${
                        selected ? "selectedPlan" : ""
                      }`}
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <span className="planCheck">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="planInformation">
                        <span className="planHeading">
                          <strong>{plan.title}</strong>

                          {plan.recommended && (
                            <small className="recommendedBadge">
                              ВЫГОДНО
                            </small>
                          )}
                        </span>

                        <small>{plan.description}</small>
                      </span>

                      <span className="planPrice">
                        {plan.oldPrice && (
                          <small>
                            {formatMoney(plan.oldPrice)}
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

              <div className="orderSummary">
                <div>
                  <span>Выбранный тариф</span>
                  <strong>{currentPlan.title}</strong>
                </div>

                <div>
                  <span>К оплате</span>
                  <strong>
                    {formatMoney(currentPlan.price)}
                  </strong>
                </div>
              </div>

              <div className="balanceNotice">
                <div>
                  <span>Баланс кошелька</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                {balance < currentPlan.price && (
                  <small>
                    На балансе недостаточно средств. Сначала
                    пополните кошелёк.
                  </small>
                )}
              </div>

              <button
                className="primaryButton"
                type="button"
                onClick={buySubscription}
              >
                Оформить за {formatMoney(currentPlan.price)}
                <span>›</span>
              </button>
            </section>
          )}

          {page === "wallet" && (
            <section className="page walletPage">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Вернуться назад"
                >
                  ‹
                </button>

                <div>
                  <span>ФИНАНСЫ</span>
                  <h2>Кошелёк</h2>
                </div>
              </div>

              <div className="walletBalanceCard">
                <span>Доступный баланс</span>
                <strong>{formatMoney(balance)}</strong>

                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <span>＋</span>
                  Пополнить баланс
                </button>
              </div>

              {pendingPayments.length > 0 && (
                <div className="paymentCheckingCard">
                  <span className="loadingCircle" />

                  <div>
                    <strong>Платёж проверяется</strong>
                    <p>
                      Баланс изменится автоматически после
                      подтверждения платёжной системой.
                    </p>
                  </div>
                </div>
              )}

              <div className="transactionsHeader">
                <div>
                  <span>История операций</span>

                  <small>
                    {transactions.length} операций
                  </small>
                </div>
              </div>

              <div className="transactions">
                {transactions.map((transaction) => (
                  <article
                    className="transactionCard"
                    key={transaction.id}
                  >
                    <span
                      className={`transactionIcon ${transaction.type}`}
                    >
                      {transaction.type === "deposit"
                        ? "↓"
                        : "◇"}
                    </span>

                    <div className="transactionInfo">
                      <strong>{transaction.title}</strong>
                      <span>{transaction.date}</span>

                      <small
                        className={`status ${transaction.status}`}
                      >
                        {getTransactionStatus(
                          transaction.status,
                        )}
                      </small>
                    </div>

                    <div className="transactionAmount">
                      <strong
                        className={
                          transaction.amount > 0
                            ? "positiveAmount"
                            : "negativeAmount"
                        }
                      >
                        {transaction.amount > 0 ? "+" : "−"}
                        {formatMoney(transaction.amount)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>

              <p className="testPaymentNotice">
                Подтверждение платежей будет выполняться
                автоматически. Пользователь не сможет самостоятельно
                менять статус операции.
              </p>
            </section>
          )}

          {page === "profile" && (
            <section className="page profilePage">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Вернуться назад"
                >
                  ‹
                </button>

                <div>
                  <span>АККАУНТ</span>
                  <h2>Профиль</h2>
                </div>
              </div>

              <div className="profileCard">
                <div className="largeAvatar">D</div>

                <div className="profileInformation">
                  <h3>Даниил</h3>

                  <p>
                    Telegram ID загрузится автоматически
                  </p>
                </div>

                <span
                  className={`profileStatus ${
                    subscriptionActive ? "active" : ""
                  }`}
                >
                  {subscriptionActive
                    ? "PREMIUM"
                    : "БЕЗ ПОДПИСКИ"}
                </span>
              </div>

              <div className="profileBalance">
                <div>
                  <span>Баланс</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                >
                  Пополнить
                </button>
              </div>

              <div className="subscriptionStatusCard">
                <div className="subscriptionStatusHeader">
                  <span className="subscriptionIcon">◇</span>

                  <div>
                    <span>Статус подписки</span>

                    <strong>
                      {subscriptionActive
                        ? "Подписка активна"
                        : "Подписка не оформлена"}
                    </strong>
                  </div>
                </div>

                {subscriptionActive && subscriptionEnd ? (
                  <div className="subscriptionDetails">
                    <div>
                      <span>Тариф</span>
                      <strong>{activePlanTitle}</strong>
                    </div>

                    <div>
                      <span>Действует до</span>

                      <strong>
                        {formatDate(subscriptionEnd)}
                      </strong>
                    </div>

                    <div>
                      <span>Осталось</span>
                      <strong>{daysLeft} дней</strong>
                    </div>

                    <div>
                      <span>VPN</span>

                      <strong
                        className={
                          connectionStatus === "connected"
                            ? "connectedText"
                            : ""
                        }
                      >
                        {connectionStatus === "connected"
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
                      openPage("subscription")
                    }
                  >
                    Оформить подписку
                  </button>
                )}
              </div>

              {subscriptionActive &&
                connectionStatus !== "connected" && (
                  <button
                    className="profileMenuItem"
                    type="button"
                    onClick={() => openPage("home")}
                  >
                    <span className="menuIcon">⚙</span>

                    <span>
                      <strong>Настроить VPN</strong>

                      <small>
                        Установка приложения и конфигурации
                      </small>
                    </span>

                    <b>›</b>
                  </button>
                )}

              <button
                className="profileMenuItem"
                type="button"
                onClick={() => openPage("wallet")}
              >
                <span className="menuIcon">₽</span>

                <span>
                  <strong>Кошелёк и платежи</strong>

                  <small>
                    Баланс и история операций
                  </small>
                </span>

                <b>›</b>
              </button>

              <button
                className="profileMenuItem"
                type="button"
              >
                <span className="menuIcon">?</span>

                <span>
                  <strong>Поддержка</strong>

                  <small>
                    Помощь и ответы на вопросы
                  </small>
                </span>

                <b>›</b>
              </button>

              <div className="notificationInformation">
                <span>🔔</span>

                <p>
                  Бот уведомит вас за 7, 3 и 1 день до окончания
                  подписки.
                </p>
              </div>
            </section>
          )}
        </div>

        <nav className="bottomNav">
          <button
            type="button"
            className={page === "home" ? "active" : ""}
            onClick={() => openPage("home")}
          >
            <span>⌂</span>
            <small>Главная</small>
          </button>

          <button
            type="button"
            className={
              page === "subscription" ? "active" : ""
            }
            onClick={() => openPage("subscription")}
          >
            <span>◇</span>
            <small>Подписка</small>
          </button>

          <button
            type="button"
            className={page === "wallet" ? "active" : ""}
            onClick={() => openPage("wallet")}
          >
            <span>₽</span>
            <small>Кошелёк</small>
          </button>

          <button
            type="button"
            className={page === "profile" ? "active" : ""}
            onClick={() => openPage("profile")}
          >
            <span>○</span>
            <small>Профиль</small>
          </button>
        </nav>
      </main>

      {showPaymentModal && (
        <div
          className="modalOverlay"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="paymentModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHandle" />

            <div className="modalHeader">
              <div>
                <span>ПОПОЛНЕНИЕ</span>
                <h3>Выберите сумму</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>

            <p>
              После оплаты платёж появится в истории со статусом
              «Проверяем платёж».
            </p>

            <div className="depositAmounts">
              {[300, 500, 1000, 2000].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() => createDeposit(amount)}
                >
                  {formatMoney(amount)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSubscriptionSuccess && (
        <div
          className="modalOverlay"
          onClick={() =>
            setShowSubscriptionSuccess(false)
          }
        >
          <div
            className="successModal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="successIcon">✓</span>

            <h3>Подписка оформлена</h3>

            <p>
              Тариф «{currentPlan.title}» успешно активирован.
              Теперь настройте VPN.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowSubscriptionSuccess(false);
                openPage("home");
              }}
            >
              Перейти к установке
              <span>›</span>
            </button>
          </div>
        </div>
      )}

      {showInsufficientBalance && (
        <div
          className="modalOverlay"
          onClick={() =>
            setShowInsufficientBalance(false)
          }
        >
          <div
            className="successModal warningModal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="warningIcon">!</span>

            <h3>Недостаточно средств</h3>

            <p>
              Пополните баланс, чтобы оформить выбранную
              подписку.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowInsufficientBalance(false);
                openPage("wallet");
                setShowPaymentModal(true);
              }}
            >
              Пополнить баланс
              <span>›</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
