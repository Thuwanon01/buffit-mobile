import { v } from "convex/values";
import { internalAction, internalMutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const generateLevelThresholds = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(api.users.getUserById, { id: userId });
    if (!user) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not configured, skipping level threshold generation");
      return;
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const parts = [
      user.age ? `อายุ ${user.age} ปี` : null,
      user.gender === "male" ? "เพศชาย" : user.gender === "female" ? "เพศหญิง" : null,
      user.weightKg ? `น้ำหนัก ${user.weightKg} kg` : null,
      user.heightCm ? `ส่วนสูง ${user.heightCm} cm` : null,
      user.fitnessLevel ? `ระดับฟิตเนส: ${user.fitnessLevel}` : null,
      user.weeklyFrequency != null ? `ออกกำลังกาย ${user.weeklyFrequency} วัน/สัปดาห์` : null,
      user.goals?.length ? `เป้าหมาย: ${user.goals.join(", ")}` : null,
      user.medicalConditions ? `ข้อจำกัด: ${user.medicalConditions}` : null,
    ].filter(Boolean);
    const profileDesc = parts.length > 0 ? parts.join(", ") : "ไม่มีข้อมูล profile";

    const prompt = `You are a personal fitness coach setting progressive level milestones for a group workout tracking app.

User profile: ${profileDesc}

Context: Users earn "coins" for every workout session (typically 1–3 coins per session). An active person doing 4 sessions/week might earn 15–30 coins per month. Coins accumulate forever as a lifetime total and never reset.

Task: Generate 10 progressive level thresholds (minLifetimeCoins required to reach each level) personalized for this specific user.

Guidelines:
- Level 1 must always be 0 (everyone starts at Level 1)
- Thresholds must be strictly increasing
- A beginner with a sedentary lifestyle should realistically reach Level 3 within 2–3 months of consistent effort
- An advanced/athletic person should need significantly more coins for the same level — they can do more
- Medical conditions or physical limitations should lower thresholds (make goals more achievable)
- Each level gap should feel like meaningful progress, not trivial

Respond ONLY with a valid JSON array, no markdown, no extra text:
[{"level":1,"minLifetimeCoins":0},{"level":2,"minLifetimeCoins":20},...,{"level":10,"minLifetimeCoins":500}]`;

    let thresholds: { level: number; minLifetimeCoins: number }[] = [];
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { level: number; minLifetimeCoins: number }[];
        thresholds = parsed
          .filter((t) => typeof t.level === "number" && typeof t.minLifetimeCoins === "number")
          .map((t) => ({ level: t.level, minLifetimeCoins: Math.max(0, t.minLifetimeCoins) }))
          .sort((a, b) => a.level - b.level);
        const lvl1 = thresholds.find((t) => t.level === 1);
        if (lvl1) lvl1.minLifetimeCoins = 0;
      }
    } catch (err) {
      console.warn("Failed to generate personalized level thresholds:", err);
      return;
    }

    if (thresholds.length < 3) return;

    await ctx.runMutation(internal.aiCoach.storeUserLevelThresholds, { userId, thresholds });
  },
});

// ── Free-text auto-log parsing ──────────────────────────────────────────

type NewActivitySpec = {
  name: string;
  nameEn: string;
  category: string;
  criteriaPerLevel: { level: number; metric: string; value: number; unit: string }[];
  weightMultiplier: number;
  rationale: string;
};

type ParsedOption =
  | { label: string; value: number; unit: string; match: "existing"; activityId: Id<"activityTypes"> }
  | { label: string; value: number; unit: string; match: "new"; newActivity: NewActivitySpec };

type ParsedEntry = { rawText: string; options: ParsedOption[] };

