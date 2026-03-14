'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
} from 'chart.js';
import { Pie, Line, Bar, Chart } from 'react-chartjs-2';

function peso(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler
);

const CHART_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16',
];

interface CategoryChartProps {
  data: { category: string; amount: number }[];
}

export function CategoryPieChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600 text-sm">
        No spending data yet
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        data: data.map((d) => d.amount),
        backgroundColor: CHART_COLORS.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  return (
    <div className="h-56 flex items-center justify-center">
      <Pie
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 10,
                padding: 12,
                font: { size: 11 },
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${peso(ctx.parsed)}`,
              },
            },
          },
        }}
      />
    </div>
  );
}

interface WeeklyChartProps {
  data: { week: string; amount: number }[];
}

export function WeeklySpendingChart({ data }: WeeklyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600 text-sm">
        No weekly data yet
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.week),
    datasets: [
      {
        label: 'Spending',
        data: data.map((d) => d.amount),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
      },
    ],
  };

  return (
    <div className="h-48">
      <Line
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 10 },
                callback: (value) => peso(Number(value)),
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${peso(ctx.parsed.y ?? 0)}`,
              },
            },
          },
        }}
      />
    </div>
  );
}

interface DailyChartProps {
  data: { day: string; amount: number }[];
}

export function DailySpendingChart({ data }: DailyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600 text-sm">
        No daily data yet
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.day),
    datasets: [
      {
        label: 'Daily Spending',
        data: data.map((d) => d.amount),
        backgroundColor: '#10b981',
        borderRadius: 6,
        barThickness: 20,
      },
    ],
  };

  return (
    <div className="h-48">
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 10 },
                callback: (value) => peso(Number(value)),
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${peso(ctx.parsed.y ?? 0)}`,
              },
            },
          },
        }}
      />
    </div>
  );
}

interface MonthlySavingsChartProps {
  data: { month: string; saved: number; spent: number; budget: number; cumulative: number }[];
}

export function MonthlySavingsChart({ data }: MonthlySavingsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600 text-sm">
        No savings data yet. Set an Overall monthly budget to start tracking.
      </div>
    );
  }

  const labels = data.map((d) => {
    const [y, m] = d.month.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Monthly Saved',
        data: data.map((d) => d.saved),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius: 6,
        barThickness: 14,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'bar',
        label: 'Monthly Spent',
        data: data.map((d) => d.spent),
        backgroundColor: 'rgba(239, 68, 68, 0.45)',
        borderRadius: 6,
        barThickness: 14,
        yAxisID: 'y',
        order: 3,
      },
      {
        type: 'line',
        label: 'Cumulative Savings',
        data: data.map((d) => d.cumulative),
        borderColor: 'rgba(99, 102, 241, 0.9)',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 2.5,
        pointRadius: data.length > 24 ? 2 : 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
        yAxisID: 'y2',
        order: 1,
      },
    ],
  };

  return (
    <div className="h-72">
      <Chart
        type="bar"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={chartData as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 10 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (value: any) => peso(Number(value)),
              },
              title: { display: true, text: 'Monthly (₱)', font: { size: 9 }, color: 'rgba(120,120,120,0.8)' },
            },
            y2: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: {
                font: { size: 10 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (value: any) => peso(Number(value)),
              },
              title: { display: true, text: 'Cumulative (₱)', font: { size: 9 }, color: 'rgba(99,102,241,0.8)' },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 45 },
            },
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { boxWidth: 10, font: { size: 11 }, usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) => ` ${ctx.dataset.label}: ${peso(ctx.parsed.y ?? 0)}`,
              },
            },
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
    </div>
  );
}
