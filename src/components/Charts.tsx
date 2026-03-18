'use client';

import { useEffect, useState } from 'react';
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
import type { Plugin } from 'chart.js';
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

function useIsCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const syncViewport = () => setIsCompactViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  return isCompactViewport;
}

interface CategoryChartProps {
  data: { category: string; amount: number }[];
}

export function CategoryPieChart({ data }: CategoryChartProps) {
  const isCompactViewport = useIsCompactViewport();

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
    <div className="h-64 sm:h-56 flex items-center justify-center">
      <Pie
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: isCompactViewport ? 'bottom' : 'right',
              labels: {
                boxWidth: isCompactViewport ? 8 : 10,
                padding: isCompactViewport ? 10 : 12,
                font: { size: isCompactViewport ? 10 : 11 },
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
  const isCompactViewport = useIsCompactViewport();

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
        pointRadius: isCompactViewport ? 2 : 4,
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
                maxTicksLimit: isCompactViewport ? 5 : 8,
                callback: (value) => peso(Number(value)),
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: isCompactViewport ? 9 : 10 }, maxTicksLimit: isCompactViewport ? 4 : 7 },
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
  const isCompactViewport = useIsCompactViewport();

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
        barThickness: isCompactViewport ? 10 : 14,
        maxBarThickness: isCompactViewport ? 12 : 16,
      },
    ],
  };

  const rightValueLabelPlugin: Plugin<'bar'> = {
    id: 'rightValueLabelPlugin',
    afterDatasetsDraw: (chart) => {
      const dataset = chart.data.datasets[0];
      if (!dataset || !Array.isArray(dataset.data)) return;

      const meta = chart.getDatasetMeta(0);
      const { ctx, chartArea } = chart;

      ctx.save();
      ctx.fillStyle = '#71717a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `${isCompactViewport ? 10 : 11}px system-ui, -apple-system, Segoe UI, sans-serif`;

      meta.data.forEach((bar, index) => {
        const rawValue = dataset.data[index];
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(value)) return;

        const y = (bar as { y: number }).y;
        ctx.fillText(peso(value), chartArea.right + 8, y);
      });

      ctx.restore();
    },
  };

  return (
    <div className="h-48">
      <Bar
        data={chartData}
        plugins={[rightValueLabelPlugin]}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          layout: {
            padding: {
              right: isCompactViewport ? 84 : 110,
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { display: false },
              ticks: {
                display: false,
              },
              border: { display: false },
            },
            y: {
              grid: { display: false },
              ticks: {
                font: { size: isCompactViewport ? 10 : 11 },
                color: '#3f3f46',
              },
              border: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${peso(ctx.parsed.x ?? 0)}`,
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
  const isCompactViewport = useIsCompactViewport();

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

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Monthly Saved',
        data: data.map((d) => d.saved),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius: 6,
        barThickness: isCompactViewport ? 10 : 14,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'bar',
        label: 'Monthly Spent',
        data: data.map((d) => d.spent),
        backgroundColor: 'rgba(239, 68, 68, 0.45)',
        borderRadius: 6,
        barThickness: isCompactViewport ? 10 : 14,
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
        pointRadius: isCompactViewport ? 2 : data.length > 24 ? 2 : 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
        yAxisID: 'y2',
        order: 1,
      },
    ],
  };

  const chartOptions = {
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
          callback: (value: string | number) => peso(Number(value)),
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
          callback: (value: string | number) => peso(Number(value)),
        },
        title: { display: true, text: 'Cumulative (₱)', font: { size: 9 }, color: 'rgba(99,102,241,0.8)' },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { size: isCompactViewport ? 9 : 10 },
          maxRotation: isCompactViewport ? 0 : 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: isCompactViewport ? 6 : 12,
        },
      },
    },
    plugins: {
      legend: {
        position: isCompactViewport ? 'bottom' : 'top',
        labels: {
          boxWidth: isCompactViewport ? 8 : 10,
          font: { size: isCompactViewport ? 10 : 11 },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y?: number } }) =>
            ` ${ctx.dataset.label}: ${peso(ctx.parsed.y ?? 0)}`,
        },
      },
    },
  };

  return (
    <div className="h-72">
      <Chart
        type="bar"
        data={chartData as never}
        options={chartOptions as never}
      />
    </div>
  );
}
