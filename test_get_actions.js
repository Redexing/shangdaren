import { Card } from './src/js/card.js';
import { Rules } from './src/js/rules.js';

export function runGetActionsTests() {
    console.log("Running refined getActions tests...");

    const suite2Idx = 1; // Suite 2: 丘，乙，几
    const suite5Idx = 4; // Suite 5: 尔, 小, 生
    const suite7Idx = 6; // Suite 7: 佳, 作, 仁

    const testCases = [
        {
            name: "Optional KOU when hand already has a suit",
            hand: [
                new Card(0, suite5Idx, 0), // 尔
                new Card(1, suite5Idx, 1), // 小
                new Card(2, suite5Idx, 1), // 小
                new Card(3, suite5Idx, 2)  // 生
            ],
            card: new Card(10, suite5Idx, 0), // 尔
            isSelf: true,
            expected: ['KOU', 'PASS']
        },
        {
            name: "Mandatory CHI when hand can complete a suite",
            hand: [
                new Card(11, suite5Idx, 1), // 小
                new Card(12, suite5Idx, 2)  // 生
            ],
            card: new Card(13, suite5Idx, 0), // 尔
            isSelf: true,
            expected: ['CHI']
        },
        {
            name: "Mandatory CHI even with passed card",
            hand: [
                new Card(11, suite5Idx, 1), // 小
                new Card(12, suite5Idx, 2)  // 生
            ],
            card: new Card(13, suite5Idx, 0), // 尔
            isSelf: false,
            expected: ['CHI']
        },
        {
            name: "Mandatory SAO when hand has a pair and self-draws the third",
            hand: [
                new Card(14, suite5Idx, 0), // 尔
                new Card(15, suite5Idx, 0)  // 尔
            ],
            card: new Card(16, suite5Idx, 0), // 尔
            isSelf: true,
            expected: ['SAO']
        },
        {
            name: "Simple KOU is always optional",
            hand: [new Card(17, suite7Idx, 2)], // 仁
            card: new Card(18, suite7Idx, 1), // 作
            isSelf: true,
            expected: ['KOU', 'PASS']
        },
        {
            name: "Prohibit breaking an existing KOU to re-form same KOU",
            hand: [
                new Card(19, suite7Idx, 1), // 作
                new Card(20, suite7Idx, 2)  // 仁
            ],
            card: new Card(21, suite7Idx, 1), // 作
            isSelf: true,
            expected: ['PASS']
        },
        {
            name: "Mandatory SAO even at the cost of breaking a suit",
            hand: [
                new Card(30, suite5Idx, 0), // 尔
                new Card(31, suite5Idx, 0), // 尔
                new Card(32, suite5Idx, 1), // 小
                new Card(33, suite5Idx, 1), // 小
                new Card(34, suite5Idx, 2), // 生
                new Card(35, suite5Idx, 2)  // 生
            ],
            card: new Card(36, suite5Idx, 0), // 尔
            isSelf: true,
            expected: ['SAO']
        },
        {
            name: "Mandatory PENG when other player discards the third card",
            hand: [
                new Card(14, suite5Idx, 0),
                new Card(15, suite5Idx, 0)
            ],
            card: new Card(16, suite5Idx, 0),
            isSelf: false,
            expected: ['PENG']
        },
        {
            name: "Mandatory PASS when hand already has a full suit",
            hand: [
                new Card(37, suite5Idx, 0), // 尔
                new Card(38, suite5Idx, 1), // 小
                new Card(39, suite5Idx, 2)  // 生
            ],
            card: new Card(40, suite5Idx, 0), // 尔
            isSelf: false,
            expected: ['PASS']
        },
        {
            name: "Self-draw card upgrades exposed SAO to KAI-ZAO",
            hand: [],
            card: new Card(44, suite5Idx, 0), // 尔
            isSelf: true,
            exposed: [{
                type: 'SAO',
                cards: [
                    new Card(41, suite5Idx, 0), // 尔
                    new Card(42, suite5Idx, 0), // 尔
                    new Card(43, suite5Idx, 0)  // 尔
                ]
            }],
            expected: ['KAI-ZAO']
        },
        {
            name: "Other's card upgrades exposed SAO to XIA-CE",
            hand: [],
            card: new Card(44, suite5Idx, 0), // 尔
            isSelf: false,
            exposed: [{
                type: 'SAO',
                cards: [
                    new Card(41, suite5Idx, 0), // 尔
                    new Card(42, suite5Idx, 0), // 尔
                    new Card(43, suite5Idx, 0)  // 尔
                ]
            }],
            expected: ['XIA-CE']
        },
        {
            name: "PENG melds cannot be upgraded",
            hand: [],
            card: new Card(48, suite5Idx, 0), // 尔
            isSelf: true,
            exposed: [{
                type: 'PENG',
                cards: [
                    new Card(45, suite5Idx, 0), // 尔
                    new Card(46, suite5Idx, 0), // 尔
                    new Card(47, suite5Idx, 0)  // 尔
                ]
            }],
            expected: ['PASS']
        },
        {
            name: "CHI higher priority than forming second KOU",
            hand: [new Card(13, suite2Idx, 1)], // 乙
            card: new Card(12, suite2Idx, 0), // 丘
            isSelf: true,
            exposed: [{
                type: 'KOU',
                cards: [
                    new Card(10, suite2Idx, 1), // 乙
                    new Card(11, suite2Idx, 2)  // 几
                ]
            }],
            expected: ['CHI']
        },
        {
            name: "Self-draw card completes a DRAGON meld",
            hand: [
                new Card(50, suite5Idx, 0), // 尔
                new Card(51, suite5Idx, 0), // 尔
                new Card(52, suite5Idx, 0), // 尔
                new Card(53, suite5Idx, 1), // 小
                new Card(54, suite5Idx, 2)  // 生
            ],
            card: new Card(55, suite5Idx, 0), // 尔
            isSelf: true,
            expected: ['DRAGON']
        },
        {
            name: "Other player's card completes a SNAKE meld",
            hand: [
                new Card(50, suite5Idx, 0), // 尔
                new Card(51, suite5Idx, 0), // 尔
                new Card(52, suite5Idx, 0), // 尔
                new Card(53, suite5Idx, 1), // 小
                new Card(54, suite5Idx, 2)  // 生
            ],
            card: new Card(55, suite5Idx, 0), // 尔
            isSelf: false,
            expected: ['SNAKE']
        },
        {
            name: "Self-draw card upgrades exposed HALF-DRAGON to DRAGON",
            hand: [],
            card: new Card(61, suite5Idx, 1), // 小
            isSelf: true,
            exposed: [{
                type: 'HALF-DRAGON',
                cards: [
                    new Card(56, suite5Idx, 0), // 尔
                    new Card(57, suite5Idx, 0), // 尔
                    new Card(58, suite5Idx, 0), // 尔
                    new Card(59, suite5Idx, 0), // 尔
                    new Card(60, suite5Idx, 2)  // 生
                ]
            }],
            expected: ['DRAGON']
        },
        {
            name: "Other player's card upgrades exposed HALF-SNAKE to SNAKE",
            hand: [],
            card: new Card(61, suite5Idx, 1), // 小
            isSelf: false,
            exposed: [{
                type: 'HALF-SNAKE',
                cards: [
                    new Card(56, suite5Idx, 0), // 尔
                    new Card(57, suite5Idx, 0), // 尔
                    new Card(58, suite5Idx, 0), // 尔
                    new Card(59, suite5Idx, 0), // 尔
                    new Card(60, suite5Idx, 2)  // 生
                ]
            }],
            expected: ['SNAKE']
        },
        {
            name: "Prohibit breaking a SAO to form a CHI, but allow optional KOU",
            hand: [
                new Card(56, suite5Idx, 0), // 尔
                new Card(57, suite5Idx, 0), // 尔
                new Card(58, suite5Idx, 0), // 尔
                new Card(59, suite5Idx, 2)  // 生
            ],
            card: new Card(61, suite5Idx, 1), // 小
            isSelf: true,
            expected: ['KOU', 'PASS']
        },
        {
            name: "Prohibit breaking SAO for CHI when card is passed by others",
            hand: [
                new Card(56, suite5Idx, 0), // 尔
                new Card(57, suite5Idx, 0), // 尔
                new Card(58, suite5Idx, 0), // 尔
                new Card(59, suite5Idx, 2)  // 生
            ],
            card: new Card(61, suite5Idx, 1), // 小
            isSelf: false,
            expected: ['KOU', 'PASS']
        },
        {
            name: "SAO cannot break to form CHI",
            hand: [
                new Card(56, suite5Idx, 0), // 尔
                new Card(57, suite5Idx, 0), // 尔
                new Card(58, suite5Idx, 0), // 尔
                new Card(59, suite5Idx, 1), // 小
                new Card(60, suite5Idx, 2), // 生
                new Card(61, suite5Idx, 2)  // 生
            ],
            card: new Card(62, suite5Idx, 1), // 小
            isSelf: true,
            expected: ['KOU', 'PASS']
        }
    ];

    testCases.forEach(tc => {
        const actions = Rules.getActions(tc.hand, tc.card, tc.isSelf, tc.exposed || [], tc.discards || []);
        const actionTypes = actions.map(a => a.type);

        const isMatch = tc.expected.length === actionTypes.length &&
            tc.expected.every(type => actionTypes.includes(type));

        if (isMatch) {
            console.log(`✅ ${tc.name}: Passed`);
        } else {
            console.error(`❌ ${tc.name}: Failed`);
            console.error(`   Expected: ${tc.expected}`);
            console.error(`   Got:      ${actionTypes}`);
        }
    });

}

// Run if direct
if (import.meta.url === `file://${process.argv[1]}`) {
    runGetActionsTests();
}
