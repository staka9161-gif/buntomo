// ============================================================
// ゴールデンセット回帰テスト
// 指示書 Section 12 準拠
// 実行: npx tsx scripts/golden-set-test.ts [baseUrl]
// ============================================================

interface GoldenCase {
  query: string;
  expectedIsbns: string[];     // いずれかが上位に出ればOK
  expectedRankMax: number;     // この順位以内に出ること
}

const GOLDEN_SET: GoldenCase[] = [
  {
    query: "ノルウェイの森",
    expectedIsbns: ["9784062748681", "9784062035156"],
    expectedRankMax: 3,
  },
  {
    query: "カラマーゾフの兄弟",
    expectedIsbns: ["9784334751067", "9784102010136", "9784003261019"],
    expectedRankMax: 5,
  },
  {
    query: "東京都同情塔",
    expectedIsbns: ["9784103555117"],
    expectedRankMax: 3,
  },
  {
    query: "リーダブルコード",
    expectedIsbns: ["9784873115658"],
    expectedRankMax: 3,
  },
  {
    query: "人間失格",
    expectedIsbns: ["9784101006055", "9784101006024"],
    expectedRankMax: 3,
  },
  {
    query: "コンビニ人間",
    expectedIsbns: ["9784163906188", "9784167911300"],
    expectedRankMax: 3,
  },
  {
    query: "火花",
    expectedIsbns: ["9784163902302", "9784167907570"],
    expectedRankMax: 5,
  },
  {
    query: "1Q84",
    expectedIsbns: ["9784103534259", "9784103534228", "9784103534235"],
    expectedRankMax: 5,
  },
  {
    query: "容疑者Xの献身",
    expectedIsbns: ["9784163242101", "9784167110123"],
    expectedRankMax: 3,
  },
  {
    query: "告白",
    expectedIsbns: ["9784575236187", "9784575513783"],
    expectedRankMax: 5,
  },
  {
    query: "推し、燃ゆ",
    expectedIsbns: ["9784309029160", "9784309417783"],
    expectedRankMax: 3,
  },
  {
    query: "流浪の月",
    expectedIsbns: ["9784488028060", "9784488028237"],
    expectedRankMax: 3,
  },
  {
    query: "君の膵臓をたべたい",
    expectedIsbns: ["9784575519945", "9784575239591"],
    expectedRankMax: 3,
  },
  {
    query: "夜は短し歩けよ乙女",
    expectedIsbns: ["9784043878024", "9784048738064"],
    expectedRankMax: 3,
  },
  {
    query: "村上春樹",
    expectedIsbns: ["9784062748681", "9784103534259", "9784062035156"],
    expectedRankMax: 10,
  },
  {
    query: "東野圭吾",
    expectedIsbns: ["9784163242101", "9784167110123", "9784167902360"],
    expectedRankMax: 10,
  },
  {
    query: "三体",
    expectedIsbns: ["9784152098702"],
    expectedRankMax: 3,
  },
  {
    query: "同志少女よ、敵を撃て",
    expectedIsbns: ["9784152100641"],
    expectedRankMax: 3,
  },
  {
    query: "重力ピエロ",
    expectedIsbns: ["9784101250236", "9784104596010"],
    expectedRankMax: 3,
  },
  {
    query: "正欲",
    expectedIsbns: ["9784103262367", "9784101062396"],
    expectedRankMax: 3,
  },
  {
    query: "汝、星のごとく",
    expectedIsbns: ["9784062211604", "9784065306567"],
    expectedRankMax: 3,
  },
  {
    query: "成瀬は天下を取りにいく",
    expectedIsbns: ["9784103554318"],
    expectedRankMax: 3,
  },
  {
    query: "52ヘルツのクジラたち",
    expectedIsbns: ["9784120053559", "9784122072411"],
    expectedRankMax: 3,
  },
  {
    query: "プロジェクト・ヘイル・メアリー",
    expectedIsbns: ["9784152100481", "9784150122546"],
    expectedRankMax: 3,
  },
  {
    query: "蜜蜂と遠雷",
    expectedIsbns: ["9784344026001", "9784344425101"],
    expectedRankMax: 3,
  },
  {
    query: "世界の終りとハードボイルド・ワンダーランド",
    expectedIsbns: ["9784101001548", "9784103534013"],
    expectedRankMax: 3,
  },
  {
    query: "博士の愛した数式",
    expectedIsbns: ["9784101215235", "9784104013029"],
    expectedRankMax: 3,
  },
  {
    query: "窓ぎわのトットちゃん",
    expectedIsbns: ["9784061457805", "9784062748001"],
    expectedRankMax: 3,
  },
  {
    query: "嫌われる勇気",
    expectedIsbns: ["9784478025819"],
    expectedRankMax: 3,
  },
  {
    query: "ファクトフルネス",
    expectedIsbns: ["9784822289607"],
    expectedRankMax: 3,
  },
];

async function run() {
  const baseUrl = process.argv[2] || "http://localhost:3000";
  console.log(`\n=== ゴールデンセット回帰テスト ===`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Test cases: ${GOLDEN_SET.length}\n`);

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const tc of GOLDEN_SET) {
    try {
      const url = `${baseUrl}/api/books/search?q=${encodeURIComponent(tc.query)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        failed++;
        failures.push(`${tc.query}: HTTP ${res.status}`);
        console.log(`  FAIL  "${tc.query}" → HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const books = data.books || [];
      const topIsbns = books.slice(0, tc.expectedRankMax).map((b: { isbn: string | null }) => b.isbn);

      const found = tc.expectedIsbns.some((isbn) => topIsbns.includes(isbn));
      if (found) {
        passed++;
        const matchIdx = books.findIndex((b: { isbn: string | null }) =>
          tc.expectedIsbns.includes(b.isbn || "")
        );
        console.log(`  PASS  "${tc.query}" → rank ${matchIdx + 1} (${books[matchIdx]?.title || "?"})`);
      } else {
        failed++;
        const actual = books.slice(0, 3).map((b: { isbn: string; title: string }) => `${b.title}[${b.isbn}]`).join(", ");
        failures.push(`${tc.query}: expected one of ${tc.expectedIsbns.join("/")} in top ${tc.expectedRankMax}, got: ${actual}`);
        console.log(`  FAIL  "${tc.query}" → top ${tc.expectedRankMax}に期待ISBNなし`);
        console.log(`        got: ${actual}`);
      }
    } catch (e) {
      failed++;
      failures.push(`${tc.query}: ${e instanceof Error ? e.message : String(e)}`);
      console.log(`  ERR   "${tc.query}" → ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const total = passed + failed;
  const rate = Math.round((passed / total) * 100);
  console.log(`\n=== 結果 ===`);
  console.log(`通過: ${passed}/${total} (${rate}%)`);
  console.log(`目標: 60% (Phase 1), 80% (Phase 3)\n`);

  if (failures.length > 0) {
    console.log(`--- 失敗ケース ---`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  process.exit(rate >= 60 ? 0 : 1);
}

run();
