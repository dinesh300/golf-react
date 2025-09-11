const { Router } = require("express");
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");

const prisma = new PrismaClient();
const router = Router();

/* ---------- ZOD VALIDATION ---------- */
const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date string");

const TabulationZ = z.object({
  label: z.string(),
  events: z.number().int(),
  first: z.number().int().nullable().optional(),
  second: z.number().int().nullable().optional(),
  third: z.number().int().nullable().optional(),
  top10: z.number().int().nullable().optional(),
  top25: z.number().int().nullable().optional(),
  cutsMade: z.number().int().nullable().optional(),
  points: z.number().nullable().optional(),
  standing: z.string().nullable().optional(),
});

const TournamentZ = z.object({
  date: DateStr.optional(),
  dateStart: DateStr.optional(),
  dateEnd: DateStr.optional(),
  tournament: z.string(),
  course: z.string(),
  score: z.string(),
  place: z.number().int().nullable().optional(),
  points: z.number().nullable().optional(),
});

const SeasonZ = z.object({
  year: z.number().int(),
  tabulation: z.array(TabulationZ).optional().default([]),
  tournaments: z.array(TournamentZ).optional().default([]),
});

const ProfileZ = z.object({
  version: z.number().int(),
  updated: DateStr,
  seasons: z.array(SeasonZ),
});

const PatchProfileZ = z.object({
  version: z.number().int().optional(),
  updated: DateStr.optional(),
  seasons: z.array(SeasonZ).optional(),
});

/* ---------- HELPERS ---------- */
const d = (s) => (s ? new Date(s) : null);

function serializeProfile(p) {
  if (!p) return null;
  return {
    version: p.version,
    updated: p.updated.toISOString().slice(0, 10),
    seasons: (p.seasons || [])
      .sort((a, b) => b.year - a.year)
      .map((s) => ({
        year: s.year,
        tabulation: (s.tabulations || []).map((t) => ({
          label: t.label,
          events: t.events,
          first: t.first,
          second: t.second,
          third: t.third,
          top10: t.top10,
          top25: t.top25,
          cutsMade: t.cutsMade,
          points: t.points,
          standing: t.standing,
        })),
        tournaments: (s.tournaments || []).map((trn) => ({
          date: trn.date ? trn.date.toISOString().slice(0, 10) : undefined,
          dateStart: trn.dateStart
            ? trn.dateStart.toISOString().slice(0, 10)
            : undefined,
          dateEnd: trn.dateEnd
            ? trn.dateEnd.toISOString().slice(0, 10)
            : undefined,
          tournament: trn.tournament,
          course: trn.course,
          score: trn.score,
          place: trn.place,
          points: trn.points,
        })),
      })),
  };
}

/* ---------- READ ENDPOINTS ---------- */

// Full profile
router.get("/profile", async (_req, res) => {
  const p = await prisma.profile.findFirst({
    include: {
      seasons: { include: { tabulations: true, tournaments: true } },
    },
  });
  if (!p) {
    return res.json({
      version: 1,
      updated: new Date().toISOString().slice(0, 10),
      seasons: [],
    });
  }
  res.json(serializeProfile(p));
});

// Season by year
router.get("/seasons/:year", async (req, res) => {
  const year = Number(req.params.year);
  const s = await prisma.season.findFirst({
    where: { year },
    include: { tabulations: true, tournaments: true },
  });
  if (!s) return res.status(404).json({ error: "Season not found" });

  res.json({
    year: s.year,
    tabulation: s.tabulations.map((t) => ({
      label: t.label,
      events: t.events,
      first: t.first,
      second: t.second,
      third: t.third,
      top10: t.top10,
      top25: t.top25,
      cutsMade: t.cutsMade,
      points: t.points,
      standing: t.standing,
    })),
    tournaments: s.tournaments.map((trn) => ({
      date: trn.date ? trn.date.toISOString().slice(0, 10) : undefined,
      dateStart: trn.dateStart
        ? trn.dateStart.toISOString().slice(0, 10)
        : undefined,
      dateEnd: trn.dateEnd ? trn.dateEnd.toISOString().slice(0, 10) : undefined,
      tournament: trn.tournament,
      course: trn.course,
      score: trn.score,
      place: trn.place,
      points: trn.points,
    })),
  });
});

