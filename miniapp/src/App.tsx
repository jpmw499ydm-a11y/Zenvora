import { useEffect, useState } from "react";
import "./App.css";

type Page = "home" | "servers" | "bypass" | "subscription" | "profile";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState<Page>("home");
useEffect(() => {
  window.scrollTo({ top: 0, behavior: "smooth" });
}, [page]);
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

          <button className="avatar" type="button" onClick={() => setPage("profile")}>
            D
          </button>
        </header>

        {page === "home" && (
          <section className="homePage">
            <div className="status">
              <span className={`statusDot ${connected ? "online" : ""}`} />
              {connected ? "Защита включена" : "Защита отключена"}
            </div>

            <button
              className={`connectButton ${connected ? "connected" : ""}`}
              type="button"
              onClick={() => setConnected(!connected)}
            >
              <span className="connectInner">
                <span className="powerIcon">⌁</span>
                <strong>{connected ? "ОТКЛЮЧИТЬ" : "ПОДКЛЮЧИТЬ"}</strong>
                <small>{connected ? "Соединение защищено" : "Нажмите для подключения"}</small>
              </span>
            </button>

            <div className="serverCard" onClick={() => setPage("servers")}>
              <div className="serverFlag">🇩🇪</div>

              <div className="serverInfo">
                <span>Текущий сервер</span>
                <strong>Германия, Франкфурт</strong>
              </div>

              <div className="ping">
                <span className="pingDot" />
                23 мс
              </div>

              <span className="arrow">›</span>
            </div>

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

            <button className="premiumCard" type="button" onClick={() => setPage("subscription")}>
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
              <button type="button" onClick={() => setPage("home")}>
                ‹
              </button>
              <h2>Серверы</h2>
            </div>

            {[
              ["🇩🇪", "Германия", "Франкфурт", "23 мс"],
              ["🇳🇱", "Нидерланды", "Амстердам", "31 мс"],
              ["🇫🇮", "Финляндия", "Хельсинки", "38 мс"],
              ["🇺🇸", "США", "Нью-Йорк", "92 мс"],
              ["🇯🇵", "Япония", "Токио", "143 мс"],
            ].map(([flag, country, city, ping]) => (
              <button className="serverListItem" type="button" key={country}>
                <span className="serverFlag">{flag}</span>
                <span className="serverInfo">
                  <strong>{country}</strong>
                  <span>{city}</span>
                </span>
                <span className="serverPing">{ping}</span>
              </button>
            ))}
          </section>
        )}

        {page === "bypass" && (
          <section className="page">
            <div className="pageHeader">
              <button type="button" onClick={() => setPage("home")}>
                ‹
              </button>
              <h2>Обход блокировок</h2>
            </div>

            <div className="featureCard">
              <div>
                <strong>Автоматический обход</strong>
                <p>Zenvora самостоятельно выберет подходящий режим соединения.</p>
              </div>

              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span />
              </label>
            </div>
          </section>
        )}

        {page === "subscription" && (
          <section className="page">
            <div className="pageHeader">
              <button type="button" onClick={() => setPage("home")}>
                ‹
              </button>
              <h2>Подписка</h2>
            </div>

            <div className="planCard activePlan">
              <span>Текущий тариф</span>
              <h3>Пробный период</h3>
              <p>Осталось 3 дня</p>
            </div>

            <div className="plans">
              <button type="button">
                <span>1 месяц</span>
                <strong>299 ₽</strong>
              </button>

              <button type="button" className="recommended">
                <small>ВЫГОДНО</small>
                <span>3 месяца</span>
                <strong>749 ₽</strong>
              </button>

              <button type="button">
                <span>12 месяцев</span>
                <strong>1 990 ₽</strong>
              </button>
            </div>
          </section>
        )}

        {page === "profile" && (
          <section className="page">
            <div className="pageHeader">
              <button type="button" onClick={() => setPage("home")}>
                ‹
              </button>
              <h2>Профиль</h2>
            </div>

            <div className="profileCard">
              <div className="largeAvatar">D</div>
              <h3>Даниил</h3>
              <p>Telegram ID: 123456789</p>
            </div>

            <button className="menuItem" type="button">
              <span>Подписка</span>
              <strong>Пробная</strong>
            </button>

            <button className="menuItem" type="button">
              <span>Поддержка</span>
              <strong>›</strong>
            </button>
          </section>
        )}

        <nav className="bottomNav">
          <button
            className={page === "home" ? "active" : ""}
            type="button"
            onClick={() => setPage("home")}
          >
            <span>⌂</span>
            Главная
          </button>

          <button
            className={page === "servers" ? "active" : ""}
            type="button"
            onClick={() => setPage("servers")}
          >
            <span>◎</span>
            Серверы
          </button>

          <button
            className={page === "bypass" ? "active" : ""}
            type="button"
            onClick={() => setPage("bypass")}
          >
            <span>◈</span>
            Обход
          </button>

          <button
            className={page === "subscription" ? "active" : ""}
            type="button"
            onClick={() => setPage("subscription")}
          >
            <span>◇</span>
            Подписка
          </button>

          <button
            className={page === "profile" ? "active" : ""}
            type="button"
            onClick={() => setPage("profile")}
          >
            <span>○</span>
            Профиль
          </button>
        </nav>
      </main>
    </div>
  );
}
