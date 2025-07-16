"use client";

import { useState, useCallback, useEffect } from 'react';
import { GameState, Card, Suit, Goal, MemoryPile, MemorySequence } from '@/lib/types';
import { GameCard } from '@/components/game-card';
import { GoalDisplay } from '@/components/goal-display';
import { CardSlot } from '@/components/card-slot';
import { GameTimer } from './game-timer';
import { CardBack } from './card-back';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import Link from 'next/link';

type DraggableData = {
  card: Card;
  source: string; // e.g., 'play-0-0', 'narrative-0'
};

const CARDS_PER_SET = 3;

export function GameBoard({ initialGameState }: { initialGameState: GameState }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const { toast } = useToast();
  const [gameOutcome, setGameOutcome] = useState<'won' | 'lost' | null>(null);

  const getCompletedSets = useCallback((pile: MemoryPile) => {
    return Math.floor(pile.cards.length / CARDS_PER_SET) + pile.completedWithQueens;
  }, []);

  const checkWinCondition = useCallback((goals: Goal[], memoryPiles: Record<Suit, MemoryPile>) => {
    return goals.every(goal => {
      const completedSets = getCompletedSets(memoryPiles[goal.suit]);
      return completedSets === goal.count;
    });
  }, [getCompletedSets]);

  const checkForLoss = useCallback((goals: Goal[], memoryPiles: Record<Suit, MemoryPile>) => {
    return goals.some(goal => {
      const completedSets = getCompletedSets(memoryPiles[goal.suit]);
      return completedSets > goal.count;
    });
  }, [getCompletedSets]);

  const processSequences = useCallback((newState: GameState) => {
    let lossOccurred = false;
    newState.memorySequences.forEach((sequence, seqIndex) => {
        if (sequence.cards.length === CARDS_PER_SET) {
            const suit = sequence.suit!;
            const pile = newState.memoryPiles[suit];
            
            pile.cards.push(...sequence.cards);
            sequence.cards = [];
            sequence.suit = null;
            
            const goal = newState.goals.find(g => g.suit === suit)!;
            const completedSets = getCompletedSets(pile);

            if (completedSets > goal.count) {
                 toast({ title: "Game Over", description: `You have created too many sets for ${suit}.`, variant: "destructive" });
                 newState.gameStatus = 'lost';
                 lossOccurred = true;
            }
        }
    });

    if (lossOccurred) return;

    if (checkWinCondition(newState.goals, newState.memoryPiles)) {
        newState.gameStatus = 'won';
    }
  }, [getCompletedSets, checkWinCondition, toast]);


  const handleDrop = useCallback((data: DraggableData, target: string) => {
    if (!data || !data.card) {
      console.error("Invalid drop data received", data);
      return;
    }

    setGameState(prevState => {
      if (prevState.gameStatus !== 'playing') return prevState;

      const newState: GameState = JSON.parse(JSON.stringify(prevState));
      const { card, source } = data;

      let cardFoundAndRemoved = false;
      if (source.startsWith('play-')) {
        const [_, row, col] = source.split('-').map(Number);
        if (newState.playDeck[row]?.[col]?.id === card.id) {
          newState.playDeck[row][col] = null;
          cardFoundAndRemoved = true;
          // Cascade logic
          if (row === 0) {
              const cardBelow = newState.playDeck[1][col];
              newState.playDeck[0][col] = cardBelow;
              const newCard = newState.mainDeck.pop() ?? null;
              newState.playDeck[1][col] = newCard;
          }
        }
      } else if (source.startsWith('narrative-')) {
        if(newState.narrativeDeck[0]?.id === card.id) {
          newState.narrativeDeck.shift();
          cardFoundAndRemoved = true;
        }
      }
      
      if (!cardFoundAndRemoved) return prevState;

      if (target.startsWith('sequence-')) {
          const seqIndex = parseInt(target.split('-')[1]);
          const sequence = newState.memorySequences[seqIndex];

          // Handle Queens
          if (card.rank === 'Q') {
              const goal = newState.goals.find(g => g.suit === card.suit)!;
              const pile = newState.memoryPiles[card.suit];
              pile.completedWithQueens++;

              if (getCompletedSets(pile) > goal.count) {
                  toast({ title: "Game Over", description: `You have created too many sets for ${card.suit}.`, variant: "destructive" });
                  newState.gameStatus = 'lost';
                  return newState;
              }
              processSequences(newState); // to check for win
              return newState;
          }
          
          // Handle regular cards
          if (sequence.suit === null) {
              sequence.suit = card.suit;
          }

          if (card.suit !== sequence.suit) {
              toast({ title: "Invalid Move", description: `This sequence is for ${sequence.suit}.`, variant: "destructive" });
              return prevState;
          }

          sequence.cards.push(card);
          processSequences(newState);
      } else if (target === 'forgotten') {
        newState.forgottenPile.push(card);
      } else {
        return prevState;
      }
      
      return newState;
    });
  }, [toast, processSequences, getCompletedSets]);

  useEffect(() => {
    const newOutcome = gameState.gameStatus === 'playing' ? null : gameState.gameStatus;
    if (newOutcome !== gameOutcome) {
      setGameOutcome(newOutcome);
    }
  }, [gameState.gameStatus, gameOutcome]);
  
  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    return rowIndex === 0 && gameState.playDeck[0][colIndex] !== null;
  };
  
  return (
    <>
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
                  gameState.narrativeDeck.slice(0, 1).map((card, index) => (
                    <GameCard 
                        key={card.id} 
                        card={card}
                        source={`narrative-${index}`}
                        isDraggable={index === 0 && gameState.gameStatus === 'playing'}
                      />
                  ))
                ) : <div className="w-24 h-36" />}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
              <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Play Area</h2>
                <div className="space-y-4">
                    <div className="flex justify-around flex-wrap gap-2 bg-primary/10 p-4 rounded-lg">
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

              <Separator />
              
              <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Memory Sequences</h2>
                <div className="flex justify-around p-4 rounded-lg flex-wrap gap-2">
                  {gameState.memorySequences.map((sequence, index) => (
                    <CardSlot key={index} id={`sequence-${index}`} onDrop={handleDrop} suit={sequence.suit ?? undefined}>
                      {sequence.cards.length > 0 &&
                        <GameCard card={sequence.cards.slice(-1)[0]} source={`sequence-${index}`} />
                      }
                    </CardSlot>
                  ))}
                </div>
              </div>
          </div>
          
          <div className="lg:col-span-1 flex flex-col gap-8 items-center lg:items-stretch">
            <div className="flex flex-row lg:flex-col gap-6 justify-around w-full">
                <div className="space-y-2 text-center">
                  <h2 className="font-headline text-xl text-primary/80">Main Deck</h2>
                  <CardBack count={gameState.mainDeck.length} />
                </div>
                <div className="space-y-2 text-center">
                    <h2 className="font-headline text-xl text-primary/80">Forgotten Pile</h2>
                    <CardSlot id="forgotten" onDrop={handleDrop}>
                        {gameState.forgottenPile.length > 0 ?
                            <CardBack pileName="Forgotten" count={gameState.forgottenPile.length} pile={gameState.forgottenPile} />
                            : <div className="w-24 h-36 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground text-center p-2">Discard Area</div>
                        }
                    </CardSlot>
                </div>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={!!gameOutcome}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-4xl">
              {gameOutcome === 'won' ? 'Congratulations!' : 'Game Over'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {gameOutcome === 'won' 
                ? 'You have successfully pieced together all the memories.' 
                : 'The memory became corrupted. A fragile mind is a dangerous thing.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
             <Link href="/" passHref>
                <AlertDialogAction>Main Menu</AlertDialogAction>
             </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
