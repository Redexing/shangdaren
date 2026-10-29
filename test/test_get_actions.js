import { Card } from '../src/js/card.js';
import { Rules } from '../src/js/rules.js';
import { Game } from '../src/js/game.js';
import { Player } from '../src/js/player.js';
import { buildAllVeggieWaiverState, buildScreenshotHarmonyState } from './test_harmony.js';

// Suite 丘乙几. Holding 丘 and seeing 几 can form KOU unless that suit was
// discarded, or an earlier legal KOU was declined. Harmony still uses the suit.
function kouNoDoOverCases(suiteIdx) {
    const qiu = new Card(200, suiteIdx, 0);
    const yi = new Card(201, suiteIdx, 1);
    const ji = new Card(202, suiteIdx, 2);
    const otherYi = new Card(203, suiteIdx, 1);
    const otherJi = new Card(204, suiteIdx, 2);
    const otherQiu = new Card(205, suiteIdx, 0);
    const otherSuit = new Card(206, 4, 0);

    const winningHand = [
        new Card(210, 0, 0), new Card(211, 0, 0), new Card(212, 0, 0),
        new Card(213, 2, 0), new Card(214, 2, 1),
        qiu,
        new Card(215, 3, 0), new Card(216, 3, 1), new Card(217, 3, 2),
        new Card(218, 4, 0), new Card(219, 4, 1), new Card(220, 4, 2),
        new Card(221, 5, 0), new Card(222, 5, 1), new Card(223, 5, 2)
    ];

    return [
        {
            name: "KOU allowed when the suit was never discarded or declined",
            hand: [qiu],
            card: ji,
            isSelf: true,
            expected: ['KOU', 'PASS']
        },
        {
            name: "No KOU after discarding 乙 from the same suit",
            hand: [qiu],
            card: ji,
            isSelf: true,
            discards: [yi],
            expected: ['PASS']
        },
        {
            name: "No KOU after discarding 几 from the same suit",
            hand: [qiu],
            card: ji,
            isSelf: true,
            discards: [otherJi],
            expected: ['PASS']
        },
        {
            name: "No KOU after discarding 丘 from the same suit",
            hand: [qiu],
            card: ji,
            isSelf: true,
            discards: [otherQiu],
            expected: ['PASS']
        },
        {
            name: "No KOU after declining an available KOU in the suit",
            hand: [qiu],
            card: ji,
            isSelf: true,
            options: { declinedKouCards: [otherYi] },
            expected: ['PASS']
        },
        {
            name: "No KOU after declining upstream 乙 when KOU was available",
            hand: [qiu],
            card: ji,
            isSelf: true,
            options: { declinedKouCards: [yi] },
            expected: ['PASS']
        },
        {
            name: "A pass or discard from another suit does not close KOU",
            hand: [qiu],
            card: ji,
            isSelf: true,
            discards: [otherSuit],
            options: { declinedKouCards: [new Card(207, 3, 1)] },
            expected: ['KOU', 'PASS']
        },
        {
            name: "CHI stays mandatory after the suit is closed for KOU",
            hand: [qiu, yi],
            card: ji,
            isSelf: true,
            discards: [otherJi],
            expected: ['CHI']
        },
        {
            name: "Closed suit still offers HARMONY and hides KOU",
            hand: winningHand,
            card: ji,
            isSelf: true,
            discards: [otherYi],
            options: { isSelfDraw: true, declinedKouCards: [otherJi] },
            expected: ['HARMONY', 'PASS']
        }
    ];
}

