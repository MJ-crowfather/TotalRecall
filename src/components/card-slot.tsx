"use client";

import { cn } from "@/lib/utils";
import { Suit } from "@/lib/types";
import React from "react";
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from "./icons";

const suitIcons: Record<Suit, React.ElementType> = {
  spades: SpadeIcon,
  hearts: HeartIcon,
  clubs: ClubIcon,
  diamonds: DiamondIcon,
};

interface CardSlotProps {
  id: string; // a.k.a target
  onDrop: (data: any, target: string) => void;
  children?: React.ReactNode;
  className?: string;
  suit?: Suit;
}

export function CardSlot({ id, onDrop, children, className, suit }: CardSlotProps) {
  const [isOver, setIsOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    try {
        const data = JSON.parse(e.dataTransfer.getData("application/json"));
        onDrop(data, id);
    } catch (error) {
        console.error("Failed to parse dragged data", error);
    }
  };

  const SuitIcon = suit ? suitIcons[suit] : null;

  return (
    <div
      id={id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "w-24 h-36 rounded-lg flex items-center justify-center transition-colors",
        isOver ? "bg-accent/50 border-accent" : "",
        children ? "border-solid border-transparent" : "border-2 border-dashed border-muted-foreground/50",
        className
      )}
    >
      {children ? children : (
         SuitIcon ? <SuitIcon className="w-12 h-12 text-muted-foreground/30" /> : <div/>
      )}
    </div>
  );
}
