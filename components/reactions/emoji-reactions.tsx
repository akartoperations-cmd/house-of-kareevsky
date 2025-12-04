"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EmojiReactionsProps {
  contentId: string;
  userId: string;
}

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

const AVAILABLE_EMOJIS = ["🔥", "💡", "🤔", "👏", "💯", "😄", "👍", "🙏", "✨", "👀"];

export function EmojiReactions({ contentId, userId }: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);

  // Load reactions from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const stored = localStorage.getItem(`emoji-reactions-${contentId}`);
    if (stored) {
      try {
        setReactions(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading reactions:", e);
      }
    }
  }, [contentId]);

  const handleReaction = (emoji: string) => {
    const currentReaction = reactions[emoji] || { emoji, count: 0, userReacted: false };
    
    const newReactions = {
      ...reactions,
      [emoji]: {
        emoji,
        count: currentReaction.userReacted ? currentReaction.count - 1 : currentReaction.count + 1,
        userReacted: !currentReaction.userReacted,
      },
    };

    // Remove emoji if count is 0
    if (newReactions[emoji].count <= 0) {
      delete newReactions[emoji];
    }

    setReactions(newReactions);
    
    if (typeof window !== "undefined") {
      localStorage.setItem(`emoji-reactions-${contentId}`, JSON.stringify(newReactions));
    }

    // Trigger animation
    if (!currentReaction.userReacted) {
      setAnimatingEmoji(emoji);
      setTimeout(() => setAnimatingEmoji(null), 600);
    }

    setShowPicker(false);
  };

  const activeReactions = Object.values(reactions).filter((r) => r.count > 0);

  return (
    <div className="relative">
      {/* Floating animation */}
      <AnimatePresence>
        {animatingEmoji && (
          <motion.div
            className="fixed pointer-events-none z-50 text-4xl"
            style={{ left: "50%", top: "50%" }}
            initial={{ scale: 0, y: 0, opacity: 1 }}
            animate={{ scale: 1.5, y: -100, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {animatingEmoji}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active reactions display */}
      <div className="flex flex-wrap items-center gap-2">
        {activeReactions.map((reaction) => (
          <motion.button
            key={reaction.emoji}
            onClick={() => handleReaction(reaction.emoji)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
              reaction.userReacted
                ? "bg-bronze-100 border-2 border-bronze-400"
                : "bg-cream-100 border-2 border-sand-200 hover:border-sand-300"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-lg">{reaction.emoji}</span>
            <span className="font-medium text-charcoal-700">{reaction.count}</span>
          </motion.button>
        ))}

        {/* Add reaction button */}
        <motion.button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-cream-100 border-2 border-sand-200 hover:border-bronze-300 hover:bg-bronze-50 transition-all text-lg"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          +
        </motion.button>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 p-3 bg-white rounded-2xl shadow-xl border border-sand-200 z-40"
          >
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-cream-100 rounded-lg transition-colors"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {showPicker && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

