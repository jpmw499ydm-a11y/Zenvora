import { useMemo, useState } from "react";
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
  return `${value.toLocaleString("ru-RU")} ₽`;
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

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("3");

  const [balance, setBalance] = useState(0);
  const [subscriptionEnd, setSubscriptionEnd] = useState<Date | null>(null);
  const [activePlanTitle, setActivePlanTitle] = useState<string | null>(null);

  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      type: "deposit",
      title: "Пополнение баланса",
      amount: 500,
      date: "Ожидает подтверждения",
      status: "pending",
    },
  ]);

  const currentPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlan) ?? plans[1];
  }, [selectedPlan]);

  const subscriptionActive =
    subscriptionEnd !== null && subscriptionEnd.getTime() > Date.now();

  function openPage(nextPage: Page) {
    setPage(nextPage);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openSubscription() {
    openPage("subscription");
  }

  function openWallet() {
    openPage("wallet");
  }

  function buySubscription() {
    if (balance < currentPlan.price) {
      openWallet();
      return;
    }

    const months = Number(currentPlan.id);
    const startingDate =
      subscriptionEnd && subscriptionEnd.getTime() > Date.now()
        ? subscriptionEnd
        : new Date();

    const newEndDate = addMonths(startingDate, months);

    setBalance((value) => value - currentPlan.price);
    setSubscriptionEnd(newEndDate);
    setActivePlanTitle(currentPlan.title);

    setTransactions((current) => [
      {
        id: Date.now(),
        type: "subscription",
        title: `Подписка на ${currentPlan.title}`,
        amount: -currentPlan.price,
        date: getCurrentDateTime(),
        status: "confirmed",
      },
      ...current,
    ]);

    setShowSuccess(true);
  }

  function createDeposit(amount: number) {
    setShowPaymentMethods(false);

    setTransactions((current) => [
      {
        id: Date.now(),
        type: "deposit",
        title: "Пополнение баланса",
        amount,
        date: getCurrentDateTime(),
        status: "pending",
      },
      ...current,
    ]);
  }

  function confirmTestPayment(transactionId: number) {
    const transaction = transactions.find(
      (item) => item.id === transactionId,
    );

    if (!transaction || transaction.status !== "pending") {
      return;
    }

    setBalance((value) => value + transaction.amount);

    setTransactions((current) =>
      current.map((item) =>
        item.id === transactionId
          ? {
              ...item,
              status: "confirmed",
              date: getCurrentDateTime(),
            }
          : item,
      ),
    );
  }

  function getTransactionStatus(status: TransactionStatus) {
    if (status === "confirmed") {
      return "Подтверждено";
    }

    if (status === "pending") {
      return "Ожидает подтверждения";
    }

    return "Отклонено";
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
              <div className="hero">
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
                  Безопасный доступ к интернету, высокая скорость и обход
                  блокировок в одном приложении.
                </p>

                <button
                  className="primaryButton heroButton"
                  type="button"
                  onClick={openSubscription}
                >
                  Оформить подписку
                  <span>›</span>
                </button>
              </div>

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

              <div className="homeWalletCard">
                <div>
                  <span>Ваш баланс</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                <button type="button" onClick={openWallet}>
                  Пополнить
                </button>
              </div>
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
                          <small>{formatMoney(plan.oldPrice)}</small>
                        )}

                        <strong>{formatMoney(plan.price)}</strong>
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
                  <strong>{formatMoney(currentPlan.price)}</strong>
                </div>
              </div>

              <div className="balanceNotice">
                <div>
                  <span>Баланс кошелька</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                {balance < currentPlan.price && (
                  <small>
                    Недостаточно средств. После нажатия вы перейдёте в
                    кошелёк.
                  </small>
                )}
              </div>

              <button
                className="primaryButton"
                type="button"
                onClick={buySubscription}
              >
                {balance >= currentPlan.price
                  ? `Оформить за ${formatMoney(currentPlan.price)}`
                  : "Перейти к пополнению"}

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
                  onClick={() => setShowPaymentMethods(true)}
                >
                  <span>＋</span>
                  Пополнить баланс
                </button>
              </div>

              <div className="transactionsHeader">
                <div>
                  <span>История операций</span>
                  <small>{transactions.length} операций</small>
                </div>
              </div>

              <div className="transactions">
                {transactions.length === 0 && (
                  <div className="emptyTransactions">
                    Здесь появится история ваших операций
                  </div>
                )}

                {transactions.map((transaction) => (
                  <article
                    className="transactionCard"
                    key={transaction.id}
                  >
                    <span
                      className={`transactionIcon ${transaction.type}`}
                    >
                      {transaction.type === "deposit" ? "↓" : "◇"}
                    </span>

                    <div className="transactionInfo">
                      <strong>{transaction.title}</strong>
                      <span>{transaction.date}</span>

                      <small className={`status ${transaction.status}`}>
                        {getTransactionStatus(transaction.status)}
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
                        {transaction.amount > 0 ? "+" : ""}
                        {formatMoney(transaction.amount)}
                      </strong>

                      {transaction.status === "pending" &&
                        transaction.type === "deposit" && (
                          <button
                            type="button"
                            onClick={() =>
                              confirmTestPayment(transaction.id)
                            }
                          >
                            Подтвердить
                          </button>
                        )}
                    </div>
                  </article>
                ))}
              </div>

              <p className="testPaymentNotice">
                Кнопка «Подтвердить» временная и нужна для проверки
                интерфейса. Позже подтверждение будет приходить
                автоматически от платёжной системы.
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
                  <p>Telegram ID загрузится автоматически</p>
                </div>

                <span
                  className={`profileStatus ${
                    subscriptionActive ? "active" : ""
                  }`}
                >
                  {subscriptionActive ? "PREMIUM" : "БЕЗ ПОДПИСКИ"}
                </span>
              </div>

              <div className="profileBalance">
                <div>
                  <span>Баланс</span>
                  <strong>{formatMoney(balance)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    openWallet();
                    setShowPaymentMethods(true);
                  }}
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
                      <strong>{formatDate(subscriptionEnd)}</strong>
                    </div>
                  </div>
                ) : (
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={openSubscription}
                  >
                    Оформить подписку
                  </button>
                )}
              </div>

              <button
                className="profileMenuItem"
                type="button"
                onClick={openWallet}
              >
                <span className="menuIcon">₽</span>

                <span>
                  <strong>Кошелёк и платежи</strong>
                  <small>Баланс и история операций</small>
                </span>

                <b>›</b>
              </button>

              <button className="profileMenuItem" type="button">
                <span className="menuIcon">?</span>

                <span>
                  <strong>Поддержка</strong>
                  <small>Помощь и ответы на вопросы</small>
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
            className={page === "subscription" ? "active" : ""}
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

      {showPaymentMethods && (
        <div
          className="modalOverlay"
          onClick={() => setShowPaymentMethods(false)}
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
                onClick={() => setShowPaymentMethods(false)}
              >
                ×
              </button>
            </div>

            <p>
              Способы оплаты добавим после того, как ты их пришлёшь.
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

      {showSuccess && (
        <div
          className="modalOverlay"
          onClick={() => setShowSuccess(false)}
        >
          <div
            className="successModal"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="successIcon">✓</span>

            <h3>Подписка оформлена</h3>

            <p>
              Тариф «{currentPlan.title}» успешно активирован.
            </p>

            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                setShowSuccess(false);
                openPage("profile");
              }}
            >
              Перейти в профиль
              <span>›</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
