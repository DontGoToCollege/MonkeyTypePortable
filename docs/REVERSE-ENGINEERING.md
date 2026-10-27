# Reverse-engineering notes

Target: the **Monkeytype** web app installed from Brave
(`%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\Default\Web Applications\_crx_picebhhlijnlefeleilfbanaghjlkkna`,
Start-menu shortcut `Brave Apps\Monkeytype.lnk`). The analysis was done on 2026-10-18 with REA (reverse-engineer-anything).

## 1. What the installed app keeps on disk

The app's Service Worker cache (`Service Worker\CacheStorage\d10d9732…`, Chromium simple-cache format, parsed with a
small extractor) holds only 4 entries:

| entry | size |
|---|---|
| `images/icons/general_icon_x512.png` | 13.7 KB |
| `images/icons/maskable_icon_x512.png` | 7.1 KB |
| `manifest.json` | 378 B |
| `webfonts/Vazirharf-NL-Regular.woff2` | 22 KB |

The service worker script (Workbox, read from V8's code cache in `ScriptCache`) precaches only the two icons and the
manifest. It routes requests as NetworkFirst for the app and `api.monkeytype.com`, and NetworkOnly for `/version.json`.

**Observation:** the installed copy does not work offline. The real app code, CSS and word lists are not on disk, which
is why this recreation exists.

## 2. Capturing the shipped app

REA `capture_browser_scenario` launched Brave headless at `https://monkeytype.com/` (service workers blocked, 6 s
settle) and kept every response body, the final DOM and a screenshot (`docs\reference-screenshot.png`).

- 25 first-party files were captured: `js/monkeytype.Bo4U-5_w.js` (780 KB main bundle), `monkeytype-packages`,
  `monkeytype-utils`, the vendor chunks, `css/monkeytype.Dn4Z6Rp1.css`, fonts, `languages/english.json` and
  `layouts/qwerty.json`. Third-party ad and tracker traffic was ignored.
- A second scenario fetched the data files that load on demand: `languages/english_1k/5k/10k.json` and
  `quotes/english.json` (6,488 quotes in 4 length groups).
- REA `analyze_javascript_application` parsed the three app bundles: 301,244 AST nodes, 0 parse failures
  (evidence `ev_fdc5d00df2d0bbc1ab302552d209760a34353c0cb4f218ff892e3bafcae9a728`). It recovered no module graph,
  only generic syntax relations, so the specific behaviours below were located by targeted searches of the same
  captured bytes. Nothing from the target was executed. Object literals were converted with regex, not `eval`.

## 3. Findings used in the recreation

| behaviour | where (captured bundle) | recreated in |
|---|---|---|
| Default config (`theme: serika_dark`, `time: 30`, `words: 50`, `smoothCaret: medium`, …) | main bundle, object starting `{theme:\`serika_dark\`` | `web/js/core.js` `defaultConfig` (offline subset); raw copy in `captured/default-config.js.txt` |
| 186 theme palettes (bg/main/caret/sub/subAlt/text/error/errorExtra/colorful*) | main bundle theme table (~offset 166 k) | `captured/themes.json` → `web/data/themes.js` |
| CSS variables a theme sets (`--bg-color` … `--colorful-error-extra-color`) | main bundle theme component | `MT.applyColors` |
| `roundTo2`, `mean`, `stdDev`, `kogasa(cov) = 100·(1 − tanh(cov + cov³/3 + cov⁵/5))` | `monkeytype-packages` helpers (offset ~1 k) | `core.js` |
| Result: `wpm = toWpm(correctWordChars)`, `raw = toWpm(allCorrect + incorrect + extra)`, `charStats = [correctWord, incorrect, extra, missed]`, accuracy = correct ÷ all input events, consistency = kogasa(stdDev ÷ mean) over raw speed per second | main bundle result builder (`wpm:Ze(kr(t.correctWord,a))…`), `jb` (accuracy), `bb` (per-second speed) | `test.js` `buildResult`, `countChars` |
| Word pick: re-roll up to 100 times if the word equals either of the previous two, is `I`/contains punctuation without punctuation mode, or has digits without numbers mode. Lowercase unless punctuation. Numbers mode: 10 % chance of a 1–4 digit number | main bundle word generator | `words.js` `languageSource` |
| Punctuation routine `uw`: capitalise sentence starts. `.`/`?`/`!` with 10 % chance (forced on the last word). Quotes 1 %, apostrophes 1.1 %, brackets 1.2 %, `:` 1.3 %, `-` 1.4 %, `;` 1.5 %, `,` 20 %, contraction 50 % | main bundle `uw`, contraction table `rw` | `words.js` `punctuateWord` (English branch) |
| Quote length groups `[[0,100],[101,300],[301,600],[601,9999]]` | `quotes/english.json` | `words.js` `quoteSource` |
| Custom duration parser (`1m30s`, `1h`) | main bundle `Qj` | `app.js` `parseDuration` |
| Typing-area CSS: letter colour variables, `correct/incorrect/extra` letters, `.word.error` underline, caret classes (`default .1em`, `block`, `outline`, `underline`), `caretFlashSmooth`, `--roundness: .5rem`, blind/colorful/flipped variants | `css/monkeytype.Dn4Z6Rp1.css` | `web/css/style.css` |
| Results CSV columns | `monkeytype-utils` `In` | `pages.js` `exportCsv` |
| Speed units and factors (wpm 1, cpm 5, …) | main bundle class `jr` | `core.js` `speedUnits` |

## 4. Design choices (not observed in the original)

- The UI is a fresh implementation in plain JS: no Solid/TanStack, no Chart.js. The result and history charts are
  drawn on canvas.
- Click and error sounds are synthesized with WebAudio, because monkeytype's sound files were not captured.
- The online account is replaced by a local stats and history page backed by `localStorage`. In the exe that storage
  lives in `MonkeyType-Data\WebView2`.
- Multi-language support, the funbox modes, the keymap and the extra per-theme CSS were not recreated.

## 5. Unknowns and limits

- The exact last-partial-second handling in monkeytype's chart was approximated: a trailing fraction above 0.1 s is
  added as one more sample.
- AFK detection, key-spacing consistency and some anti-cheat checks were not recreated. Invalid tests are limited to
  duration under 1 s or wpm above 350.
- The capture is a snapshot of monkeytype as served on 2026-10-18. Later upstream changes are not reflected.