/* ---------- WRITE ENDPOINTS (POSTMAN-FRIENDLY) ---------- */

/** Create/REPLACE the full profile */
router.post("/profile", async (req, res) => {
  const parsed = ProfileZ.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    await tx.profile.deleteMany({});
    return tx.profile.create({
      data: {
        version: data.version,
        updated: new Date(data.updated),
        seasons: {
          create: data.seasons.map((s) => ({
            year: s.year,
            tabulations: {
              create: (s.tabulation || []).map((t) => ({
                label: t.label,
                events: t.events,
                first: t.first ?? null,
                second: t.second ?? null,
                third: t.third ?? null,
                top10: t.top10 ?? null,
                top25: t.top25 ?? null,
                cutsMade: t.cutsMade ?? null,
                points: t.points ?? null,
                standing: t.standing ?? null,
              })),
            },
            tournaments: {
              create: (s.tournaments || []).map((trn) => ({
                date: d(trn.date),
                dateStart: d(trn.dateStart),
                dateEnd: d(trn.dateEnd),
                tournament: trn.tournament,
                course: trn.course,
                score: trn.score,
                place: trn.place ?? null,
                points: trn.points ?? null,
              })),
            },
          })),
        },
      },
      include: {
        seasons: { include: { tabulations: true, tournaments: true } },
      },
    });
  });

  res.status(201).json(serializeProfile(created));
});

/** Merge/append into existing profile (no delete) */
router.patch("/profile", async (req, res) => {
  const parsed = PatchProfileZ.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;

  let profile = await prisma.profile.findFirst();
  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        version: body.version ?? 1,
        updated: new Date(
          body.updated || new Date().toISOString().slice(0, 10)
        ),
      },
    });
  }

  if (body.version || body.updated) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        ...(body.version ? { version: body.version } : {}),
        ...(body.updated ? { updated: new Date(body.updated) } : {}),
      },
    });
  }

  if (body.seasons && body.seasons.length) {
    for (const s of body.seasons) {
      const existing = await prisma.season.findFirst({
        where: { profileId: profile.id, year: s.year },
      });

      if (!existing) {
        await prisma.season.create({
          data: {
            year: s.year,
            profileId: profile.id,
            tabulations: {
              create: (s.tabulation || []).map((t) => ({
                label: t.label,
                events: t.events,
                first: t.first ?? null,
                second: t.second ?? null,
                third: t.third ?? null,
                top10: t.top10 ?? null,
                top25: t.top25 ?? null,
                cutsMade: t.cutsMade ?? null,
                points: t.points ?? null,
                standing: t.standing ?? null,
              })),
            },
            tournaments: {
              create: (s.tournaments || []).map((trn) => ({
                date: d(trn.date),
                dateStart: d(trn.dateStart),
                dateEnd: d(trn.dateEnd),
                tournament: trn.tournament,
                course: trn.course,
                score: trn.score,
                place: trn.place ?? null,
                points: trn.points ?? null,
              })),
            },
          },
        });
      } else {
        if (s.tabulation && s.tabulation.length) {
          await prisma.tabulation.createMany({
            data: s.tabulation.map((t) => ({
              seasonId: existing.id,
              label: t.label,
              events: t.events,
              first: t.first ?? null,
              second: t.second ?? null,
              third: t.third ?? null,
              top10: t.top10 ?? null,
              top25: t.top25 ?? null,
              cutsMade: t.cutsMade ?? null,
              points: t.points ?? null,
              standing: t.standing ?? null,
            })),
          });
        }
        if (s.tournaments && s.tournaments.length) {
          await prisma.tournament.createMany({
            data: s.tournaments.map((trn) => ({
              seasonId: existing.id,
              date: d(trn.date),
              dateStart: d(trn.dateStart),
              dateEnd: d(trn.dateEnd),
              tournament: trn.tournament,
              course: trn.course,
              score: trn.score,
              place: trn.place ?? null,
              points: trn.points ?? null,
            })),
          });
        }
      }
    }
  }

  const result = await prisma.profile.findUnique({
    where: { id: profile.id },
    include: { seasons: { include: { tabulations: true, tournaments: true } } },
  });

  res.json(serializeProfile(result));
});

