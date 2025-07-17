import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center text-center space-y-8">
        <h1 className="text-8xl md:text-9xl font-headline text-primary tracking-wider">
          Recall
        </h1>
        <Card className="max-w-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline text-primary/90">A Card Game</CardTitle>
            <CardDescription className="font-body text-muted-foreground pt-2">
              Welcome to the corridors of your mind. Piece together forgotten memories before they fade away forever.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-left font-body">
            <p>
              Your goal is to complete a specific number of 'Memory Sets' for each suit. A set consists of three cards of the same suit. The number of sets required for each suit is determined at the start of the game.
            </p>
            <p>
              Use the cards in your 'Play Deck' to build these sets. You can also draw from the 'Narrative Deck' for help, but be wary—unused narrative cards are lost to the 'Forgotten Pile'.
            </p>
            <p className="font-bold">
              Wield powerful royal cards to manipulate the game:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><span className="font-bold">King:</span> Discard a card from your narrative deck.</li>
                <li><span className="font-bold">Queen:</span> Instantly completes a memory set for any suit.</li>
                <li><span className="font-bold">Jack:</span> Remove a card from a sequence or draw from the forgotten pile.</li>
            </ul>
            <p>
              The clock is ticking. Complete your memories and win the game. Good luck.
            </p>
          </CardContent>
        </Card>
        <Link href="/play" passHref>
          <Button size="lg" className="font-headline text-2xl tracking-wide shadow-lg hover:shadow-xl transition-shadow">
            Begin Game
          </Button>
        </Link>
      </div>
    </main>
  );
}
