import { useEffect, useState } from "react";
import "./App.css";

type Page = "home" | "servers" | "bypass" | "subscription" | "profile";
type PlanId = "1" | "3" | "12";

type Server = {
  flag: string;
  country: string;
  city: string;
  ping: string;
};

type Plan = {
  id: PlanId;
  title: string;
  price: string;
  recommended?: boolean;
};

const servers: Server[] = [
  {
    flag: "🇩🇪",
    country: "Германия",
    city: "Франкфурт",
    ping: "23 мс",
  },
  {
    flag: "🇳🇱",
    country: "Нидерланды",
    city: "Амстердам",
    ping: "31 мс",
  },
  {
    flag: "🇫🇮",
    country: "Финляндия",
    city: "Хельсинки",
    ping: "38 мс",
  },
  {
    flag: "🇺🇸",
    country: "США",
    city: "Нью-Йорк",
    ping: "92 мс",
  },
  {
    flag: "🇯🇵",
    country: "Япония",
    city: "Токио",
    ping: "143 мс",
  },
];

const plans: Plan[] = [
  {
    id: "1",
    title: "1 месяц",
    price: "299 ₽",
  },
  {
    id: "3",
    title: "3 месяца",
    price: "749 ₽",
    recommended: true,
  },
  {
    id: "12",
    title: "12 месяцев",
    price: "1 990 ₽",
  },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [connected, setConnected] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server>(servers[0]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("3");
  const [bypassEnabled, setBypassEnabled] = useState(true);

  const currentPlan =
    plans.find((plan) => plan.id === selectedPlan) ?? plans[1];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  function openPage(nextPage: Page) {
    setPage(nextPage);
    window.scrollTo(0, 0);
  }

  function chooseServer(server: Server) {
    setSelectedServer(server);
    setConnected(false);
    openPage("home");
  }

  return (
    <div className="app">
      <div className="backgroundGlow backgroundGlowOne" />
      <div className="backgroundGlow backgroundGlowTwo" />

      <main className="phone">
        <header className="header">
          <div>
            <p className="eyebrow">PREMIUM VPN</p>
            <h1>ZENVORA</h1>
          </div>

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
              <div className="status">
                <span
                  className={`statusDot ${connected ? "online" : ""}`}
                />

                {connected ? "Защита включена" : "Защита отключена"}
              </div>

              <button
                className={`connectButton ${
                  connected ? "connected" : ""
                }`}
                type="button"
                onClick={() => setConnected((value) => !value)}
              >
                <span className="connectInner">
                  <span className="powerIcon">⌁</span>

                  <strong>
                    {connected ? "ОТКЛЮЧИТЬ" : "ПОДКЛЮЧИТЬ"}
                  </strong>

                  <small>
                    {connected
                      ? "Соединение защищено"
                      : "Нажмите для подключения"}
                  </small>
                </span>
              </button>

              <button
                className="serverCard"
                type="button"
                onClick={() => openPage("servers")}
              >
                <span className="serverFlag">
                  {selectedServer.flag}
                </span>

                <span className="serverInfo">
                  <span>Текущий сервер</span>

                  <strong>
                    {selectedServer.country}, {selectedServer.city}
                  </strong>
                </span>

                <span className="ping">
                  <span className="pingDot" />
                  {selectedServer.ping}
                </span>

                <span className="arrow">›</span>
              </button>

              <div className="statsGrid">
                <div className="statCard">
                  <span>Скорость</span>
                  <strong>{connected ? "84.6" : "0.0"}</strong>
                  <small>Мбит/с</small>
                </div>

                <div className="statCard">
                  <span>Трафик</span>
                  <strong>{connected ? "1.24" : "0.00"}</strong>
                  <small>ГБ</small>
                </div>
              </div>

              <button
                className="premiumCard"
                type="button"
                onClick={() => openPage("subscription")}
              >
                <div>
                  <span className="premiumBadge">PREMIUM</span>
                  <h2>Безлимитный интернет</h2>
                  <p>Все страны и максимальная скорость</p>
                </div>

                <span className="premiumArrow">›</span>
              </button>
            </section>
          )}

          {page === "servers" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Назад"
                >
                  ‹
                </button>

                <h2>Серверы</h2>
              </div>

              <div className="serverList">
                {servers.map((server) => {
                  const isSelected =
                    server.country === selectedServer.country;

                  return (
                    <button
                      className={`serverListItem ${
                        isSelected ? "selectedServer" : ""
                      }`}
                      type="button"
                      key={server.country}
                      onClick={() => chooseServer(server)}
                    >
                      <span className="serverFlag">{server.flag}</span>

                      <span className="serverInfo">
                        <strong>{server.country}</strong>
                        <span>{server.city}</span>
                      </span>

                      <span className="serverPing">
                        {isSelected ? "Выбран" : server.ping}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {page === "bypass" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Назад"
                >
                  ‹
                </button>

                <h2>Обход блокировок</h2>
              </div>

              <div className="featureCard">
                <div>
                  <strong>Автоматический обход</strong>

                  <p>
                    Zenvora самостоятельно выберет подходящий режим
                    соединения.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={bypassEnabled}
                    onChange={(event) =>
                      setBypassEnabled(event.target.checked)
                    }
                  />

                  <span />
                </label>
              </div>

              <div className="bypassStatus">
                <span
                  className={`statusDot ${
                    bypassEnabled ? "online" : ""
                  }`}
                />

                {bypassEnabled
                  ? "Обход блокировок включён"
                  : "Обход блокировок выключен"}
              </div>
            </section>
          )}

          {page === "subscription" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Назад"
                >
                  ‹
                </button>

                <h2>Подписка</h2>
              </div>

              <div className="selectedPlanCard">
                <span>Выбранный тариф</span>
                <h3>{currentPlan.title}</h3>
                <p>{currentPlan.price}</p>
              </div>

              <div className="plans">
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <button
                      className={`planOption ${
                        isSelected ? "selectedPlan" : ""
                      }`}
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <span className="planTitle">{plan.title}</span>

                      <span className="planRight">
                        {plan.recommended && (
                          <small className="recommendedBadge">
                            ВЫГОДНО
                          </small>
                        )}

                        <strong>{plan.price}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button className="buyButton" type="button">
                Продолжить за {currentPlan.price}
              </button>
            </section>
          )}

          {page === "profile" && (
            <section className="page">
              <div className="pageHeader">
                <button
                  type="button"
                  onClick={() => openPage("home")}
                  aria-label="Назад"
                >
                  ‹
                </button>

                <h2>Профиль</h2>
              </div>

              <div className="profileCard">
                <div className="largeAvatar">D</div>
                <h3>Даниил</h3>
                <p>Telegram ID будет загружен автоматически</p>
              </div>

              <button
                className="menuItem"
                type="button"
                onClick={() => openPage("subscription")}
              >
                <span>Выбранный тариф</span>
                <strong>{currentPlan.title}</strong>
              </button>

              <button className="menuItem" type="button">
                <span>Поддержка</span>
                <strong>›</strong>
              </button>
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
            className={page === "servers" ? "active" : ""}
            onClick={() => openPage("servers")}
          >
            <span>◎</span>
            <small>Серверы</small>
          </button>

          <button
            type="button"
            className={page === "bypass" ? "active" : ""}
            onClick={() => openPage("bypass")}
          >
            <span>◈</span>
            <small>Обход</small>
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
            className={page === "profile" ? "active" : ""}
            onClick={() => openPage("profile")}
          >
            <span>○</span>
            <small>Профиль</small>
          </button>
        </nav>
      </main>
    </div>
  );
}
