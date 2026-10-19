"use strict";
/* =========================================================================
   ЛР №5. ДИНАМИЧЕСКИЕ WEB-СТРАНИЦЫ. ОБРАБОТКА СОБЫТИЙ.
   Игра Flappy Bird.

   В комментариях помечено, какому пункту требований лабораторной
   соответствует тот или иной фрагмент кода — это упрощает сверку
   с отчётом.
   ========================================================================= */

/* ============================ КОНСТАНТЫ ================================ */
const GRAVITY = 1500;
const JUMP_STRENGTH = -500;
const FLOOR_HEIGHT = 150;
const PIPE_WIDTH = 70;
const MIN_PIPE_HEIGHT = 100;
const COIN_CHANCE = 0.9; // вероятность появления монеты в новом просвете

const DIFFICULTY = {
  easy:   { gap: 220, speed: 170, spawn: 2.0 },
  normal: { gap: 180, speed: 220, spawn: 1.8 },
  hard:   { gap: 140, speed: 280, spawn: 1.5 },
};

const GameState = {
  MENU: "menu",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "gameOver",
};

/* ============================== СОСТОЯНИЕ =============================== */
const state = {
  current: GameState.MENU,
  score: 0,
  level: 1,
  highScore: 0,
  coins: 0,
  coinsThisRun: 0,
  difficulty: "normal",
  skin: "classic",
  volume: 0.5,
  pausedBySystem: false, // пауза от blur, а не от пользователя
};

/* ==============================================================
   2.1 ДОСТУП К DOM-ЭЛЕМЕНТАМ — используем все требуемые способы:
   а) по имени/порядковому номеру, б) get*(), в) query*(),
   г) специальные свойства узлов (parentNode/firstChild/...)
   ============================================================== */

// б) getElementById — точечный доступ по id
const gameEl = document.getElementById("game");
const birdEl = document.getElementById("bird");
let birdBodyEl = document.getElementById("bird-body"); // let: узел будет заменяться replaceChild()
const pipesContainer = document.getElementById("pipes-container");
const coinsContainer = document.getElementById("coins-container");
const particlesContainer = document.getElementById("particles-container");

// а) доступ по имени (name) через свойство forms документа
const settingsForm = document.forms["settingsForm"]; // <form name="settingsForm">
// а) доступ по порядковому номеру: первая кнопка меню — через children[0]
const firstMenuButton = document.querySelector(".menu-buttons").children[0];

// в) querySelectorAll — коллекция экранов по CSS-классу
const allScreens = document.querySelectorAll(".screen");
// б) getElementsByClassName — ещё один способ получить коллекцию (live-коллекция)
const menuButtonGroups = document.getElementsByClassName("menu-buttons");

/* ============================== ПТИЧКА =================================== */
const bird = {
  element: birdEl,
  x: window.innerWidth * 0.2,
  y: window.innerHeight / 2,
  velocity: 0,
  width: 50,
  height: 40,
};

/* ============================= ЗВУК =====================================
   HTMLMediaElement сам генерирует событие "volumechange" при изменении
   свойства .volume — используем это как пример события, НЕ связанного
   напрямую с действием пользователя (п. "обработка событий браузера").
   ========================================================================= */
const sfxJump = document.getElementById("sfx-jump");
const sfxCoin = document.getElementById("sfx-coin");
const volumeValueLabel = document.getElementById("volume-value");

[sfxJump, sfxCoin].forEach((audio) => {
  audio.addEventListener("volumechange", () => {
    volumeValueLabel.textContent = Math.round(audio.volume * 100) + "%";
  });
});

function setVolume(v) {
  state.volume = v;
  sfxJump.volume = v; // изменение свойства -> событие volumechange сработает само
  sfxCoin.volume = v;
}

function playSound(audio) {
  try {
    audio.currentTime = 0;
    // audio.play() возвращает Promise — используем его (обработка события через Promise)
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        /* автоплей может быть заблокирован браузером — это нормально для лаб. работы */
      });
    }
  } catch (e) {
    /* игнорируем: короткий data-uri звук может не поддерживаться в некоторых браузерах */
  }
}

