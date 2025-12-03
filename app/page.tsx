import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 via-cream-100 to-sand-100">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-bronze-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-gold-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="font-heading text-5xl md:text-7xl lg:text-8xl text-charcoal-900 mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              Digital Sanctuary
            </motion.h1>

            <motion.p
              className="font-body text-xl md:text-2xl text-charcoal-700 mb-8 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              A quiet space for exclusive artistic content. Literature, music, and moments
              shared with a close circle of followers.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Link
                href="/auth/signin"
                className="group px-8 py-4 bg-bronze-500 hover:bg-bronze-600 text-white rounded-lg font-medium transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                Enter the Sanctuary
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/content"
                className="px-8 py-4 bg-cream-200 hover:bg-cream-300 text-charcoal-800 rounded-lg font-medium transition-all duration-300 border-2 border-sand-300"
              >
                Explore Content
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating Sparkles */}
          <motion.div
            className="absolute top-10 left-10"
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Sparkles className="w-6 h-6 text-bronze-400 opacity-60" />
          </motion.div>

          <motion.div
            className="absolute bottom-20 right-20"
            animate={{
              y: [0, 20, 0],
              rotate: [0, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            <Sparkles className="w-8 h-8 text-gold-400 opacity-50" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-cream-50">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="font-heading text-4xl md:text-5xl text-center text-charcoal-900 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            A Space for Intimate Art
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Exclusive Content",
                description: "Literature, music, and vlogs shared only with premium members.",
              },
              {
                title: "Peaceful Experience",
                description: "A calm, distraction-free environment designed for deep engagement.",
              },
              {
                title: "Intimate Community",
                description: "Connect through thoughtful comments and reactions.",
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white rounded-xl p-6 shadow-sm border border-sand-200"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <h3 className="font-heading text-xl text-charcoal-900 mb-3">
                  {feature.title}
                </h3>
                <p className="font-body text-charcoal-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

