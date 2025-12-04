"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
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

interface BlurredCardProps {
  content: Content;
}

export function BlurredCard({ content }: BlurredCardProps) {
  const getPlaceholderText = () => {
    switch (content.type) {
      case "text":
        return "Exclusive literature content";
      case "audio":
        return "Exclusive audio content";
      case "video":
        return "Exclusive video content";
      default:
        return "Exclusive content";
    }
  };

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-sand-200 p-6 md:p-8 overflow-hidden">
      {/* Blurred Content */}
      <div className="filter blur-lg opacity-50 pointer-events-none">
        <h2 className="font-heading text-3xl text-charcoal-900 mb-4">{content.title}</h2>
        <div className="h-64 bg-sand-200 rounded-lg"></div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center p-8"
        >
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <Lock className="w-12 h-12 text-bronze-500" />
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <Sparkles className="w-6 h-6 text-gold-400" />
              </motion.div>
            </div>
          </div>

          <h3 className="font-heading text-xl text-charcoal-900 mb-2">
            Premium Content
          </h3>
          <p className="text-charcoal-600 mb-6 max-w-md">
            {getPlaceholderText()} available only to premium members.
          </p>

          <Link
            href={process.env.NEXT_PUBLIC_DIGISTORE_LINK || "#"}
            className="inline-block px-6 py-3 bg-bronze-500 hover:bg-bronze-600 text-white rounded-lg font-medium transition-colors"
          >
            Unlock Premium Access
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

