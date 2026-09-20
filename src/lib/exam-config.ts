// 出題規格，來源：cs-graduate-exam-skills / mock-exam-generator / EXAM_SPEC.md（§1、§3、§5）

export const EXAM_YEAR = 116;
export const EXAM_DURATION_MINUTES = 100;

export type SubjectId = "linear-algebra" | "dsa" | "discrete-math" | "os" | "co";
export type SchoolId = "ntu" | "ncku" | "ncu" | "tai";

export interface Topic {
  name: string;
  weight: number;
  focus: string;
}

export interface Subject {
  id: SubjectId;
  /** 輸出資料夾與檔名使用的科目名稱 */
  name: string;
  /** 考古題資料夾（相對於 EXAM_ARCHIVE_DIR）。合科考卷也算該科的參考資料 */
  archiveDirs: string[];
  topics: Topic[];
}

export const SUBJECTS: Subject[] = [
  {
    id: "dsa",
    name: "資料結構與演算法",
    archiveDirs: ["資料結構與演算法"],
    topics: [
      { name: "動態規劃", weight: 20, focus: "LCS、LIS、背包、矩陣鏈乘、區間 DP" },
      { name: "圖論演算法", weight: 15, focus: "Dijkstra、MST、拓撲排序、BFS/DFS" },
      { name: "貪婪演算法", weight: 15, focus: "活動選擇、Huffman、greedy 正確性證明" },
      { name: "複雜度分析", weight: 12, focus: "Big-O、Master Theorem、遞迴求解、攤銷" },
      { name: "搜尋樹", weight: 12, focus: "BST、AVL、Red-Black、B-tree 操作" },
      { name: "排序", weight: 10, focus: "時間/空間複雜度、穩定性、比較次數" },
      { name: "雜湊/堆積", weight: 8, focus: "碰撞處理、負載因子、優先佇列" },
      { name: "NP 理論與字串", weight: 8, focus: "NPC 判定、reduction、KMP" },
    ],
  },
  {
    id: "linear-algebra",
    name: "線性代數",
    archiveDirs: ["線性代數", "數學(綜合)"],
    topics: [
      { name: "特徵值與對角化", weight: 20, focus: "特徵多項式、可對角化、求 A^n" },
      { name: "向量空間", weight: 15, focus: "子空間判別、基底與維度、四大空間" },
      { name: "線性映射", weight: 15, focus: "矩陣表示（相對基底）、核與值域、秩零度" },
      { name: "內積空間與投影", weight: 15, focus: "Gram–Schmidt、正交投影、最小平方法" },
      { name: "矩陣與行列式", weight: 12, focus: "rank、逆矩陣、行列式性質、分塊矩陣" },
      { name: "分解與特殊矩陣", weight: 13, focus: "SVD、LU、對稱/正交矩陣、二次型" },
      { name: "概念判斷", weight: 10, focus: "子空間/線性/可逆/正定之綜合是非題" },
    ],
  },
  {
    id: "discrete-math",
    name: "離散數學",
    archiveDirs: ["離散數學", "數學(綜合)"],
    topics: [
      { name: "圖論", weight: 20, focus: "尤拉/Hamilton、著色、最大流、平面圖" },
      { name: "排列組合與計數", weight: 15, focus: "容斥、鴿籠、二項式" },
      { name: "遞迴關係", weight: 15, focus: "特徵方程式、生成函數求解" },
      { name: "集合與函數", weight: 13, focus: "等價關係、偏序、函數性質" },
      { name: "邏輯與證明", weight: 12, focus: "命題/謂詞邏輯、數學歸納法" },
      { name: "生成函數", weight: 10, focus: "普通/指數生成函數" },
      { name: "代數結構", weight: 8, focus: "群判定、子群、Lagrange 定理" },
      { name: "樹", weight: 7, focus: "樹性質、spanning tree 計數" },
    ],
  },
  {
    id: "os",
    name: "作業系統",
    archiveDirs: ["作業系統"],
    topics: [
      { name: "同步與互斥", weight: 20, focus: "semaphore/monitor、經典問題、race condition" },
      { name: "CPU 排程", weight: 15, focus: "Gantt 圖、等待/周轉時間、RR/SJF" },
      { name: "死結", weight: 15, focus: "Banker's、資源分配圖、必要條件" },
      { name: "虛擬記憶體", weight: 15, focus: "頁取代（FIFO/LRU/Clock）、thrashing、Belady" },
      { name: "記憶體管理", weight: 15, focus: "分頁/分段、頁表、TLB" },
      { name: "檔案系統與磁碟", weight: 10, focus: "配置方式、磁碟排程 seek time" },
      { name: "概念比較", weight: 10, focus: "行程 vs 執行緒、分頁 vs 分段" },
    ],
  },
  {
    id: "co",
    name: "計算機組織與結構",
    archiveDirs: ["計算機組織", "作業系統"],
    topics: [
      { name: "管線", weight: 20, focus: "5-stage、hazard、forwarding、stall CPI" },
      { name: "快取", weight: 20, focus: "tag/index/offset、mapping、miss rate" },
      { name: "效能評估", weight: 15, focus: "CPI、CPU time、Amdahl's Law" },
      { name: "指令集與算術", weight: 15, focus: "MIPS、定址模式、IEEE 754、二補數" },
      { name: "資料路徑與控制", weight: 15, focus: "控制訊號、單/多循環" },
      { name: "虛擬記憶體（硬體面）", weight: 10, focus: "TLB、page table、address translation" },
      { name: "平行處理與概念", weight: 5, focus: "ILP、多處理器、記憶體一致性" },
    ],
  },
];

