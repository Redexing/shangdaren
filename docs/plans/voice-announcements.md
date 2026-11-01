# Voice announcements for draws and the call that settles them

Plan for [issue #6](https://github.com/Redexing/shangdaren/issues/6). This document is the review copy. No game code changes with it.

Spoken audio is Mandarin only. The English UI stays English. The clips say the Chinese terms.

## Decide before implementation

1. **Readings** in the lexicon below, especially 几 `jǐ`, 和 `hú`, 绍 `shào`, 作 `zuò`, 大 `dà`, 上 `shàng`, and 不要 `bú yào`.
2. **Voices.** The three clips in `samples/` are the set we can render with no API key: 晓晓 (female), 云健 (male), 云扬 (male). Confirm that trio, or swap the female for an older Azure voice before any full render.
3. **Who says 不要.** Recommended: the player who declines the passed card (the downstream player). The drawer's earlier pass stays silent, because the next player may still take the card.
4. **Which calls are spoken.** Recommended: every meld the engine can form, plus 和, plus that closing 不要. Discard, 没有碰, and 包子 stay silent in this slice.

## What the table says

Two moments per card that comes off the deck:

1. The freshly drawn card is named in the **drawer's** voice, as soon as it is shown.
2. The **final** call on that card is spoken in the **player who makes that call**'s voice.

| What happened | Spoken line | Voice |
|---|---|---|
| A card is drawn from the deck | That character | Drawer |
| Someone forms a meld with it (吃, 口, 碰, 绍, 下扯, 开招, 龙, 蛇, 半龙, 半蛇, 双龙抱柱) | That meld name | The player who forms it |
| Someone declares 和 on it | 和 | The player who wins |
| The drawer passes, and the next player also declines | 不要 | The player who declines the passed card |

A passed card is not named again. It was named when it was drawn.

Silence in this slice:

- The drawer's pass while the card is still offered downstream.
- An interrupt decline (the button labeled 没有碰).
- The discard that follows a meld.
- A naked four-of-a-kind revealed instead of a discard.
- 包子, an empty deck, and the game-over alert.

### Examples

Seat 0 is 晓晓, seat 1 is 云健, seat 2 is 云扬. That is the default mapping below.

**Self-drawn 绍.** Seat 1 draws 丘. 云健 says 丘. Seat 1 forms 绍. 云健 says 绍.

**Interrupt 碰.** Seat 0 draws 仁. 晓晓 says 仁. Seat 2 forms 碰. 云扬 says 碰.

**Pass, then 吃.** Seat 0 draws 生. 晓晓 says 生. Seat 0 passes. Silence. Seat 1 forms 吃. 云健 says 吃.

**Nobody wants it.** Seat 2 draws 土. 云扬 says 土. Seat 2 passes. Silence. Seat 0 declines the passed card. 晓晓 says 不要.

**Interrupt decline, then the drawer 口.** The card is named at the draw. 没有碰 is silent. The drawer forms 口 and that drawer's voice says 口.

## Lexicon

37 lines. Each line is one clip per voice. Clips are never stitched together, so tone sandhi stays inside the clip that needs it (不要).

One syllable is the full lexical tone, held long enough to hear the tone. 子 is `zǐ`, not the neutral `zi`.

### Card names

Order and glyphs follow `SUITES_DATA` in `src/js/card.js`. Four copies of a character share one clip.

| Suit | Glyph | Reading | Clip id |
|---|---|---|---|
| 上大人, red, meat | 上 | shàng | `4e0a` |
| | 大 | dà | `5927` |
| | 人 | rén | `4eba` |
| 丘乙几, black, meat | 丘 | qiū | `4e18` |
| | 乙 | yǐ | `4e59` |
| | 几 | jǐ | `51e0` |
| 化三千, red, meat | 化 | huà | `5316` |
| | 三 | sān | `4e09` |
| | 千 | qiān | `5343` |
| 七十土, black, veggie | 七 | qī | `4e03` |
| | 十 | shí | `5341` |
| | 土 | tǔ | `571f` |
| 尔小生, red, veggie | 尔 | ěr | `5c14` |
| | 小 | xiǎo | `5c0f` |
| | 生 | shēng | `751f` |
| 八九子, black, veggie | 八 | bā | `516b` |
| | 九 | jiǔ | `4e5d` |
| | 子 | zǐ | `5b50` |
| 佳作仁, red, veggie | 佳 | jiā | `4f73` |
| | 作 | zuò | `4f5c` |
| | 仁 | rén | `4ec1` |
| 可知礼, black, veggie | 可 | kě | `53ef` |
| | 知 | zhī | `77e5` |
| | 礼 | lǐ | `793c` |

人 `U+4EBA` and 仁 `U+4EC1` are both `rén`. The card face tells them apart. The call does not add a suit prefix.

The card glyph 几 is the primer line's third character (classic texts print 己). Both intended readings are `jǐ`. The furniture reading `jī` is the one to avoid.

### Calls

Chinese strings match `src/js/translations.js`.

| Engine type | Chinese | Reading | Clip id |
|---|---|---|---|
| CHI | 吃 | chī | `chi` |
| KOU | 口 | kǒu | `kou` |
| PENG | 碰 | pèng | `peng` |
| SAO | 绍 | shào | `shao` |
| XIA-CE | 下扯 | xià chě | `xia-che` |
| KAI-ZAO | 开招 | kāi zhāo | `kai-zhao` |
| DRAGON | 龙 | lóng | `long` |
| SNAKE | 蛇 | shé | `she` |
| HALF-DRAGON | 半龙 | bàn lóng | `ban-long` |
| HALF-SNAKE | 半蛇 | bàn shé | `ban-she` |
| TWO-DRAGONS-TUSSLING | 双龙抱柱 | shuāng lóng bào zhù | `shuang-long-bao-zhu` |
| HARMONY | 和 | hú | `hu` |
| PASS | 不要 | bú yào | `bu-yao` |

和 is the win call, read `hú`, the same syllable players use at a mahjong table. The citation reading `hé` is the one to avoid.

绍 follows the glossary character 绍 `shào`. The engine key `SAO` is only an identifier.

不要 is one word. 不 takes second tone in front of 要.

### Listening check after the full render

The keyless renderer used for the samples does not accept pinyin SSML. The first full render is checked by ear on these lines. If a line comes out on the wrong reading, re-render that line from the fallback script. The card face stays the real glyph.

| Glyph | Intended | Wrong reading to catch | Fallback script |
|---|---|---|---|
| 几 | jǐ | jī | 己 |
| 和 | hú | hé | 胡 |
| 作 | zuò | zuō | 做 |
| 大 | dà | dài | 大 |
| 不要 | bú yào | bù yào | 不要, as one word, slightly slower |

## Voices

Adults play this game. The two men need to be easy to tell apart in a short call. Child, teen, cartoon, and dialect voices are out.

The keyless Microsoft Edge neural list on 2026-11-01 can render three standard Mandarin voices that fit:

| Persona | Engine id | Who | Sample |
|---|---|---|---|
| 女声 | `zh-CN-XiaoxiaoNeural` | Woman, warm. The only standard Mandarin woman on this list. She reads younger than the two men. | [xiaoxiao.mp3](samples/xiaoxiao.mp3) |
| 男声甲 | `zh-CN-YunjianNeural` | Man, about 30–35, deeper and more forceful. | [yunjian.mp3](samples/yunjian.mp3) |
| 男声乙 | `zh-CN-YunyangNeural` | Man, about 35, calmer and more formal, so he does not blend with 云健. | [yunyang.mp3](samples/yunyang.mp3) |

Each sample says the same line, at the engine's default rate and pitch:

> 上。几。绍。和。不要。双龙抱柱。

That line is there so the three timbres can be compared on a fourth-tone card, on 几, on 绍, on 和, on 不要, and on the longest meld name. Clips are about 6–7 seconds, 48 kbps mono MP3.

Other Edge voices were set aside: 晓伊 (college-age, cartoon), 云希 (teen), 云夏 (child), and the Liaoning and Shaanxi dialect voices.

These older Azure neural voices do **not** render on the keyless endpoint (tried the same day: no audio): 晓颜 (`Xiaoyan`, about 30), 晓秋 (`Xiaoqiu`, about 35–40), 晓睿 (`Xiaorui`, about 50), 云泽 (`Yunze`, about 45–50), 云野 (`Yunye`, about 35–40). They can be auditioned in the [Azure voice gallery](https://speech.microsoft.com/portal/voicegallery). Use one of them only if 晓晓 is too young or the two men are too close. The game still plays local files either way. The renderer is a dev-time choice, not a runtime dependency.

### Seat mapping

Three personas, three seats. `localStorage` key `voiceSeat0` stores which persona sits at seat 0 (`xiaoxiao` by default). The other two seats take the remaining personas in the order 女声, 男声甲, 男声乙.

| Seat | Default voice |
|---|---|
| 0, You (or the first bot in a watched game) | 晓晓 |
| 1, downstream / left | 云健 |
| 2, upstream / right | 云扬 |

A watched game uses the same map. The header setting is 你的声音 / Your voice, with those three labels. 声音 / Sound is a mute toggle, `localStorage` key `voiceMuted`, default unmuted. Both strings go in `src/js/translations.js` in `zh` and `en`.

## Where it hooks into the turn

Audio stays in the presentation layer. `rules.js` stays pure. `game.js` emits one fact and does not touch the DOM or the clock. `main.js` already subscribes to events; a small `src/js/voice.js` plays them.

Event name: `VOICE_CALL`.

```js
{ playerIndex: 0 | 1 | 2, lineId: '4e0a' | 'chi' | 'hu' | 'bu-yao' | ... }
```

Emit sites, matched to the current turn code:

| Site | Emit |
|---|---|
| `drawCard`, when the deck card is shown | The character, `currentPlayerIndex` |
| `executeBotMeld` and `finalizeConfirmHumanMeld`, beside each existing `ACTION_ANNOUNCE` | That meld type, the player who formed it |
| `handleHarmony` | `hu`, the winner. Harmony has no `ACTION_ANNOUNCE` today, so the win call needs its own emit. |
| `handlePass`, the branch where this player is the current player and the card was already passed (`activeCardSource !== 'DECK'`) | `bu-yao`, that player |

`executeMeld` and `formKou` have no callers. The live meld paths are `executeBotMeld` and `finalizeConfirmHumanMeld`.

`handlePass` when the drawer passes a fresh card, and `handlePass` when another player declines an interrupt, emit nothing.

The speech bubble on `ACTION_ANNOUNCE` stays. 和 and the closing 不要 should use that same bubble, so the call is visible as well as heard. The card name needs no bubble. The card is already face up in the center.

Playback does not insert delays into `game.js`. `GAME_SPEEDS` stays the turn clock. `voice.js` keeps a queue:

- Play calls in order. The card name and its later meld call can sit one after another.
- Leave a short gap, `UI_DELAYS.VOICE_GAP`, between two queued clips.
- If a new card name arrives while something older is still queued, drop the queued leftovers and let the clip that is already playing finish. The name of the card on the table wins. Do not cut a syllable in half.
- A human thinking between the draw and the call leaves the queue empty. That gap is fine.

Browser autoplay: resume `AudioContext` inside the click on 新牌局 or 观摩机器人对局. Decode each clip once into an `AudioBuffer`. A gain node handles mute. If the context stays suspended, the bubbles and the cards still work.

Files:

```text
src/audio/xiaoxiao/<clip-id>.mp3
src/audio/yunjian/<clip-id>.mp3
src/audio/yunyang/<clip-id>.mp3
src/js/voice_lines.js    catalog: lineId, glyph, reading, file
src/js/voice.js          queue, unlock, mute, seat map
```

111 files. At the audition bitrate that is well under a megabyte. One format, MP3, so Safari and Chrome share a file. Trim only silence outside an 80 ms pad. Isolated card names and one-syllable calls should land under about 0.9 s. 双龙抱柱 under about 1.8 s.

`voice_lines.js` is the checklist. A node test imports it and asserts:

- every glyph in `SUITES_DATA` has one line
- every meld key in the Chinese translations, plus `HARMONY` and `PASS`, has one line
- no two glyphs share a clip id

A second test, in the style of `test/test_flow.js`, covers the pass rule: a fresh-card pass emits no `VOICE_CALL`, and the downstream decline emits `bu-yao`.

Service worker: when the files land, add them to `ASSETS_TO_CACHE` and bump `CACHE_NAME` past `shangdaren-v17`. `cache.addAll` fails the install if any path is missing, so the list and the files ship together. The publish allowlist in `docs/plans/auto-publish.md` and the publish skill gain `src/js/voice.js`, `src/js/voice_lines.js`, and `src/audio/`. The audition clips under `docs/plans/` stay off the site.

Dev-time render can be a Python script under `tools/`, using `edge-tts`, with no `package.json` dependency and nothing for the browser to load. Re-render is how a voice swap happens. The running game never calls a speech service, so a table still speaks offline.

## Out of this slice

A separate tile-click or shuffle sound. Issue #6 mentions sound effects in general. This plan is the voice half: the card name, and the call that settles that card.