/* ============================= ТРУБЫ ===================================== */
const pipes = {
  container: pipesContainer,
  list: [],
  spawnTimer: 0,

  spawn() {
    const cfg = DIFFICULTY[state.difficulty];
    const gameHeight = window.innerHeight;
    const playableHeight = gameHeight - FLOOR_HEIGHT;
    const maxTopHeight = playableHeight - cfg.gap - MIN_PIPE_HEIGHT;
    const topHeight = Math.random() * (maxTopHeight - MIN_PIPE_HEIGHT) + MIN_PIPE_HEIGHT;

    const topPipe = document.createElement("div");
    topPipe.className = "pipe pipe--top";
    topPipe.style.height = topHeight + "px";
    topPipe.style.top = "0";
    // 2.2.б setAttribute — храним флаг "уже засчитана" как строковый атрибут
    topPipe.setAttribute("data-scored", "false");
    this.container.appendChild(topPipe); // append через appendChild()

    const bottomPipe = document.createElement("div");
    bottomPipe.className = "pipe pipe--bottom";
    const bottomHeight = playableHeight - topHeight - cfg.gap;
    bottomPipe.style.height = bottomHeight + "px";
    bottomPipe.style.top = topHeight + cfg.gap + "px";
    // Вставляем нижнюю трубу СРАЗУ ПОСЛЕ верхней, используя after()
    topPipe.after(bottomPipe);

    this.list.push({
      topElement: topPipe,
      x: window.innerWidth,
      topHeight,
      gap: cfg.gap,
    });

    // Монета в просвете между трубами (не всегда)
    if (Math.random() < COIN_CHANCE) {
      coins.spawn(window.innerWidth + PIPE_WIDTH / 2, topHeight + cfg.gap / 2);
    }
  },

  // Получаем нижнюю трубу через связь узлов nextSibling, а не через отдельное поле объекта
  getBottomElement(pipe) {
    return pipe.topElement.nextSibling; // 2.1.г специальное свойство узла
  },

  update(deltaTime) {
    const cfg = DIFFICULTY[state.difficulty];
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= cfg.spawn) {
      this.spawn();
      this.spawnTimer = 0;
    }

    for (const pipe of this.list) {
      pipe.x -= cfg.speed * deltaTime;
      pipe.topElement.style.transform = `translateX(${pipe.x}px)`;
      this.getBottomElement(pipe).style.transform = `translateX(${pipe.x}px)`;
    }

    this.list = this.list.filter((pipe) => {
      if (pipe.x < -PIPE_WIDTH) {
        // Демонстрация удаления через parentNode.removeChild()
        const bottom = this.getBottomElement(pipe);
        pipe.topElement.parentNode.removeChild(pipe.topElement);
        if (bottom) bottom.remove();
        return false;
      }
      return true;
    });
  },

  checkScoring() {
    for (const pipe of this.list) {
      const scored = pipe.topElement.getAttribute("data-scored") === "true";
      if (!scored && pipe.x + PIPE_WIDTH < bird.x) {
        pipe.topElement.setAttribute("data-scored", "true");
        addScore(1);
      }
    }
  },

  checkCollisions() {
    const birdRect = { left: bird.x, right: bird.x + bird.width, top: bird.y, bottom: bird.y + bird.height };
    for (const pipe of this.list) {
      if (pipe.x > bird.x + bird.width + 50) continue;
      if (pipe.x + PIPE_WIDTH < bird.x - 50) continue;

      const topRect = { left: pipe.x, right: pipe.x + PIPE_WIDTH, top: 0, bottom: pipe.topHeight };
      const gameHeight = window.innerHeight;
      const bottomRect = {
        left: pipe.x, right: pipe.x + PIPE_WIDTH,
        top: pipe.topHeight + pipe.gap, bottom: gameHeight - FLOOR_HEIGHT,
      };
      if (isColliding(birdRect, topRect) || isColliding(birdRect, bottomRect)) return true;
    }
    return false;
  },

  clear() {
    // Демонстрация очистки через firstChild в цикле
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.list = [];
    this.spawnTimer = 0;
  },
};

