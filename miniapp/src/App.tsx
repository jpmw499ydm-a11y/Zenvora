import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Page = "home" | "subscription" | "wallet" | "profile";

type PlanId = "1" | "3" | "12";

type TransactionStatus = "pending" | "confirmed" | "declined";

type TransactionType = "deposit" | "subscription";

type SetupStatus =
  | "not-started"
  | "config-opened"
  | "checking"
  | "connected";

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
  id: number;
  title: string;
  amount: number;
  date: string;
  type: TransactionType;
  status: TransactionStatus;
};

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

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
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

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedPlanId, setSelectedPlanId] =
    useState<PlanId>("3");

  /*
    Тестовый баланс.

    Позже баланс будет загружаться с сервера.
    Для проверки подписки оставляем 2500 ₽.
  */
  const [balance, setBalance] = useState(2500);

  const [subscriptionEnd, setSubscriptionEnd] =
    useState<Date | null>(null);

  const [activePlanTitle, setActivePlanTitle] =
    useState<string>("");

  const [setupStatus, setSetupStatus] =
    useState<SetupStatus>("not-started");

  const [showDepositModal, setShowDepositModal] =
    useState(false);

  const [showSuccessModal, setShowSuccessModal] =
    useState(false);

  const [showBalanceModal, setShowBalanceModal] =
    useState(false);

  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);

  const selectedPlan = useMemo(() => {
    return (
      plans.find((plan) => plan.id === selectedPlanId) ??
      plans[1]
    );
  }, [selectedPlanId]);

  const subscriptionActive =
    subscriptionEnd !== null &&
    subscriptionEnd.getTime() > Date.now();

  const daysLeft = calculateDaysLeft(subscriptionEnd);

  const pendingPayments = transactions.filter(
    (transaction) =>
      transaction.type === "deposit" &&
      transaction.status === "pending",
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [page]);

  function changePage(nextPage: Page) {
    setPage(nextPage);
  }

  function buySubscription() {
    if (balance < selectedPlan.price) {
      setShowBalanceModal(true);
      return;
    }

    const currentDate = new Date();

    const startDate =
      subscriptionEnd &&
      subscriptionEnd.getTime() > currentDate.getTime()
        ? subscriptionEnd
        : currentDate;

    const newSubscriptionEnd = addMonths(
      startDate,
      selectedPlan.months,
    );

    setBalance((currentBalance) => {
      return currentBalance - selectedPlan.price;
    });

    setSubscriptionEnd(newSubscriptionEnd);
    setActivePlanTitle(selectedPlan.title);
    setSetupStatus("not-started");

    setTransactions((currentTransactions) => [
      {
        id: Date.now(),
        title: `Подписка на ${selectedPlan.title}`,
        amount: -selectedPlan.price,
        date: formatDateTime(new Date()),
        type: "subscription",
        status: "confirmed",
      },
      ...currentTransactions,
    ]);

    setShowSuccessModal(true);
  }

  function createDeposit(amount: number) {
    setTransactions((currentTransactions) => [
      {
        id: Date.now(),
        title: "Пополнение баланса",
        amount,
        date: formatDateTime(new Date()),
        type: "deposit",
        status: "pending",
      },
      ...currentTransactions,
    ]);

    setShowDepositModal(false);
  }

  function openExternalLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openIphoneApp() {
    openExternalLink("https://example.com/iphone");
  }

  function openAndroidApp() {
    openExternalLink("https://example.com/android");
  }

  function openInstruction() {
    openExternalLink("https://example.com/instruction");
  }

  function installVpn() {
    setSetupStatus("config-opened");

    openExternalLink("https://example.com/vpn-config");
  }

  function checkConnection() {
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
            Высокая скорость, защита данных и доступ к нужным
            сервисам без лишних настроек.
          </p>

          <button
            className="primaryButton"
            type="button"
            onClick={() => changePage("subscription")}
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
              <p>Стабильное соединение без ограничений</p>
            </div>
          </article>

          <article className="featureCard">
            <div className="featureIcon">🔒</div>

            <div>
              <strong>Защита данных</strong>
              <p>Безопасное использование любых сетей</p>
            </div>
          </article>

          <article className="featureCard">
            <div className="featureIcon">🌍</div>

            <div>
              <strong>Доступ к сайтам</strong>
              <p>Автоматический обход ограничений</p>
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
            onClick={() => setShowDepositModal(true)}
          >
            Пополнить
          </button>
        </section>
      </>
    );
  }

  function renderSetupHome() {
    return (
      <section className="setupPage">
        <div className="setupTitle">
          <span>ПОДПИСКА АКТИВНА</span>

          <h1>Настройте VPN</h1>

          <p>
            Выполните три шага, чтобы начать пользоваться
            Zenvora.
          </p>
        </div>

        <div className="progressLine">
          <span className="active" />

          <span
            className={
              setupStatus !== "not-started" ? "active" : ""
            }
          />

          <span
            className={
              setupStatus === "checking" ||
              setupStatus === "connected"
                ? "active"
                : ""
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
                Выберите приложение для вашего устройства.
              </p>

              <div className="appButtons">
                <button
                  type="button"
                  onClick={openIphoneApp}
                >
                  <span className="appIcon"></span>

                  <div>
                    <small>Скачать для</small>
                    <strong>iPhone</strong>
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

              <h3>Откройте инструкцию</h3>

              <p>
                Посмотрите пошаговое руководство по установке.
              </p>

              <button
                className="instructionCard"
                type="button"
                onClick={openInstruction}
              >
                <span className="instructionIcon">?</span>

                <div>
                  <strong>Инструкция по установке</strong>
                  <small>Открыть руководство</small>
                </div>

                <b>›</b>
              </button>
            </div>
          </article>

          <article
            className={`setupCard ${
              setupStatus !== "not-started"
                ? "setupCardCompleted"
                : ""
            }`}
          >
            <div className="stepNumber">
              {setupStatus !== "not-started" ? "✓" : "3"}
            </div>

            <div className="stepContent">
              <small>ПОСЛЕДНИЙ ШАГ</small>

              <h3>Установите VPN</h3>

              <p>
                Откройте персональную конфигурацию и добавьте её
                в установленное приложение.
              </p>

              {setupStatus === "not-started" && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={installVpn}
                >
                  Установить VPN
                  <span>›</span>
                </button>
              )}

              {setupStatus === "config-opened" && (
                <div className="configOpenedBlock">
                  <div className="configNotice">
                    <span>✓</span>

                    <div>
                      <strong>Конфигурация открыта</strong>
                      <p>
                        Установите её и вернитесь в Zenvora.
                      </p>
                    </div>
                  </div>

                  <button
                    className="primaryButton"
                    type="button"
                    onClick={checkConnection}
                  >
                    Проверить подключение
                    <span>›</span>
                  </button>

                  <button
                    className="textButton"
                    type="button"
                    onClick={installVpn}
                  >
                    Открыть конфигурацию ещё раз
                  </button>
                </div>
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
            </div>
          </article>
        </div>

        <section className="subscriptionSummary">
          <div>
            <span>Тариф</span>
            <strong>{activePlanTitle}</strong>
          </div>

          <div>
            <span>Осталось</span>
            <strong>{daysLeft} дней</strong>
          </div>
        </section>
      </section>
    );
  }

  function renderConnectedHome() {
    return (
      <section className="connectedPage">
        <div className="connectedCheck">✓</div>

        <span className="connectedBadge">
          VPN ПОДКЛЮЧЁН
        </span>

        <h1>Всё готово!</h1>

        <p>
          Zenvora успешно настроена. Желаем приятного и
          безопасного пользования!
        </p>

        <section className="connectedInfo">
          <div>
            <span>Статус</span>
            <strong className="greenText">
              Подключение защищено
            </strong>
          </div>

          <div>
            <span>Тариф</span>
            <strong>{activePlanTitle}</strong>
          </div>

          <div>
            <span>Действует до</span>

            <strong>
              {subscriptionEnd
                ? formatDate(subscriptionEnd)
                : "—"}
            </strong>
          </div>
        </section>

        <button
          className="secondaryButton"
          type="button"
          onClick={() => changePage("profile")}
        >
          Открыть профиль
        </button>
      </section>
    );
  }

  function renderHome() {
    if (!subscriptionActive) {
      return renderPublicHome();
    }

    if (setupStatus === "connected") {
      return renderConnectedHome();
    }

    return renderSetupHome();
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
            onClick={() => changePage("profile")}
          >
            D
          </button>
        </header>

        <div className="pageContent">
          {page === "home" && (
            <section className="page homePage">
              {renderHome()}
            </section>
          )}

          {page === "subscription" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() => changePage("home")}
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
                        selected ? "planCardSelected" : ""
                      }`}
                      type="button"
                      key={plan.id}
                      onClick={() =>
                        setSelectedPlanId(plan.id)
                      }
                    >
                      <span className="planRadio">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="planContent">
                        <span className="planTitleRow">
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

              <section className="orderCard">
                <div>
                  <span>Выбранный тариф</span>
                  <strong>{selectedPlan.title}</strong>
                </div>

                <div>
                  <span>К оплате</span>

                  <strong>
                    {formatMoney(selectedPlan.price)}
                  </strong>
                </div>
              </section>

              <section className="walletNotice">
                <div>
                  <span>Баланс кошелька</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                {balance < selectedPlan.price && (
                  <p>
                    Недостаточно средств. Пополните баланс перед
                    оформлением.
                  </p>
                )}
              </section>

              <button
                className="primaryButton"
                type="button"
                onClick={buySubscription}
              >
                Оформить за{" "}
                {formatMoney(selectedPlan.price)}
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
                  onClick={() => changePage("home")}
                >
                  ‹
                </button>

                <div>
                  <small>ФИНАНСЫ</small>
                  <h2>Кошелёк</h2>
                </div>
              </div>

              <section className="walletCard">
                <span>Доступный баланс</span>

                <strong>{formatMoney(balance)}</strong>

                <button
                  type="button"
                  onClick={() => setShowDepositModal(true)}
                >
                  <span>＋</span>
                  Пополнить баланс
                </button>
              </section>

              {pendingPayments.length > 0 && (
                <section className="walletPendingCard">
                  <div className="pendingSpinner" />

                  <div>
                    <strong>Платёж проверяется</strong>

                    <p>
                      Баланс изменится автоматически после
                      подтверждения оплаты.
                    </p>
                  </div>
                </section>
              )}

              <div className="sectionTitle">
                <strong>История операций</strong>

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

                {transactions.map((transaction) => (
                  <article
                    className="transactionCard"
                    key={transaction.id}
                  >
                    <span
                      className={`transactionIcon ${
                        transaction.type === "deposit"
                          ? "depositIcon"
                          : "subscriptionIcon"
                      }`}
                    >
                      {transaction.type === "deposit"
                        ? "↓"
                        : "◇"}
                    </span>

                    <div className="transactionContent">
                      <strong>{transaction.title}</strong>

                      <span>{transaction.date}</span>

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
                      {transaction.amount > 0 ? "+" : "−"}
                      {formatMoney(transaction.amount)}
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          )}

          {page === "profile" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  className="backButton"
                  type="button"
                  onClick={() => changePage("home")}
                >
                  ‹
                </button>

                <div>
                  <small>АККАУНТ</small>
                  <h2>Профиль</h2>
                </div>
              </div>

              <section className="profileCard">
                <div className="profileAvatar">D</div>

                <div className="profileName">
                  <strong>Даниил</strong>

                  <span>
                    Telegram ID загрузится автоматически
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
                  <strong>{formatMoney(balance)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDepositModal(true)}
                >
                  Пополнить
                </button>
              </section>

              <section className="subscriptionCard">
                <div className="subscriptionHeader">
                  <span>◇</span>

                  <div>
                    <small>Статус подписки</small>

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
                          setupStatus === "connected"
                            ? "greenText"
                            : ""
                        }
                      >
                        {setupStatus === "connected"
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
                      changePage("subscription")
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
                    onClick={() => changePage("home")}
                  >
                    <span className="menuIcon">⚙</span>

                    <div>
                      <strong>Настроить VPN</strong>
                      <small>
                        Установка приложения и конфигурации
                      </small>
                    </div>

                    <b>›</b>
                  </button>
                )}

              <button
                className="menuCard"
                type="button"
                onClick={() => changePage("wallet")}
              >
                <span className="menuIcon">₽</span>

                <div>
                  <strong>Кошелёк и платежи</strong>
                  <small>Баланс и история операций</small>
                </div>

                <b>›</b>
              </button>

              <button
                className="menuCard"
                type="button"
              >
                <span className="menuIcon">?</span>

                <div>
                  <strong>Поддержка</strong>
                  <small>Помощь и ответы на вопросы</small>
                </div>

                <b>›</b>
              </button>

              <section className="notificationCard">
                <span>🔔</span>

                <p>
                  Бот уведомит вас за 7, 3 и 1 день до окончания
                  подписки.
                </p>
              </section>
            </section>
          )}
        </div>

        <nav className="bottomNavigation">
          <button
            className={page === "home" ? "active" : ""}
            type="button"
            onClick={() => changePage("home")}
          >
            <span>⌂</span>
            <small>Главная</small>
          </button>

          <button
            className={
              page === "subscription" ? "active" : ""
            }
            type="button"
            onClick={() => changePage("subscription")}
          >
            <span>◇</span>
            <small>Подписка</small>
          </button>

          <button
            className={page === "wallet" ? "active" : ""}
            type="button"
            onClick={() => changePage("wallet")}
          >
            <span>₽</span>
            <small>Кошелёк</small>
          </button>

          <button
            className={page === "profile" ? "active" : ""}
            type="button"
            onClick={() => changePage("profile")}
          >
            <span>○</span>
            <small>Профиль</small>
          </button>
        </nav>
      </main>

      {showDepositModal && (
        <div
          className="modalOverlay"
          onClick={() => setShowDepositModal(false)}
        >
          <section
            className="bottomModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHandle" />

            <div className="modalHeader">
              <div>
                <small>ПОПОЛНЕНИЕ</small>
                <h3>Выберите сумму</h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDepositModal(false)
                }
              >
                ×
              </button>
            </div>

            <p>
              После оплаты операция появится со статусом
              «Проверяем платёж».
            </p>

            <div className="depositGrid">
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
          </section>
        </div>
      )}

      {showSuccessModal && (
        <div
          className="modalOverlay centeredModal"
          onClick={() => setShowSuccessModal(false)}
        >
          <section
            className="messageModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="successModalIcon">✓</div>

            <h3>Подписка оформлена</h3>

            <p>
              Тариф «{selectedPlan.title}» успешно активирован.
              Теперь настройте VPN.
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
          onClick={() => setShowBalanceModal(false)}
        >
          <section
            className="messageModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="warningModalIcon">!</div>

            <h3>Недостаточно средств</h3>

            <p>
              Пополните баланс, чтобы оформить выбранную
              подписку.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowBalanceModal(false);
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
    </div>
  );
}
