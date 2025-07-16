import { type Suit, type Rank, type Card, type Goal, type GameState } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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
    const shuffledSuits = shuffleDeck(SUITS);
    return shuffledSuits.map(suit => ({
        suit,
        count: Math.floor(Math.random() * 3) + 1, // 1-3 sets
        id: suit,
    }));
};

const isFaceCard = (card: Card): boolean => {
    return ['J', 'Q', 'K'].includes(card.rank);
};

export const setupGame = (): GameState => {
    const goals = generateGoals();
    let deck = shuffleDeck(createDeck());
    
    // Deal Narrative Deck (4 non-face cards, except Aces)
    const narrativeDeck: Card[] = [];
    
    let tempMainDeck = [...deck];
    let narrativeCandidates = tempMainDeck.filter(c => !isFaceCard(c));
    let otherCards = tempMainDeck.filter(c => isFaceCard(c));
    
    narrativeDeck.push(...narrativeCandidates.slice(0, 4));
    
    const remainingCandidates = narrativeCandidates.slice(4);
    deck = shuffleDeck([...remainingCandidates, ...otherCards]);

    // Deal Play Deck
    const playDeck: (Card | null)[][] = [[], []];
    for (let i = 0; i < 8; i++) {
        const card = deck.pop();
        if (card) {
            if (i < 4) {
                playDeck[0].push(card);
            } else {
                playDeck[1].push(card);
            }
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
