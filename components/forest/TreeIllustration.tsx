import { useId } from "react";
import {
  eraFor,
  eraLabel,
  genres,
  growthStage,
  treeHeightMeters,
  treeSpecies,
  type Classification,
} from "@/lib/literature-forest/model";
import styles from "./forest.module.css";
import { growthLeafPosition, treeGrowthVisual } from "./tree-growth";

export function TreeCrown({ style }: { style: string }) {
  switch (style) {
    case "broadleaf":
      return (
        <>
          <ellipse cx="59" cy="96" rx="42" ry="43" />
          <ellipse cx="141" cy="96" rx="42" ry="43" />
          <ellipse cx="100" cy="53" rx="48" ry="44" />
        </>
      );
    case "maple":
      return (
        <path d="M100 13 L117 49 143 30 138 66 180 70 157 97 179 116 135 128 100 147 65 128 21 116 43 97 20 70 62 66 57 30 83 49Z" />
      );
    case "conifer":
      return (
        <path d="M100 8 L143 72 H128 L158 113 H140 L171 151 H29 L60 113 H42 L72 72 H57Z" />
      );
    case "ginkgo":
      return (
        <path d="M100 142 Q44 137 21 73 Q42 22 91 19 L100 46 109 19 Q158 22 179 73 Q156 137 100 142Z" />
      );
    case "beech":
      return (
        <path d="M100 15 Q126 19 145 45 Q174 66 169 100 Q165 130 144 142 L57 142 Q25 121 31 90 Q22 59 56 39 Q74 14 100 15Z" />
      );
    case "zelkova":
      return (
        <path d="M100 149 Q73 108 30 89 Q4 71 19 48 Q39 32 58 44 Q66 7 100 15 Q134 7 142 44 Q161 32 181 48 Q196 71 170 89 Q127 108 100 149Z" />
      );
    case "hinoki":
      return (
        <>
          <path d="M100 10 L127 59 116 59 143 99 127 99 153 143 47 143 73 99 57 99 84 59 73 59Z" />
          <path
            d="M76 70 H124 M64 111 H136"
            stroke="white"
            opacity=".25"
            strokeWidth="4"
          />
        </>
      );
    case "pine":
      return (
        <>
          <ellipse cx="56" cy="118" rx="46" ry="19" />
          <ellipse cx="143" cy="85" rx="43" ry="19" />
          <ellipse cx="87" cy="44" rx="45" ry="20" />
        </>
      );
    case "sacred":
      return (
        <>
          <path d="M100 8 Q132 -1 151 33 Q194 33 188 78 Q205 116 162 139 Q116 161 59 144 Q10 129 15 91 Q0 52 45 35 Q64 4 100 8Z" />
          <path
            d="M28 112 Q100 144 174 110"
            fill="none"
            stroke="white"
            strokeWidth="5"
            opacity=".3"
          />
        </>
      );
    case "birch":
      return (
        <>
          <ellipse cx="70" cy="83" rx="27" ry="57" />
          <ellipse cx="123" cy="68" rx="32" ry="65" />
          <ellipse cx="141" cy="110" rx="25" ry="38" />
        </>
      );
    case "redwood":
      return (
        <path d="M100 2 L126 44 120 44 146 81 135 81 158 119 145 119 170 154 H30 L55 119 H42 L65 81 H54 L80 44 H74Z" />
      );
    case "metasequoia":
      return (
        <>
          <path d="M100 10 L125 50 H112 L141 77 H118 L155 106 H124 L168 139 H32 L76 106 H45 L82 77 H59 L88 50 H75Z" />
          <path d="M100 25 V145" stroke="white" opacity=".25" strokeWidth="3" />
        </>
      );
    case "olive":
      return (
        <>
          <ellipse cx="56" cy="98" rx="43" ry="30" />
          <ellipse cx="135" cy="72" rx="46" ry="32" />
          <ellipse cx="98" cy="117" rx="47" ry="31" />
          <g fill="white" opacity=".28">
            <ellipse cx="44" cy="96" rx="4" ry="9" />
            <ellipse cx="120" cy="58" rx="4" ry="9" />
            <ellipse cx="142" cy="85" rx="4" ry="9" />
          </g>
        </>
      );
    case "flowering":
      return (
        <>
          <circle cx="50" cy="91" r="35" />
          <circle cx="78" cy="49" r="35" />
          <circle cx="126" cy="49" r="35" />
          <circle cx="150" cy="91" r="35" />
          <circle cx="101" cy="108" r="38" />
          <Blossoms />
        </>
      );
    case "jacaranda":
      return (
        <>
          <path d="M13 93 Q17 50 61 40 Q100 3 139 40 Q183 50 187 93 Q163 118 100 117 Q37 118 13 93Z" />
          <path
            d="M36 93 V126 M64 100 V136 M98 106 V145 M132 100 V136 M162 93 V126"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <Blossoms />
        </>
      );
    case "fruit":
      return (
        <>
          <path d="M100 139 Q46 163 24 119 Q4 86 39 61 Q45 21 84 29 Q107 6 138 31 Q180 26 177 67 Q209 93 176 128 Q144 156 100 139Z" />
          <g fill="#ce7968">
            <circle cx="53" cy="91" r="8" />
            <circle cx="114" cy="53" r="8" />
            <circle cx="146" cy="114" r="8" />
          </g>
        </>
      );
    case "palm":
      return (
        <>
          <path d="M100 79 Q30 1 8 88 Q52 47 100 89 Q172 40 194 94 Q164 1 100 79 Q103 -8 56 22 Q85 30 100 79 Q138 -1 164 28 Q129 32 100 79Z" />
          <path
            d="M100 85 Q51 89 42 137 M101 84 Q153 81 166 133"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
          />
        </>
      );
    case "willow":
      return (
        <path d="M22 164 Q5 25 100 27 Q195 25 178 164 Q150 119 149 77 Q153 154 126 173 Q131 110 113 63 Q106 149 82 171 Q83 106 64 75 Q58 151 22 164Z" />
      );
    case "poplar":
      return (
        <path d="M100 2 Q120 25 139 70 Q163 128 115 151 L100 166 85 151 Q37 128 61 70 Q80 25 100 2Z" />
      );
    default:
      return (
        <>
          <ellipse cx="100" cy="84" rx="59" ry="64" />
          <ellipse cx="65" cy="113" rx="31" ry="30" />
          <ellipse cx="135" cy="113" rx="31" ry="30" />
        </>
      );
  }
}
function Blossoms() {
  return (
    <g fill="#f4dfe6">
      <circle cx="51" cy="77" r="6" />
      <circle cx="93" cy="40" r="6" />
      <circle cx="134" cy="63" r="6" />
      <circle cx="112" cy="99" r="6" />
      <circle cx="159" cy="93" r="5" />
    </g>
  );
}
const leafPaths: Record<string, string> = {
  broadleaf: "M0 0 Q-34 -29 -34 -4 Q-22 13 0 0Z",
  maple: "M0 0 L-12 -3 -24 -15 -24 -6 -37 -8 -31 3 -37 10 -21 10 -8 6Z",
  conifer: "M0 0 L-30 -20 -19 -5 -36 -12 -23 2 -36 0 -19 10Z",
  ginkgo: "M0 0 L-17 -24 Q-40 -27 -39 -5 Q-36 12 -18 15Z",
  beech: "M0 0 Q-25 -25 -36 -5 Q-28 19 0 0Z",
  zelkova: "M0 0 L-14 -12 -22 -8 -27 -15 -34 -6 -39 -3 -28 10 -16 10Z",
  hinoki: "M0 0 L-27 -24 -20 -9 -34 -18 -24 -3 -38 -8 -26 6 -13 8Z",
  pine: "M0 0 L-27 -26 -8 -6 -35 -17 -11 -2 -39 -5 -12 4 -35 9Z",
  sacred: "M0 0 Q-15 -27 -34 -20 Q-51 -6 -32 9 Q-10 20 0 0Z",
  birch: "M0 0 L-13 -22 -23 -25 -35 -15 -30 0 -16 8Z",
  redwood: "M0 0 L-37 -27 -21 -8 -43 -17 -25 2 -43 -1 -24 12Z",
  metasequoia: "M0 0 L-28 -19 -17 -2 -38 -9 -23 4 -41 2 -24 11Z",
  olive: "M0 0 Q-36 -18 -43 -2 Q-22 13 0 0Z",
  flowering: "M0 0 Q-14 -18 -27 -8 Q-41 -15 -40 -1 Q-39 14 -24 10 Q-11 17 0 0Z",
  jacaranda: "M0 0 L-11 -13 -21 -10 -28 -17 -37 -9 -31 0 -39 5 -21 12Z",
  fruit: "M0 0 Q-13 -24 -30 -18 Q-47 -7 -34 10 Q-15 19 0 0Z",
  palm: "M0 0 L-31 -31 -15 -10 -43 -24 -21 -4 -44 -9 -22 4 -40 6Z",
  willow: "M0 0 Q-32 -11 -43 20 Q-12 11 0 0Z",
  poplar: "M0 0 Q-17 -38 -29 -15 Q-38 6 0 0Z",
  default: "M0 0 Q-28 -23 -35 0 Q-18 15 0 0Z",
};

