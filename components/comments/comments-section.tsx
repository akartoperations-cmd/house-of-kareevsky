"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  user_id: string;
  content_id: string;
  text: string;
  is_hidden_shadowban: boolean;
  created_at: string;
  user: {
    full_name: string;
    email: string;
  };
}

interface CommentsSectionProps {
  contentId: string;
  userId: string;
}

export function CommentsSection({ contentId, userId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchComments() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          user:users!comments_user_id_fkey(full_name, email)
        `
        )
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching comments:", error);
      } else {
        // Filter out shadow-banned comments for other users
        const visibleComments = (data || []).filter((comment) => {
          // User can always see their own comments
          if (comment.user_id === userId) return true;
          // Hide shadow-banned comments from others
          return !comment.is_hidden_shadowban;
        });
        setComments(visibleComments);
      }

      setLoading(false);
    }

    fetchComments();
  }, [contentId, userId]);

  const handleNewComment = async (text: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("comments")
      .insert({
        content_id: contentId,
        user_id: userId,
        text,
        is_hidden_shadowban: false,
      })
      .select(
        `
        *,
        user:users!comments_user_id_fkey(full_name, email)
      `
      )
      .single();

    if (error) {
      console.error("Error adding comment:", error);
      return;
    }

    if (data) {
      setComments([data, ...comments]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-charcoal-600">
        <MessageCircle className="w-5 h-5" />
        <span>Loading comments...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-charcoal-700" />
        <h3 className="font-heading text-lg text-charcoal-900">
          Comments ({comments.length})
        </h3>
      </div>

      <CommentForm onSubmit={handleNewComment} />

      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <p className="text-charcoal-500 text-sm">No comments yet. Be the first to share your thoughts.</p>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} currentUserId={userId} />
          ))
        )}
      </div>
    </div>
  );
}

