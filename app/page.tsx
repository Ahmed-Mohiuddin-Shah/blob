import { headers } from "next/headers";
import { Cat, Dices, Gamepad2, Laugh, Smile, Sparkles } from "lucide-react";
import { Categories } from "@/components/home/categories";
import { Featured } from "@/components/home/featured";
import { Hero } from "@/components/home/hero";
import { MemberCta } from "@/components/home/member-cta";
import { PrintsCta } from "@/components/home/prints-cta";
import { getSession } from "@/lib/auth";

const popular = ["cat", "angry", "happy", "bruh"];

const categories = [
  { name: "Reactions", icon: Smile, className: "bg-accent-gradient" },
  { name: "Animals", icon: Cat, className: "bg-accent-orange" },
  { name: "Memes", icon: Laugh, className: "bg-metro-pink" },
  { name: "Gaming", icon: Gamepad2, className: "bg-metro-orange" },
  { name: "Anime", icon: Sparkles, className: "bg-accent-pink" },
  { name: "Random", icon: Dices, className: "bg-accent-orange" },
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
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
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
