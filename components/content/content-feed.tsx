"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ContentCard } from "./content-card";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

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
      // SECURITY: Only premium users can see content
      if (!isPremium) {
        setContent([]);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      
      // Sort by created_at ASCENDING - newest posts at bottom (like a chat)
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("created_at", { ascending: true });

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

  // NON-PREMIUM: Show upgrade prompt
  if (!isPremium) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-bronze-100 to-sand-100 flex items-center justify-center border-2 border-bronze-200">
          <Lock className="w-10 h-10 text-bronze-500" />
        </div>
        <h3 className="text-2xl font-heading text-charcoal-900 mb-3">
          Premium Content
        </h3>
        <p className="text-charcoal-600 font-body text-lg mb-6 max-w-md mx-auto">
          Subscribe to access exclusive literature, music, and vlogs from the Digital Sanctuary.
        </p>
        <a
          href={process.env.NEXT_PUBLIC_DIGISTORE_LINK || "#"}
          className="inline-flex items-center gap-2 px-8 py-4 bg-bronze-500 hover:bg-bronze-600 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
        >
          Become a Member
        </a>
      </div>
    );
  }

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
          <ContentCard content={item} userId={userId} />
        </motion.div>
      ))}
      
      {/* Scroll anchor for newest content */}
      <div ref={feedEndRef} />
    </div>
  );
}
