"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReactionHeatmapProps {
  contentId: string;
  userId: string;
}

interface ReactionPosition {
  x: number;
  y: number;
  id: string;
}

export function ReactionHeatmap({ contentId, userId }: ReactionHeatmapProps) {
  const [reactions, setReactions] = useState<ReactionPosition[]>([]);
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Load existing reactions (stored as positions)
  useEffect(() => {
    // In a real implementation, you'd fetch reaction positions from a database
    // For now, we'll use localStorage as a simple store
    const stored = localStorage.getItem(`reactions-${contentId}`);
    if (stored) {
      try {
        setReactions(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading reactions:", e);
      }
    }
  }, [contentId]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Create new reaction
    const newReaction: ReactionPosition = {
      x,
      y,
      id: `${Date.now()}-${Math.random()}`,
    };

    setReactions([...reactions, newReaction]);
    localStorage.setItem(`reactions-${contentId}`, JSON.stringify([...reactions, newReaction]));

    // Create sparkle animation
    const sparkleId = Date.now();
    setSparkles([...sparkles, { id: sparkleId, x: e.clientX, y: e.clientY }]);

    // Remove sparkle after animation
    setTimeout(() => {
      setSparkles((prev) => prev.filter((s) => s.id !== sparkleId));
    }, 600);
  };

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={handleClick}
      style={{ minHeight: "100px" }}
    >
      {/* Reaction Dots */}
      {reactions.map((reaction) => (
        <motion.div
          key={reaction.id}
          className="absolute w-2 h-2 bg-bronze-400 rounded-full opacity-60"
          style={{
            left: `${reaction.x}%`,
            top: `${reaction.y}%`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      ))}

      {/* Sparkle Animations */}
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.div
            key={sparkle.id}
            className="fixed pointer-events-none z-50"
            style={{
              left: sparkle.x,
              top: sparkle.y,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ scale: 0, rotate: 0, opacity: 1 }}
            animate={{ scale: 1.5, rotate: 360, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Sparkles className="w-8 h-8 text-gold-400" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Hint Text */}
      {reactions.length === 0 && (
        <div className="text-center py-4 text-charcoal-500 text-sm">
          Click anywhere to add a reaction
        </div>
      )}
    </div>
  );
}

