export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface Goal {
  suit: Suit;
  count: number;
  id: Suit;
}

export type MemoryPile = {
  cards: Card[];
  completedWithQueens: number;
};

export type MemorySequence = {
    cards: Card[];
    suit: Suit | null;
}

export interface GameState {
  goals: Goal[];
  playDeck: (Card | null)[][];
  narrativeDeck: (Card | null)[];
  forgottenPile: Card[];
  memoryPiles: Record<Suit, MemoryPile>;
  memorySequences: MemorySequence[];
  mainDeck: Card[];
  gameStatus: 'playing' | 'won' | 'lost';
  startTime: number;
  history: {
    move: string;
    timestamp: number;
  }[];
}
