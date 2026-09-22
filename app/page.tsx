import { auth } from "@/auth";
import { Categories } from "@/components/home/categories";
import { Featured } from "@/components/home/featured";
import { Hero } from "@/components/home/hero";
import { MemberCta } from "@/components/home/member-cta";
import { PrintsCta } from "@/components/home/prints-cta";

const popular = ["cat", "angry", "happy", "bruh"];

const categories = [
  { name: "Reactions", symbol: "!", className: "bg-accent-pink" },
  { name: "Animals", symbol: "◉", className: "bg-accent-orange" },
  { name: "Memes", symbol: "⌁", className: "bg-metro-pink" },
  { name: "Gaming", symbol: "✦", className: "bg-metro-orange" },
  { name: "Anime", symbol: "✧", className: "bg-accent-pink" },
  { name: "Random", symbol: "⊙", className: "bg-accent-orange" },
];

const stickers = [
  { title: "Excited blob", author: "Ahmed", type: "GIF", color: "from-accent-pink/30 to-accent-orange/20" },
  { title: "Absolutely not", author: "Maya", type: "IMAGE", color: "from-accent-orange/30 to-metro-pink/20" },
  { title: "Confused", author: "Sam", type: "VIDEO", color: "from-metro-pink/30 to-accent-pink/20" },
  { title: "Tiny victory", author: "Ahmed", type: "GIF", color: "from-metro-orange/30 to-accent-orange/20" },
  { title: "Why", author: "Maya", type: "IMAGE", color: "from-accent-pink/30 to-metro-pink/20" },
  { title: "Bonk", author: "Sam", type: "VIDEO", color: "from-accent-orange/30 to-metro-orange/20" },
];

export default async function HomePage() {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name,
        displayName: session.user.displayName,
        role: session.user.role,
      }
    : null;

  return (
    <>
      <Hero popular={popular} />
      <Categories categories={categories} />
      <Featured stickers={stickers} />
      <PrintsCta />
      <MemberCta user={user} />
    </>
  );
}
