import { Game, EVENTS } from './game.js';
import { Rules } from './rules.js';
import { TRANSLATIONS } from './translations.js';
import { UI_DELAYS } from './constants.js';

const app = document.getElementById('app');
const gameBoard = document.getElementById('game-board');
let btnDraw, btnDiscard, btnKou;

const game = new Game();

// UI State
let selectedHandIndex = -1;
let selectedAction = null; // { type, cards }
let currentLang = localStorage.getItem('language') || 'zh';
let lastCarouselSlot = 1; // Start at slot 1 (Player 0)
let lastRenderedTurn = -1;
let isCarouselScrolling = false;
let lastPlayerFingerprint = ''; // Tracks player state for selective re-render
let lastHeaderLang = ''; // Guards setupHeader from rebuilding on every render

function t(key) {
    return TRANSLATIONS[currentLang][key] || key;
}

function init() {
    setupHeader();
    setupDashboard();

    // Scroll handling for header
    let lastScrollTop = 0;
    gameBoard.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        const st = gameBoard.scrollTop;
        if (st > lastScrollTop && st > 50) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        lastScrollTop = st;
    });

    game.on(EVENTS.STATE_CHANGE, render);
    game.on(EVENTS.LOG, (msg) => {
        console.log(`[GAME] ${msg}`);
    });
    game.on(EVENTS.GAME_OVER, (result) => {
        let msg = `${t('Game Over! Winner: ')}${result.winner ? result.winner.name : t('None')}`;
        if (result.special === 'BAO-ZI') {
            const rawName = result.triggerPlayer ? result.triggerPlayer.name : '';
            const translatedTriggerName = rawName.split(' ').map(part => t(part)).join(' ');
            msg = `${t('Game Over!')} ${translatedTriggerName} ${t('is BAO-ZI (no cards to discard).')} ${t('Everyone else wins!')}`;
        }
        alert(msg);
    });

    game.on('ACTION_ANNOUNCE', ({ playerIndex, type }) => {
        const playerEl = document.querySelector(`.player-${playerIndex}`);
        if (playerEl) {
            const bubble = document.createElement('div');
            bubble.className = 'speech-bubble';
            bubble.textContent = t(type);
            // Position near player area
            const rect = playerEl.getBoundingClientRect();
            bubble.style.top = `${rect.top + 20}px`;
            bubble.style.left = `${rect.left + rect.width / 2}px`;
            document.body.appendChild(bubble);
            setTimeout(() => bubble.remove(), UI_DELAYS.ANNOUNCEMENT_BUBBLE);
        }
    });

    render();
}

function setupHeader() {
    // Only rebuild if language actually changed — avoids per-render DOM churn
    if (currentLang === lastHeaderLang) return;
    lastHeaderLang = currentLang;

    const settingsContainer = document.getElementById('header-settings');
    settingsContainer.innerHTML = '';

    const settings = document.createElement('div');
    settings.className = 'settings-panel';

    const label = document.createElement('label');
    label.textContent = t('Language') + ': ';

    const select = document.createElement('select');
    select.id = 'lang-select';
    const optZh = document.createElement('option');
    optZh.value = 'zh';
    optZh.textContent = '简体中文';
    const optEn = document.createElement('option');
    optEn.value = 'en';
    optEn.textContent = 'English';
    select.appendChild(optZh);
    select.appendChild(optEn);
    select.value = currentLang;

    select.onchange = (e) => {
        currentLang = e.target.value;
        localStorage.setItem('language', currentLang);
        // Bust both caches so header + player panel re-translate on next render
        lastHeaderLang = '';
        lastPlayerFingerprint = '';
        render();
    };

    settings.appendChild(label);
    settings.appendChild(select);
    settingsContainer.appendChild(settings);

    // Update breadcrumb links translations
    document.getElementById('link-about').textContent = t('About');
    document.getElementById('link-how-to').textContent = t('How-to');
    document.getElementById('link-versions').textContent = t('Versions');
}

