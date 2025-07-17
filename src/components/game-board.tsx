
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';

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
  const [jackAction, setJackAction] = useState<{ card: Card, position: { row: number, col: number } } | null>(null);
  const [isDiscardMode, setIsDiscardMode] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null);
  const [showResurrectDialog, setShowResurrectDialog] = useState(false);


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
      let cardRow = -1;
      let cardCol = -1;
      
      // Card removal logic from Play Deck
      if (source.startsWith('play-')) {
        const [_, rowStr, colStr] = source.split('-');
        cardRow = parseInt(rowStr);
        cardCol = parseInt(colStr);

        if (newState.playDeck[cardRow]?.[cardCol]?.id === card.id) {
            // We don't set to null yet. We do it based on the drop target.
            cardFoundAndRemoved = true;
        }
      }
      
      if (!cardFoundAndRemoved) {
        return prevState; 
      }
      
      // Handle the drop action
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

                if(rankDiff === 1) { 
                    if (!isAdjacent) {
                        toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                        return prevState;
                    }
                } else if (rankDiff === 2) {
                    if (!isBetween) {
                        toast({ title: "Invalid Move", description: "This card does not complete the sequence.", variant: "destructive" });
                        return prevState;
                    }
                } else {
                    toast({ title: "Invalid Move", description: "This card does not fit the sequence.", variant: "destructive" });
                    return prevState;
                }
            }
        }
        
        sequence.cards.push(card);
        
        // This is a "Play", so cascade the column
        newState.playDeck[cardRow][cardCol] = newState.playDeck[1][cardCol];
        newState.playDeck[1][cardCol] = newState.mainDeck.pop() ?? null;
        
        const lossOccurred = processNarrativeSet(newState, seqIndex);
        if (lossOccurred) return newState;

      } else if (target === 'forgotten') {
        // This is a "Discard", so just empty the slot
        newState.forgottenPile.push(card);
        newState.playDeck[cardRow][cardCol] = null;
      } else {
         // Invalid drop, return to original state
         return prevState;
      }
      
      if (checkWinCondition(newState)) {
        newState.gameStatus = 'won';
      }

      return newState;
    });
  }, [toast, checkWinCondition, processNarrativeSet]);

  const handleKingClick = (card: Card) => {
    if (gameState.gameStatus !== 'playing') return;
    setKingAction(card);
  }
  
  const handleQueenClick = (card: Card) => {
    if (gameState.gameStatus !== 'playing') return;
    setQueenAction(card);
  }

  const handleJackClick = (card: Card, rowIndex: number, colIndex: number) => {
    if (gameState.gameStatus !== 'playing') return;
    setJackAction({ card, position: { row: rowIndex, col: colIndex } });
  }

  const handleKingAction = (action: 'discardNarrative' | 'discardKing', card: Card) => {
      if (!card) return;

      setGameState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState));
        let kingFound = false;

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
      let queenRow = -1;
      let queenCol = -1;

      for (let i = 0; i < newState.playDeck.length; i++) {
          for (let j = 0; j < newState.playDeck[i].length; j++) {
              if (newState.playDeck[i][j]?.id === card.id) {
                  queenRow = i;
                  queenCol = j;
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
      
      if (action === 'completeSet') {
          if (card.suit === 'joker') {
             toast({ title: "Invalid Action", description: "A Joker Queen cannot be used this way.", variant: "destructive" });
             return prevState; 
          }
          
          newState.forgottenPile.push(card);
          
          if (queenRow !== -1 && queenCol !== -1) {
              newState.playDeck[queenRow][queenCol] = newState.playDeck[1][queenCol];
              newState.playDeck[1][queenCol] = newState.mainDeck.pop() ?? null;
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
      } else { // discardQueen
        if (queenRow !== -1 && queenCol !== -1) {
            newState.playDeck[queenRow][queenCol] = null;
        }
        newState.forgottenPile.push(card);
      }
      
      return newState;
    });

    setQueenAction(null);
  };

  const handleJackAction = (action: 'discardJack' | 'resurrectCard') => {
    if (!jackAction) return;
    
    if (action === 'discardJack') {
        setGameState(prevState => {
            const newState = JSON.parse(JSON.stringify(prevState));
            const { card, position } = jackAction;

            newState.playDeck[position.row][position.col] = null;
            newState.forgottenPile.push(card);

            return newState;
        });
        setJackAction(null);
    } else { // resurrectCard
        if (gameState.forgottenPile.length === 0) {
            toast({ title: "No Cards to Resurrect", description: "The forgotten pile is empty.", variant: "destructive" });
            setJackAction(null);
            return;
        }
        setShowResurrectDialog(true);
    }
  }

  const handleResurrectSelect = (selectedCard: Card) => {
      if (!jackAction) return;
      
      setGameState(prevState => {
          const newState = JSON.parse(JSON.stringify(prevState));
          const { card: jackCard, position } = jackAction;

          const cardIndex = newState.forgottenPile.findIndex(c => c.id === selectedCard.id);
          if (cardIndex > -1) {
              newState.forgottenPile.splice(cardIndex, 1);
          }

          newState.forgottenPile.push(jackCard);
          
          newState.playDeck[position.row][position.col] = selectedCard;
          
          toast({ title: "Card Resurrected!", description: `The ${selectedCard.rank} of ${selectedCard.suit} has been returned to play.` });

          return newState;
      });

      setShowResurrectDialog(false);
      setJackAction(null);
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

            if (sequenceToDiscard) {
                newState.forgottenPile.push(...sequenceToDiscard.cards);
                newState.narrativeDeck[confirmDiscard].cards = [];
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
  
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const topRowEmpty = gameState.playDeck[0].every(card => card === null);

    if (topRowEmpty && gameState.mainDeck.length > 0) {
      setGameState(prevState => {
        const isTopRowActuallyEmpty = prevState.playDeck[0].every(card => card === null);
        if (!isTopRowActuallyEmpty) return prevState;

        const newState = JSON.parse(JSON.stringify(prevState));
        
        newState.playDeck[0] = newState.playDeck[1];
        
        newState.playDeck[1] = [];
        for (let i = 0; i < 4; i++) {
          const newCard = newState.mainDeck.pop();
          newState.playDeck[1].push(newCard ?? null);
        }

        toast({ title: "Play Area Refreshed", description: "New cards have been dealt." });

        return newState;
      });
    }
  }, [gameState.playDeck, gameState.mainDeck.length, gameState.gameStatus, toast]);

  const isPlayable = (rowIndex: number, colIndex: number): boolean => {
    if (gameState.gameStatus !== 'playing') return false;
    const card = gameState.playDeck[rowIndex][colIndex];
    if (!card) return false;

    if (rowIndex === 1) {
      return false;
    }
    
    if (rowIndex === 0) {
      for (let i = 0; i < colIndex; i++) {
        if (gameState.playDeck[0][i] !== null) {
          return false;
        }
      }
      return true;
    }
    
    return false;
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
                        className={`relative ${isDiscardMode && sequence.cards.length > 0 ? 'cursor-pointer border-destructive hover:border-destructive/80' : ''}`}
                        suit={sequence.cards.length > 0 ? (sequence.cards.find(c => c.rank !== 'Joker')?.suit || undefined) : undefined}
                        hasVisibleContent={sequence.cards.length > 0}
                      >
                         {isDiscardMode && sequence.cards.length > 0 && (
                            <div
                              className="absolute inset-0 z-20"
                              onClick={() => handleNarrativeCardClick(index)}
                            />
                         )}
                        {sequence.cards.length > 0 && (
                           sequence.cards.map((c, i) => (
                              <div 
                                key={c.id} 
                                className="absolute" 
                                style={{ top: `${i * 25}px`, zIndex: i }}
                              >
                                <GameCard 
                                  card={c} 
                                  source={`narrative-card-${i}`} 
                                  isDraggable={false}
                                  className={isDiscardMode ? 'border-destructive' : ''}
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
                                  isDraggable={isPlayable(0, index) && !['K', 'Q', 'J'].includes(card.rank)}
                                  onClick={
                                    isPlayable(0,index) ?
                                      card.rank === 'K' ? () => handleKingClick(card) :
                                      card.rank === 'Q' ? () => handleQueenClick(card) :
                                      card.rank === 'J' ? () => handleJackClick(card, 0, index) :
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
                              isDraggable={false}
                               onClick={
                                isPlayable(1,index) ?
                                  card.rank === 'K' ? () => handleKingClick(card) :
                                  card.rank === 'Q' ? () => handleQueenClick(card) :
                                  card.rank === 'J' ? () => handleJackClick(card, 1, index) :
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
                  <Button variant="ghost" onClick={() => setKingAction(null)}>Cancel</Button>
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
                  <Button variant="ghost" onClick={() => setQueenAction(null)}>Cancel</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!jackAction && !showResurrectDialog}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-headline text-2xl">Jack Power</AlertDialogTitle>
                  <AlertDialogDescription>
                      You have played the Jack of {jackAction?.card.suit}. Choose an action.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <Button variant="outline" onClick={() => handleJackAction('resurrectCard')}>Resurrect a Card</Button>
                  <Button onClick={() => handleJackAction('discardJack')}>Just Discard Jack</Button>
                  <Button variant="ghost" onClick={() => setJackAction(null)}>Cancel</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showResurrectDialog} onOpenChange={setShowResurrectDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="font-headline text-2xl text-primary">Resurrect a Card</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-96">
                  <div className="flex flex-wrap gap-4 justify-center p-4">
                      {gameState.forgottenPile.map(card => (
                          <div key={card.id} onClick={() => handleResurrectSelect(card)}>
                              <GameCard card={card} source="resurrect-pile" isDraggable={false} className="cursor-pointer" />
                          </div>
                      ))}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

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