/* ============================== МОНЕТЫ ==================================== */
const coins = {
  container: coinsContainer,
  list: [],

  spawn(x, centerY) {
    const el = document.createElement("div");
    el.className = "coin";
    el.style.left = x + "px";
    el.style.top = centerY - 13 + "px";
    el.setAttribute("data-value", "1"); // 2.2.б атрибут-как-строка
    this.container.append(el);
    this.list.push({ element: el, x, y: centerY, collected: false });
  },

  update(deltaTime) {
    const cfg = DIFFICULTY[state.difficulty];
    for (const coin of this.list) {
      coin.x -= cfg.speed * deltaTime;
      // Двигаем монету через свойство left, а не через transform: у монеты уже есть
      // CSS-анимация вращения (transform: scaleX(...)), и обе манипуляции с transform
      // конфликтовали бы — анимация переопределяла бы позицию на каждом кадре.
      coin.element.style.left = coin.x + "px";
    }
    this.list = this.list.filter((c) => {
      if (c.x < -40) {
        c.element.remove();
        return false;
      }
      return true;
    });
  },

  checkCollect() {
    const birdCenterX = bird.x + bird.width / 2;
    const birdCenterY = bird.y + bird.height / 2;
    for (const coin of this.list) {
      if (coin.collected) continue;
      const dx = coin.x - birdCenterX;
      const dy = coin.y - birdCenterY;
      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        coin.collected = true;
        collectCoin(coin);
      }
    }
  },

  clear() {
    for (const c of this.list) c.element.remove();
    this.list = [];
  },
};

function collectCoin(coin) {
  state.coinsThisRun += Number(coin.element.getAttribute("data-value")); // getAttribute()
  playSound(sfxCoin);

  // Всплывающая надпись "+1": вставляем в начало контейнера через prepend()
  const splash = document.createElement("span");
  splash.className = "splash";
  splash.textContent = "+1";
  splash.style.left = coin.element.style.left;
  splash.style.top = coin.element.style.top;
  particlesContainer.prepend(splash);
  // 2.4 non-user event: animationend — удаляем всплеск, когда CSS-анимация завершится
  splash.addEventListener("animationend", (ev) => {
    ev.target.remove();
  });

  coin.element.classList.add("collected");
  coin.element.addEventListener("animationend", () => coin.element.remove(), { once: true });

  // 2.5 Пользовательское (кастомное) событие: "монета собрана"
  const evt = new CustomEvent("coin:collected", {
    bubbles: true,
    detail: { total: state.coinsThisRun },
  });
  gameEl.dispatchEvent(evt);
}

// Слушаем собственное кастомное событие отдельно от места его создания —
// это и есть демонстрация пользовательского события из методички.
const coinDisplay = document.getElementById("coin-display");
gameEl.addEventListener("coin:collected", (e) => {
  coinDisplay.textContent = `Монеты: ${e.detail.total}`;
});

/* ======================== СЧЁТ И УРОВНИ (custom event) =================== */
const scoreDisplay = document.getElementById("score-display");
const levelDisplay = document.getElementById("level-display");
const levelUpBanner = document.getElementById("level-up-banner");

function addScore(amount) {
  state.score += amount;
  scoreDisplay.textContent = String(state.score); // textContent

  const newLevel = Math.floor(state.score / 5) + 1;
  if (newLevel !== state.level) {
    state.level = newLevel;
    levelDisplay.textContent = `Уровень ${state.level}`;
    // Пользовательское событие "уровень пройден / новый уровень"
    gameEl.dispatchEvent(new CustomEvent("level:up", { detail: { level: state.level } }));
  }
}

gameEl.addEventListener("level:up", (e) => {
  levelUpBanner.textContent = `Уровень ${e.detail.level}!`;
  levelUpBanner.classList.remove("playing");
  // перезапуск CSS-анимации
  void levelUpBanner.offsetWidth;
  levelUpBanner.classList.add("playing");
});

/* ============================ СТОЛКНОВЕНИЯ ================================ */
function isColliding(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/* ============================== ИГРОВОЙ ЦИКЛ =============================== */
let lastTime = 0;
function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (state.current === GameState.PLAYING) {
    update(deltaTime);
    checkCollisions();
  }
  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  bird.velocity += GRAVITY * deltaTime;
  bird.y += bird.velocity * deltaTime;

  const rotation = Math.max(-30, Math.min(90, bird.velocity / 10));
  bird.element.style.transform = `translate(${bird.x}px, ${bird.y}px) rotate(${rotation}deg)`;

  pipes.update(deltaTime);
  coins.update(deltaTime);
  pipes.checkScoring();
  coins.checkCollect();
}