function setupDashboard() {
    const controls = document.getElementById('controls');
    controls.innerHTML = '';

    btnDraw = document.createElement('button');
    btnDraw.id = 'btn-draw';
    btnDraw.textContent = t('Draw');
    btnDraw.onclick = () => game.handlePlayerDraw();
    controls.appendChild(btnDraw);

    const deckArea = document.getElementById('deck-area');
    if (deckArea) {
        deckArea.onclick = () => {
            if (!btnDraw.disabled) game.handlePlayerDraw();
        };
        deckArea.style.cursor = 'pointer';
    }

    btnDiscard = document.createElement('button');
    btnDiscard.id = 'btn-discard';
    btnDiscard.textContent = t('CONFIRM DISCARD');
    btnDiscard.disabled = true;
    controls.appendChild(btnDiscard);

    btnKou = document.createElement('button');
    btnKou.id = 'btn-kou';
    btnKou.style.display = 'none';

    if (!document.getElementById('btn-watch')) {
        const watchBtn = document.createElement('button');
        watchBtn.id = 'btn-watch';
        watchBtn.onclick = () => {
            lastCarouselSlot = 1;
            lastRenderedTurn = -1;
            game.init(true);
            render();
        };
        controls.prepend(watchBtn);

        const newBtn = document.createElement('button');
        newBtn.id = 'btn-new-game';
        newBtn.onclick = () => {
            lastCarouselSlot = 1;
            lastRenderedTurn = -1;
            game.init(false);
            render();
        };
        controls.prepend(newBtn);
    }
}

// Compute a lightweight fingerprint of all player state that affects the player DOM.
// When only the dashboard changes (deck count, active card, buttons), skip renderPlayers.
function playerFingerprint() {
    if (!game.players || game.players.length === 0) return '';
    // Include highlighted card IDs so that blue-border animations still trigger a rebuild
    const highlights = (game.highlightedCards || []).map(c => c.id).sort().join(',');
    const selAction = selectedAction ? selectedAction.type : 'none';
    return game.players.map(p =>
        `${p.hand.length}|${p.exposed.length}|${p.discards.length}|${p.passedCards.length}`
    ).join('/') + `@${game.currentPlayerIndex}@${game.turnPhase}@hl:${highlights}@sel:${selectedHandIndex}@act:${selAction}`;
}

function render() {
    setupHeader(); // Re-render header for lang

    const fp = playerFingerprint();
    if (fp !== lastPlayerFingerprint) {
        lastPlayerFingerprint = fp;
        renderPlayers();
    } else if (window.innerWidth <= 800) {
        // Even when player data hasn't changed, re-apply the carousel position
        // so a rapid STATE_CHANGE that only updates the dashboard doesn't leave
        // the carousel drifted after a DOM rebuild was skipped.
        restoreCarouselPosition();
    }

    renderCommunityArea();
    updateControls();
}

function renderCommunityArea() {
    const deckArea = document.getElementById('deck-area');
    const centerDiscard = document.getElementById('center-discard');

    if (!deckArea || !centerDiscard) return;

    // Deck
    const count = game.deck.cards.length;
    deckArea.innerHTML = '';
    const deckVisual = document.createElement('div');
    deckVisual.className = 'card back';
    deckVisual.style.width = '100%';
    deckVisual.style.height = '100%';
    deckVisual.style.fontSize = (window.innerWidth < 600) ? '10px' : '12px';
    deckVisual.style.display = 'flex';
    deckVisual.style.flexDirection = 'column';
    deckVisual.style.justifyContent = 'center';
    deckVisual.style.alignItems = 'center';
    deckVisual.style.color = 'white';
    deckVisual.style.fontWeight = '800';
    deckVisual.style.lineHeight = '1.2';
    deckVisual.innerHTML = `<span style="display:block !important">${t('Deck')}</span><span style="display:block !important">(${count})</span>`;
    deckArea.appendChild(deckVisual);

    // Center Discard
    centerDiscard.innerHTML = '';
    if (game.activeCard) {
        centerDiscard.appendChild(decorateCard(game.activeCard.render(), game.activeCard));
        centerDiscard.classList.add('active');
    } else {
        centerDiscard.innerHTML = t('Empty');
        centerDiscard.classList.remove('active');
    }
}

// Snap the carousel to lastCarouselSlot without rebuilding the DOM.
function restoreCarouselPosition() {
    const playersArea = document.getElementById('players-area');
    if (!playersArea || isCarouselScrolling) return;
    const width = playersArea.offsetWidth;
    if (width === 0) return;
    playersArea.scrollLeft = lastCarouselSlot * width;
}