export const parseFreeTextLog = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<{ entries: ParsedEntry[] }> => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) throw new Error("Not authenticated");

    const trimmed = text.trim();
    if (!trimmed) return { entries: [] };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI ยังไม่พร้อมใช้งาน (ไม่ได้ตั้งค่า GEMINI_API_KEY)");

    const activities = await ctx.runQuery(api.activityTypes.getApprovedActivities);
    const activityList = activities.map((a) => ({
      id: a._id as string,
      name: a.name,
      nameEn: a.nameEn ?? null,
      category: a.category,
      sampleMetric: a.criteriaPerLevel[0]?.metric ?? null,
      sampleUnit: a.criteriaPerLevel[0]?.unit ?? null,
    }));

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `You are a fitness-log parsing assistant for a Thai group workout tracking app ("Buffit").

The user typed free text describing one or more workouts they just did, e.g. "วิดพื้น 10, lat pulldown 20" (push-ups 10, lat pulldown 20). Your job: split it into individual workout entries, and for each one figure out which Activity Type it refers to and the quantity logged.

User's raw text:
"""
${trimmed}
"""

## Existing approved Activity Types (match against these first — copy "id" EXACTLY when matching)
${JSON.stringify(activityList)}

## Matching rules
- Recognize the SAME exercise across languages/spelling/synonyms — e.g. "วิดพื้น", "Push up", "pushups", "push-ups" all refer to the same activity. Match to the existing activity whose "name" or "nameEn" corresponds.
- Do NOT merge genuinely different exercises just because they're related — e.g. "lat pulldown" is NOT "ดึงบาร์ (Chin-up)"; "วิ่ง" (running) is NOT "เดิน" (walking).
- If nothing in the list matches, propose a brand-new activity (see "newActivity" schema below). Always decide on your own — never ask the user which activity it is.

## Quantity/unit rules
- Extract the numeric quantity from the text, with its unit if the user specified one (reps, ครั้ง, km, นาที, ก้าว, etc.).
- If the unit is implied and unambiguous (e.g. "วิดพื้น 10" obviously means 10 reps), return exactly ONE option.
- If the quantity is genuinely ambiguous about WHAT it measures (e.g. "เดิน 20" could mean 20 minutes OR 20 km OR 20,000 steps — each a different interpretation), return 2-4 distinct "options", each a COMPLETE different interpretation (its own value/unit/activity match), with a short clear Thai "label" so the user can tap the correct one.

## Output format — respond ONLY with valid JSON, no markdown, no extra text:
{
  "entries": [
    {
      "rawText": "<original text segment for this entry>",
      "options": [
        {
          "label": "<short Thai description of this interpretation>",
          "value": <number>,
          "unit": "<string, e.g. ครั้ง / นาที / km / ก้าว>",
          "match": "existing",
          "activityId": "<id copied EXACTLY from the list above>"
        }
      ]
    },
    {
      "rawText": "<another segment, this time no existing match>",
      "options": [
        {
          "label": "<short Thai description>",
          "value": <number>,
          "unit": "<string>",
          "match": "new",
          "newActivity": {
            "name": "<Thai name>",
            "nameEn": "<English name>",
            "category": "weight" | "cardio",
            "criteriaPerLevel": [
              {"level":1,"metric":"reps"|"km"|"minutes"|"steps","value":<number>,"unit":"<string>"},
              {"level":2,"metric":"...","value":<number>,"unit":"..."},
              {"level":3,"metric":"...","value":<number>,"unit":"..."},
              {"level":4,"metric":"...","value":<number>,"unit":"..."},
              {"level":5,"metric":"...","value":<number>,"unit":"..."}
            ],
            "weightMultiplier": <number between 0.5 and 2.0>,
            "rationale": "<short Thai explanation, max 100 chars>"
          }
        }
      ]
    }
  ]
}

Notes:
- "criteriaPerLevel" = minimum effort needed at each level to earn a coin (level 1 = beginner-friendly, level 5 = challenging, strictly increasing values).
- "weightMultiplier" range 0.5–2.0: harder/intense activities (push-ups, pull-ups, burpees) ~1.4–1.8; moderate (squats, running) ~1.0–1.2; easy/low-intensity (walking, light dumbbell work) ~0.6–0.9.
- Split the input into entries by commas, "และ", newlines, or other natural delimiters. Ignore filler words.
- If the input contains no recognizable workout activity at all, respond with {"entries": []}.`;

    let entries: ParsedEntry[] = [];
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        entries = sanitizeParsedEntries(parsed?.entries, activityList);
      }
    } catch (err) {
      console.warn("Failed to parse free-text workout log:", err);
      throw new Error("AI แปลข้อความไม่สำเร็จ ลองใหม่อีกครั้ง");
    }

    return { entries };
  },
});

