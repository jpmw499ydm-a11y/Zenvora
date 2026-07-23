import { useEffect, useState } from "react";
import "./App.css";

type Page = "home" | "servers" | "bypass" | "subscription" | "profile";
type Plan = "1" | "3" | "12";

type Server = {
  flag: string;
  country: string;
  city: string;
  ping: string;
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

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [connected, setConnected] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server>(servers[0]);
  const [bypassEnabled, setBypassEnabled] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("3");

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [page]);

  function openPage(nextPage: Page) {
    setPage(nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function selectServer(server: Server) {
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
          >
            D
          </button>
        </header>

        {page === "home" && (
          <section className="homePage">
            <div className="status">
              <span
                className={`statusDot ${connected ? "online" : ""}`}
              />

              {connected ? "Защита включена" : "Защита отключена"}
            </div>

            <button
              className={`connectButton ${connected ? "connected" : ""}`}
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
              >
                ‹
              </button>

              <h2>Серверы</h2>
            </div>

            {servers.map((server) => {
              const isSelected =
                server.country === selectedServer.country;

              return (
                <button
                  className="serverListItem"
                  type="button"
                  key={server.country}
                  onClick={() => selectServer(server)}
                  style={
                    isSelected
                      ? {
                          borderColor: "rgba(67, 122, 255, 0.65)",
                          background: "rgba(48, 99, 220, 0.16)",
                        }
                      : undefined
                  }
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
          </section>
        )}

        {page === "bypass" && (
          <section className="page">
            <div className="pageHeader">
              <button
                type="button"
                onClick={() => openPage("home")}
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
          </section>
        )}

        {page === "subscription" && (
          <section className="page">
            <div className="pageHeader">
              <button
                type="button"
                onClick={() => openPage("home")}
              >
                ‹
              </button>

              <h2>Подписка</h2>
            </div>

            <div className="planCard activePlan">
              <span>Выбранный тариф</span>

              <h3>
                {selectedPlan === "1" && "1 месяц"}
                {selectedPlan === "3" && "3 месяца"}
                {selectedPlan === "12" && "12 месяцев"}
              </h3>

              <p>
                {selectedPlan === "1" && "299 ₽"}
                {selectedPlan === "3" && "749 ₽"}
                {selectedPlan === "12" && "1 990 ₽"}
              </p>
            </div>

            <div className="plans">
              <button
                type="button"
                onClick={() => setSelectedPlan("1")}
                style={
                  selectedPlan === "1"
                    ? {
                        borderColor: "rgba(67, 122, 255, 0.65)",
                        background: "rgba(48, 99, 220, 0.18)",
                      }
                    : undefined
                }
              >
                <span>1 месяц</span>
                <strong>299 ₽</strong>
              </button>

              <button
                type="button"
                className="recommended"
                onClick={() => setSelectedPlan("3")}
                style={
                  selectedPlan === "3"
                    ? {
                        borderColor: "rgba(67, 122, 255, 0.75)",
                        background: "rgba(48, 99, 220, 0.22)",
                      }
                    : undefined
                }
              >
                <small>ВЫГОДНО</small>
                <span>3 месяца</span>
                <strong>749 ₽</strong>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan("12")}
                style={
                  selectedPlan === "12"
                    ? {
                        borderColor: "rgba(67, 122, 255, 0.65)",
                        background: "rgba(48, 99, 220, 0.18)",
                      }
                    : undefined
                }
              >
                <span>12 месяцев</span>
                <strong>1 990 ₽</strong>
              </button>
            </div>
          </section>
        )}

        {page === "profile" && (
          <section className="page">
            <div className="pageHeader">
              <button
                type="button"
                onClick={() => openPage("home")}
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
              <span>Подписка</span>

              <strong>
                {selectedPlan === "1" && "1 месяц"}
                {selectedPlan === "3" && "3 месяца"}
                {selectedPlan === "12" && "12 месяцев"}
              </strong>
            </button>

            <button className="menuItem" type="button">
              <span>Поддержка</span>
              <strong>›</strong>
            </button>
          </section>
        )}

        <nav className="bottomNav">
          <button
            type="button"
            className={page === "home" ? "active" : ""}
            onClick={() => openPage("home")}
          >
            <span>⌂</span>
            Главная
          </button>

          <button
            type="button"
            className={page === "servers" ? "active" : ""}
            onClick={() => openPage("servers")}
          >
            <span>◎</span>
            Серверы
          </button>

          <button
            type="button"
            className={page === "bypass" ? "active" : ""}
            onClick={() => openPage("bypass")}
          >
            <span>◈</span>
            Обход
          </button>

          <button
            type="button"
            className={page === "subscription" ? "active" : ""}
            onClick={() => openPage("subscription")}
          >
            <span>◇</span>
            Подписка
          </button>

          <button
            type="button"
            className={page === "profile" ? "active" : ""}
            onClick={() => openPage("profile")}
          >
            <span>○</span>
            Профиль
          </button>
        </nav>
      </main>
    </div>
  );
}
