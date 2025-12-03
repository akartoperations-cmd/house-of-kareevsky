import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ContentFeed } from "@/components/content/content-feed";
import { ContentWithLanguageSetup } from "./content-with-language-setup";

export default async function ContentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Check premium status and get language preferences
  const { data: profile } = await supabase
    .from("users")
    .select("is_premium, preferred_languages")
    .eq("id", user.id)
    .single();

  const isPremium = profile?.is_premium || false;
  const preferredLanguages = profile?.preferred_languages || ["en"];

  return (
    <main className="min-h-screen bg-cream-50">
      <ContentWithLanguageSetup userId={user.id}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="font-heading text-4xl md:text-5xl text-charcoal-900 mb-8">
            Content Feed
          </h1>
          <ContentFeed 
            isPremium={isPremium} 
            userId={user.id} 
            preferredLanguages={preferredLanguages}
          />
        </div>
      </ContentWithLanguageSetup>
    </main>
  );
}

