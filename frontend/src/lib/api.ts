// ─── Shooting Star API client ───────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type ApiSubtopic = { id: string; name: string; blurb: string; mastery: number };
export type ApiTopic = {
  id: string; name: string; tag: string; blurb: string;
  lit: boolean; progress: number;
  subtopics: ApiSubtopic[];
};

export type ApiConceptNode = { id: string; label: string; detail: string };
export type ApiConceptEdge = { from: string; to: string; label: string };
export type ApiPointer = { label: string; index: number };
export type ApiFrame = {
  note: string;
  values: number[];
  highlights: number[];
  merged: number[];
  // optional, richer fields for deterministic algorithm animations
  dim?: number[];
  pointers?: ApiPointer[];
  action?: string;
};

// `narration` is the spoken voice-over script for the Video Overview mode.
// Optional for backward-compatibility with any older cached decks.
export type ApiSlide =
  | { kind: "mindmap"; title: string; center: string; branches: { label: string; children: string[] }[]; narration?: string }
  | { kind: "definition"; title: string; terms: { term: string; formal: string; simple: string; analogy: string }[]; narration?: string }
  | { kind: "flow"; title: string; nodes: ApiConceptNode[]; edges: ApiConceptEdge[]; narration?: string }
  | { kind: "animation"; title: string; frames: ApiFrame[]; narration?: string };

export type ApiConceptMap = {
  subtopicId: string; name: string; topicName: string;
  slides: ApiSlide[];
  provider: string; cached: boolean;
};

export type ApiUser = { name: string; email: string };

export type ApiQuestion = {
  id: number;
  subtopic_id: string;
  subtopic_name: string;
  qtype: "mcq" | "long_answer" | "flashcard";
  prompt: string;
  choices: string[] | null;
  flashcard_back: string | null;
};

export type ApiAttempt = {
  id: number;
  topic_id: string;
  mode: string;
  timed: boolean;
  time_limit_s: number;
  status: string;
  llm_provider: string;
  questions: ApiQuestion[];
};

export type AnswerPayload = {
  question_id: number;
  response?: string;
  self_correct?: boolean;
  time_taken_s?: number;
};

export type ApiConceptFrame = { note: string; values: number[]; highlights: number[]; merged: number[] };
export type ApiWeakConcept = {
  subtopicId: string; name: string; aiDiagnosis: string;
  wrongAnswerPattern: string; frames: ApiConceptFrame[];
};
export type ApiGradedAnswer = {
  questionId: number; prompt: string; response: string;
  correct: boolean; partialCredit: number; feedback: string;
};
export type ApiAnalysis = {
  topicId: string; attemptId: number; attemptLabel: string;
  score: number; timeTaken: string; mode: string; provider: string;
  results: { subtopicId: string; name: string; correct: number; total: number }[];
  weak: ApiWeakConcept[];
  answers: ApiGradedAnswer[];
};

// ─── Auth token (persisted so login survives refresh) ───────────────────────

const TOKEN_KEY = "shooting-star.token";
const USER_KEY = "shooting-star.user";

export const auth = {
  token: (): string | null => localStorage.getItem(TOKEN_KEY),
  user: (): ApiUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  save(token: string, user: ApiUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn: (): boolean => Boolean(localStorage.getItem(TOKEN_KEY)),
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = auth.token();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    auth.clear();
    window.location.href = "/login";
    throw new ApiError(401, "session expired");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new ApiError(res.status, detail?.detail ?? res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ApiAchievement = { key: string; name: string; desc: string; unlocked: boolean };
export type ApiProfile = {
  totalAttempts: number; avgScore: number; bestScore: number;
  kp: number; topicsExplored: number; achievements: ApiAchievement[];
};
export type ApiProgressPoint = { label: string; avgScore: number | null; attempts: number };
export type ApiProgress = { period: string; points: ApiProgressPoint[]; trend: number };

export const api = {
  register: async (name: string, email: string, password: string) => {
    const r = await request<{ token: string; name: string; email: string }>(
      "/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    auth.save(r.token, { name: r.name, email: r.email });
    return r;
  },

  login: async (email: string, password: string) => {
    const r = await request<{ token: string; name: string; email: string }>(
      "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    auth.save(r.token, { name: r.name, email: r.email });
    return r;
  },

  topics: () => request<ApiTopic[]>("/api/topics"),

  createTopic: (name: string) =>
    request<ApiTopic>("/api/topics", { method: "POST", body: JSON.stringify({ name }) }),

  profile: () => request<ApiProfile>("/api/profile"),

  progress: (period: "weekly" | "monthly" | "annual") =>
    request<ApiProgress>(`/api/progress?period=${period}`),

  concept: (subtopicId: string) =>
    request<ApiConceptMap>(`/api/subtopics/${subtopicId}/concept`),

  createAttempt: (body: {
    topic_id: string;
    mode: "mcq" | "long_answer" | "flashcard";
    timed: boolean;
    num_questions: number;
    focus_subtopic_id?: string | null;
  }) => request<ApiAttempt>("/api/attempts", { method: "POST", body: JSON.stringify(body) }),

  getAttempt: (id: number) => request<ApiAttempt>(`/api/attempts/${id}`),

  submitAttempt: (id: number, answers: AnswerPayload[]) =>
    request<ApiAnalysis>(`/api/attempts/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  getAnalysis: (attemptId: number) => request<ApiAnalysis>(`/api/attempts/${attemptId}/analysis`),

  latestAnalysis: (topicId: string) => request<ApiAnalysis>(`/api/topics/${topicId}/latest-analysis`),
};
