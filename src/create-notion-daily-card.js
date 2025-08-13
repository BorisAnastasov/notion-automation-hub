import { Client } from "@notionhq/client";

// ====== CONFIGURATION ======
const TZ = "Europe/Sofia"; // Your timezone
// src/create-notion-daily-card.js  (only this part changes)
const PROPS = {
  title: "Name",          // your Title property (usually "Name")
  date: "Date",           // the Date column shown in your screenshot
  checkboxes: [
    "WORKOUT DONE",
    "Programming 2h",
    "10k STEPS DONE",
    "CALORIE GOAL HIT"
  ],
  notes: "Extra notes",   // keep if you have this property; else set to null
  quote: "Quote"         // set to "Quote" if you add a Quote property; null = add as page block
};

const COVER_QUERY = "motivation"; // Unsplash topic for covers
const QUOTE_SOURCE = "quotable";  // "quotable" or "zenquotes"
// ============================

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function sofiaNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function yyyyMmDd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function weekday(d) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TZ }).format(d);
}

async function fetchQuote() {
  try {
    if (QUOTE_SOURCE === "zenquotes") {
      const r = await fetch("https://zenquotes.io/api/random");
      const arr = await r.json();
      const q = arr?.[0]?.q?.trim();
      const a = arr?.[0]?.a?.trim();
      if (q) return { text: q, author: a || "Unknown" };
    } else {
      const r = await fetch("https://api.quotable.io/random");
      const data = await r.json();
      const q = data?.content?.trim();
      const a = data?.author?.trim();
      if (q) return { text: q, author: a || "Unknown" };
    }
  } catch (e) {
    console.warn("Quote fetch failed:", e.message);
  }
  return { text: "Small steps every day add up.", author: "—" };
}

async function alreadyExists() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: { property: PROPS.date, date: { equals: yyyyMmDd(sofiaNow()) } }
    });
    return response.results.length > 0;
  } catch {
    return false;
  }
}

async function createDailyCard() {
  const now = sofiaNow();
  const isoDate = yyyyMmDd(now);
  const titleText = weekday(now);
  const { text: quoteText, author } = await fetchQuote();

  const properties = {
    [PROPS.title]: { title: [{ type: "text", text: { content: titleText } }] },
    [PROPS.date]: { date: { start: isoDate } }
  };
  for (const key of PROPS.checkboxes) properties[key] = { checkbox: false };
  if (PROPS.notes) properties[PROPS.notes] = { rich_text: [{ type: "text", text: { content: "" } }] };
  if (PROPS.quote) {
    properties[PROPS.quote] = {
      rich_text: [{ type: "text", text: { content: `${quoteText} — ${author}` } }]
    };
  }

  const coverUrl = `https://source.unsplash.com/random/1200x800/?${encodeURIComponent(COVER_QUERY)}`;

  const page = await notion.pages.create({
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties,
    cover: { type: "external", external: { url: coverUrl } }
  });

  if (!PROPS.quote && quoteText) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: [
        {
          object: "block",
          type: "quote",
          quote: {
            rich_text: [{ type: "text", text: { content: `${quoteText} — ${author}` } }]
          }
        }
      ]
    });
  }

  console.log(`Created: ${page.id} — ${titleText} (${isoDate}) with quote`);
}

(async () => {
  try {
    if (await alreadyExists()) {
      console.log("Today's page already exists — skipping.");
      return;
    }
    await createDailyCard();
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
})();
