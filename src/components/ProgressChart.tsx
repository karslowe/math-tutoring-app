"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TopicProgressEntry {
  topicName: string;
  level: string;
  numericLevel: number;
  date: string;
  sessionId: string;
}

interface TopicSummary {
  topicName: string;
  currentLevel: string;
  numericLevel: number;
  history: TopicProgressEntry[];
}

interface ProgressChartProps {
  progress: TopicSummary[];
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Learning",
  2: "Practicing",
  3: "Getting It",
  4: "Mastered",
};

const LEVEL_COLORS: Record<string, string> = {
  Learning: "bg-red-100 text-red-700 border-red-200",
  Practicing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Getting It": "bg-blue-100 text-blue-700 border-blue-200",
  Mastered: "bg-green-100 text-green-700 border-green-200",
};

const LINE_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#84cc16", // lime
];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-700">{entry.name}:</span>
          <span className="font-medium">
            {LEVEL_LABELS[entry.value] || entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProgressChart({ progress }: ProgressChartProps) {
  if (!progress || progress.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-10 w-10 text-gray-300 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-gray-500 text-sm">No topic progress data yet.</p>
        <p className="text-gray-400 text-xs mt-1">
          Progress will appear after session notes with topics are added.
        </p>
      </div>
    );
  }

  // Build chart data: each unique date becomes a data point
  const dateSet = new Set<string>();
  for (const topic of progress) {
    for (const entry of topic.history) {
      dateSet.add(entry.date);
    }
  }
  const sortedDates = Array.from(dateSet).sort();

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number> = {
      date: formatDateShort(date),
    };
    for (const topic of progress) {
      // Find the latest entry for this topic on or before this date
      const relevantEntries = topic.history.filter((e) => e.date <= date);
      if (relevantEntries.length > 0) {
        point[topic.topicName] =
          relevantEntries[relevantEntries.length - 1].numericLevel;
      }
    }
    return point;
  });

  return (
    <div>
      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
            />
            <YAxis
              domain={[1, 4]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={(v) => LEVEL_LABELS[v] || ""}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {progress.map((topic, i) => (
              <Line
                key={topic.topicName}
                type="monotone"
                dataKey={topic.topicName}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Topic Summary Table */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Current Topic Levels
        </h3>
        <div className="flex flex-wrap gap-2">
          {progress.map((topic) => (
            <div
              key={topic.topicName}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="text-sm font-medium text-gray-800">
                {topic.topicName}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  LEVEL_COLORS[topic.currentLevel] || "bg-gray-100 text-gray-600"
                }`}
              >
                {topic.currentLevel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export the mastery badge for reuse in session history
export function MasteryBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${
        LEVEL_COLORS[level] || "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {level}
    </span>
  );
}

export function TopicTag({
  name,
  level,
}: {
  name: string;
  level: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
      <span className="font-medium text-gray-700">{name}</span>
      <MasteryBadge level={level} />
    </span>
  );
}
