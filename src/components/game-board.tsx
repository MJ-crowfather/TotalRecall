
"use client";

import { useState, useCallback, useEffect } from 'react';
import { GameState, Card, Suit, Goal, MemoryPile, Rank, NarrativeSequence } from '@/lib/types';
import { GameCard } from '@/components/game-card';
import { GoalDisplay } from '@/components/goal-display';
import { CardSlot } from '@/components/card-slot';
import { GameTimer } from './game-timer';
import { CardBack } from './card-back';
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
  const [kingAction, setKingAction] = useState<Card | null>(null);
  const [isDiscardMode, setIsDiscardMode] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null);

  const getRankValue = (rank: Rank): number => RANK_ORDER.indexOf(rank);

  const getCompletedSets = useCallback((pile: MemoryPile) => {
    return Math.floor(pile.cards.length / CARDS_PER_SET) + pile.completedWithQueens;
  }, []);

  const checkWinCondition = useCallback((state: GameState) => {
    return state.goals.every(goal => {
      const completedSets = getCompletedSets(state.memoryPiles[goal.suit]);
      return completedSets >= goal.count;
    });
  }, [getCompletedSets]);

  const processNarrativeSet = useCallback((newState: GameState, sequenceIndex: number) => {
      const sequence = newState.narrativeDeck[sequenceIndex];
      if (sequence.cards.length < CARDS_PER_SET) return false;

      const sortedCards = [...sequence.cards].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
      
      const isSequential = getRankValue(sortedCards[0].rank) + 1 === getRankValue(sortedCards[1].rank) && getRankValue(sortedCards[1].rank) + 1 === getRankValue(sortedCards[2].rank);

      if (isSequential) {
        const suit = sortedCards[0].suit;
        const pile = newState.memoryPiles[suit];

        pile.cards.push(...sortedCards);
        
        const newCard = newState.mainDeck.pop();
        sequence.cards = newCard ? [newCard] : [];
        
        toast({ title: "Set Complete!", description: `A set of ${suit} has been moved to your memory.`});

        const goal = newState.goals.find(g => g.suit === suit)!;
        const completedSets = getCompletedSets(pile);

        if (completedSets > goal.count) {
          toast({ title: "Game Over", description: `You have created too many sets for ${suit}.`, variant: "destructive" });
          newState.gameStatus = 'lost';
          return true;
        }
        if (checkWinCondition(newState)) {
            newState.gameStatus = 'won';
        }
      }
      return false;
  }, [getCompletedSets, toast, checkWinCondition]);


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
        const [_, rowStr, colStr] = source.split('-');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (newState.playDeck[row]?.[col]?.id === card.id) {
            if (row === 0) {
                const cardBelow = newState.playDeck[1][col];
                newState.playDeck[0][col] = cardBelow;
                newState.playDeck[1][col] = newState.mainDeck.pop() ?? null;
            } else {
                 newState.playDeck[row][col] = null;
            }
          cardFoundAndRemoved = true;
        }
      } else if (source.startsWith('narrative-card-')) {
          const index = parseInt(source.split('-')[2]);
          if (newState.narrativeDeck[index].cards[0].id === card.id) {
            newState.narrativeDeck[index].cards.shift();
            cardFoundAndRemoved = true;
          }
      } else {
        console.warn("Card not found at source, aborting drop.", {card, source});
        return prevState; 
      }

      if (!cardFoundAndRemoved) {
        return prevState;
      }
      
      if (target.startsWith('narrative-')) {
        const seqIndex = parseInt(target.split('-')[1]);
        const sequence = newState.narrativeDeck[seqIndex];

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

        if (sequence.cards.length > 0 && card.suit !== sequence.cards[0].suit) {
          toast({ title: "Invalid Move", description: `This sequence is for ${sequence.cards[0].suit}.`, variant: "destructive" });
          return prevState;
        }

        if (sequence.cards.some(c => c.rank === card.rank)) {
           toast({ title: "Invalid Move", description: "Cannot have duplicate ranks in a sequence.", variant: "destructive" });
           return prevState;
        }
        
        const cardRankValue = getRankValue(card.rank);
        const ranksInSequence = sequence.cards.map(c => getRankValue(c.rank));
        const minRank = Math.min(...ranksInSequence);
        const maxRank = Math.max(...ranksInSequence);

        if (sequence.cards.length === 1) {
            if (Math.abs(cardRankValue - minRank) > 2) {
                toast({ title: "Invalid Move", description: "Card rank is too far to form a set.", variant: "destructive" });
                return prevState;
            }
        } else if (sequence.cards.length === 2) {
            const isBetween = cardRankValue > minRank && cardRankValue < maxRank;
            const isAdjacent = cardRankValue === minRank - 1 || cardRankValue === maxRank + 1;
            
            if (maxRank - minRank === 1) { 
                if(!isAdjacent) {
                    toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                    return prevState;
                }
            } else if (maxRank - minRank === 2) { 
                 if(!isBetween) {
                    toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                    return prevState;
                 }
            } else { 
                toast({ title: "Invalid Move", description: "This card does not fit the sequence.", variant: "destructive" });
                return prevState;
            }
        }

        sequence.cards.push(card);
        const lossOccurred = processNarrativeSet(newState, seqIndex);
        if (lossOccurred) return newState;

      } else if (target === 'forgotten') {
        newState.forgottenPile.push(card);
      } else {
        toast({ title: "Invalid Move", description: "This is not a valid placement for the card.", variant: "destructive" });
        return prevState;
      }
      
      if (checkWinCondition(newState)) {
        newState.gameStatus = 'won';
      }

      return newState;
    });
  }, [toast, getCompletedSets, checkWinCondition, processNarrativeSet]);

  const handleKingClick = (card: Card) => {
    if (gameState.gameStatus !== 'playing') return;
    setKingAction(card);
  }

  const handleKingAction = (action: 'discardNarrative' | 'discardKing', card: Card) => {
      if (!card) return;

      setGameState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState));
        let kingFound = false;

        // Find and remove the king from the play deck
        for (let i = 0; i < newState.playDeck.length; i++) {
            for (let j = 0; j < newState.playDeck[i].length; j++) {
                if (newState.playDeck[i][j]?.id === card.id) {
                    if (i === 0) {
                        const cardBelow = newState.playDeck[1][j];
                        newState.playDeck[0][j] = cardBelow;
                        newState.playDeck[1][j] = newState.mainDeck.pop() ?? null;
                    } else {
                        newState.playDeck[i][j] = null;
                    }
                    kingFound = true;
                    break;
                }
            }
            if(kingFound) break;
        }

        if (!kingFound) {
            console.error("King card not found in play deck to remove.");
            // Even if not found, proceed to avoid getting stuck
        }


        newState.forgottenPile.push(card);

        if (action === 'discardNarrative') {
            toast({ title: "King Played!", description: "Select a card from the narrative deck to discard." });
            setIsDiscardMode(true);
        }
        return newState;
      });
      setKingAction(null);
  }

  const handleNarrativeCardClick = (index: number) => {
    if (!isDiscardMode) return;
    setConfirmDiscard(index);
  };
  
  const handleConfirmDiscard = (confirmed: boolean) => {
    if (confirmDiscard === null) return;
    
    if (confirmed) {
        setGameState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const sequenceToDiscard = newState.narrativeDeck[confirmDiscard];

            if (sequenceToDiscard && sequenceToDiscard.cards.length > 0) {
                newState.forgottenPile.push(...sequenceToDiscard.cards);
                
                const newCard = newState.mainDeck.pop();
                newState.narrativeDeck[confirmDiscard].cards = newCard ? [newCard] : [];
                toast({ title: "Card Discarded", description: `The pile was moved to the forgotten pile.`});
            }
            
            setIsDiscardMode(false);
            return newState;
        });
    }
    setConfirmDiscard(null);
    setIsDiscardMode(false);
  };


  useEffect(() => {
    if (gameState.gameStatus !== 'playing') {
      setGameOutcome(gameState.gameStatus);
    }
  }, [gameState.gameStatus]);
  
  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    const card = gameState.playDeck[rowIndex][colIndex];
    if (!card) return false;

    // Kings are handled by click, not drag
    if (card.rank === 'K') return false; 

    // A card in row 0 is only playable if its index corresponds to the first non-null card from left to right.
    if (rowIndex === 0) {
        for (let i = 0; i < colIndex; i++) {
            if (gameState.playDeck[0][i] !== null) {
                return false;
            }
        }
        return true;
    }

    // A card in the bottom row is playable only if the card above it is gone.
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
              <div className="bg-primary/10 p-4 rounded-lg space-y-8">
                <div>
                  <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Narrative Deck</h2>
                  <div className="flex justify-around flex-wrap gap-2">
                    {gameState.narrativeDeck.map((sequence, index) => (
                      <CardSlot 
                        key={sequence.id} 
                        id={`narrative-${index}`} 
                        onDrop={handleDrop}
                        className={isDiscardMode ? 'border-destructive' : ''}
                        suit={sequence.cards.length > 0 ? sequence.cards[0].suit : undefined}
                      >
                        {sequence.cards.map((c, i) => (
                          <div 
                            key={c.id} 
                            className="absolute" 
                            style={{ top: `${i * 25}px`}}
                            onClick={isDiscardMode ? () => handleNarrativeCardClick(index) : undefined}
                          >
                            <GameCard 
                              card={c} 
                              source={`narrative-card-${index}`} 
                              isDraggable={false}
                              className={isDiscardMode ? 'cursor-pointer hover:border-destructive hover:shadow-lg' : ''}
                            />
                          </div>
                        ))}
                      </CardSlot>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Play Area</h2>
                  <div className="space-y-4">
                      <div className="flex justify-around flex-wrap gap-2">
                        {gameState.playDeck[0].map((card, index) => (
                          <CardSlot key={`play-slot-0-${index}`} id={`forgotten-play-area-top-${index}`} onDrop={handleDrop}>
                            {card && (
                                <GameCard 
                                  card={card} 
                                  source={`play-0-${index}`}
                                  isDraggable={isPlayable(0, index)}
                                  onClick={card.rank === 'K' ? () => handleKingClick(card) : undefined}
                                />
                            )}
                          </CardSlot>
                        ))}
                      </div>
                      <div className="flex justify-around flex-wrap gap-2">
                        {gameState.playDeck[1].map((card, index) => (
                          <CardSlot key={`play-slot-1-${index}`} id={`play-1-${index}`} onDrop={() => {}}>
                            {card && <GameCard 
                              card={card} 
                              source={`play-1-${index}`} 
                              isDraggable={isPlayable(1, index)}
                              onClick={card.rank === 'K' ? () => handleKingClick(card) : undefined}
                            />}
                          </CardSlot>
                        ))}
                      </div>
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
                      You have played the King of {kingAction?.suit}. Choose an action.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <Button variant="outline" onClick={() => handleKingAction('discardNarrative', kingAction!)}>Discard a Narrative Pile</Button>
                  <Button onClick={() => handleKingAction('discardKing', kingAction!)}>Just Discard King</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-2xl">Confirm Discard</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to discard this entire pile from the narrative deck? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmDiscard(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDiscard(true)}>Discard Pile</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