type ActivityListItem = { id: string; name: string; nameEn: string | null; category: string };

function sanitizeParsedEntries(raw: unknown, activityList: ActivityListItem[]): ParsedEntry[] {
  if (!Array.isArray(raw)) return [];
  const validIds = new Set(activityList.map((a) => a.id));
  const entries: ParsedEntry[] = [];

  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const rawText = (e as any).rawText;
    const rawOptions = (e as any).options;
    if (typeof rawText !== "string" || !Array.isArray(rawOptions)) continue;

    const options: ParsedOption[] = [];
    for (const o of rawOptions.slice(0, 4)) {
      if (!o || typeof o !== "object") continue;
      const label = (o as any).label;
      const unit = (o as any).unit;
      const value = Number((o as any).value);
      if (typeof label !== "string" || typeof unit !== "string") continue;
      if (!Number.isFinite(value) || value <= 0) continue;

      if ((o as any).match === "existing") {
        const activityId = (o as any).activityId;
        if (typeof activityId === "string" && validIds.has(activityId)) {
          options.push({ label, value, unit, match: "existing", activityId: activityId as Id<"activityTypes"> });
        }
      } else if ((o as any).match === "new") {
        const spec = sanitizeNewActivitySpec((o as any).newActivity);
        if (spec) options.push({ label, value, unit, match: "new", newActivity: spec });
      }
    }
    if (options.length > 0) entries.push({ rawText, options });
  }
  return entries;
}

function sanitizeNewActivitySpec(raw: unknown): NewActivitySpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  if (typeof r.nameEn !== "string" || !r.nameEn.trim()) return null;
  if (r.category !== "weight" && r.category !== "cardio") return null;
  if (!Array.isArray(r.criteriaPerLevel)) return null;

  const criteriaPerLevel = r.criteriaPerLevel
    .filter((c: any) => c && typeof c.level === "number" && typeof c.value === "number" && typeof c.unit === "string")
    .map((c: any) => ({
      level: c.level,
      metric: typeof c.metric === "string" ? c.metric : "reps",
      value: Math.max(0, Number(c.value)),
      unit: c.unit,
    }))
    .sort((a: any, b: any) => a.level - b.level);
  if (criteriaPerLevel.length < 2) return null;

  const weightMultiplier = Math.max(0.5, Math.min(2.0, Number(r.weightMultiplier) || 1.0));
  const rationale = typeof r.rationale === "string" ? r.rationale.slice(0, 200) : "";

  return { name: r.name.trim(), nameEn: r.nameEn.trim(), category: r.category, criteriaPerLevel, weightMultiplier, rationale };
}

export const storeUserLevelThresholds = internalMutation({
  args: {
    userId: v.id("users"),
    thresholds: v.array(
      v.object({ level: v.number(), minLifetimeCoins: v.float64() })
    ),
  },
  handler: async (ctx, { userId, thresholds }) => {
    const existing = await ctx.db
      .query("userLevelThresholds")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const t of existing) {
      await ctx.db.delete(t._id);
    }
    for (const { level, minLifetimeCoins } of thresholds) {
      await ctx.db.insert("userLevelThresholds", { userId, level, minLifetimeCoins });
    }
    await ctx.scheduler.runAfter(0, internal.users.updateLevel, { userId });
  },
});