function checkCollisions() {
  const gameHeight = window.innerHeight;
  const floorY = gameHeight - FLOOR_HEIGHT - bird.height;

  if (bird.y > floorY) {
    bird.y = floorY;
    gameOver();
    return;
  }
  if (bird.y < 0) {
    bird.y = 0;
    bird.velocity = 0;
  }
  if (pipes.checkCollisions()) gameOver();
}

function jump() {
  if (state.current === GameState.PLAYING) {
    bird.velocity = JUMP_STRENGTH;
    playSound(sfxJump);
  }
}

/* ==================== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ (transitionend) ================ */
function showScreen(id) {
  allScreens.forEach((s) => {
    if (s.id === id) {
      s.classList.remove("hidden");
      // .setAttribute для aria-hidden — демонстрация работы с атрибутами
      s.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => s.classList.add("visible"));
    } else {
      s.classList.remove("visible");
      s.setAttribute("aria-hidden", "true");
    }
  });
}
function hideAllScreens() {
  allScreens.forEach((s) => {
    s.classList.remove("visible");
    s.setAttribute("aria-hidden", "true");
  });
}
// Событие transitionend: прячем экран физически из потока после ухода прозрачности, чтобы вернуть класс hidden
allScreens.forEach((s) => {
  s.addEventListener("transitionend", (e) => {
    if (e.propertyName === "opacity" && !s.classList.contains("visible")) {
      s.classList.add("hidden");
    }
  });
});

/* ============================== ПРОМИС: ОТСЧЁТ ============================= */
// 3-й способ привязки обработчиков — через объект Promise.
// Промис завершается по-разному:
//   resolve() — отсчёт дошёл до нуля, можно начинать игру;
//   reject()  — отсчёт отменили (клавиша Esc или уход со страницы), игра не стартует.
let cancelCountdown = null; // функция отмены текущего отсчёта (null, если отсчёта нет)

function countdown(seconds) {
  const numberEl = document.getElementById("countdown-number");
  hideAllScreens();
  document.getElementById("screen-countdown").classList.remove("hidden");
  showScreen("screen-countdown");

  return new Promise((resolve, reject) => {
    let n = seconds;
    numberEl.textContent = String(n);
    const timer = setInterval(() => {
      n--;
      if (n > 0) {
        numberEl.textContent = String(n);
      } else {
        clearInterval(timer);
        cancelCountdown = null;
        resolve();
      }
    }, 700);

    cancelCountdown = () => {
      clearInterval(timer);
      cancelCountdown = null;
      reject(new Error("Отсчёт отменён игроком"));
    };
  });
}

// "Асинхронная загрузка профиля игрока" (в реальном проекте здесь мог бы быть fetch).
// resolve() — данные прочитаны; reject() — хранилище недоступно или данные повреждены.
function loadProfileAsync() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const high = parseInt(localStorage.getItem("highScore") || "0", 10);
        const coins = parseInt(localStorage.getItem("coins") || "0", 10);
        if (Number.isNaN(high) || Number.isNaN(coins)) {
          reject(new Error("Данные профиля повреждены"));
          return;
        }
        state.highScore = high;
        state.coins = coins;
        resolve();
      } catch (e) {
        // например, localStorage запрещён настройками браузера
        reject(new Error("Хранилище недоступно: " + e.message));
      }
    }, 150);
  });
}

/* ============================ УПРАВЛЕНИЕ СОСТОЯНИЯМИ ======================= */
async function startGame() {
  const startBtn = document.getElementById("btn-start");
  startBtn.disabled = true;
  state.current = GameState.COUNTDOWN;

  try {
    await countdown(3);
  } catch (err) {
    // сработал reject() — отсчёт отменили, возвращаемся в меню
    startBtn.removeAttribute("disabled");
    showMenu();
    return;
  }
  startBtn.removeAttribute("disabled");

  state.current = GameState.PLAYING;
  state.score = 0;
  state.level = 1;
  state.coinsThisRun = 0;

  bird.y = window.innerHeight / 2;
  bird.velocity = 0;

  pipes.clear();
  coins.clear();

  hideAllScreens();
  scoreDisplay.classList.remove("hidden");
  levelDisplay.classList.remove("hidden");
  coinDisplay.classList.remove("hidden");
  coinDisplay.textContent = "Монеты: 0";
  scoreDisplay.textContent = "0";
  levelDisplay.textContent = "Уровень 1";
}

