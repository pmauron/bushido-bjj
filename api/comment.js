export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

  const { action } = req.body;

  // ── Retranslate mode: EN → CN only ──
  if (action === "retranslate") {
    const { en } = req.body;
    if (!en) return res.status(400).json({ error: "Missing en text" });

    const prompt = `Translate the following BJJ academy coach comment into natural Mandarin Chinese. Keep the same tone — warm, professional, motivational. Do not add anything. Return ONLY the Chinese translation, nothing else.\n\n${en}`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: 500,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        return res.status(502).json({ error: "Groq error", detail: err });
      }
      const data = await response.json();
      const cn = data.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ cn });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Generate mode: full comment ──
  const {
    name, age, belt, stripes, cycle,
    scores, categoryScores, rubricContext,
    prevScores, prevFinal,
    weeklyAvg, totalClasses,
    promoProjection,
    ranking, bracketSize, bracketLabel,
    teamStatus,
  } = req.body;

  const finalScore = categoryScores?.final;

  // Build score detail block
  const scoreBlock = Object.entries(scores || {}).map(([c, v]) => `${c}: ${v}/5`).join(", ");

  const catBlock = Object.entries(categoryScores || {})
    .filter(([k]) => k !== "final")
    .map(([cat, val]) => `${cat}: ${typeof val === "number" ? val.toFixed(2) : val}/5`)
    .join(", ");

  // Delta vs previous
  let trendBlock = "First assessment — no prior data.";
  if (prevFinal != null) {
    const delta = finalScore - prevFinal;
    const dir = delta > 0.1 ? "improved" : delta < -0.1 ? "declined" : "stable";
    trendBlock = `Previous cycle score: ${prevFinal.toFixed(2)}/5 → Current: ${finalScore.toFixed(2)}/5 (${dir}, ${delta > 0 ? "+" : ""}${delta.toFixed(2)}).`;
    if (prevScores) {
      const changes = Object.entries(scores || {}).map(([c, v]) => {
        const prev = prevScores[c];
        if (prev == null) return null;
        const d = v - prev;
        if (Math.abs(d) >= 0.5) return `${c}: ${prev}→${v} (${d > 0 ? "+" : ""}${d})`;
        return null;
      }).filter(Boolean);
      if (changes.length > 0) trendBlock += ` Notable changes: ${changes.join("; ")}.`;
    }
  }

  // Rubric context (top 3 strongest + weakest 2)
  const sortedCriteria = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]);
  const topCriteria = sortedCriteria.slice(0, 3);
  const weakCriteria = sortedCriteria.slice(-2);

  let rubricBlock = "";
  if (rubricContext) {
    const rubricLines = [];
    topCriteria.forEach(([c, v]) => {
      if (rubricContext[c]?.[v - 1]) rubricLines.push(`${c} (${v}/5 — strength): "${rubricContext[c][v - 1]}"`);
    });
    weakCriteria.forEach(([c, v]) => {
      if (rubricContext[c]?.[v - 1]) rubricLines.push(`${c} (${v}/5 — area to develop, current level): "${rubricContext[c][v - 1]}"`);
      if (v < 5 && rubricContext[c]?.[v]) rubricLines.push(`${c} (${v + 1}/5 — NEXT LEVEL TARGET, use this to describe what to work on): "${rubricContext[c][v]}"`);
    });
    rubricBlock = rubricLines.join("\n");
  }

  const prompt = `You are a head coach at a children's BJJ (Brazilian Jiu-Jitsu) academy writing a progress comment for a student's quarterly assessment report. Parents will read this.

STUDENT PROFILE:
- Name: ${name}, Age: ${age}, Belt: ${belt} (${stripes} stripes)
- Assessment cycle: ${cycle}
- Overall score: ${finalScore?.toFixed(2)}/5.00
- Category scores: ${catBlock}
- Individual criteria: ${scoreBlock}

TREND:
${trendBlock}

TRAINING:
- Average: ${weeklyAvg} classes/week, ${totalClasses} total classes on record

PROMOTION:
${promoProjection || "No projection available."}

RANKING:
${ranking != null ? `Ranked #${ranking} out of ${bracketSize} in ${bracketLabel}` : "No ranking data available."}

COMPETITION TEAM:
${teamStatus || "Not evaluated for competition team."}

RUBRIC REFERENCE (what each score level means for this student's strongest and weakest areas):
${rubricBlock || "No rubric context available."}

INSTRUCTIONS:
Write EXACTLY 5 sentences in third person about ${name}. Be positive and motivational, but specific and honest.
- Sentence 1: Overall assessment — where they stand this cycle.
- Sentence 2: Highlight 1–2 specific strengths by criteria name, referencing what they can actually do (use the rubric descriptions).
- Sentence 3: One concrete area to develop, framed as a growth opportunity. Describe specifically what the student should work on to reach the NEXT LEVEL using the rubric target description provided (e.g. "To progress further, Leo can focus on connecting two takedowns together and fighting for grips both ways").
- Sentence 4: Training commitment and/or competition readiness observation.
- Sentence 5: Forward-looking encouragement tied to promotion path or competition goals.

RULES:
- Do NOT repeat exact numbers or scores — describe performance qualitatively.
- Do NOT use bullet points, headers, or markdown.
- Do NOT mention "rubric" or "scoring system" — speak naturally as a coach.
- Keep it under 120 words total.
- Separate English and Chinese with exactly |||
- After |||, write the same 5 sentences translated into natural Mandarin Chinese. Same tone — warm, professional, motivational.

OUTPUT FORMAT (no labels, just the text):
[English paragraph]|||[Chinese paragraph]`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "Groq error", detail: err });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parts = text.split("|||").map(s => s.trim());

    return res.status(200).json({
      en: parts[0] || text,
      cn: parts[1] || "",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
