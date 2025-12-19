
'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import Image from "next/image";

type Variant = 'chat' | 'setting' | 'memory' | 'timer' |'back' ; //chat,setthing,memory,timerにボタンを分ける

type NavigationButtonProps = {
  href: string;//リンク
  label: string;//文字
  variant: Variant;//種類
  className?: string;
  icon: React.ReactNode;//アイコンはそれぞれのページで読み込ませる
};

const NavigationButton: React.FC<NavigationButtonProps> = ({ href, label, variant, className,icon }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(href);
  };

  // variantごとにスタイルを切り替え
  const getClassName = () => {
    switch (variant) {
      case 'chat':
        return ' text-white w-18 h-18  rounded-xl';
      case 'setting':
        return ' text-white  w-18 h-18 rounded-xl';
      case 'memory':
        return ' text-white w-18 h-18 rounded-xl';
      case 'timer':
        return 'border text-white px-6 py-4 rounded-xl shadow-lg ';
      case 'back':
        return  ' text-white w-18 h-18  rounded-xl'
      default:
        return '';
    }
  };

  // timerは構造を変える(画像形式) 
  if (variant === 'timer') {
    return (
      <button
        onClick={handleClick}
        className={`${getClassName()} ${className || ''}`}
        style={{ backgroundColor: 'transparent', padding: 0, border: 'none' }}
      >
        <img
          src="/images/timer_button.png"
          style={{ width: '300px', height: '80px' }}
          alt={label}
          
        />
      </button>
    );
  }
  
  
//backボタンの構造も変える。枠線なし
  if (variant === 'back') {
    return (
      <button
        onClick={handleClick}
        className={`${getClassName()} ${className || ''}`}
        style={{ padding: 0, border: 'none' }}
      >
       <span className="flex items-center justify-center">{icon}</span>
        
      </button>
    );
  }

  // 通常のボタン構造（ホーム画面の3つのボタンの共通部分のcss）
  return (
    <button onClick={handleClick} className={`${getClassName()} ${className || ''}`}
    style={{ backgroundColor: '#ffffff', border: '1px solid #F9BF8D' }}>
       <span className="flex items-center justify-center">{icon}</span>
      {label}
    </button>
  );
};

export default NavigationButton;
