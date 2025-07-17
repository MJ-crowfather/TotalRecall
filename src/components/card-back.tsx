
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { GameCard } from './game-card';
import { type Card } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

export function CardBack({ count, pileName, pile, className }: { count: number, pileName?: string, pile?: Card[], className?: string }) {
  const content = (
    <div className={cn("relative w-24 h-36 bg-primary rounded-lg shadow-lg border-2 border-primary-foreground/50 flex items-center justify-center", className)}>
      <div className="w-20 h-32 rounded-md border-2 border-dashed border-primary-foreground/30 flex items-center justify-center">
        <span className="font-bold text-2xl text-primary-foreground">{count}</span>
      </div>
    </div>
  );

  if (pile && pile.length > 0 && pileName) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto w-auto hover:bg-transparent cursor-pointer">
            {content}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">{pileName} Pile</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="flex flex-wrap gap-4 justify-center p-4">
              {pile.map(card => (
                <GameCard 
                  key={card.id} 
                  card={card} 
                  source={`${pileName}-pile`} 
                  isDraggable={false} 
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
