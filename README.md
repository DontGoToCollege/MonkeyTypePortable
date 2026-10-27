# Monkeytype Portable

An offline, portable recreation of [monkeytype](https://monkeytype.com), built from the copy installed on this PC
as a Brave web app. One `MonkeyType.exe` with no install and no internet. Settings and results live next to the exe.

## Use it

- Run `dist\MonkeyType.exe`. Copy it anywhere (a USB stick, a synced folder). It creates `MonkeyType-Data\` beside
  itself for settings, results and window position. Take that folder along to keep your history.
- Needs the Microsoft Edge **WebView2 runtime**, which is built into Windows 11. On an older Windows 10 PC without it,
  the app shows a message instead of loading.
- If the exe's folder is read-only, data falls back to `%LOCALAPPDATA%\MonkeyTypePortable`.
- Flags: `--devtools` enables the web inspector and right-click menu. `--smoke` loads the app, writes
  `MonkeyType-Data\smoke.txt` and exits (self-check).

The web app also runs on its own. Open `web\index.html` in any browser, or serve the `web\` folder. In that case its
data lives in that browser's storage instead of `MonkeyType-Data`.

## Features

- Modes: time (15/30/60/120/custom), words (10/25/50/100/custom), quote (all/short/medium/long/thicc), zen and
  custom text (simple/shuffle/random, word limit, pipe delimiter, load .txt). Punctuation and numbers toggles.
- Word sets: english (200 words), english_1k, 5k and 10k. 6,488 English quotes.
- Same scoring as monkeytype: wpm, raw, accuracy, consistency, character stats, per-second chart with errors, PB crown,
  words history with per-word burst, and practise of missed words.
- 186 themes with live preview, favorites, random theme and a custom theme editor.
- Most of monkeytype's settings: difficulty (normal/expert/master), quick restart, blind, freedom, stop on error,
  confidence, quick end, strict space, min speed/accuracy, pace caret, caret styles and smooth caret, timer and live
  stats styles, font size and family, highlight mode, typed effect, colorful mode, flip colors, focus mode, speed
  units (wpm/cpm/wps/cps/wph), and synthesized click/error sounds.
- Command line (`esc` or `ctrl+shift+p`) with single-list search for every setting and theme.
- A local **stats & history** page in place of the online account: totals, PB tables, history chart and result
  table. JSON backup/import and a results CSV export in monkeytype's column format.

Left out on purpose, because they are online-only: accounts, leaderboards, friends, ads and the merch banner. Also not
recreated: the funbox modes, the on-screen keymap, non-English languages, and the extra CSS effects that 52 themes add
on top of their colors.

## Build

```powershell
.\publish.ps1          # -> dist\MonkeyType.exe (self-contained .NET 8 WPF + WebView2, ~64 MB)
.\publish.ps1 -Run
```

- `web\`: the app (plain HTML/CSS/JS, no build step, no dependencies)
- `captured\`: data extracted from the installed monkeytype (themes, word lists, quotes, default config, icon)
- `tools\build-data.py`: turns `captured\` into `web\data\*.js`. `publish.ps1` runs it automatically.
- `tools\make-icon.ps1`: regenerates `src\MonkeyTypePortable\app.ico`
- `src\MonkeyTypePortable\`: the WPF shell. It serves `web\` from embedded resources on a private host and refuses
  every other request, so the app cannot reach the network.
- `docs\REVERSE-ENGINEERING.md`: how the original was analysed and what was taken from it

## Licence note

monkeytype is open source under GPL-3.0 (Miodec and contributors). The themes, word lists and quotes come from it, and
the quote texts belong to their authors. The fonts are Roboto Mono (Apache-2.0) and Lexend Deca (OFL), and the icons
are from Font Awesome Free (OFL). This is a personal, non-commercial recreation and is not affiliated with monkeytype.

## Download

Download `MonkeyType.exe` from the [latest release](https://github.com/DontGoToCollege/MonkeyTypePortable/releases/latest). It's a single program: no installer, just run it.

## License

GPL-3.0, the same licence as monkeytype: free for anyone to use, change and share, as long as what they share stays under GPL-3.0. See [LICENSE](LICENSE).
