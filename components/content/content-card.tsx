"use client";

import { CustomAudioPlayer } from "@/components/media/custom-audio-player";
import { CustomVideoPlayer } from "@/components/media/custom-video-player";
import { CommentsSection } from "@/components/comments/comments-section";
import { ReactionHeatmap } from "@/components/reactions/reaction-heatmap";
import { format } from "date-fns";

interface Content {
  id: string;
  title: string;
  type: "text" | "audio" | "video";
  url: string;
  is_public: boolean;
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
        // For text content, url could be HTML string or a file URL
        // In production, you'd fetch the content from the URL
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
    <div className="bg-white rounded-xl shadow-sm border border-sand-200 p-6 md:p-8">
      <div className="mb-4">
        <h2 className="font-heading text-2xl md:text-3xl text-charcoal-900 mb-2">
          {content.title}
        </h2>
        <p className="text-sm text-charcoal-500 font-ui">
          {format(new Date(content.created_at), "MMMM d, yyyy")}
        </p>
      </div>

      <div className="mb-6">{renderContent()}</div>

      <ReactionHeatmap contentId={content.id} userId={userId} />

      <div className="mt-6 pt-6 border-t border-sand-200">
        <CommentsSection contentId={content.id} userId={userId} />
      </div>
    </div>
  );
}

