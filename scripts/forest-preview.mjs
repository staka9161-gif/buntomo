// Isolated UI fixtures only. No request reaches a database; never deploy this proxy.
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const production = process.argv.includes("--production");
const port = production ? 3128 : 3118;
const upstreamPort = production ? 3127 : 3117;
const env = {
  ...process.env,
  DATABASE_POSTGRES_PRISMA_URL:
    "postgresql://fixture:fixture@127.0.0.1:1/forest_fixture",
  DATABASE_URL_UNPOOLED:
    "postgresql://fixture:fixture@127.0.0.1:1/forest_fixture",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/forest_fixture",
  AUTH_SECRET: "local-forest-fixture-only-not-a-production-secret",
  AUTH_URL: "http://127.0.0.1:3118",
  NEXTAUTH_URL: "http://127.0.0.1:3118",
  NEXT_PUBLIC_GA_ID: "",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const build = process.argv.includes("--build");
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    ...(build
      ? ["build", "--webpack"]
      : [
          production ? "start" : "dev",
          ...(!production ? ["--webpack"] : []),
          "--hostname",
          "127.0.0.1",
          "--port",
          String(upstreamPort),
        ]),
  ],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
if (build) {
  next.on("exit", (code) => process.exit(code || 0));
} else {
  const japanese = {
    literatureScope: "japan",
    countryCode: null,
    prefectureCode: "JP-26",
    era: "modern",
    mainGenreId: "fiction",
    subgenreIds: [],
    customGenreTags: [],
  };
  const makeTree = (
    id,
    title,
    currentPage,
    totalPages,
    status,
    classification,
  ) => ({
    bookId: id,
    readingStatusId: `reading-${id}`,
    title,
    author: "ローカル検証用",
    coverImageUrl: null,
    currentPage,
    totalPages,
    status,
    classification,
  });
  const trees = [
    makeTree(
      "forest-demo",
      "読書の森・読書モード検証",
      0,
      300,
      "READING",
      null,
    ),
    makeTree(
      "forest-kyoto",
      "京都の森・読了済み",
      100,
      320,
      "COMPLETED",
      japanese,
    ),
    makeTree("forest-france", "フランスの森", 50, 250, "READING", {
      ...japanese,
      literatureScope: "world",
      countryCode: "FR",
      prefectureCode: null,
      mainGenreId: "poetry_drama",
      era: "contemporary",
    }),
    makeTree(
      "forest-old",
      "以前から読了済み・ページ数未設定",
      0,
      null,
      "COMPLETED",
      null,
    ),
  ];
  const operations = new Map();
  if (process.argv.includes("--atlas")) {
    const genreCatalog = JSON.parse(
      readFileSync(
        new URL("../lib/literature-forest/genres.json", import.meta.url),
        "utf8",
      ),
    );
    const samples = [
      ["石の劇場", "GR", -430, "poetry_drama"],
      ["海辺の書簡", "FR", 1570, "essay"],
      ["冬の庭園", "GB", 1813, "fiction"],
      ["丘の向こうへ", "GB", 1847, "fiction"],
      ["霧の街の手紙", "FR", 1867, "fiction"],
      ["硝子の駅", "DE", 1915, "fiction"],
      ["長い夜の図書館", "US", 1949, "fiction"],
      ["熱帯の時計", "CO", 1967, "fiction"],
      ["夜行列車の窓", "GB", 1982, "fiction"],
      ["遠い街の小さな灯", "US", 2005, "fiction"],
      ["星を渡る人々", "CN", 2014, "fiction"],
      ["雨の記憶", "KR", 2021, "fiction"],
      ["明日の手帖", "FR", 2025, "essay"],
    ];
    samples.forEach(([title, country, year, genre], index) => {
      const main = genreCatalog.mainGenres.find((g) => g.id === genre);
      if (!main) throw new Error(`Invalid fixture genre ${genre}`);
      trees.push(
        makeTree(
          `atlas-world-${index}`,
          title,
          45 + index * 12,
          200 + index * 15,
          index % 3 === 0 ? "READING" : "COMPLETED",
          {
            ...japanese,
            literatureScope: "world",
            countryCode: country,
            prefectureCode: null,
            era: String(year),
            mainGenreId: genre,
            subgenreIds: [main.groups[0].subgenres[0].id],
            customGenreTags: ["読書マップの検証用"],
          },
        ),
      );
    });
    [
      ["山の灯", "JP-26", 1000],
      ["月を待つ川", "JP-13", 1604],
      ["港の時計", "JP-28", 1900],
      ["森に残る手紙", "JP-01", 1980],
      ["旅の余白", "JP-26", 2020],
    ].forEach(([title, prefecture, year], index) => {
      trees.push(
        makeTree(
          `atlas-japan-${index}`,
          title,
          80,
          240 + index * 30,
          "COMPLETED",
          {
            ...japanese,
            prefectureCode: prefecture,
            era: String(year),
            mainGenreId: index % 2 ? "essay" : "fiction",
          },
        ),
      );
    });
  }
  let failAfterCommit = false;
  const json = (res, value, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const pathname = url.pathname;
      const body = async () => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        return JSON.parse(Buffer.concat(chunks).toString() || "{}");
      };
      if (pathname === "/_preview/state")
        return json(res, { trees, operations: [...operations.keys()] });
      if (pathname === "/_preview/fail-once" && req.method === "POST") {
        failAfterCommit = true;
        return json(res, { ok: true });
      }
      if (pathname === "/api/auth/session")
        return json(res, {
          user: {
            id: "local-preview-user",
            name: "ローカル検証",
            email: "fixture@example.invalid",
          },
          expires: "2099-01-01T00:00:00Z",
        });
      if (pathname === "/api/me/profile")
        return json(res, {
          profile: {
            id: "local-preview-user",
            name: "ローカル検証",
            handle: "local_preview",
            accountStatus: "active",
          },
        });
      if (pathname === "/api/me/literature-forest") return json(res, { trees });
      const match = pathname.match(
        /^\/api\/me\/literature-forest\/([^/]+)(\/progress)?$/,
      );
      if (match) {
        const tree = trees.find((t) => t.bookId === match[1]);
        if (!tree) return json(res, { error: "Not found" }, 404);
        if (req.method === "PATCH" && !match[2])
          tree.classification = await body();
        else if (req.method === "POST" && match[2]) {
          const op = await body();
          if (!operations.has(op.operationId)) {
            if (
              tree.status !== "READING" ||
              ![-1, 1].includes(op.delta) ||
              tree.currentPage + op.delta < 0 ||
              tree.currentPage + op.delta > (tree.totalPages || 100000)
            )
              return json(res, { error: "範囲外" }, 409);
            tree.currentPage += op.delta;
            operations.set(op.operationId, op);
            if (failAfterCommit) {
              failAfterCommit = false;
              return json(
                res,
                { error: "検証用: 保存後に通信応答が失敗しました" },
                503,
              );
            }
          }
        } else if (req.method !== "GET")
          return json(res, { error: "Method not allowed" }, 405);
        return json(res, { tree });
      }
      const toReading = (tree) => ({
        id: tree.readingStatusId,
        bookId: tree.bookId,
        ...tree,
        book: {
          id: tree.bookId,
          title: tree.title,
          author: tree.author,
          coverImageUrl: null,
          totalPages: 300,
          migratedWorkId: null,
        },
        completedAt:
          tree.status === "COMPLETED" ? "2026-10-28T00:00:00Z" : null,
      });
      if (pathname === "/api/me/readings" && req.method === "GET")
        return json(res, {
          readings: trees
            .filter(
              (t) =>
                !url.searchParams.get("status") ||
                t.status === url.searchParams.get("status").toUpperCase(),
            )
            .map(toReading),
        });
      const readingMatch = pathname.match(/^\/api\/me\/readings\/([^/]+)$/);
      if (readingMatch && req.method === "PATCH") {
        const tree = trees.find((t) => t.readingStatusId === readingMatch[1]);
        if (!tree) return json(res, { error: "Not found" }, 404);
        const value = await body();
        for (const key of ["currentPage", "totalPages", "status"])
          if (value[key] !== undefined) tree[key] = value[key];
        return json(res, { reading: toReading(tree) });
      }
      const bookMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
      if (bookMatch && req.method === "GET") {
        const tree = trees.find((t) => t.bookId === bookMatch[1]);
        return tree
          ? json(res, {
              book: toReading(tree).book,
              readingCount: tree.status === "READING" ? 1 : 0,
              completedCount: tree.status === "COMPLETED" ? 1 : 0,
              eventCount: 0,
            })
          : json(res, { error: "Not found" }, 404);
      }
      if (pathname.startsWith("/api/"))
        return json(res, {
          readings: [],
          readers: [],
          friends: [],
          received: [],
          chatHistory: [],
          events: [],
          announcements: [],
          announcement: null,
          notifications: [],
          count: 0,
        });
      if (req.method !== "GET" && req.method !== "HEAD")
        return json(res, { error: "Preview refuses unmocked writes" }, 405);
      // No cookies or authorization are passed upstream. The upstream DB URL is also loopback-only.
      const headers = { ...req.headers, host: `127.0.0.1:${upstreamPort}` };
      delete headers.cookie;
      delete headers.authorization;
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: upstreamPort,
          path: req.url,
          method: req.method,
          headers,
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        if (!res.headersSent) json(res, { error: "Next.js starting" }, 503);
      });
      upstream.end();
    } catch (error) {
      json(res, { error: error.message }, 500);
    }
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `ISOLATED FOREST PREVIEW http://127.0.0.1:${port}/books/forest-demo/read (in-memory fixtures, no database)`,
    ),
  );
  const close = () => {
    server.close();
    next.kill();
    process.exit();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  next.on("exit", () => {
    server.close();
    process.exit();
  });
}