/** Create/REPLACE a single season */
router.post("/seasons", async (req, res) => {
  const parsed = SeasonZ.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const s = parsed.data;

  const profile = await prisma.profile.findFirst();
  if (!profile)
    return res
      .status(404)
      .json({ error: "Profile not found. Create /api/profile first." });

  const created = await prisma.$transaction(async (tx) => {
    await tx.season.deleteMany({
      where: { profileId: profile.id, year: s.year },
    });
    return tx.season.create({
      data: {
        year: s.year,
        profileId: profile.id,
        tabulations: {
          create: (s.tabulation || []).map((t) => ({
            label: t.label,
            events: t.events,
            first: t.first ?? null,
            second: t.second ?? null,
            third: t.third ?? null,
            top10: t.top10 ?? null,
            top25: t.top25 ?? null,
            cutsMade: t.cutsMade ?? null,
            points: t.points ?? null,
            standing: t.standing ?? null,
          })),
        },
        tournaments: {
          create: (s.tournaments || []).map((trn) => ({
            date: d(trn.date),
            dateStart: d(trn.dateStart),
            dateEnd: d(trn.dateEnd),
            tournament: trn.tournament,
            course: trn.course,
            score: trn.score,
            place: trn.place ?? null,
            points: trn.points ?? null,
          })),
        },
      },
      include: { tabulations: true, tournaments: true },
    });
  });

  res.status(201).json({
    year: created.year,
    tabulation: created.tabulations,
    tournaments: created.tournaments,
  });
});

/** Append tabulation rows to a season */
router.post("/seasons/:year/tabulation", async (req, res) => {
  const year = Number(req.params.year);
  const parsed = z.array(TabulationZ).safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const s = await prisma.season.findFirst({ where: { year } });
  if (!s) return res.status(404).json({ error: "Season not found" });

  await prisma.tabulation.createMany({
    data: parsed.data.map((t) => ({
      seasonId: s.id,
      label: t.label,
      events: t.events,
      first: t.first ?? null,
      second: t.second ?? null,
      third: t.third ?? null,
      top10: t.top10 ?? null,
      top25: t.top25 ?? null,
      cutsMade: t.cutsMade ?? null,
      points: t.points ?? null,
      standing: t.standing ?? null,
    })),
  });

  const updated = await prisma.season.findUnique({
    where: { id: s.id },
    include: { tabulations: true },
  });
  res
    .status(201)
    .json({ year, tabulation: updated ? updated.tabulations : [] });
});

/** Append tournaments to a season */
router.post("/seasons/:year/tournaments", async (req, res) => {
  const year = Number(req.params.year);
  const parsed = z.array(TournamentZ).safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const s = await prisma.season.findFirst({ where: { year } });
  if (!s) return res.status(404).json({ error: "Season not found" });

  await prisma.tournament.createMany({
    data: parsed.data.map((trn) => ({
      seasonId: s.id,
      date: d(trn.date),
      dateStart: d(trn.dateStart),
      dateEnd: d(trn.dateEnd),
      tournament: trn.tournament,
      course: trn.course,
      score: trn.score,
      place: trn.place ?? null,
      points: trn.points ?? null,
    })),
  });

  const updated = await prisma.season.findUnique({
    where: { id: s.id },
    include: { tournaments: true },
  });
  res
    .status(201)
    .json({ year, tournaments: updated ? updated.tournaments : [] });
});

module.exports = router;