function renderPlayers() {
    const playersArea = document.getElementById('players-area');
    playersArea.innerHTML = '';

    if (!game.players || game.players.length === 0) return;

    const isMobile = window.innerWidth <= 800;
    // Desktop: [0, 1, 2] | Mobile Carousel: [2, 0, 1, 2, 0]
    const displayIndices = isMobile ? [2, 0, 1, 2, 0] : [0, 1, 2];

    displayIndices.forEach((pIdx, slotIndex) => {
        const p = game.players[pIdx];
        const pEl = document.createElement('div');
        pEl.className = `player-area player-slot-${slotIndex} player-${pIdx}`;
        if (isMobile && (slotIndex === 0 || slotIndex === 4)) {
            pEl.classList.add('clone');
        }
        if (pIdx === game.currentPlayerIndex) {
            pEl.classList.add('current-turn');
        }

        const info = document.createElement('div');
        info.className = 'player-info';
        const showPoints = p.isHuman || game.isWatchMode;
        const ptValue = p.calculatePoints(Rules);
        const ptStr = showPoints ? ` | ${t('Points')}: ${ptValue}` : '';
        const translatedName = p.name.split(' ').map(part => t(part)).join(' ');
        const winPct = p.getWinPercentage().toFixed(1);
        info.innerHTML = `<strong>${translatedName}</strong> [${t('Win %')}: ${winPct}%] [${t('Cards')}: ${p.hand.length}]${ptStr}`;

        if (pIdx === game.currentPlayerIndex) {
            const arrow = document.createElement('span');
            arrow.className = 'turn-indicator';
            arrow.textContent = t('Current Turn');
            info.appendChild(arrow);
        }
        pEl.appendChild(info);

        pEl.appendChild(createSection(t('HAND'), p.hand, pIdx));

        const exposedSec = document.createElement('div');
        exposedSec.className = 'section exposed-section';
        exposedSec.innerHTML = `<div class="sec-label">${t('EXPOSED')}</div>`;
        if (p.exposed.length === 0) {
            exposedSec.innerHTML += `<div class="empty-msg">${t('None')}</div>`;
        } else {
            const list = document.createElement('div');
            list.className = 'exposed-list';
            p.exposed.forEach(meld => {
                const item = document.createElement('div');
                item.className = 'meld-item';
                const label = document.createElement('div');
                label.className = 'meld-label';
                label.textContent = t(meld.type);
                item.appendChild(label);
                const row = document.createElement('div');
                row.className = 'meld-cards-row';
                meld.cards.forEach(c => row.appendChild(decorateCard(c.render(), c)));
                item.appendChild(row);
                list.appendChild(item);
            });
            exposedSec.appendChild(list);
        }
        pEl.appendChild(exposedSec);
        pEl.appendChild(createMiniSection(t('DISCARD'), p.discards));
        pEl.appendChild(createMiniSection(t('PASSED'), p.passedCards));

        playersArea.appendChild(pEl);
    });

    // Auto-scroll logic for circular carousel
    if (isMobile) {
        // Immediately restore the last known scroll position right after the DOM rebuild.
        // `innerHTML = ''` resets scrollLeft to 0; we fix it synchronously so the browser
        // never paints the wrong slot before our async transition code runs.
        {
            const w = playersArea.offsetWidth;
            if (w > 0) playersArea.scrollLeft = lastCarouselSlot * w;
        }

        const turn = game.currentPlayerIndex;
        const turnChanged = (turn !== lastRenderedTurn);

        // Update tracking immediately to prevent duplicate turn-change detections
        let transitionPlanned = false;
        if (turnChanged) {
            lastRenderedTurn = turn;
            transitionPlanned = true;
        }

        // Manual Scroll Listener (for circular swipes)
        if (!playersArea.getAttribute('data-has-listener')) {
            playersArea.setAttribute('data-has-listener', 'true');
            let scrollTimer;
            playersArea.addEventListener('scroll', () => {
                if (isCarouselScrolling) return; // Ignore if we're doing an auto-move

                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    // Re-check inside the debounce — isCarouselScrolling may have been
                    // set true by the auto-advance timer in the 150ms window.
                    if (isCarouselScrolling) return;

                    const scrollPos = playersArea.scrollLeft;
                    const width = playersArea.offsetWidth;
                    if (width === 0) return;
                    const currentSlot = Math.round(scrollPos / width);

                    if (currentSlot === 0) {
                        // Wrap: snap to real P2 slot (3)
                        playersArea.scrollLeft = 3 * width;
                        lastCarouselSlot = 3;
                    } else if (currentSlot === 4) {
                        // Wrap: snap to real P0 slot (1)
                        playersArea.scrollLeft = 1 * width;
                        lastCarouselSlot = 1;
                    } else {
                        lastCarouselSlot = currentSlot;
                    }
                }, UI_DELAYS.CAROUSEL_DEBOUNCE);
            });
        }

        // If a turn transition is planned, lock the carousel immediately so the
        // DOM-reset scroll event (from innerHTML = '') cannot race our auto-advance.
        if (transitionPlanned) {
            isCarouselScrolling = true;
        }

        setTimeout(() => {
            const expectedSlot = turn + 1; // Primary slot for this player index

            if (transitionPlanned) {
                let targetSlot = lastCarouselSlot;

                // Determine direction based on circle logic
                if (lastCarouselSlot === 3 && turn === 0) {
                    targetSlot = 4; // Move forward to P0 clone
                } else if (lastCarouselSlot === 1 && turn === 2) {
                    targetSlot = 0; // Move backward to P2 clone
                } else {
                    targetSlot = expectedSlot;
                }

                const targetEl = playersArea.querySelector(`.player-slot-${targetSlot}`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    lastCarouselSlot = targetSlot;

                    if (targetSlot === 0 || targetSlot === 4) {
                        // Snap-back to the real slot as soon as the smooth scroll ends.
                        // Use 'scrollend' for zero-latency snap; fall back to a short timeout.
                        const doSnapBack = () => {
                            const snapSlot = (targetSlot === 0) ? 3 : 1;
                            const w = playersArea.offsetWidth;
                            if (w > 0) {
                                // Use scrollLeft directly — scroll-snap needs an exact offset,
                                // not a viewport-relative center, to land perfectly on slot.
                                playersArea.scrollLeft = snapSlot * w;
                            }
                            lastCarouselSlot = snapSlot;
                            isCarouselScrolling = false;
                        };

                        let snapDone = false;
                        const onScrollEnd = () => {
                            if (snapDone) return;
                            snapDone = true;
                            playersArea.removeEventListener('scrollend', onScrollEnd);
                            doSnapBack();
                        };
                        playersArea.addEventListener('scrollend', onScrollEnd);
                        // Fallback: fire after 300ms in case scrollend is not supported
                        setTimeout(() => onScrollEnd(), UI_DELAYS.SCROLL_END_FALLBACK);
                    } else {
                        // No snap-back needed; release lock after animation completes
                        const releaseLock = () => { isCarouselScrolling = false; };
                        let releaseDone = false;
                        const onScrollEndRelease = () => {
                            if (releaseDone) return;
                            releaseDone = true;
                            playersArea.removeEventListener('scrollend', onScrollEndRelease);
                            releaseLock();
                        };
                        playersArea.addEventListener('scrollend', onScrollEndRelease);
                        setTimeout(() => onScrollEndRelease(), UI_DELAYS.SCROLL_END_FALLBACK);
                    }
                } else {
                    isCarouselScrolling = false;
                }
            } else if (!isCarouselScrolling) {
                // Re-center to the last known slot without animation.
                const w = playersArea.offsetWidth;
                if (w > 0) playersArea.scrollLeft = lastCarouselSlot * w;
            }
        }, UI_DELAYS.CAROUSEL_AUTO_SCROLL);
    }
}

