"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // ← 追加
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const Timer = () => {
  const totalTime = 25 * 60; // 25分
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [isRunning, setIsRunning] = useState(true);
  const router = useRouter(); // ← 追


  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  // タイマーが0になったときにホームに戻る
  useEffect(() => {
    if (timeLeft === 0) {
      sessionStorage.setItem("timerCompleted", "true");
      router.push("/home"); 
    }
  }, [timeLeft, router]); 

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const percentage = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="relative w-[300px] h-[300px] opacity-80 shadow-lg">
        <CircularProgressbar
          value={percentage}
          text={formatTime(timeLeft)}
          strokeWidth={2}
          styles={buildStyles({
            pathColor: "#1E3A8A",
            textColor: "#ffffff",
            trailColor: "#ffffff",
            textSize: "16px",
          })}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-white text-xl font-semibold  mb-10">
            {isRunning ? "作業中" : "離席中"}
          </div>
          <button
            onClick={isRunning ? handleStop : handleStart}
            className="border-white border-2 text-white p-3 rounded-full mt-20 hover:bg-white transition hover:text-blue-900"
          >
            {isRunning ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" className="fill-current">
                <rect width="4" height="14" x="6" y="5" rx="1" />
                <rect width="4" height="14" x="14" y="5" rx="1" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </main>
  );
};

export default Timer;
