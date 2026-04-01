import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';

export interface SeverityDataPoint {
  name: string;
  value: number;
  color: string;
}

interface IssueSeverityChartProps {
  data: SeverityDataPoint[];
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]!;
  return (
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: (entry.payload as SeverityDataPoint | undefined)?.color }}
        />
        <span className="font-medium">{entry.name}:</span>
        <span>{entry.value}</span>
      </div>
    </div>
  );
}

interface CustomLegendProps {
  payload?: Array<{ value: string; color: string; payload?: { value: number } }>;
}

function CustomLegend({ payload }: CustomLegendProps) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
          <span className="font-medium">({entry.payload?.value})</span>
        </div>
      ))}
    </div>
  );
}

function CenterLabel({ data }: { data: SeverityDataPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <text
      x="50%"
      y="45%"
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-foreground"
    >
      <tspan x="50%" dy="-0.2em" fontSize="24" fontWeight="bold">
        {total}
      </tspan>
      <tspan x="50%" dy="1.5em" fontSize="12" className="fill-muted-foreground">
        Total Issues
      </tspan>
    </text>
  );
}

export function IssueSeverityChart({ data }: IssueSeverityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          animationDuration={800}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <CenterLabel data={data} />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
