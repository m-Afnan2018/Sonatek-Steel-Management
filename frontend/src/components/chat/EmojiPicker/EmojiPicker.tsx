'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './EmojiPicker.module.css';

const EMOJIS: Record<string, string[]> = {
  'Smileys': ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😗','🤩','😋','😛','😜','🤪','😝','🤑','🤗','🤔','😐','😑','😶','😏','😒','🙄','😬','😔','😪','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','😵','🤯','😎','🥳','😱','😨','😰','😢','😭','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽'],
  'Gestures': ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🙏','👏','🤲','🤝','💪','🦾','✍️','🤏','🤜','🤛','👊','✊','🫶','🫂'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹','💌','💋','💯','🌹','🥀','🌸','🌺','💐'],
  'Objects': ['🎉','🎊','🎈','🎁','🏆','🥇','🌟','⭐','✨','💫','🔥','💥','❌','✅','❓','❗','💬','💭','📌','🔑','💡','📱','💻','🖥️','📷','🎵','🎶','🎮','🚀','⚡','🌈','🍕','🍔','🍣','☕','🍺','🎂'],
};

const CATEGORY_ICONS: Record<string, string> = {
  'Smileys': '😊',
  'Gestures': '👍',
  'Hearts': '❤️',
  'Objects': '🎉',
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export default function EmojiPicker({ onSelect, onClose, style }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('Smileys');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div className={styles.picker} style={style} ref={containerRef}>
      {/* Category tabs */}
      <div className={styles.tabs}>
        {Object.keys(EMOJIS).map((cat) => (
          <button
            key={cat}
            className={`${styles.tabBtn} ${activeCategory === cat ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveCategory(cat)}
            title={cat}
          >
            {CATEGORY_ICONS[cat]}
          </button>
        ))}
      </div>

      {/* Category label */}
      <p className={styles.categoryLabel}>{activeCategory}</p>

      {/* Emoji grid */}
      <div className={styles.grid}>
        {EMOJIS[activeCategory].map((emoji) => (
          <button
            key={emoji}
            className={styles.emojiBtn}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
