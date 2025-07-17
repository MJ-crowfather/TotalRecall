import { GameBoard } from '@/components/game-board';
import { setupGame } from '@/lib/game';

export const dynamic = 'force-dynamic';

export default function PlayPage() {
  const initialGameState = setupGame();

  return (
    <main className="min-h-screen bg-background text-foreground font-body p-2 sm:p-4">
      <GameBoard initialGameState={initialGameState} />
    </main>
  );
}
