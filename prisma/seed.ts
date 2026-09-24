import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  "Memes",
  "Reactions",
  "Animals",
  "People",
  "Gaming",
  "Anime",
  "Movies",
  "Internet",
  "Miscellaneous",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i]!;
    const slug = slugify(name);
    await prisma.category.upsert({
      where: { slug },
      create: { slug, name, sortOrder: i },
      update: { name, sortOrder: i },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