function createSection(label, cards, pIdx) {
    const sec = document.createElement('div');
    sec.className = 'section';
    sec.innerHTML = `<div class="sec-label">${label}</div>`;
    const container = document.createElement('div');
    container.className = 'hand-cards';
    const showFaceUp = game.players[pIdx].isHuman || game.isWatchMode;
    cards.forEach((c, idx) => {
        let el;
        if (showFaceUp) {
            el = decorateCard(c.render(), c);
            if (pIdx === 0 && !game.isWatchMode) {
                el.onclick = () => onCardClick(idx);
                if (selectedHandIndex === idx) {
                    el.classList.add('selected');
                    // "Stay highlighted" - make it blue like other active cards
                    if (game.turnPhase === 'DISCARD_WAIT' || game.turnPhase === 'SELECT_DISCARD_FOR_MELD') {
                        el.classList.add('highlight-blue');
                    }
                }
            }
        } else {
            el = document.createElement('div');
            el.className = 'card back';
        }
        container.appendChild(el);
    });
    sec.appendChild(container);
    return sec;
}

function createMiniSection(label, cards) {
    const sec = document.createElement('div');
    sec.className = 'section';
    sec.innerHTML = `<div class="sec-label">${label}</div>`;
    const container = document.createElement('div');
    container.className = 'mini-cards-grid';
    cards.forEach(c => container.appendChild(decorateCard(c.render(), c)));
    sec.appendChild(container);
    return sec;
}

