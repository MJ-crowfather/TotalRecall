
"use client";

import { Card as CardType, Suit, CardSuit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from "./icons";
import React from "react";

const suitIcons: Record<Suit, React.ElementType> = {
  spades: SpadeIcon,
  hearts: HeartIcon,
  clubs: ClubIcon,
  diamonds: DiamondIcon,
};

const suitColors: Record<CardSuit, string> = {
  spades: "text-foreground",
  hearts: "text-red-600",
  clubs: "text-foreground",
  diamonds: "text-red-600",
  joker: "text-red-600",
};

interface GameCardProps {
  card: CardType;
  source: string;
  isDraggable?: boolean;
  className?: string;
  onClick?: () => void;
}

export function GameCard({ card, source, isDraggable = true, className, onClick }: GameCardProps) {
  const SuitIcon = card.suit !== 'joker' ? suitIcons[card.suit] : HeartIcon; // Default icon for Joker
  const isClickable = !!onClick;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggable) {
        e.preventDefault();
        return;
    };
    const data = { card, source };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(data));
  };

  if (card.rank === 'Joker') {
    return (
        <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onClick={onClick}
            className={cn(
                "w-24 h-36 bg-card rounded-lg p-2 flex flex-col justify-between shadow-md border",
                isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all" : "",
                !isDraggable && !isClickable ? "cursor-not-allowed" : "",
                isClickable ? "cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all" : "",
                suitColors['joker'],
                className
            )}
            title="Joker"
        >
            <div className="text-left">
                <p className="font-bold text-xl font-body">Joker</p>
            </div>
            <div className="text-center">
                <SuitIcon className="w-8 h-8 mx-auto" />
            </div>
            <div className="text-right transform rotate-180">
                <p className="font-bold text-xl font-body">Joker</p>
            </div>
        </div>
    );
  }
  
  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onClick={onClick}
      className={cn(
        "w-24 h-36 bg-card rounded-lg p-2 flex flex-col justify-between shadow-md border",
        isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all" : "",
        !isDraggable && !isClickable ? "cursor-not-allowed" : "",
        isClickable ? "cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all" : "",
        card.suit !== 'joker' && suitColors[card.suit],
        className
      )}
      title={`${card.rank} of ${card.suit}`}
    >
      <div className="text-left">
        <p className="font-bold text-xl font-body">{card.rank}</p>
        <SuitIcon className="w-5 h-5" />
      </div>
      <div className="text-center">
        <SuitIcon className="w-8 h-8 mx-auto" />
      </div>
      <div className="text-right transform rotate-180">
        <p className="font-bold text-xl font-body">{card.rank}</p>
        <SuitIcon className="w-5 h-5" />
      </div>
    </div>
  );
}
