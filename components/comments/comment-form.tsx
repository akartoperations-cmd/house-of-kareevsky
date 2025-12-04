"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface CommentFormProps {
  onSubmit: (text: string) => Promise<void>;
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your thoughts..."
        className="flex-1 px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white font-body resize-none"
        rows={2}
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={!text.trim() || isSubmitting}
        className="px-4 py-2 bg-bronze-500 hover:bg-bronze-600 disabled:bg-sand-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <Send className="w-4 h-4" />
        {isSubmitting ? "..." : "Post"}
      </button>
    </form>
  );
}

