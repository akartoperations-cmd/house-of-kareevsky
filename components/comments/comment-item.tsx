"use client";

import { format } from "date-fns";

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

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
}

export function CommentItem({ comment, currentUserId }: CommentItemProps) {
  const isOwnComment = comment.user_id === currentUserId;

  return (
    <div
      className={`p-4 rounded-lg ${
        comment.is_hidden_shadowban && !isOwnComment
          ? "bg-sand-100 opacity-50"
          : "bg-cream-100"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-medium text-charcoal-900">
            {comment.user?.full_name || "Anonymous"}
          </p>
          <p className="text-xs text-charcoal-500">
            {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        {comment.is_hidden_shadowban && isOwnComment && (
          <span className="text-xs text-charcoal-500 italic">(Hidden from others)</span>
        )}
      </div>
      <p className="text-charcoal-700 font-body leading-relaxed">{comment.text}</p>
    </div>
  );
}

