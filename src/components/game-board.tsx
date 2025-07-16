"use client";

import { useState, useCallback, useEffect } from 'react';
import { GameState, Card, Suit, Goal, MemoryPile } from '@/lib/types';
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
  const [discardedTopRow, setDiscardedTopRow] = useState([false, false, false, false]);

  const getCompletedSets = useCallback((pile: MemoryPile) => {
    return Math.floor(pile.cards.length / CARDS_PER_SET) + pile.completedWithQueens;
  }, []);

  const checkWinCondition = useCallback((state: GameState) => {
    return state.goals.every(goal => {
      const completedSets = getCompletedSets(state.memoryPiles[goal.suit]);
      return completedSets === goal.count;
    });
  }, [getCompletedSets]);

  const processSequences = useCallback((newState: GameState) => {
    let lossOccurred = false;
    newState.memorySequences.forEach((sequence) => {
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

    if (checkWinCondition(newState)) {
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
      const newDiscardedTopRow = [...discardedTopRow];
      const { card, source } = data;

      let cardFoundAndRemoved = false;
      
      if (source.startsWith('play-')) {
        const [_, rowStr, colStr] = source.split('-');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (newState.playDeck[row]?.[col]?.id === card.id) {
          newState.playDeck[row][col] = null;
          cardFoundAndRemoved = true;

          // If card was played from top row (and not discarded), replace it
          if (row === 0 && !target.startsWith('forgotten')) {
            const cardBelow = newState.playDeck[1][col];
            newState.playDeck[0][col] = cardBelow;
            newState.playDeck[1][col] = newState.mainDeck.pop() ?? null;
          }
          // If card was discarded from top row
          else if (row === 0 && target.startsWith('forgotten')) {
            newDiscardedTopRow[col] = true;
            setDiscardedTopRow(newDiscardedTopRow);
            
            // Check if all top row cards are discarded to cycle rows
            if (newDiscardedTopRow.every(d => d)) {
                newState.playDeck[0] = newState.playDeck[1];
                newState.playDeck[1] = [
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                ];
                setDiscardedTopRow([false, false, false, false]);
            }
          }
        }
      } 
      else if (source.startsWith('narrative-')) {
        const index = parseInt(source.split('-')[1]);
        if (newState.narrativeDeck[index]?.id === card.id) {
          newState.narrativeDeck[index] = null;
          cardFoundAndRemoved = true;
        }
      }

      if (!cardFoundAndRemoved) {
        console.warn("Card not found at source, aborting drop.", {card, source});
        return prevState; 
      }

      // Handle drop targets
      if (target.startsWith('sequence-')) {
        const seqIndex = parseInt(target.split('-')[1]);
        const sequence = newState.memorySequences[seqIndex];

        if (card.rank === 'Q') {
          const pile = newState.memoryPiles[card.suit];
          pile.completedWithQueens++;
          const goal = newState.goals.find(g => g.suit === card.suit)!;
          if (getCompletedSets(pile) > goal.count) {
            toast({ title: "Game Over", description: `You used a Queen to create too many sets for ${card.suit}.`, variant: "destructive" });
            newState.gameStatus = 'lost';
          } else {
             if (checkWinCondition(newState)) {
                newState.gameStatus = 'won';
             }
          }
          return newState;
        }

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
  }, [toast, processSequences, getCompletedSets, checkWinCondition]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') {
      setGameOutcome(gameState.gameStatus);
    }
  }, [gameState.gameStatus]);
  
  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    if (rowIndex !== 0) return false;
    if (gameState.playDeck[0][colIndex] === null) return false;

    // A card is playable if all cards to its left in the top row have been discarded.
    for (let i = 0; i < colIndex; i++) {
        if (!discardedTopRow[i]) return false;
    }
    return true;
  };
  
  return (
    <>
      <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto">
        <header className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl font-headline text-primary">Memory Lane</h1>
          <GameTimer startTime={gameState.startTime} isRunning={gameState.gameStatus === 'playing'} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <GoalDisplay goals={gameState.goals} memoryPiles={gameState.memoryPiles} />
          </div>

          {/* Center Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
              <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Memory Sequences</h2>
                <div className="flex justify-around p-4 rounded-lg flex-wrap gap-2">
                  {gameState.memorySequences.map((sequence, index) => (
                    <CardSlot key={index} id={`sequence-${index}`} onDrop={handleDrop} suit={sequence.suit ?? undefined}>
                      {sequence.cards.length > 0 &&
                        <GameCard card={sequence.cards.slice(-1)[0]} source={`sequence-${index}`} isDraggable={false}/>
                      }
                    </CardSlot>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Narrative Deck</h2>
                <div className="flex justify-around flex-wrap gap-2 bg-primary/10 p-4 rounded-lg">
                  {gameState.narrativeDeck.map((card, index) => (
                      <CardSlot key={`narrative-slot-${index}`} id={`narrative-drop-${index}`} onDrop={() => {}}>
                        {card && (
                            <GameCard 
                              card={card} 
                              source={`narrative-${index}`}
                              isDraggable={gameState.gameStatus === 'playing'}
                            />
                        )}
                      </CardSlot>
                  ))}
                </div>
              </div>
              
              <div>
                <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Play Area</h2>
                <div className="space-y-4">
                    <div className="flex justify-around flex-wrap gap-2">
                      {gameState.playDeck[0].map((card, index) => (
                        <CardSlot key={`play-slot-0-${index}`} id={`play-0-${index}`} onDrop={() => {}}>
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
                        <CardSlot key={`play-slot-1-${index}`} id={`play-1-${index}`} onDrop={() => {}}>
                          {card && <GameCard card={card} source={`play-1-${index}`} isDraggable={false} />}
                        </CardSlot>
                      ))}
                    </div>
                </div>
              </div>
          </div>
          
          {/* Right Column */}
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