function gameOver() {
  state.current = GameState.GAME_OVER;
  let isRecord = false;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("highScore", String(state.highScore));
    isRecord = true;
  }
  state.coins += state.coinsThisRun;
  localStorage.setItem("coins", String(state.coins));

  scoreDisplay.classList.add("hidden");
  levelDisplay.classList.add("hidden");
  coinDisplay.classList.add("hidden");

  const title = document.getElementById("gameover-title");
  if (isRecord) {
    // Замена заголовка целиком через replaceWith() — демонстрация метода замены узла
    const newTitle = document.createElement("h2");
    newTitle.id = "gameover-title";
    newTitle.textContent = "🏆 Новый рекорд!";
    title.replaceWith(newTitle);
  } else {
    title.textContent = "Игра окончена";
  }

  // Короткая подпись под счётом. Старую удаляем через remove(), новую вставляем
  // двумя разными способами: insertBefore() при рекорде и before() в остальных случаях.
  const oldNote = document.getElementById("gameover-note");
  if (oldNote) oldNote.remove();
  const note = document.createElement("p");
  note.id = "gameover-note";
  const buttons = document.querySelector("#screen-gameover .menu-buttons");
  if (isRecord) {
    note.innerText = "Так держать!";
    buttons.parentNode.insertBefore(note, buttons);
  } else {
    note.innerText = "Попробуйте ещё раз!";
    buttons.before(note);
  }

  hideAllScreens();
  showScreen("screen-gameover");
  gameEl.dispatchEvent(new CustomEvent("game:over", { detail: { score: state.score, coins: state.coinsThisRun } }));
}

// Итоги раунда выводим в обработчике пользовательского события game:over
gameEl.addEventListener("game:over", (e) => {
  document.getElementById("final-score").textContent = e.detail.score;
  document.getElementById("high-score-gameover").textContent = state.highScore;
  document.getElementById("coins-collected").textContent = e.detail.coins;
});

function showMenu() {
  state.current = GameState.MENU;
  hideAllScreens();
  showScreen("screen-menu");
  document.getElementById("high-score").textContent = state.highScore;
  document.getElementById("total-coins").textContent = state.coins;
}

/* ============================== ПАУЗА (focus/blur) ========================= */
function pauseGame(bySystem) {
  if (state.current !== GameState.PLAYING) return;
  state.current = GameState.PAUSED;
  state.pausedBySystem = !!bySystem;
  showScreen("screen-pause");
}
function resumeGame() {
  if (state.current !== GameState.PAUSED) return;
  state.current = GameState.PLAYING;
  hideAllScreens();
}

// Событие blur/focus у window — событие, НЕ связанное напрямую с действием игрока
window.addEventListener("blur", () => {
  if (cancelCountdown) cancelCountdown(); // уход со страницы во время отсчёта — reject
  pauseGame(true);
});

/* ================================ ВВОД ====================================== */
function handlePrimaryAction() {
  if (state.current === GameState.MENU) startGame();
  else if (state.current === GameState.PLAYING) jump();
  else if (state.current === GameState.PAUSED) resumeGame();
  else if (state.current === GameState.GAME_OVER) showMenu();
}

// -- Клавиатура (keydown/keyup) --
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // Event.preventDefault() — отменяем прокрутку страницы
    handlePrimaryAction();
    birdBodyEl.classList.add("pressed"); // птичка слегка сплющивается, пока клавиша зажата
  } else if (e.key === "Escape") {
    if (cancelCountdown) cancelCountdown(); // Esc во время отсчёта — reject
  } else if (e.key.toLowerCase() === "p") {
    if (state.current === GameState.PLAYING) pauseGame(false);
    else if (state.current === GameState.PAUSED) resumeGame();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") birdBodyEl.classList.remove("pressed");
});

