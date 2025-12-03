import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ContentFeed } from "@/components/content/content-feed";

export default async function ContentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Check premium status
  const { data: profile } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  const isPremium = profile?.is_premium || false;

  return (
    <main className="min-h-screen bg-cream-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-4xl md:text-5xl text-charcoal-900 mb-8">
          Content Feed
        </h1>
        <ContentFeed isPremium={isPremium} userId={user.id} />
      </div>
    </main>
  );
}

