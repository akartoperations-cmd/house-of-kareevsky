"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Check, X, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminDashboardProps {
  userId: string;
}

const contentTypeOptions = [
  { value: "text", label: "Text / Article" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
] as const;

const languageOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "universal", label: "Universal (Music/Photos)" },
] as const;

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [formData, setFormData] = useState({
    title: "",
    type: "text" as "text" | "audio" | "video",
    url: "",
    language: "en",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage("");

    const supabase = createClient();

    // SECURITY: is_public is ALWAYS false - content is premium-only
    const { data, error } = await supabase
      .from("content")
      .insert({
        title: formData.title,
        type: formData.type,
        url: formData.url,
        language: formData.language,
        is_public: false, // LOCKED: All content is premium-only
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating content:", error);
      setSubmitStatus("error");
      setSubmitMessage(error.message || "Failed to create content. Verify admin status.");
      setIsSubmitting(false);
      return;
    }

    setSubmitStatus("success");
    setSubmitMessage("Content created successfully!");
    
    // Reset form
    setFormData({
      title: "",
      type: "text",
      url: "",
      language: "en",
    });

    setIsSubmitting(false);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSubmitStatus(null);
      setSubmitMessage("");
    }, 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-sand-200 p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-heading text-charcoal-900 mb-2">
          Upload Content
        </h2>
        <p className="text-charcoal-600">
          Create new exclusive content for premium subscribers
        </p>
      </div>

      {/* Security Notice */}
      <div className="mb-6 p-4 bg-bronze-50 border border-bronze-200 rounded-lg flex items-start gap-3">
        <Lock className="w-5 h-5 text-bronze-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-bronze-900">Premium Content Only</p>
          <p className="text-xs text-bronze-700 mt-1">
            All uploaded content is automatically restricted to premium subscribers only.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-charcoal-700 mb-2">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
            placeholder="Enter content title"
          />
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">
            Content Type *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {contentTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, type: option.value })}
                className={cn(
                  "px-4 py-3 rounded-lg border-2 transition-all",
                  formData.type === option.value
                    ? "border-bronze-400 bg-bronze-50 text-bronze-900"
                    : "border-sand-200 bg-white text-charcoal-700 hover:border-sand-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-2">
            Language *
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            required
            className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-charcoal-500 mt-1">
            Choose &quot;Universal&quot; for music, photos, or content that should appear to all users regardless of language preference.
          </p>
        </div>

        {/* URL/Content */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-charcoal-700 mb-2">
            {formData.type === "text" ? "Content (HTML)" : "Media URL"} *
          </label>
          {formData.type === "text" ? (
            <textarea
              id="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              rows={10}
              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white font-mono text-sm"
              placeholder="Enter HTML content here..."
            />
          ) : (
            <input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
              placeholder="https://example.com/media.mp4"
            />
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-bronze-500 hover:bg-bronze-600 disabled:bg-sand-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-5 h-5" />
          {isSubmitting ? "Uploading..." : "Upload Content"}
        </button>

        {/* Status Message */}
        {submitStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-lg flex items-center gap-3",
              submitStatus === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            )}
          >
            {submitStatus === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{submitMessage}</span>
          </motion.div>
        )}
      </form>
    </div>
  );
}