export interface QuestionMix {
  calc: number;
  proof: number;
  concept: number;
}

export interface School {
  id: SchoolId;
  name: string;
  /** 考古題資料夾內的學校資料夾名稱 */
  archiveName: string;
  /** 題型比例（EXAM_SPEC §1.3 基準 40/40/20，§5 各校調整） */
  mix: QuestionMix;
  /** 對主題權重的加成（百分點，之後會重新正規化為 100） */
  topicBoost: Partial<Record<SubjectId, Record<string, number>>>;
  /** 卷面風格描述（EXAM_SPEC §1.5、§5），只用於提示詞，不會出現在卷面 */
  style: string;
}

export const SCHOOLS: School[] = [
  {
    id: "ntu",
    name: "台大",
    archiveName: "台大",
    mix: { calc: 40, proof: 50, concept: 10 },
    topicBoost: {
      dsa: { 動態規劃: 3, 貪婪演算法: 3, "NP 理論與字串": 3 },
      "linear-algebra": { 線性映射: 3, 內積空間與投影: 3 },
    },
    style:
      "Proof/design-heavy. Many sub-questions are multi-select ('Which ones of the following are true?', all correct choices required for credit) and fill-in-the-blank, each sub-question with its own percentage, e.g. '1. (5%)'.",
  },
  {
    id: "ncku",
    name: "成大",
    archiveName: "成大",
    mix: { calc: 50, proof: 30, concept: 20 },
    topicBoost: {
      dsa: { 搜尋樹: 3 },
      co: { 指令集與算術: 3 },
    },
    style:
      "Computation-heavy while keeping basics and applications balanced. Mix of single-choice (a)-(d) and true/false items (a)-(e) with small per-item percentages, plus data-structure operation questions and IEEE 754 style computations.",
  },
  {
    id: "ncu",
    name: "中央",
    archiveName: "中央",
    mix: { calc: 40, proof: 30, concept: 30 },
    topicBoost: {},
    style:
      "More conceptual judgement. Include single-choice / true-false parts with an explicit scoring rule (e.g. 'each question 5%, a wrong answer deducts 2%'). Difficulty leans basic-to-medium.",
  },
  {
    id: "tai",
    name: "台聯大聯招",
    archiveName: "台聯大聯招",
    mix: { calc: 60, proof: 20, concept: 20 },
    topicBoost: {},
    style: "Electrical-engineering style, computation-dominated, with straightforward well-defined problems.",
  },
];

/** 卷面（含檔名）不得出現的學校字樣 */
export const SCHOOL_NAME_PATTERN =
  /台灣大學|臺灣大學|台大|臺大|成功大學|成大|中央大學|清華|清大|交通大學|陽明交大|交大|台聯大|聯招|\bNTU\b|\bNCKU\b|\bNCU\b|\bNTHU\b|\bNYCU\b/;

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function getSchool(id: string): School | undefined {
  return SCHOOLS.find((s) => s.id === id);
}

/** 依最大餘數法把權重正規化為總和 100 的整數 */
function normalizeTo100(entries: { name: string; value: number }[]): Map<string, number> {
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const scaled = entries.map((e) => {
    const exact = (e.value / total) * 100;
    return { name: e.name, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let remaining = 100 - scaled.reduce((sum, e) => sum + e.floor, 0);
  for (const e of [...scaled].sort((a, b) => b.frac - a.frac)) {
    if (remaining <= 0) break;
    e.floor += 1;
    remaining -= 1;
  }
  return new Map(scaled.map((e) => [e.name, e.floor]));
}

export interface ExamPlan {
  topics: { name: string; weight: number; focus: string }[];
  mix: QuestionMix;
}

/** 依科目基準權重與所選學校的風格，算出本次出題的主題權重與題型比例 */
export function buildPlan(subject: Subject, schools: School[]): ExamPlan {
  const boosted = subject.topics.map((t) => {
    const boost = schools.reduce((sum, s) => sum + (s.topicBoost[subject.id]?.[t.name] ?? 0), 0);
    const avgBoost = schools.length > 0 ? boost / schools.length : 0;
    return { name: t.name, value: t.weight + avgBoost };
  });
  const weights = normalizeTo100(boosted);

  const baseMix: QuestionMix = { calc: 40, proof: 40, concept: 20 };
  const mixSources = schools.length > 0 ? schools.map((s) => s.mix) : [baseMix];
  const avg = (key: keyof QuestionMix) => mixSources.reduce((sum, m) => sum + m[key], 0) / mixSources.length;
  const mixWeights = normalizeTo100([
    { name: "calc", value: avg("calc") },
    { name: "proof", value: avg("proof") },
    { name: "concept", value: avg("concept") },
  ]);

  return {
    topics: subject.topics.map((t) => ({ name: t.name, focus: t.focus, weight: weights.get(t.name) ?? 0 })),
    mix: {
      calc: mixWeights.get("calc") ?? 0,
      proof: mixWeights.get("proof") ?? 0,
      concept: mixWeights.get("concept") ?? 0,
    },
  };
}
