"use client";

import { CustomAudioPlayer } from "@/components/media/custom-audio-player";
import { CustomVideoPlayer } from "@/components/media/custom-video-player";
import { CommentsSection } from "@/components/comments/comments-section";
import { EmojiReactions } from "@/components/reactions/emoji-reactions";
import { format } from "date-fns";

interface Content {
  id: string;
  title: string;
  type: "text" | "audio" | "video";
  url: string;
  is_public: boolean;
  language: string;
  created_at: string;
}

interface ContentCardProps {
  content: Content;
  userId: string;
}

export function ContentCard({ content, userId }: ContentCardProps) {
  const renderContent = () => {
    switch (content.type) {
      case "text":
        return (
          <article
            className="prose prose-lg max-w-none font-body text-charcoal-800 leading-relaxed readable-content"
            data-reader-content="true"
          >
            <div dangerouslySetInnerHTML={{ __html: content.url }} />
          </article>
        );
      case "audio":
        return <CustomAudioPlayer src={content.url} title={content.title} />;
      case "video":
        return <CustomVideoPlayer src={content.url} title={content.title} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Chat bubble tail */}
      <div className="absolute -left-2 top-6 w-4 h-4 bg-gradient-to-br from-cream-100 to-sand-50 transform rotate-45 border-l border-b border-sand-200" />
      
      {/* Main chat bubble card */}
      <div className="relative bg-gradient-to-br from-cream-100 via-cream-50 to-sand-50 rounded-3xl rounded-tl-md shadow-md border border-sand-200 overflow-hidden">
        {/* Header with warm accent bar */}
        <div className="h-1 bg-gradient-to-r from-bronze-300 via-gold-300 to-bronze-400" />
        
        <div className="p-5 md:p-7">
          {/* Title and date */}
          <div className="mb-4">
            <h2 className="font-heading text-xl md:text-2xl text-charcoal-900 mb-1.5 leading-tight">
              {content.title}
            </h2>
            <p className="text-xs text-charcoal-500 font-ui flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bronze-400" />
              {format(new Date(content.created_at), "MMMM d, yyyy • h:mm a")}
            </p>
          </div>

          {/* Content */}
          <div className="mb-5 bg-white/60 rounded-2xl p-4 border border-sand-100">
            {renderContent()}
          </div>

          {/* Emoji Reactions */}
          <div className="mb-4">
            <EmojiReactions contentId={content.id} userId={userId} />
          </div>

          {/* Comments */}
          <div className="pt-4 border-t border-sand-200/60">
            <CommentsSection contentId={content.id} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}
