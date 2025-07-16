import { Goal, Suit, Card } from "@/lib/types";
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from "./icons";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const suitIcons: Record<Suit, React.ElementType> = {
  spades: SpadeIcon,
  hearts: HeartIcon,
  clubs: ClubIcon,
  diamonds: DiamondIcon,
};

interface GoalDisplayProps {
  goals: Goal[];
  memoryPiles: Record<Suit, Card[]>;
}

export function GoalDisplay({ goals, memoryPiles }: GoalDisplayProps) {
  return (
    <UICard>
      <CardHeader>
        <CardTitle className="font-headline text-xl text-primary/80">Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map(goal => {
          const SuitIcon = suitIcons[goal.suit];
          const currentCount = memoryPiles[goal.suit].length;
          const progress = goal.count > 0 ? (currentCount / goal.count) * 100 : (currentCount > 0 ? 100 : 0);
          const isComplete = goal.count > 0 && currentCount >= goal.count;

          return (
            <div key={goal.id}>
              <div className="flex justify-between items-center mb-1 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <SuitIcon className="w-5 h-5 text-primary" />
                  <span className="font-body">{goal.count === 0 ? "Any number" : `Collect ${goal.count}`}</span>
                </div>
                <span className={isComplete ? 'font-bold text-primary' : ''}>
                    {currentCount} / {goal.count > 0 ? goal.count : '∞'}
                </span>
              </div>
              <Progress value={progress} className={isComplete ? '[&>*]:bg-green-500' : ''}/>
            </div>
          );
        })}
      </CardContent>
    </UICard>
  );
}