// -- Мышь (click) с использованием target/currentTarget --
gameEl.addEventListener("click", (e) => {
  if (e.target.closest("button, input, label, .skin-swatch, form")) return;
  handlePrimaryAction();
});

// -- Наведение мыши (mouseenter/mouseleave) на первую кнопку меню, доступ по индексу --
firstMenuButton.addEventListener("mouseenter", () => firstMenuButton.classList.add("glow"));
firstMenuButton.addEventListener("mouseleave", () => firstMenuButton.classList.remove("glow"));

// -- Сенсорные события (touchstart/touchend) --
gameEl.addEventListener(
  "touchstart",
  (e) => {
    if (e.target.closest("button, input, label, .skin-swatch")) return;
    e.preventDefault();
    handlePrimaryAction();
  },
  { passive: false }
);
gameEl.addEventListener("touchend", () => {
  /* можно расширить (например, для свайпов); оставлено как точка расширения */
});

/* ============================ КНОПКИ МЕНЮ =================================== */
// 1-й способ привязки: on*-свойство объекта (а не addEventListener)
document.getElementById("btn-start").onclick = startGame;

document.getElementById("btn-record").addEventListener("click", () => {
  document.getElementById("high-score").textContent = state.highScore;
  document.getElementById("total-coins").textContent = state.coins;
  hideAllScreens();
  showScreen("screen-record");
});
document.getElementById("btn-back-from-record").addEventListener("click", showMenu);

document.getElementById("btn-settings").addEventListener("click", () => {
  hideAllScreens();
  showScreen("screen-settings");
});
document.getElementById("btn-back-from-settings").addEventListener("click", showMenu);

document.getElementById("btn-restart").addEventListener("click", startGame);
document.getElementById("btn-to-menu").addEventListener("click", showMenu);

/* ============================== ФОРМА НАСТРОЕК =============================== */
// доступ к элементам формы по имени (settingsForm.volume, settingsForm.elements['difficulty'])
settingsForm.volume.addEventListener("input", (e) => {
  setVolume(Number(e.target.value) / 100);
});
settingsForm.volume.addEventListener("focus", (e) => e.target.parentElement.style.outline = "2px solid #ffd23f");
settingsForm.volume.addEventListener("blur", (e) => e.target.parentElement.style.outline = "none");

Array.from(settingsForm.elements["difficulty"]).forEach((radio) => {
  radio.addEventListener("change", (e) => {
    state.difficulty = e.target.value;
  });
});

/* ==================== DRAG AND DROP — выбор скина птички (DragEvent) ========= */
const dropZone = document.getElementById("drop-zone");
document.querySelectorAll(".skin-swatch").forEach((swatch) => {
  swatch.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", swatch.getAttribute("data-skin"));
    e.dataTransfer.effectAllowed = "copy";
    swatch.classList.add("dragging");
  });
  swatch.addEventListener("dragend", () => swatch.classList.remove("dragging"));
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault(); // обязательно, иначе drop не сработает
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const skin = e.dataTransfer.getData("text/plain");
  applySkin(skin);
});

function applySkin(skin) {
  state.skin = skin;
  // Замена className через createElement + replaceChild — иллюстрация метода replaceChild()
  const newBody = birdBodyEl.cloneNode(true);
  newBody.id = "bird-body";
  newBody.className = "bird-body" + (skin !== "classic" ? " skin-" + skin : "");
  birdBodyEl.parentNode.replaceChild(newBody, birdBodyEl);
  birdBodyEl = newBody; // обновляем ссылку на актуальный узел в DOM-дереве
}

/* ================================ ИНИЦИАЛИЗАЦИЯ ============================== */
async function init() {
  try {
    await loadProfileAsync(); // Promise-based загрузка
  } catch (err) {
    // сработал reject() — используем значения по умолчанию и чистим повреждённые данные
    state.highScore = 0;
    state.coins = 0;
    try { localStorage.removeItem("highScore"); localStorage.removeItem("coins"); } catch (e) { /* хранилище недоступно */ }
    console.warn(err.message + " — профиль сброшен");
  }
  bird.element.style.transform = `translate(${bird.x}px, ${bird.y}px)`;
  showMenu();
  requestAnimationFrame(gameLoop);
}

init();
