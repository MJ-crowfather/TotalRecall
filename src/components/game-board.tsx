"use client";

import { useState, useCallback } from 'react';
import { GameState, Card, Suit } from '@/lib/types';
import { GameCard } from '@/components/game-card';
import { GoalDisplay } from '@/components/goal-display';
import { CardSlot } from '@/components/card-slot';
import { GameTimer } from './game-timer';
import { CardBack } from './card-back';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';

type DraggableData = {
  card: Card;
  source: string; // e.g., 'play-0-0', 'narrative-0'
};

export function GameBoard({ initialGameState }: { initialGameState: GameState }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const { toast } = useToast();

  const handleDrop = useCallback((data: DraggableData, target: string) => {
    // A simplified game logic handler.
    // In a full implementation, this would be much more complex, validating every move.
    setGameState(prevState => {
      const newState = JSON.parse(JSON.stringify(prevState)); // Deep copy for mutation
      const { card, source } = data;

      // Find and remove card from source
      let cardFound = false;
      if (source.startsWith('play-')) {
        const [_, row, col] = source.split('-').map(Number);
        if (newState.playDeck[row][col]?.id === card.id) {
          newState.playDeck[row][col] = null;
          cardFound = true;
        }
      } else if (source.startsWith('narrative-')) {
        if(newState.narrativeDeck[0]?.id === card.id) {
          newState.narrativeDeck.shift();
          cardFound = true;
        }
      }
      
      if (!cardFound) return prevState; // Card not found where it's supposed to be

      // Add card to target
      if (target.startsWith('memory-')) {
        const suit = target.split('-')[1] as Suit;
        // Basic validation: must be the correct suit
        if (card.suit === suit) {
          newState.memoryPiles[suit].push(card);
        } else {
           toast({ title: "Invalid Move", description: `This card must be a ${suit}.`, variant: "destructive" });
           return prevState; // Revert if invalid
        }
      } else if (target === 'discard') {
        newState.discardPile.push(card);
      } else {
        return prevState; // Invalid target, revert.
      }
      
      // Post-move logic (deal new cards, move cards up, etc.)
      // This is where rules like "E moves up" would be implemented.

      return newState;
    });
  }, [toast]);
  
  const isPlayable = (rowIndex: number, cardIndex: number): boolean => {
    if (rowIndex === 0) {
        for (let i = 0; i < cardIndex; i++) {
            if (gameState.playDeck[0][i] !== null) {
                return false;
            }
        }
        return gameState.playDeck[0][cardIndex] !== null;
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-headline text-primary">Memory Lane</h1>
        <GameTimer startTime={gameState.startTime} isRunning={gameState.gameStatus === 'playing'} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <GoalDisplay goals={gameState.goals} memoryPiles={gameState.memoryPiles} />
          <div className="space-y-2">
            <h2 className="font-headline text-xl text-primary/80">Narrative</h2>
            <div className="flex gap-2">
              {gameState.narrativeDeck.length > 0 ? (
                gameState.narrativeDeck.map((card, index) => (
                   <GameCard 
                      key={card.id} 
                      card={card}
                      source={`narrative-${index}`}
                      isDraggable={index === 0}
                    />
                ))
              ) : <div className="w-24 h-36" />}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Memory Piles</h2>
              <div className="flex justify-around bg-primary/10 p-4 rounded-lg flex-wrap gap-2">
                {['spades', 'hearts', 'clubs', 'diamonds'].map(suit => (
                   <CardSlot key={suit} id={`memory-${suit}`} onDrop={handleDrop} suit={suit as Suit}>
                     {gameState.memoryPiles[suit as Suit].length > 0 &&
                       <GameCard card={gameState.memoryPiles[suit as Suit].slice(-1)[0]} source={`memory-${suit}`} />
                     }
                   </CardSlot>
                ))}
              </div>
            </div>

            <Separator />
            
            <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Play Area</h2>
                <div className="space-y-4">
                  <div className="flex justify-around flex-wrap gap-2">
                    {gameState.playDeck[0].map((card, index) => (
                      <CardSlot key={`play-slot-0-${index}`} id={`play-0-${index}`} onDrop={handleDrop}>
                        {card && (
                            <GameCard 
                              card={card} 
                              source={`play-0-${index}`}
                              isDraggable={isPlayable(0, index)}
                            />
                        )}
                      </CardSlot>
                    ))}
                  </div>
                  <div className="flex justify-around flex-wrap gap-2">
                     {gameState.playDeck[1].map((card, index) => (
                      <CardSlot key={`play-slot-1-${index}`} id={`play-1-${index}`} onDrop={handleDrop}>
                        {card && <GameCard card={card} source={`play-1-${index}`} isDraggable={false} />}
                       </CardSlot>
                    ))}
                  </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6 items-center lg:items-stretch">
           <div className="space-y-2">
            <h2 className="font-headline text-xl text-primary/80">Main Deck</h2>
            <CardBack count={gameState.mainDeck.length} />
          </div>
           <div className="space-y-2">
             <h2 className="font-headline text-xl text-primary/80">Discard Pile</h2>
              <CardSlot id="discard" onDrop={handleDrop}>
                 {gameState.discardPile.length > 0 ? 
                    <GameCard card={gameState.discardPile.slice(-1)[0]} source="discard" /> :
                    <div className="w-24 h-36 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground text-center p-2">Discard Area</div>
                 }
              </CardSlot>
           </div>
           <div className="space-y-2">
             <h2 className="font-headline text-xl text-primary/80">Forgotten Pile</h2>
             <CardBack pileName="Forgotten" count={gameState.forgottenPile.length} pile={gameState.forgottenPile} />
           </div>
        </div>
      </div>
    </div>
  );
}
