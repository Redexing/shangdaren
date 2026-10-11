# Shangdaren Game Implementation Plan

## Goal
Build a Progressive Web App (PWA) for the "Shangdaren" card game, a 3-player turn-based game with unique cards and rules (similar to Bridge/Mahjong). The game will support 1 human player and 2 AI/bot players initially.

## Architecture

### 1. Core Logic (Headless)
Detailed game logic decoupled from UI to allow for easy testing and AI simulation.
- **Card System**:
    - `Card`: Properties for Type (24 types), Suite (8 suites), Color (Red/Black), ID.
    - `Deck`: 96 cards (4 of each type), shuffling, dealing.
- **Player Module**:
    - `Player`: Manages `Hand` (hidden cards), `ExposedCards` (Melds/KOU/PENG/SAO), `Discards`.
    - `Hand`: Logic for sorting and checking combinations.
- **Rules Engine**:
    - `Validator`: Checks valid discards (cannot break suites/triples).
    - `Matcher`: Detects PENG, SAO, KOU, DRAGON opportunities.
    - `Scorer`: Implements "FU TEST" and scoring logic (Red=1/2/4, Black=2/4/8, etc.).
    - `TurnManager`: Handles turn phases (Draw -> Action -> Discard), interruptions (PENG/SAO claims).

### 2. State Management
- `GameState`: Central store for current turn, deck state, player states, pending actions.
- **Event System**: Emits events (`ON_DRAW`, `ON_DISCARD`, `ON_MELD`, `GAME_OVER`) to update UI.

### 3. AI / Bot
- `BotStrategy`: basic heuristic bot.
    - Priority: Win > PENG/SAO > Form Suite > Keep Pairs.

### 4. UI / Frontend
- **Tech Stack**: standard HTML/CSS/JS (Vanilla or lightweight setup).
- **Views**:
    - `Table View`: 3 avatars, center deck, discard piles.
    - `Player View`: Interactive hand (15 cards), drag-to-discard or click-to-action.
    - `Bot View`: Hidden hands, visible exposed piles.
- **Components**:
    - `CardComponent`: Slim rectangular rendering with characters on ends.
    - `ActionBubble`: Visual cues for "PENG", "HARMONY", etc.

## Implementation Steps

### Phase 1: Project Setup & Core Data Structures
- [ ] Initialize project structure (HTML/CSS/JS).
- [ ] Implement `Card` and `Deck` classes.
- [ ] Implement `Player` class with basic hand structure.

### Phase 2: Game Loop & Rules
- [ ] Implement `GameState` to track turns.
- [ ] Implement basic mechanics: Draw, Discard.
- [ ] Implement Validation: Prevent illegal discards.
- [ ] Implement Matching: PENG/SAO detection mechanics.

### Phase 3: Advanced Rules & Winning
- [ ] Implement "KOU" logic and restrictions.
- [ ] Implement Scoring ("FU TEST", Dragon/Half-Dragon bonuses).
- [ ] Implement "HARMONY" (Win) condition checks.

### Phase 4: UI Implementation
- [ ] Create layout (Table, Players).
- [ ] Render Cards (CSS/Canvas).
- [ ] Wire up interactions (Click to discard, Buttons for PENG/HARMONY).
- [ ] Add visual feedback (Action bubbles).

### Phase 5: Bots & Polish
- [ ] Implement `BotPlayer` decision logic.
- [ ] Add "Auto Play" mode/toggle.
- [ ] Finalize "New Game" flow.

# Additional implementation instructions

## Generate User documentations

Distill rules from shangdaren_game.md
into concise  how-to.html page content.  

Provide a section to introduce the cards, suit they form; use a simple javascript to actually draw the 24 cards in this section.

Provide a section to list the rules, including how many cards are initially drew for each plyer;  turn taking; what melds can be formed (again use a simple javascript to draw an example for each meld type);  what action a player can take during either someone else's turn or his own turn;  how to count points;  what condition needs to be met, to declare HARMONY.   Highlight rules that are must-rules, i.e. when conditions are met, the player has to take that action.