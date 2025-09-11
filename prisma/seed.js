const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const payload = {
  version: 1,
  updated: "2025-08-21",
  seasons: [
    {
      year: 2025,
      tabulation: [
        {
          label: "Girls 14-15 Divisional Points",
          events: 8,
          first: 1,
          second: 2,
          third: 2,
          top10: 8,
          top25: 8,
          cutsMade: 8,
          points: 140.0,
          standing: "T3",
        },
        {
          label: "Team Points - Girls(14-18)",
          events: 8,
          first: 1,
          second: 1,
          third: null,
          top10: 6,
          top25: 8,
          cutsMade: 8,
          points: 86.0,
          standing: "T13",
        },
      ],
      tournaments: [
        {
          dateStart: "2025-06-24",
          dateEnd: "2025-06-25",
          tournament: "SRIXON CUP @THE YARD SERIES #1: 12-18",
          course: "Bay View GC",
          score: "101-105--206",
          place: 3,
          points: 16.0,
        },
        {
          dateStart: "2025-07-10",
          dateEnd: "2025-07-11",
          tournament: "89th EAST BAY JUNIOR CHAMPIONSHIP: 12-18",
          course: "Corica Park - North",
          score: "90-96--186",
          place: 11,
          points: 0.0,
        },
        {
          dateStart: "2025-07-16",
          dateEnd: "2025-07-17",
          tournament: "SRIXON CUP @THE YARD SERIES #2: 12-18",
          course: "Bay View GC",
          score: "92-93--185",
          place: 8,
          points: 6.0,
        },
        {
          date: "2025-07-21",
          tournament: "RAY ANDERSON MEMORIAL JUNIOR",
          course: "Spring Valley",
          score: "84",
          place: 2,
          points: 15.0,
        },
        {
          dateStart: "2025-07-29",
          dateEnd: "2025-07-30",
          tournament: "SAN JOSE CITY JR CHAMPIONSHIP: 12-18",
          course: "Santa Teresa GC",
          score: "90-86--176",
          place: 8,
          points: 10.0,
        },
        {
          dateStart: "2025-08-04",
          dateEnd: "2025-08-05",
          tournament: "CONCORD CITY JUNIOR: 12-18",
          course: "Diablo Creek GC",
          score: "85-90--175",
          place: 3,
          points: 16.0,
        },
        {
          dateStart: "2025-08-06",
          dateEnd: "2025-08-07",
          tournament: "SRIXON CUP @THE YARD SERIES #3: 12-18",
          course: "Bay View GC",
          score: "87-91--178",
          place: 1,
          points: 35.0,
        },
        {
          dateStart: "2025-08-16",
          dateEnd: "2025-08-17",
          tournament: "MOUNTAIN VIEW JUNIOR Series #4: 12-18",
          course: "Shoreline Golf Links",
          score: "89-92--181",
          place: 4,
          points: 18.0,
        },
      ],
    },
    {
      year: 2024,
      tabulation: [],
      tournaments: [
        {
          dateStart: "2024-10-26",
          dateEnd: "2024-10-27",
          tournament: "MOUNTAIN VIEW JUNIOR Series #3: 12-18",
          course: "Shoreline Golf Links",
          score: "105-104--209",
          place: 6,
          points: 14.0,
        },
      ],
    },
  ],
};

const d = (s) => (s ? new Date(s) : null);

async function main() {
  await prisma.profile.deleteMany({}); // clear old data

  const profile = await prisma.profile.create({
    data: {
      version: payload.version,
      updated: new Date(payload.updated),
      seasons: {
        create: payload.seasons.map((s) => ({
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
  });

  console.log("Seeded profile:", profile.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