function runKouNoDoOverGameTests() {
    const suiteIdx = 1;
    const qiu = new Card(300, suiteIdx, 0);
    const yi = new Card(301, suiteIdx, 1);
    const ji = new Card(302, suiteIdx, 2);
    const earlierJi = new Card(303, suiteIdx, 2);

    function bareGame() {
        const game = new Game();
        game.players = [
            new Player('You', true),
            new Player('Bot Left', false),
            new Player('Bot Right', false)
        ];
        game.currentPlayerIndex = 0;
        game.activeCardSource = 'DECK';
        game.players[0].hand = [qiu];
        game.pendingActions = new Map();
        game.declinedPlayers = new Set();
        return game;
    }

    function typesFor(game, card) {
        return (game.calculateActions(card).get(0) || []).map(a => a.type);
    }

    const cases = [
        {
            name: "Physical upstream pass alone does not block KOU",
            setup(game) {
                game.players[2].addToDiscards(yi, true);
            },
            card: ji,
            expected: ['KOU', 'PASS']
        },
        {
            name: "Recorded legal KOU decline blocks the suit",
            setup(game) {
                game.players[0].recordKouDecline(yi);
            },
            card: ji,
            expected: ['PASS']
        },
        {
            name: "Game still offers KOU for the card upstream is passing now",
            setup(game) {
                game.players[2].addToDiscards(ji, true);
                game.activeCardSource = 2;
            },
            card: ji,
            expected: ['KOU', 'PASS']
        },
        {
            name: "Game hides KOU after you declined an available KOU earlier",
            setup(game) {
                game.players[0].recordKouDecline(earlierJi);
            },
            card: ji,
            expected: ['PASS']
        },
        {
            name: "Downstream pass does not close your KOU",
            setup(game) {
                game.players[1].addToDiscards(yi, true);
            },
            card: ji,
            expected: ['KOU', 'PASS']
        }
    ];

    let failed = 0;
    cases.forEach(tc => {
        const game = bareGame();
        tc.setup(game);
        const actionTypes = typesFor(game, tc.card);
        const isMatch = tc.expected.length === actionTypes.length &&
            tc.expected.every(type => actionTypes.includes(type));
        if (isMatch) {
            console.log(`✅ ${tc.name}: Passed`);
        } else {
            console.error(`❌ ${tc.name}: Failed`);
            console.error(`   Expected: ${tc.expected}`);
            console.error(`   Got:      ${actionTypes}`);
            failed++;
        }
    });
    return failed;
}

