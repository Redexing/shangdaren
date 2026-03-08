
export class Player {
    constructor(name, isHuman = false) {
        this.name = name;
        this.isHuman = isHuman;
        this.hand = []; // Array of Cards
        this.exposed = []; // Array of Meld Objects
        this.discards = []; // Array of Cards (From hand)
        this.passedCards = []; // Array of Cards (Drawn but immediately passed)

        this.wins = 0;
        this.totalGames = 0;
        this.loadStats();
    }

    loadStats() {
        try {
            const stats = JSON.parse(localStorage.getItem(`shangdaren_stats_${this.name}`));
            if (stats) {
                this.wins = stats.wins || 0;
                this.totalGames = stats.totalGames || 0;
            }
        } catch (e) {
            console.error("Failed to load stats for " + this.name, e);
        }
    }

    saveStats() {
        try {
            localStorage.setItem(`shangdaren_stats_${this.name}`, JSON.stringify({
                wins: this.wins,
                totalGames: this.totalGames
            }));
        } catch (e) {
            console.error("Failed to save stats for " + this.name, e);
        }
    }

    getWinPercentage() {
        if (this.totalGames === 0) return 0;
        return (this.wins / this.totalGames) * 100;
    }

    draw(card) {
        this.hand.push(card);
        this.sortHand();
    }

    discard(cardIndex) {
        if (cardIndex < 0 || cardIndex >= this.hand.length) {
            throw new Error("Invalid card index");
        }
        const card = this.hand.splice(cardIndex, 1)[0];
        return card;
    }

    addToDiscards(card, wasPassed) {
        if (wasPassed) {
            this.passedCards.push(card);
        } else {
            this.discards.push(card);
        }
    }

    // Basic sorting: By Suite, then by Character Index
    sortHand() {
        this.hand.sort((a, b) => {
            if (a.suiteIndex !== b.suiteIndex) {
                return a.suiteIndex - b.suiteIndex;
            }
            return a.characterIndex - b.characterIndex;
        });
    }

    getHand() {
        return this.hand;
    }

    getDiscards() {
        return this.discards;
    }

    getPassedCards() {
        return this.passedCards;
    }

    addToExposed(meld) {
        // meld is { type, cards }
        this.exposed.push(meld);
    }

    removePassedCard(card) {
        const idx = this.passedCards.findIndex(c => c.id === card.id);
        if (idx !== -1) {
            this.passedCards.splice(idx, 1);
        }
    }

    calculatePoints(Rules) {
        // Harmony condition ensures finding partition, but for general display:
        const meldsInHand = Rules.findMeldsInHand(this.hand);
        return Rules.calculateTotalPoints([...this.exposed, ...meldsInHand]);
    }
}
