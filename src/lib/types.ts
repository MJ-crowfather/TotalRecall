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

export interface GameState {
  goals: Goal[];
  playDeck: (Card | null)[][];
  narrativeDeck: Card[];
  discardPile: Card[];
  forgottenPile: Card[];
  memoryPiles: Record<Suit, Card[]>;
  mainDeck: Card[];
  gameStatus: 'playing' | 'won' | 'lost';
  startTime: number;
  history: {
    move: string;
    timestamp: number;
  }[];
}
