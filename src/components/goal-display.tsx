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

const CARDS_PER_SET = 3;

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
          const currentSets = Math.floor(memoryPiles[goal.suit].length / CARDS_PER_SET);
          const totalSetsRequired = goal.count;
          const progress = totalSetsRequired > 0 ? (currentSets / totalSetsRequired) * 100 : (currentSets > 0 ? 100 : 0);
          const isComplete = totalSetsRequired > 0 && currentSets >= totalSetsRequired;

          return (
            <div key={goal.id}>
              <div className="flex justify-between items-center mb-1 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <SuitIcon className="w-5 h-5 text-primary" />
                  <span className="font-body">{`Collect ${totalSetsRequired} set(s)`}</span>
                </div>
                <span className={isComplete ? 'font-bold text-primary' : ''}>
                    {`${currentSets} / ${totalSetsRequired}`}
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
