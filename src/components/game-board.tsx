
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
  const [queenAction, setQueenAction] = useState<Card | null>(null);
  const [isDiscardMode, setIsDiscardMode] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null);

  const getRankValue = (rank: Rank): number => {
    if (rank === 'Joker') return -1; // Jokers are special
    return RANK_ORDER.indexOf(rank);
  }

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
      
      const nonJokers = sequence.cards.filter(c => c.rank !== 'Joker');
      if (nonJokers.length === 0) return false; // Cannot determine suit or ranks

      const suit = nonJokers[0].suit as Suit;
      
      // Separate jokers and numbered cards
      const jokers = sequence.cards.filter(c => c.rank === 'Joker');
      const numberedCards = nonJokers.map(c => ({...c, rankValue: getRankValue(c.rank)}));
      numberedCards.sort((a, b) => a.rankValue - b.rankValue);

      const minRank = numberedCards[0].rankValue;
      const maxRank = numberedCards[numberedCards.length-1].rankValue;
      const rankDiff = maxRank - minRank;

      let isSet = false;
      if(numberedCards.length === 3) {
          isSet = rankDiff === 2; // e.g. 5,6,7
      } else if (numberedCards.length === 2) {
          isSet = rankDiff <= 2; // Needs 1 joker. e.g. 5,7 -> joker is 6. 5,6 -> joker is 4 or 7
      } else if (numberedCards.length === 1) {
          isSet = true; // Needs 2 jokers. any card + 2 jokers is a set.
      }


      if (isSet) {
        const pile = newState.memoryPiles[suit];

        pile.cards.push(...sequence.cards);
        
        sequence.cards = []; // Leave the slot empty
        
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
      
      // Card removal logic from Play Deck
      if (source.startsWith('play-')) {
        const [_, rowStr, colStr] = source.split('-');
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (newState.playDeck[row]?.[col]?.id === card.id) {
            // If card is played (to narrative), cascade. If discarded (to forgotten), don't.
            if (target.startsWith('narrative-')) {
                // Card is played
                if (row === 0) {
                    const cardBelow = newState.playDeck[1][col];
                    newState.playDeck[0][col] = cardBelow;
                    newState.playDeck[1][col] = newState.mainDeck.pop() ?? null;
                } else {
                     newState.playDeck[row][col] = null;
                }
            } else if (target === 'forgotten') {
                 // Card is discarded
                 newState.playDeck[row][col] = null;
            } else {
                 // Invalid drop target for a play deck card, just discard it
                 newState.playDeck[row][col] = null;
            }
            cardFoundAndRemoved = true;
        }
      }
      
      if (!cardFoundAndRemoved) {
        return prevState; 
      }
      
      if (target.startsWith('narrative-')) {
        const seqIndex = parseInt(target.split('-')[1]);
        const sequence = newState.narrativeDeck[seqIndex];
        
        const nonJokerCards = sequence.cards.filter(c => c.rank !== 'Joker');
        const sequenceSuit = nonJokerCards.length > 0 ? nonJokerCards[0].suit : (card.suit !== 'joker' ? card.suit : undefined);

        if (card.rank !== 'Joker' && sequenceSuit && card.suit !== sequenceSuit) {
           toast({ title: "Invalid Move", description: `This sequence is for ${sequenceSuit}.`, variant: "destructive" });
           return prevState;
        }

        if (sequence.cards.some(c => c.rank === card.rank && card.rank !== 'Joker')) {
           toast({ title: "Invalid Move", description: "Cannot have duplicate ranks in a sequence.", variant: "destructive" });
           return prevState;
        }

        const cardRankValue = getRankValue(card.rank);
        const ranksInSequence = sequence.cards.filter(c => c.rank !== 'Joker').map(c => getRankValue(c.rank));
        ranksInSequence.sort((a,b) => a - b);
        const minRank = ranksInSequence[0];
        const maxRank = ranksInSequence[ranksInSequence.length - 1];

        if (card.rank !== 'Joker') {
            if (ranksInSequence.length === 1) {
                if (Math.abs(cardRankValue - minRank) > 2) {
                    toast({ title: "Invalid Move", description: "Card rank is too far to form a set.", variant: "destructive" });
                    return prevState;
                }
            } else if (ranksInSequence.length === 2) {
                const isAdjacent = cardRankValue === minRank - 1 || cardRankValue === maxRank + 1;
                const isBetween = cardRankValue > minRank && cardRankValue < maxRank;
                const rankDiff = maxRank - minRank;

                if(rankDiff === 1) { // e.g., 6, 7. Needs 5 or 8.
                    if (!isAdjacent) {
                        toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                        return prevState;
                    }
                } else if (rankDiff === 2) { // e.g., 6, 8. Needs 7.
                    if (!isBetween) {
                        toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                        return prevState;
                    }
                } else { // Should not happen with the rank diff check above, but as a fallback.
                    toast({ title: "Invalid Move", description: "This card does not fit the sequence.", variant: "destructive" });
                    return prevState;
                }
            }
        }
        
        sequence.cards.push(card);
        const lossOccurred = processNarrativeSet(newState, seqIndex);
        if (lossOccurred) return newState;

      } else if (target === 'forgotten') {
        newState.forgottenPile.push(card);
      } else {
         // This case handles invalid drops that still removed a card (e.g. dropping a queen somewhere invalid)
         // We should ensure the card is returned or forgotten. For simplicity, we forget it.
         newState.forgottenPile.push(card);
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
  
  const handleQueenClick = (card: Card) => {
    if (gameState.gameStatus !== 'playing') return;
    setQueenAction(card);
  }

  const handleKingAction = (action: 'discardNarrative' | 'discardKing', card: Card) => {
      if (!card) return;

      setGameState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState));
        let kingFound = false;

        // Remove King from play deck, leaving the spot empty
        for (let i = 0; i < newState.playDeck.length; i++) {
            for (let j = 0; j < newState.playDeck[i].length; j++) {
                if (newState.playDeck[i][j]?.id === card.id) {
                    newState.playDeck[i][j] = null;
                    kingFound = true;
                    break;
                }
            }
            if(kingFound) break;
        }

        if (!kingFound) {
            console.error("King card not found in play deck to remove.");
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

  const handleQueenAction = (action: 'completeSet' | 'discardQueen', card: Card) => {
    if (!card) return;

    setGameState(prevState => {
      const newState = JSON.parse(JSON.stringify(prevState));
      let queenFound = false;

      // Remove Queen from play deck, leaving the spot empty
      for (let i = 0; i < newState.playDeck.length; i++) {
          for (let j = 0; j < newState.playDeck[i].length; j++) {
              if (newState.playDeck[i][j]?.id === card.id) {
                  newState.playDeck[i][j] = null;
                  queenFound = true;
                  break;
              }
          }
          if (queenFound) break;
      }
      
      if (!queenFound) {
          console.error("Queen card not found in play deck to remove.");
          return prevState;
      }

      newState.forgottenPile.push(card);

      if (action === 'completeSet') {
          if (card.suit === 'joker') {
             toast({ title: "Invalid Action", description: "A Joker Queen cannot be used this way.", variant: "destructive" });
             return prevState; // Should not happen, but safeguard.
          }
          const pile = newState.memoryPiles[card.suit];
          pile.completedWithQueens++;

          const goal = newState.goals.find(g => g.suit === card.suit)!;
          if (getCompletedSets(pile) > goal.count) {
            toast({ title: "Game Over", description: `You used a Queen to create too many sets for ${card.suit}.`, variant: "destructive" });
            newState.gameStatus = 'lost';
          } else if (checkWinCondition(newState)) {
             newState.gameStatus = 'won';
          } else {
             toast({ title: "Set Completed!", description: `You used the Queen to complete a set of ${card.suit}.` });
          }
      }
      
      return newState;
    });

    setQueenAction(null);
  };


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

            if (sequenceToDiscard) {
                newState.forgottenPile.push(...sequenceToDiscard.cards);
                newState.narrativeDeck[confirmDiscard].cards = []; // Leave the spot empty
                toast({ title: "Pile Discarded", description: `The pile was moved to the forgotten pile.`});
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
  
  // Effect to check for game loss condition
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    
    const playDeckEmpty = gameState.playDeck.flat().every(c => c === null);

    if (gameState.mainDeck.length === 0 && playDeckEmpty) {
       if (!checkWinCondition(gameState)) {
          setGameState(prevState => ({ ...prevState, gameStatus: 'lost' }));
          toast({ title: "Game Over", description: "You have run out of cards and moves.", variant: "destructive" });
       }
    }

  }, [gameState, checkWinCondition, toast]);
  
  // Effect to handle play area cascade
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const topRowEmpty = gameState.playDeck[0].every(card => card === null);

    if (topRowEmpty) {
      setGameState(prevState => {
        // Only proceed if the top row is actually empty and we are not in the middle of another update
        if (!prevState.playDeck[0].every(card => card === null)) return prevState;

        const newState = JSON.parse(JSON.stringify(prevState));
        
        // Move bottom row to top row
        newState.playDeck[0] = newState.playDeck[1];
        
        // Deal 4 new cards to the bottom row
        newState.playDeck[1] = [];
        for (let i = 0; i < 4; i++) {
          newState.playDeck[1].push(newState.mainDeck.pop() ?? null);
        }

        toast({ title: "Play Area Refreshed", description: "New cards have been dealt." });

        return newState;
      });
    }
  }, [gameState.playDeck, gameState.gameStatus, toast]);

  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    const card = gameState.playDeck[rowIndex][colIndex];
    if (!card) return false;

    // A card in the top row is playable
    if (rowIndex === 0) {
      return true;
    }
    
    // Bottom row card is playable only if the card directly above it is null
    const cardAbove = gameState.playDeck[0][colIndex];
    return cardAbove === null;
  };
  
  return (
    <>
      <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto">
        <header className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl font-headline text-primary">Recall</h1>
          <GameTimer startTime={gameState.startTime} isRunning={gameState.gameStatus === 'playing'} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <GoalDisplay goals={gameState.goals} memoryPiles={gameState.memoryPiles} />
          </div>

          {/* Center Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-primary/10 p-4 rounded-lg space-y-8 flex-grow flex flex-col justify-start">
                <div>
                  <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Narrative Deck</h2>
                  <div className="flex justify-around flex-wrap gap-2">
                    {gameState.narrativeDeck.map((sequence, index) => (
                      <CardSlot 
                        key={sequence.id} 
                        id={`narrative-${index}`} 
                        onDrop={handleDrop}
                        className={`relative ${isDiscardMode ? 'border-destructive' : ''}`}
                        suit={sequence.cards.length > 0 && sequence.cards.find(c => c.rank !== 'Joker')?.suit || undefined}
                      >
                        {sequence.cards.length > 0 && (
                           sequence.cards.map((c, i) => (
                              <div 
                                key={c.id} 
                                className="absolute" 
                                style={{ top: `${i * 25}px`, zIndex: i }}
                                onClick={isDiscardMode ? () => handleNarrativeCardClick(index) : undefined}
                              >
                                <GameCard 
                                  card={c} 
                                  source={`narrative-card-${i}`} 
                                  isDraggable={false}
                                  className={isDiscardMode ? 'cursor-pointer hover:border-destructive hover:shadow-lg' : ''}
                                />
                              </div>
                            ))
                        )}
                      </CardSlot>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="font-headline text-xl text-primary/80 mb-2 text-center">Play Area</h2>
                  <div className="space-y-4">
                      <div className="flex justify-around flex-wrap gap-2">
                        {gameState.playDeck[0].map((card, index) => (
                          <CardSlot key={`play-slot-0-${index}`} id={`play-0-${index}`} onDrop={() => {}}>
                            {card && (
                                <GameCard 
                                  card={card} 
                                  source={`play-0-${index}`}
                                  isDraggable={isPlayable(0, index) && card.rank !== 'K' && card.rank !== 'Q'}
                                  onClick={
                                    isPlayable(0,index) ?
                                      card.rank === 'K' ? () => handleKingClick(card) :
                                      card.rank === 'Q' ? () => handleQueenClick(card) :
                                      undefined
                                    : undefined
                                  }
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
                              isDraggable={isPlayable(1, index) && card.rank !== 'K' && card.rank !== 'Q'}
                              onClick={
                                isPlayable(1,index) ?
                                  card.rank === 'K' ? () => handleKingClick(card) :
                                  card.rank === 'Q' ? () => handleQueenClick(card) :
                                  undefined
                                : undefined
                              }
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
                <Button>Main Menu</Button>
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
      
      <AlertDialog open={!!queenAction}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-headline text-2xl">Queen Power</AlertDialogTitle>
                  <AlertDialogDescription>
                      You have played the Queen of {queenAction?.suit}. Choose an action.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <Button variant="outline" onClick={() => handleQueenAction('completeSet', queenAction!)}>Complete a Memory Set</Button>
                  <Button onClick={() => handleQueenAction('discardQueen', queenAction!)}>Just Discard Queen</Button>
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

    