function decorateCard(el, card) {
    if (game.highlightedCards && game.highlightedCards.some(hc => hc.id === card.id)) {
        el.classList.add('highlight-blue');
    }
    return el;
}

function updateControls() {
    const isMyTurn = game.currentPlayerIndex === 0;
    const phase = game.turnPhase;
    const container = document.getElementById('controls');

    // Clear dynamic decisions
    document.querySelectorAll('.decision-btn, .status-msg').forEach(el => el.remove());

    btnDraw.disabled = !(isMyTurn && phase === 'DRAWING');
    btnDiscard.style.display = 'none';

    if (phase === 'DECISION_WAIT') {
        const myActions = game.pendingActions ? game.pendingActions.get(0) : [];
        if (myActions && myActions.length > 0) {
            const types = new Set(myActions.map(a => a.type));
            const order = ['HARMONY', 'SNAKE', 'DRAGON', 'HALF-SNAKE', 'HALF-DRAGON', 'KAI-ZAO', 'XIA-CE', 'SAO', 'PENG', 'CHI', 'KOU', 'PASS'];
            order.forEach(tKey => {
                if (types.has(tKey)) {
                    const btn = document.createElement('button');
                    let label = t(tKey);
                    if (tKey === 'PASS' && !isMyTurn) label = t('DECLINE');
                    btn.textContent = label;
                    btn.className = 'decision-btn';
                    btn.onclick = () => onActionClick(tKey);
                    container.appendChild(btn);
                }
            });
        }
    } else if ((isMyTurn && phase === 'DISCARD_WAIT') || phase === 'SELECT_DISCARD_FOR_MELD') {
        btnDiscard.style.display = 'inline-block';
        btnDiscard.disabled = selectedHandIndex === -1;
        btnDiscard.textContent = t('CONFIRM DISCARD');
        btnDiscard.onclick = handleConfirmedDiscard;
    }

    const watchBtn = document.getElementById('btn-watch');
    if (watchBtn) watchBtn.textContent = t('Watch Bot Game');
    const newBtn = document.getElementById('btn-new-game');
    if (newBtn) newBtn.textContent = t('New Game (Play)');
    if (btnDraw) btnDraw.textContent = t('Draw'); // Update Draw btn as well

    if (phase === 'SELECT_DISCARD_FOR_MELD') {
        const msg = document.createElement('div');
        msg.className = 'status-msg';
        msg.textContent = `${t('Select a card to DISCARD to complete')} ${selectedAction ? t(selectedAction.type) : t('Meld')}`;
        container.appendChild(msg);
    }
}

function handleConfirmedDiscard() {
    if (selectedHandIndex === -1) return;
    if (!Rules.canDiscard(game.players[0].hand, selectedHandIndex)) {
        alert(t('Card is part of a Meld!'));
        return;
    }
    if (selectedAction && selectedAction.cards.some(c => c.id === game.players[0].hand[selectedHandIndex].id)) {
        alert(t('Cannot discard a card that is part of the meld you are forming!'));
        return;
    }

    if (selectedAction) {
        game.confirmHumanMeld(selectedAction, selectedHandIndex);
        selectedAction = null;
    } else {
        game.handlePlayerDiscard(selectedHandIndex);
    }
    selectedHandIndex = -1;
    render();
}

function onActionClick(type) {
    if (type === 'HARMONY') {
        game.handleHarmony(0, game.activeCard);
        return;
    }
    if (type === 'PASS') {
        game.handlePass(0, game.activeCard);
        return;
    }
    const myActions = game.pendingActions.get(0);
    const action = myActions.find(a => a.type === type);
    selectedAction = action;

    if (['KAI-ZAO', 'XIA-CE'].includes(type) || (type === 'SAO' && game.activeCardSource === 'DECK')) {
        // Some actions might be auto-resolved or skip discard
        // In this game, most melds still require a discard unless it's a quad
    }

    // For simplicity, handle skip discard if rule matches
    if (['KAI-ZAO', 'XIA-CE'].includes(type)) {
        game.confirmHumanMeld(action, -1);
        selectedAction = null;
    } else {
        selectedHandIndex = -1;
        game.turnPhase = 'SELECT_DISCARD_FOR_MELD';
        render();
    }
}

function onCardClick(index) {
    if (game.turnPhase === 'ANIMATING') return;
    selectedHandIndex = (selectedHandIndex === index) ? -1 : index;
    render();
}

window.addEventListener('load', () => {
    init();
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered!', reg))
            .catch(err => console.log('SW registration failed!', err));
    }
});
