
export const SUITES_DATA = [
    ['上', '大', '人'], // Suite 1 (Index 0) - RED, MEAT
    ['丘', '乙', '几'], // Suite 2 (Index 1) - BLACK, MEAT
    ['化', '三', '千'], // Suite 3 (Index 2) - RED, MEAT
    ['七', '十', '土'], // Suite 4 (Index 3) - BLACK, VEGGIE
    ['尔', '小', '生'], // Suite 5 (Index 4) - RED, VEGGIE
    ['八', '九', '子'], // Suite 6 (Index 5) - BLACK, VEGGIE
    ['佳', '作', '仁'], // Suite 7 (Index 6) - RED, VEGGIE
    ['可', '知', '礼']  // Suite 8 (Index 7) - BLACK, VEGGIE
];

export const ALL_SUITES = SUITES_DATA;

export class Card {
    constructor(id, suiteIndex, characterIndex) {
        this.id = id;
        this.suiteIndex = suiteIndex;
        this.characterIndex = characterIndex;

        // Rule: Odd suites (1st, 3rd, 5th, 7th) are red.
        // Index is 0-based, so Suite 1 is index 0. 
        // Index 0, 2, 4, 6 are red (even index = odd suite)
        this.isRed = (suiteIndex % 2 === 0);

        // Rule: First three suites are MEAT, rest are VEGGIE.
        this.isMeat = suiteIndex < 3;

        this.character = ALL_SUITES[suiteIndex][characterIndex];
        this.typeId = (suiteIndex * 3) + characterIndex;
        this.selected = false;
    }

    toString() {
        return `${this.character}`;
    }

    render() {
        if (typeof document === 'undefined') return null;
        const el = document.createElement('div');
        el.className = `card ${this.isRed ? 'red' : 'black'}`;
        if (this.selected) el.classList.add('selected');

        el.dataset.id = this.id;
        el.dataset.type = this.typeId;

        const desktopLayout = document.createElement('div');
        desktopLayout.className = 'card-desktop-layout';

        const topChar = document.createElement('span');
        topChar.className = 'top-char';
        topChar.textContent = this.character;

        const bottomChar = document.createElement('span');
        bottomChar.className = 'bottom-char';
        bottomChar.textContent = this.character;
        bottomChar.style.transform = 'rotate(180deg)';

        desktopLayout.appendChild(topChar);
        desktopLayout.appendChild(document.createElement('div')); // Spacer
        desktopLayout.appendChild(bottomChar);

        const centerChar = document.createElement('span');
        centerChar.className = 'center-char';
        centerChar.textContent = this.character;

        el.appendChild(desktopLayout);
        el.appendChild(centerChar);

        return el;
    }
}
