"use client";
import { useState, useEffect } from "react";

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function GameTimer({ startTime, isRunning }: { startTime: number, isRunning: boolean }) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      // Set initial time
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      interval = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    }
  }, [startTime, isRunning]);

  return (
    <div className="font-mono text-2xl bg-primary/10 text-primary px-4 py-1 rounded-md shadow-inner">
      {formatTime(elapsedTime)}
    </div>
  );
}