export default function TreeIllustration({
  pages,
  classification,
  pulse = false,
}: {
  pages: number | null;
  classification: Classification | null;
  pulse?: boolean;
}) {
  const style =
    genres.find((g) => g.id === classification?.mainGenreId)?.treeStyleId ||
    "default";
  const color = eraFor(classification)?.color || "#749881";
  const height = pages ? Math.min(204, 48 + treeHeightMeters(pages) * 28) : 20;
  const species = treeSpecies[style] || treeSpecies.default;
  const growth = treeGrowthVisual(pages);
  const crownClip = "forest-crown-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const trunkTop =
    145 + ((style === "palm" ? 72 : 78) - 145) * growth.crownHeight;
  return (
    <svg
      viewBox="0 0 200 240"
      role="img"
      aria-label={[
        growthStage(pages),
        pages === null ? "" : pages + "ページ",
        species,
        eraLabel(classification),
      ]
        .filter(Boolean)
        .join("・")}
      data-tree-style={style}
      data-growth-step={growth.step}
      data-era={eraFor(classification)?.id || "unclassified"}
      className={[styles.tree, pulse ? styles.pulse : ""].join(" ")}
    >
      <ellipse cx="100" cy="225" rx="58" ry="7" fill="#d5e3d8" />
      {!pages ? (
        <g>
          <path
            d="M100 223 Q94 207 105 204"
            stroke="#648372"
            fill="none"
            strokeWidth="3"
          />
          <g transform="translate(105 205) scale(.4)" fill={color}>
            <path d={leafPaths[style]} transform="rotate(140)" />
          </g>
        </g>
      ) : pages < 10 ? (
        <g>
          <path
            d="M100 224 Q91 203 102 178"
            fill="none"
            stroke="#726654"
            strokeWidth="4"
          />
          <g fill={color}>
            <path
              d={leafPaths[style]}
              transform="translate(100 201) rotate(8)"
            />
            <path
              d={leafPaths[style]}
              transform="translate(101 188) rotate(160) scale(.9)"
            />
          </g>
        </g>
      ) : (
        <g
          transform={
            "translate(" +
            (100 - height / 2) +
            " " +
            (224 - height) +
            ") scale(" +
            height / 200 +
            ")"
          }
        >
          <path
            d={
              style === "palm"
                ? `M95 200 Q116 150 97 ${trunkTop} L105 ${trunkTop} Q128 152 107 200Z`
                : style === "redwood" || style === "sacred"
                  ? `M86 200 L96 ${trunkTop} H107 L117 200Z`
                  : `M92 200 L97 ${trunkTop} H104 L111 200Z`
            }
            fill={style === "birch" ? "#dedbc7" : "#726654"}
            transform={`translate(100 0) scale(${growth.trunkWidth} 1) translate(-100 0)`}
          />
          <g
            transform={`translate(100 145) scale(${growth.crownWidth} ${growth.crownHeight}) translate(-100 -145)`}
          >
            <defs>
              <clipPath id={crownClip} clipPathUnits="userSpaceOnUse">
                <TreeCrown style={style} />
              </clipPath>
            </defs>
            <g fill={color} color={color} data-tree-canopy={style}>
              <TreeCrown style={style} />
            </g>
            <g clipPath={`url(#${crownClip})`}>
              <g stroke="#726654" strokeWidth="2.5" opacity=".35" fill="none">
                {Array.from({ length: growth.branchCount }, (_, index) => {
                  const side = index % 2 === 0 ? -1 : 1;
                  const y = 140 - Math.floor(index / 2) * 15;
                  return (
                    <path
                      data-growth-branch=""
                      key={index}
                      d={`M100 ${y + 14} Q${100 + side * 20} ${y} ${100 + side * (36 + (index % 3) * 8)} ${y - 20}`}
                    />
                  );
                })}
              </g>
              <g fill="white" opacity=".32">
                {Array.from({ length: growth.leafCount }, (_, index) => {
                  const [x, y] = growthLeafPosition(index);
                  return (
                    <path
                      key={index}
                      data-growth-leaf=""
                      d={leafPaths[style]}
                      transform={`translate(${x} ${y}) rotate(${(index * 137.5) % 360}) scale(.4)`}
                    />
                  );
                })}
              </g>
            </g>
          </g>
          <path
            d={`M100 181 L100 ${trunkTop + 30}`}
            fill="none"
            stroke="#726654"
            strokeWidth="3"
            opacity=".7"
          />
          <g fill="none" stroke="#726654" strokeWidth="3" strokeLinecap="round">
            {Array.from({ length: growth.rootCount }, (_, index) => {
              const side = index % 2 === 0 ? -1 : 1;
              return (
                <path
                  data-growth-root=""
                  key={index}
                  d={`M100 191 Q${100 + side * 3} 200 ${100 + side * (14 + Math.floor(index / 2) * 9)} 202`}
                />
              );
            })}
          </g>
          {style === "birch" && (
            <path
              d="M94 158 H103 M98 173 H107 M93 186 H103"
              stroke="#726654"
              strokeWidth="3"
            />
          )}
        </g>
      )}
    </svg>
  );
}
