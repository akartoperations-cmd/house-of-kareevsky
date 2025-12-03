"use client";

import { useEffect, useState } from "react";
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
  created_at: string;
}

interface ContentFeedProps {
  isPremium: boolean;
  userId: string;
}

export function ContentFeed({ isPremium, userId }: ContentFeedProps) {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      const supabase = createClient();
      
      let query = supabase
        .from("content")
        .select("*")
        .order("created_at", { ascending: false });

      // If not premium, only show public content
      if (!isPremium) {
        query = query.eq("is_public", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching content:", error);
      } else {
        setContent(data || []);
      }

      setLoading(false);
    }

    fetchContent();
  }, [isPremium]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 bg-sand-200 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-charcoal-600 font-body text-lg">
          No content available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {content.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          {isPremium || item.is_public ? (
            <ContentCard content={item} userId={userId} />
          ) : (
            <BlurredCard content={item} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

