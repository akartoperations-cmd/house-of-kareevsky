import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Check if user is admin (you can customize this logic)
  // For now, we'll allow any authenticated user - you can add admin check later
  const { data: profile } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  // Basic check - you might want to add an is_admin column later
  const isAdmin = profile?.is_premium || false;

  if (!isAdmin) {
    redirect("/content");
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-4xl md:text-5xl text-charcoal-900 mb-8">
          Admin Dashboard
        </h1>
        <AdminDashboard userId={user.id} />
      </div>
    </main>
  );
}

