import { type Suit, type Rank, type Card, type Goal, type GameState } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ROYAL_RANKS: Rank[] = ['J', 'Q', 'K'];

export const createDeck = (): Card[] => {
  return SUITS.flatMap(suit =>
    RANKS.map(rank => ({
      id: `${rank}-${suit}`,
      suit,
      rank,
    }))
  );
};

export const shuffleDeck = <T,>(deck: T[]): T[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const generateGoals = (): Goal[] => {
    // Each suit gets between 0 and 4 sets to complete.
    return SUITS.map(suit => ({
        suit,
        count: Math.floor(Math.random() * 3) + 1, // 1-3 sets
        id: suit,
    }));
};

export const setupGame = (): GameState => {
    const goals = generateGoals();
    let deck = shuffleDeck(createDeck());
    
    // Deal Narrative Deck (4 cards), ensuring no royal cards
    const narrativeDeck: (Card | null)[] = [];
    const tempHeldRoyals: Card[] = [];

    while (narrativeDeck.length < 4 && deck.length > 0) {
        const card = deck.pop();
        if (card) {
            if (ROYAL_RANKS.includes(card.rank)) {
                tempHeldRoyals.push(card);
            } else {
                narrativeDeck.push(card);
            }
        }
    }
    
    // Add held royal cards back to the deck and reshuffle
    deck.push(...tempHeldRoyals);
    deck = shuffleDeck(deck);

    // Deal Play Deck (8 cards in 2 rows)
    const playDeck: (Card | null)[][] = [[], []];
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            playDeck[i].push(deck.pop() ?? null);
        }
    }

    return {
        goals,
        playDeck,
        narrativeDeck,
        forgottenPile: [],
        memoryPiles: { 
            spades: { cards: [], completedWithQueens: 0 }, 
            hearts: { cards: [], completedWithQueens: 0 }, 
            clubs: { cards: [], completedWithQueens: 0 }, 
            diamonds: { cards: [], completedWithQueens: 0 } 
        },
        memorySequences: Array(4).fill(null).map(() => ({ cards: [], suit: null })),
        mainDeck: deck,
        gameStatus: 'playing',
        startTime: Date.now(),
        history: [],
    };
};