export function runGetActionsTests() {
    console.log("Running refined getActions tests...");

    const suite2Idx = 1; // Suite 2: 丘，乙，几
    const suite5Idx = 4; // Suite 5: 尔, 小, 生
    const suite7Idx = 6; // Suite 7: 佳, 作, 仁
    const suite8Idx = 7; // Suite 8: 可, 知, 礼

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
            expected: ['KOU', 'PASS'],
            expectedKouPartnerId: 59 // Must pair with 生, never breaking 尔尔尔
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
            expected: ['KOU', 'PASS'],
            expectedKouPartnerId: 59
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
            expected: ['KOU', 'PASS'],
            expectedKouPartnerId: 60 // Must pair with redundant 生, never breaking 尔尔尔
        },
        {
            name: "[RULE-KOU-NO-BREAK-HAND] Issue #20: 可知礼礼礼 cannot KOU on another 可",
            hand: [
                new Card(80, suite8Idx, 0), // 可
                new Card(81, suite8Idx, 1), // 知
                new Card(82, suite8Idx, 2), // 礼
                new Card(83, suite8Idx, 2), // 礼
                new Card(84, suite8Idx, 2)  // 礼
            ],
            card: new Card(85, suite8Idx, 0), // passed or drawn 可
            isSelf: false,
            expected: ['PASS']
        },
        {
            name: "[RULE-KOU-NO-BREAK-HAND] Issue #20: self-drawn 可 also cannot break 可知礼礼礼",
            hand: [
                new Card(86, suite8Idx, 0), // 可
                new Card(87, suite8Idx, 1), // 知
                new Card(88, suite8Idx, 2), // 礼
                new Card(89, suite8Idx, 2), // 礼
                new Card(90, suite8Idx, 2)  // 礼
            ],
            card: new Card(91, suite8Idx, 0), // 可
            isSelf: true,
            expected: ['PASS']
        },
        {
            name: "[RULE-KOU-NO-BREAK-HAND] Spare 礼 may KOU while 可知礼 stays intact",
            hand: [
                new Card(92, suite8Idx, 0), // 可
                new Card(93, suite8Idx, 1), // 知
                new Card(94, suite8Idx, 2), // 礼
                new Card(95, suite8Idx, 2)  // 礼
            ],
            card: new Card(96, suite8Idx, 0), // 可
            isSelf: true,
            expected: ['KOU', 'PASS'],
            expectedKouPartnerId: 94
        },
        {
            name: "Prohibit breaking 3-of-a-kind (小x3) in hand to form KOU with 生",
            hand: [
                new Card(63, suite5Idx, 1), // 小
                new Card(64, suite5Idx, 1), // 小
                new Card(65, suite5Idx, 1)  // 小
            ],
            card: new Card(66, suite5Idx, 2), // 生
            isSelf: true,
            expected: ['PASS']
        },
        {
            name: "Holding un-broken 3-of-a-kind (小x3) forms KAI-ZAO on self-drawn 4th 小",
            hand: [
                new Card(63, suite5Idx, 1), // 小
                new Card(64, suite5Idx, 1), // 小
                new Card(65, suite5Idx, 1)  // 小
            ],
            card: new Card(67, suite5Idx, 1), // 4th 小
            isSelf: true,
            expected: ['KAI-ZAO']
        },
        {
            name: "[RULE-KOU-MAX-EXPOSED] 2nd KOU allowed when only 1 KOU is exposed",
            hand: [new Card(70, suite7Idx, 2)], // 仁
            card: new Card(71, suite7Idx, 1), // 作
            isSelf: true,
            exposed: [
                { type: 'KOU', cards: [new Card(72, suite2Idx, 0), new Card(73, suite2Idx, 1)] }
            ],
            expected: ['KOU', 'PASS']
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Self-drawn 九 with exposed SAO and a single 子 becomes HALF-DRAGON",
            hand: [new Card(900, 5, 2)], // 子
            card: new Card(901, 5, 1), // 九
            isSelf: true,
            exposed: [{
                type: 'SAO',
                cards: [
                    new Card(902, 5, 1),
                    new Card(903, 5, 1),
                    new Card(904, 5, 1)
                ]
            }],
            expected: ['HALF-DRAGON'],
            expectMeldRefType: 'SAO',
            expectedActionCardsCount: 1
        },
        {
            name: "[RULE-KOU-MAX-EXPOSED] HALF-DRAGON stays mandatory when 2 KOU are already exposed",
            hand: [new Card(910, 5, 2), new Card(911, 3, 0)], // 子 + spare 七
            card: new Card(912, 5, 1), // 九
            isSelf: true,
            exposed: [
                {
                    type: 'SAO',
                    cards: [new Card(913, 5, 1), new Card(914, 5, 1), new Card(915, 5, 1)]
                },
                { type: 'KOU', cards: [new Card(916, 0, 0), new Card(917, 0, 1)] },
                { type: 'KOU', cards: [new Card(918, 1, 0), new Card(919, 1, 1)] }
            ],
            expected: ['HALF-DRAGON'],
            expectMeldRefType: 'SAO',
            expectedActionCardsCount: 1
        },
        {
            name: "[RULE-KOU-MAX-EXPOSED] HALF-DRAGON counts toward the 2 KOU limit",
            hand: [new Card(920, 6, 2)], // 仁
            card: new Card(921, 6, 1), // 作
            isSelf: true,
            exposed: [
                { type: 'KOU', cards: [new Card(922, 0, 0), new Card(923, 0, 1)] },
                {
                    type: 'HALF-DRAGON',
                    cards: [
                        new Card(924, 5, 1), new Card(925, 5, 1),
                        new Card(926, 5, 1), new Card(927, 5, 1),
                        new Card(928, 5, 2)
                    ]
                }
            ],
            expected: ['PASS']
        },
        {
            name: "[RULE-KOU-MAX-EXPOSED] 3rd KOU is blocked when 2 KOUs are already exposed",
            hand: [new Card(74, suite7Idx, 2)], // 仁
            card: new Card(75, suite7Idx, 1), // 作
            isSelf: true,
            exposed: [
                { type: 'KOU', cards: [new Card(76, suite2Idx, 0), new Card(77, suite2Idx, 1)] },
                { type: 'KOU', cards: [new Card(78, suite5Idx, 0), new Card(79, suite5Idx, 1)] }
            ],
            expected: ['PASS']
        },
        {
            name: "[RULE-KOU-MAX-EXPOSED] Completing an exposed KOU into CHI is still mandatory at 2 exposed KOUs",
            hand: [],
            card: new Card(80, suite2Idx, 2), // 几 completes 丘乙
            isSelf: true,
            exposed: [
                { type: 'KOU', cards: [new Card(81, suite2Idx, 0), new Card(82, suite2Idx, 1)] },
                { type: 'KOU', cards: [new Card(83, suite5Idx, 0), new Card(84, suite5Idx, 1)] }
            ],
            expected: ['CHI']
        },
        {
            name: "[RULE-EXPOSED-PRIORITY] Incoming 生 upgrades exposed 尔小 KOU to CHI before in-hand 尔小",
            hand: [
                new Card(85, suite5Idx, 0), // 尔 in hand
                new Card(86, suite5Idx, 1)  // 小 in hand
            ],
            card: new Card(87, suite5Idx, 2), // 生
            isSelf: true,
            exposed: [
                { type: 'KOU', cards: [new Card(88, suite5Idx, 0), new Card(89, suite5Idx, 1)] }
            ],
            expected: ['CHI'],
            expectMeldRefType: 'KOU',
            expectedActionCardsCount: 0
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Self-drawn 4th card upgrades exposed SAO + 1 same-suit hand card into HALF-DRAGON",
            hand: [new Card(90, suite5Idx, 1)], // 小 in hand
            card: new Card(91, suite5Idx, 0),   // 4th 尔
            isSelf: true,
            exposed: [
                {
                    type: 'SAO',
                    cards: [
                        new Card(92, suite5Idx, 0),
                        new Card(93, suite5Idx, 0),
                        new Card(94, suite5Idx, 0)
                    ]
                }
            ],
            expected: ['HALF-DRAGON'],
            expectMeldRefType: 'SAO',
            expectedActionCardsCount: 1
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Other's 4th card upgrades exposed SAO + 1 same-suit hand card into HALF-SNAKE",
            hand: [new Card(90, suite5Idx, 1)], // 小 in hand
            card: new Card(91, suite5Idx, 0),   // 4th 尔
            isSelf: false,
            exposed: [
                {
                    type: 'SAO',
                    cards: [
                        new Card(92, suite5Idx, 0),
                        new Card(93, suite5Idx, 0),
                        new Card(94, suite5Idx, 0)
                    ]
                }
            ],
            expected: ['HALF-SNAKE'],
            expectMeldRefType: 'SAO',
            expectedActionCardsCount: 1
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Self-drawn 4th card upgrades exposed SAO + 2 same-suit hand cards into DRAGON",
            hand: [
                new Card(95, suite5Idx, 1), // 小
                new Card(96, suite5Idx, 2)  // 生
            ],
            card: new Card(97, suite5Idx, 0), // 4th 尔
            isSelf: true,
            exposed: [
                {
                    type: 'SAO',
                    cards: [
                        new Card(98, suite5Idx, 0),
                        new Card(99, suite5Idx, 0),
                        new Card(100, suite5Idx, 0)
                    ]
                }
            ],
            expected: ['DRAGON'],
            expectMeldRefType: 'SAO',
            expectedActionCardsCount: 2
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Exposed SAO + exposed KOU of same suit merges into DRAGON (priority over hand)",
            hand: [
                new Card(101, suite5Idx, 1), // 小 in hand
                new Card(102, suite5Idx, 2)  // 生 in hand
            ],
            card: new Card(103, suite5Idx, 0), // 4th 尔
            isSelf: true,
            exposed: [
                {
                    type: 'SAO',
                    cards: [
                        new Card(104, suite5Idx, 0),
                        new Card(105, suite5Idx, 0),
                        new Card(106, suite5Idx, 0)
                    ]
                },
                {
                    type: 'KOU',
                    cards: [
                        new Card(107, suite5Idx, 1), // 小 in exposed KOU
                        new Card(108, suite5Idx, 2)  // 生 in exposed KOU
                    ]
                }
            ],
            expected: ['DRAGON'],
            expectMeldRefType: 'SAO',
            expectMergeMeldRefType: 'KOU',
            expectedActionCardsCount: 0
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] In-hand 3-of-a-kind + exposed KOU of same suit merges into SNAKE on other's card",
            hand: [
                new Card(109, suite5Idx, 0), // 尔
                new Card(110, suite5Idx, 0), // 尔
                new Card(111, suite5Idx, 0)  // 尔
            ],
            card: new Card(112, suite5Idx, 0), // 4th 尔
            isSelf: false,
            exposed: [
                {
                    type: 'KOU',
                    cards: [
                        new Card(113, suite5Idx, 1), // 小
                        new Card(114, suite5Idx, 2)  // 生
                    ]
                }
            ],
            expected: ['SNAKE'],
            expectMeldRefType: 'KOU',
            expectedActionCardsCount: 3
        },
        {
            name: "[RULE-MELD-UPGRADE-SAO] Exposed KAI-ZAO cannot absorb a future draw to become HALF-DRAGON",
            hand: [],
            card: new Card(115, suite5Idx, 1), // 小 drawn later
            isSelf: true,
            exposed: [
                {
                    type: 'KAI-ZAO',
                    cards: [
                        new Card(116, suite5Idx, 0),
                        new Card(117, suite5Idx, 0),
                        new Card(118, suite5Idx, 0),
                        new Card(119, suite5Idx, 0)
                    ]
                }
            ],
            expected: ['PASS']
        },
        {
            name: "[RULE-MELD-UPGRADE-TWO-DRAGONS] Exposed HALF-DRAGON + in-hand 3-of-a-kind upgrades to TWO-DRAGONS-TUSSLING",
            hand: [
                new Card(120, suite5Idx, 2), // 生
                new Card(121, suite5Idx, 2), // 生
                new Card(122, suite5Idx, 2)  // 生
            ],
            card: new Card(123, suite5Idx, 2), // 4th 生
            isSelf: true,
            exposed: [
                {
                    type: 'HALF-DRAGON',
                    cards: [
                        new Card(124, suite5Idx, 0), // 尔
                        new Card(125, suite5Idx, 0), // 尔
                        new Card(126, suite5Idx, 0), // 尔
                        new Card(127, suite5Idx, 0), // 尔
                        new Card(128, suite5Idx, 1)  // 小
                    ]
                }
            ],
            expected: ['TWO-DRAGONS-TUSSLING'],
            expectMeldRefType: 'HALF-DRAGON',
            expectedActionCardsCount: 3
        },
        {
            name: "[RULE-MELD-UPGRADE-TWO-DRAGONS] Exposed HALF-SNAKE + exposed SAO merges into TWO-DRAGONS-TUSSLING",
            hand: [],
            card: new Card(129, suite5Idx, 2), // 4th 生
            isSelf: false,
            exposed: [
                {
                    type: 'HALF-SNAKE',
                    cards: [
                        new Card(130, suite5Idx, 0), // 尔
                        new Card(131, suite5Idx, 0), // 尔
                        new Card(132, suite5Idx, 0), // 尔
                        new Card(133, suite5Idx, 0), // 尔
                        new Card(134, suite5Idx, 1)  // 小
                    ]
                },
                {
                    type: 'SAO',
                    cards: [
                        new Card(135, suite5Idx, 2), // 生
                        new Card(136, suite5Idx, 2), // 生
                        new Card(137, suite5Idx, 2)  // 生
                    ]
                }
            ],
            expected: ['TWO-DRAGONS-TUSSLING'],
            expectMeldRefType: 'HALF-SNAKE',
            expectMergeMeldRefType: 'SAO',
            expectedActionCardsCount: 0
        },
        (() => {
            const state = buildAllVeggieWaiverState();
            return {
                name: "All-veggie CHI/KOU hand offers HARMONY on 作",
                hand: state.hand,
                card: state.activeCard,
                isSelf: true,
                exposed: state.exposed,
                expected: ['CHI', 'HARMONY']
            };
        })(),
        (() => {
            const state = buildScreenshotHarmonyState();
            return {
                name: "[RULE-HARMONY-SCORE-THRESHOLD] Exposed SAO blocks HARMONY on the 8-fu screenshot",
                hand: state.hand,
                card: state.activeCard,
                isSelf: true,
                exposed: state.exposed,
                expected: ['CHI']
            };
        })(),
        ...kouNoDoOverCases(suite2Idx)
    ];

    let failed = 0;
    testCases.forEach(tc => {
        const actions = Rules.getActions(
            tc.hand,
            tc.card,
            tc.isSelf,
            tc.exposed || [],
            tc.discards || [],
            tc.options || {}
        );
        const actionTypes = actions.map(a => a.type);

        const isTypeMatch = tc.expected.length === actionTypes.length &&
            tc.expected.every(type => actionTypes.includes(type));
        const kouAction = actions.find(a => a.type === 'KOU');
        const isPartnerMatch = tc.expectedKouPartnerId === undefined ||
            (kouAction && kouAction.cards.length === 1 && kouAction.cards[0].id === tc.expectedKouPartnerId);
        const primaryAction = actions[0];
        const isMeldRefMatch = tc.expectMeldRefType === undefined ||
            (primaryAction && primaryAction.meldRef && primaryAction.meldRef.type === tc.expectMeldRefType);
        const isMergeMeldRefMatch = tc.expectMergeMeldRefType === undefined ||
            (primaryAction && primaryAction.mergeMeldRef && primaryAction.mergeMeldRef.type === tc.expectMergeMeldRefType);
        const isCardsCountMatch = tc.expectedActionCardsCount === undefined ||
            (primaryAction && Array.isArray(primaryAction.cards) && primaryAction.cards.length === tc.expectedActionCardsCount);
        const isMatch = isTypeMatch && isPartnerMatch && isMeldRefMatch && isMergeMeldRefMatch && isCardsCountMatch;

        if (isMatch) {
            console.log(`✅ ${tc.name}: Passed`);
        } else {
            console.error(`❌ ${tc.name}: Failed`);
            console.error(`   Expected: ${tc.expected}`);
            console.error(`   Got:      ${actionTypes}`);
            if (!isPartnerMatch) {
                console.error(`   Expected KOU partner id: ${tc.expectedKouPartnerId}, Got: ${kouAction ? kouAction.cards.map(c => c.id) : 'no KOU'}`);
            }
            failed++;
        }
    });

    failed += runKouNoDoOverGameTests();
    if (failed > 0) {
        console.error(`${failed} getActions test(s) failed.`);
        process.exit(1);
    }
    console.log("All getActions tests passed successfully!");
}

// Run if direct
if (import.meta.url === `file://${process.argv[1]}`) {
    runGetActionsTests();
}
