
"use client";

import { useState, useCallback, useEffect } from 'react';
import { GameState, Card, Suit, Goal, MemoryPile, Rank } from '@/lib/types';
import { GameCard } from '@/components/game-card';
import { GoalDisplay } from '@/components/goal-display';
import { CardSlot } from '@/components/card-slot';
import { GameTimer } from './game-timer';
import { CardBack } from './card-back';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import Link from 'next/link';
import { Button } from './ui/button';

type DraggableData = {
  card: Card;
  source: string;
};

const CARDS_PER_SET = 3;

const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function GameBoard({ initialGameState }: { initialGameState: GameState }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const { toast } = useToast();
  const [gameOutcome, setGameOutcome] = useState<'won' | 'lost' | null>(null);
  const [discardedTopRow, setDiscardedTopRow] = useState([false, false, false, false]);
  const [isDiscardMode, setIsDiscardMode] = useState(false);
  const [kingAction, setKingAction] = useState<Card | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null);

  const getRankValue = (rank: Rank): number => RANK_ORDER.indexOf(rank);

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
    newState.memorySequences.forEach((sequence, seqIndex) => {
      if (sequence.cards.length < CARDS_PER_SET) return;

      const sortedCards = [...sequence.cards].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
      
      const isSequential = getRankValue(sortedCards[0].rank) + 1 === getRankValue(sortedCards[1].rank) && getRankValue(sortedCards[1].rank) + 1 === getRankValue(sortedCards[2].rank);

      if (isSequential) {
        const suit = sequence.suit!;
        const pile = newState.memoryPiles[suit];

        pile.cards.push(...sortedCards);
        
        sequence.cards = [];
        sequence.suit = null;
        
        toast({ title: "Set Complete!", description: `A set of ${suit} has been moved to your memory.`});

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
          if (row === 0 && !target.startsWith('forgotten')) {
            const cardBelow = newState.playDeck[1][col];
            newState.playDeck[0][col] = cardBelow;
            newState.playDeck[1][col] = newState.mainDeck.pop() ?? null;
          } else {
             newState.playDeck[row][col] = null;
          }
          cardFoundAndRemoved = true;

          if (row === 0 && target.startsWith('forgotten')) {
            newDiscardedTopRow[col] = true;
            
            if (newDiscardedTopRow.every(d => d)) {
                newState.playDeck[0] = newState.playDeck[1];
                newState.playDeck[1] = [
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                    newState.mainDeck.pop() ?? null,
                ];
                setDiscardedTopRow([false, false, false, false]);
            } else {
                setDiscardedTopRow(newDiscardedTopRow);
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
      } else if (source.startsWith('sequence-')) {
        return prevState;
      }


      if (!cardFoundAndRemoved) {
        console.warn("Card not found at source, aborting drop.", {card, source});
        return prevState; 
      }
      
      if (target.startsWith('sequence-')) {
        const seqIndex = parseInt(target.split('-')[1]);
        const sequence = newState.memorySequences[seqIndex];

        if (card.rank === 'K') {
            setKingAction(card);
            return newState;
        }

        if (card.rank === 'Q') {
          const pile = newState.memoryPiles[card.suit];
          pile.completedWithQueens++;
          const goal = newState.goals.find(g => g.suit === card.suit)!;
          if (getCompletedSets(pile) > goal.count) {
            toast({ title: "Game Over", description: `You used a Queen to create too many sets for ${card.suit}.`, variant: "destructive" });
            newState.gameStatus = 'lost';
          }
           newState.forgottenPile.push(card);
          if (checkWinCondition(newState)) {
             newState.gameStatus = 'won';
          }
          return newState;
        }

        if (sequence.cards.length > 0 && card.suit !== sequence.suit) {
          toast({ title: "Invalid Move", description: `This sequence is for ${sequence.suit}.`, variant: "destructive" });
          return prevState;
        }
        
        if (sequence.cards.length === 0) {
            sequence.suit = card.suit;
        }

        if(sequence.cards.length > 0) {
          const cardRankValue = getRankValue(card.rank);
          const isAdjacent = sequence.cards.some(c => {
              const existingRankValue = getRankValue(c.rank);
              return Math.abs(cardRankValue - existingRankValue) === 1;
          });

          if (!isAdjacent) {
              toast({ title: "Invalid Move", description: "Cards in a sequence must be adjacent in rank.", variant: "destructive" });
              return prevState;
          }
        }
        
        sequence.cards.push(card);
        processSequences(newState);

      } else if (target === 'forgotten') {
        newState.forgottenPile.push(card);
      } else {
        toast({ title: "Invalid Move", description: "This is not a valid placement for the card.", variant: "destructive" });
        return prevState;
      }
      
      return newState;
    });
  }, [toast, processSequences, getCompletedSets, checkWinCondition, discardedTopRow]);

  const handleNarrativeCardClick = (index: number) => {
    if (!isDiscardMode) return;
    setConfirmDiscard(index);
  };
  
  const handleKingAction = (action: 'discardNarrative' | 'discardKing') => {
      if (!kingAction) return;

      setGameState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState));
        newState.forgottenPile.push(kingAction);
        if (action === 'discardNarrative') {
            toast({ title: "King Played!", description: "Select a card from the narrative deck to discard." });
            setIsDiscardMode(true);
        }
        return newState;
      });
      setKingAction(null);
  }

  const handleConfirmDiscard = (confirmed: boolean) => {
    if (confirmDiscard === null) return;
    
    if (confirmed) {
        setGameState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const cardToDiscard = newState.narrativeDeck[confirmDiscard];

            if (cardToDiscard) {
                newState.forgottenPile.push(cardToDiscard);
                newState.narrativeDeck[confirmDiscard] = null;
                toast({ title: "Card Discarded", description: `The ${cardToDiscard.rank} of ${cardToDiscard.suit} was moved to the forgotten pile.`});
            }
            
            setIsDiscardMode(false);
            return newState;
        });
    }
    setConfirmDiscard(null);
  };

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') {
      setGameOutcome(gameState.gameStatus);
    }
  }, [gameState.gameStatus]);
  
  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    const card = gameState.playDeck[rowIndex][colIndex];
    if (card === null) return false;
    
    // Top row is playable.
    if (rowIndex === 0) return true;

    // Bottom row card is playable if the card above it is gone.
    const cardAbove = gameState.playDeck[0][colIndex];
    return cardAbove === null;
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
                     <CardSlot 
                        key={index} 
                        id={`sequence-${index}`} 
                        onDrop={handleDrop} 
                        suit={sequence.suit ?? undefined}
                        className="relative"
                     >
                       {sequence.cards.map((c, i) => (
                          <div key={c.id} className="absolute" style={{ top: `${i * 25}px`}}>
                            <GameCard card={c} source={`sequence-${index}-${i}`} isDraggable={false}/>
                          </div>
                       ))}
                     </CardSlot>
                  ))}
                </div>
              </div>
              
              <Separator />

              <div>
                  <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Narrative Deck</h2>
                  <div className="flex justify-around flex-wrap gap-2 bg-primary/10 p-4 rounded-lg">
                      {gameState.narrativeDeck.map((card, index) => (
                          <div key={card?.id || `narrative-empty-${index}`} onClick={() => handleNarrativeCardClick(index)}>
                              {card ? (
                                  <GameCard 
                                    card={card} 
                                    source={`narrative-${index}`} 
                                    isDraggable={!isDiscardMode}
                                    className={isDiscardMode ? 'cursor-pointer hover:border-destructive hover:shadow-lg' : ''}
                                  />
                              ) : <div className="w-24 h-36" />}
                          </div>
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
                          {card && <GameCard card={card} source={`play-1-${index}`} isDraggable={isPlayable(1, index)} />}
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

      <AlertDialog open={!!kingAction}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-headline text-2xl">King Power</AlertDialogTitle>
                  <AlertDialogDescription>
                      You have played the King. Choose an action.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <Button variant="outline" onClick={() => handleKingAction('discardNarrative')}>Discard a Narrative Card</Button>
                  <Button onClick={() => handleKingAction('discardKing')}>Just Discard King</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-2xl">Confirm Discard</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to discard this card from the narrative deck? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmDiscard(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDiscard(true)}>Discard Card</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
