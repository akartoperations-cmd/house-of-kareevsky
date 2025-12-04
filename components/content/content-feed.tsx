"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ContentCard } from "./content-card";
import { BlurredCard } from "./blurred-card";
import { motion } from "framer-motion";

interface Content {
  id: string;
  title: string;
  type: "text" | "audio" | "video";
  url: string;
  is_public: boolean;
  language: string;
  created_at: string;
}

interface ContentFeedProps {
  isPremium: boolean;
  userId: string;
  preferredLanguages?: string[];
}

export function ContentFeed({ isPremium, userId, preferredLanguages = ["en"] }: ContentFeedProps) {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchContent() {
      const supabase = createClient();
      
      // Sort by created_at ASCENDING - newest posts at bottom (like a chat)
      let query = supabase
        .from("content")
        .select("*")
        .order("created_at", { ascending: true });

      // If not premium, only show public content
      if (!isPremium) {
        query = query.eq("is_public", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching content:", error);
        setLoading(false);
        return;
      }

      // Filter by language preferences
      // Show content if: language is 'universal' OR language is in user's preferred languages
      const filteredContent = (data || []).filter((item) => {
        return item.language === "universal" || preferredLanguages.includes(item.language);
      });

      setContent(filteredContent);
      setLoading(false);
    }

    fetchContent();
  }, [isPremium, preferredLanguages]);

  // Scroll to bottom when content loads (newest at bottom)
  useEffect(() => {
    if (!loading && content.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, content.length]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 bg-gradient-to-r from-sand-100 to-cream-100 animate-pulse rounded-3xl"
          />
        ))}
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cream-100 flex items-center justify-center">
          <span className="text-3xl">📭</span>
        </div>
        <p className="text-charcoal-600 font-body text-lg">
          No content available yet.
        </p>
        <p className="text-charcoal-500 font-body text-sm mt-1">
          Check back soon for new posts!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {content.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
        >
          {isPremium || item.is_public ? (
            <ContentCard content={item} userId={userId} />
          ) : (
            <BlurredCard content={item} />
          )}
        </motion.div>
      ))}
      
      {/* Scroll anchor for newest content */}
      <div ref={feedEndRef} />
    </div>
  );
}
