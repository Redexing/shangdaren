import { Card } from './src/js/card.js';
import { Rules } from './src/js/rules.js';

export function runHarmonyTests() {
    console.log("Running Rules.canDeclareHarmony tests...");

    const MEAT_SUITE_1 = 0;
    const MEAT_SUITE_2 = 1;
    const MEAT_SUITE_3 = 2;
    const VEG_SUITE_1 = 3;
    const VEG_SUITE_2 = 4;
    const VEG_SUITE_3 = 5;

    let idTracker = 100;
    const getNextId = () => idTracker++;

    const makeChi = (suiteIndex) => [
        new Card(getNextId(), suiteIndex, 0),
        new Card(getNextId(), suiteIndex, 1),
        new Card(getNextId(), suiteIndex, 2)
    ];

    const makeKou = (suiteIndex, char1, char2) => [
        new Card(getNextId(), suiteIndex, char1),
        new Card(getNextId(), suiteIndex, char2)
    ];

    const makeTrip = (suiteIndex, charIndex) => [
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex)
    ];

    const makeQuad = (suiteIndex, charIndex) => [
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex),
        new Card(getNextId(), suiteIndex, charIndex)
    ];

    const testCases = [
        {
            name: "Valid Harmony (Exactly 10 points: 2 Meat KOU, 2 Meat CHI, 2 Veggie CHI)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // 2 pts
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(MEAT_SUITE_1),       // 3 pts
                ...makeChi(VEG_SUITE_1),        // 0 pts
                ...makeChi(VEG_SUITE_2)         // 0 pts
            ],
            exposed: [],
            activeCard: null,
            expected: true
        },
        {
            name: "Invalid Harmony (9 points: 2 Veggie KOU, 3 Meat CHI, 1 Veggie CHI)",
            hand: [
                ...makeKou(VEG_SUITE_1, 0, 1), // 0 pts
                ...makeKou(VEG_SUITE_2, 0, 1), // 0 pts
                ...makeChi(MEAT_SUITE_1),      // 3 pts
                ...makeChi(MEAT_SUITE_2),      // 3 pts
                ...makeChi(MEAT_SUITE_3),      // 3 pts
                ...makeChi(VEG_SUITE_3)        // 0 pts
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Invalid Harmony (Incorrect card count: 13 cards instead of 16)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1),
                ...makeKou(MEAT_SUITE_2, 0, 1),
                ...makeChi(MEAT_SUITE_1),
                ...makeChi(MEAT_SUITE_2),
                ...makeChi(MEAT_SUITE_3)
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Valid Harmony with exposed melds and active card (11 points)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1), // 2 pts
                ...makeKou(MEAT_SUITE_2, 0, 1), // 2 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
                new Card(getNextId(), VEG_SUITE_1, 0), // part of CHI (0 pts)
                new Card(getNextId(), VEG_SUITE_1, 1)  // part of CHI (0 pts)
            ],
            exposed: [
                {
                    type: 'SAO', // Veggie SAO -> 4 pts
                    cards: makeTrip(VEG_SUITE_2, 0)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_1, 2), // completes CHI
            expected: true
        },
        {
            name: "Valid Harmony with active card turning CHI (in exposed) into two KOU",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
            ],
            exposed: [
                {
                    type: 'CHI',
                    cards: makeChi(VEG_SUITE_2)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_2, 1), // turn exposed CHI into KOU
            expected: true
        },
        {
            name: "Valid Harmony with active card turning CHI  (in hand) into two KOU",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeChi(VEG_SUITE_3),        // 0 pts
            ],
            exposed: [
                {
                    type: 'CHI',
                    cards: makeChi(VEG_SUITE_2)
                }
            ],
            activeCard: new Card(getNextId(), MEAT_SUITE_1, 1), // turn hand CHI into KOU
            expected: true
        },
        {
            name: "Valid Harmony with 17 cards due to XIA-CE",
            hand: [
                ...makeChi(MEAT_SUITE_1), // 3 pts
                ...makeTrip(MEAT_SUITE_2, 0), // 6 pts
                ...makeChi(MEAT_SUITE_3),       // 3 pts
                ...makeKou(VEG_SUITE_3, 0, 1),        // 0 pts
                new Card(getNextId(), VEG_SUITE_1, 0)
            ],
            exposed: [
                {
                    type: 'XIA-CE',
                    cards: makeQuad(VEG_SUITE_2, 0)
                }
            ],
            activeCard: new Card(getNextId(), VEG_SUITE_1, 1), // turn hand CHI into KOU
            expected: true
        },
        {
            name: "Invalid Harmony (Hand cannot be perfectly partitioned with 2 KOU)",
            hand: [
                ...makeKou(MEAT_SUITE_1, 0, 1),
                ...makeKou(MEAT_SUITE_2, 0, 1),
                ...makeKou(MEAT_SUITE_3, 0, 1), // 3 KOUs instead of 2!
                ...makeChi(MEAT_SUITE_1),
                ...makeChi(VEG_SUITE_1),
                new Card(getNextId(), VEG_SUITE_2, 0)
                // This makes 16 cards total, but cannot form exactly 2 KOUs along with valid melds
            ],
            exposed: [],
            activeCard: null,
            expected: false
        },
        {
            name: "Valid Harmony using HALF-DRAGON as one of the KOUs",
            hand: [
                // HALF-DRAGON: 4 of a kind + 1 other. Total 5 cards. (14 pts if meat)
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 0),
                new Card(getNextId(), MEAT_SUITE_1, 1),

                ...makeKou(VEG_SUITE_1, 0, 1), // 1 KOU (2 cards) -> 0 pts

                ...makeChi(VEG_SUITE_2), // 3 cards -> 0 pts
                ...makeChi(VEG_SUITE_3), // 3 cards -> 0 pts
                ...makeChi(MEAT_SUITE_2) // 3 cards -> 3 pts
            ],
            exposed: [],
            activeCard: null,
            expected: true // Total pts: 14 + 0 + 0 + 0 + 3 = 17 pts >= 10
        }
    ];

    let allPassed = true;
    testCases.forEach(tc => {
        const canDeclare = Rules.canDeclareHarmony(tc.hand, tc.exposed || [], tc.activeCard);
        if (canDeclare === tc.expected) {
            console.log(`✅ ${tc.name}: Passed`);
        } else {
            console.error(`❌ ${tc.name}: Failed`);
            console.error(`   Expected: ${tc.expected}`);
            console.error(`   Got:      ${canDeclare}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log("All Rules.canDeclareHarmony tests passed successfully!");
    } else {
        process.exit(1);
    }
}

// Run if direct
if (import.meta.url === `file://${process.argv[1]}`) {
    runHarmonyTests();
}
