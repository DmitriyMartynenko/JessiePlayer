# Jessie Player

A desktop animation viewer for **Lottie**, **JSON**, **WebM**, and **GIF** files — built with Electron + React.

![Jessie Player](icons/icon-256.png)

---

## Features

- **View mode** — plays animations with zoom, pan, and speed control
- **Creator mode** — composite animations over a custom background image
- **Export** — render to MP4, WebM, or GIF
- **File browser** — sidebar for navigating directories
- **Recent files** — quick access to last opened files
- **Diagnostics panel** — detailed animation info (dimensions, FPS, layers, warnings)
- **Customizable background** — color picker with opacity control
- **Auto-update** — installed copies are notified when a new version is released

## Supported formats

| Format | Notes |
|--------|-------|
| `.json` | Lottie animation (JSON) |
| `.lottie` | Lottie animation (zip container) |
| `.webm` | WebM video |
| `.gif` | Animated GIF |

## Installation

Download the latest installer from the [**Releases**](../../releases/latest) page:

- **Windows** — `Jessie-Player-Setup-x.x.x.exe`

Run the installer — no additional setup required. The app will notify you automatically when updates are available.

## Usage

1. **Open a file** — drag and drop onto the window, or click anywhere to browse
2. **Play / Pause** — `Space`
3. **Switch mode** — toggle between **View** and **Creator** in the top-right corner
4. **Export** — click the export button in the bottom bar
5. **File browser** — click the folder icon in the bottom-right to open the sidebar

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run electron:dev

# Build Windows installer
npm run dist:win
```

**Stack:** Electron 30 · React 18 · TypeScript 5 · Vite 5 · Tailwind 4 · lottie-web · Zustand

## Author

**Dmytro Martynenko**
[LinkedIn](https://www.linkedin.com/in/dmytromartynenko/) · [GitHub](https://github.com/DmitriyMartynenko)

---
---

# Jessie Player

Десктопний переглядач анімацій для файлів **Lottie**, **JSON**, **WebM** та **GIF** — побудований на Electron + React.

---

## Можливості

- **Режим перегляду (View)** — відтворення анімацій із масштабуванням, переміщенням та контролем швидкості
- **Режим Creator** — накладання анімацій на власне фонове зображення
- **Експорт** — рендеринг у MP4, WebM або GIF
- **Браузер файлів** — бічна панель для навігації по директоріях
- **Останні файли** — швидкий доступ до нещодавно відкритих файлів
- **Панель діагностики** — детальна інформація про анімацію (розміри, FPS, шари, попередження)
- **Налаштування фону** — вибір кольору з регулюванням прозорості
- **Автооновлення** — встановлені копії отримують сповіщення про нові версії

## Підтримувані формати

| Формат | Опис |
|--------|------|
| `.json` | Lottie-анімація (JSON) |
| `.lottie` | Lottie-анімація (zip-контейнер) |
| `.webm` | WebM відео |
| `.gif` | Анімований GIF |

## Встановлення

Завантажте останній інсталятор зі сторінки [**Releases**](../../releases/latest):

- **Windows** — `Jessie-Player-Setup-x.x.x.exe`

Запустіть інсталятор — додаткове налаштування не потрібне. Програма автоматично повідомить вас про вихід нових версій.

## Використання

1. **Відкрити файл** — перетягніть на вікно або натисніть будь-де для вибору через браузер
2. **Відтворення / Пауза** — `Пробіл`
3. **Змінити режим** — перемикач між **View** та **Creator** у правому верхньому куті
4. **Експорт** — кнопка експорту на нижній панелі
5. **Браузер файлів** — іконка папки у правому нижньому куті

## Розробка

```bash
# Встановити залежності
npm install

# Запустити в режимі розробки (hot reload)
npm run electron:dev

# Зібрати Windows-інсталятор
npm run dist:win
```

**Стек:** Electron 30 · React 18 · TypeScript 5 · Vite 5 · Tailwind 4 · lottie-web · Zustand

## Автор

**Dmytro Martynenko**
[LinkedIn](https://www.linkedin.com/in/dmytromartynenko/) · [GitHub](https://github.com/DmitriyMartynenko)
