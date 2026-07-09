import { useState } from "react";
import {
  useGetDashboardStats,
  useGetRecentActivity,
  useListTasks,
  useUpdateTask,
  useListLeads,
  useListContentPosts,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderOpen, TrendingUp, IndianRupee, CheckSquare,
  BarChart3, CheckCircle2, ArrowRight, Flame,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  formatDistanceToNow, isToday, isBefore, parseISO,
  startOfWeek, endOfWeek, addDays, format,
} from "date-fns";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "ytd", label: "YTD" },
];

const PRIORITY_DOT: Record<string, string> = {
  HIGH:   "bg-rose-500",
  URGENT: "bg-rose-600",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-slate-300",
};

const PLATFORM_DOT: Record<string, string> = {
  INSTAGRAM: "bg-pink-500",
  LINKEDIN:  "bg-blue-600",
  FACEBOOK:  "bg-blue-500",
  YOUTUBE:   "bg-red-500",
  TWITTER:   "bg-slate-800 dark:bg-slate-200",
  TIKTOK:    "bg-slate-700",
  PINTEREST: "bg-red-600",
};

const HEALTH_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"];

const STAGE_ORDER = ["LEAD", "CONTACTED", "DEMO_GIVEN", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
const STAGE_LABEL: Record<string, string> = {
  LEAD: "Lead", CONTACTED: "Contacted", DEMO_GIVEN: "Demo",
  PROPOSAL_SENT: "Proposal", NEGOTIATION: "Negotiation", WON: "Won",
};
const STAGE_COLOR: Record<string, string> = {
  LEAD: "bg-slate-400", CONTACTED: "bg-blue-400", DEMO_GIVEN: "bg-indigo-400",
  PROPOSAL_SENT: "bg-violet-400", NEGOTIATION: "bg-amber-400", WON: "bg-emerald-500",
};

function StatCard({
  label, value, change, changeType, icon,
}: {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "warning" | "danger" | "neutral";
  icon: React.ReactNode;
}) {
  const accent = {
    positive: "border-l-emerald-500",
    warning:  "border-l-amber-400",
    danger:   "border-l-rose-500",
    neutral:  "border-l-primary",
  }[changeType ?? "neutral"];

  const changeColor = {
    positive: "text-emerald-600",
    warning:  "text-amber-600",
    danger:   "text-rose-500",
    neutral:  "text-muted-foreground",
  }[changeType ?? "neutral"];

  return (
    <Card className={cn("border-l-[3px] scale-hover", accent)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="mt-1.5 text-2xl font-bold font-heading text-foreground">{value}</p>
            {change && <p className={cn("mt-1 text-xs font-medium", changeColor)}>{change}</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 ml-3">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [chartRange, setChartRange] = useState<string>("6m");

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: revenueChart, isLoading: chartLoading } = useQuery<{ month: string; amount: number }[]>({
    queryKey: ["revenue-chart", chartRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/revenue-chart?range=${chartRange}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });
  const { data: projectHealth } = useQuery<{ onTrack: number; atRisk: number; delayed: number; completed: number; total: number }>({
    queryKey: ["project-health"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/project-health", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: allTasks, isLoading: tasksLoading } = useListTasks();
  const { data: leads } = useListLeads();

  // Content posts for current week (fetch both bounding months to handle month boundaries)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const weekEndMonthStr = format(weekEnd, "yyyy-MM");
  const needsBothMonths = currentMonthStr !== weekEndMonthStr;
  const { data: weekPosts } = useListContentPosts({
    month: currentMonthStr,
  } as any);
  const { data: weekPostsNext } = useListContentPosts({
    month: weekEndMonthStr,
  } as any);
  const allWeekPosts = needsBothMonths ? [...(weekPosts ?? []), ...(weekPostsNext ?? [])] : (weekPosts ?? []);

  const updateTaskMutation = useUpdateTask({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); }
    }
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const todayStr = format(new Date(), "EEEE, dd MMM yyyy");
  const tasksDueToday = (allTasks ?? []).filter((t) =>
    t.status !== "DONE" && t.dueDate && isToday(parseISO(t.dueDate))
  );
  const tasksOverdue = (allTasks ?? []).filter((t) =>
    t.status !== "DONE" && t.dueDate &&
    isBefore(parseISO(t.dueDate), new Date()) && !isToday(parseISO(t.dueDate))
  );

  // Sales pipeline by stage (exclude lost)
  const pipelineByStage = STAGE_ORDER.map((stage) => {
    const stageLeads = (leads ?? []).filter((l) => l.stage === stage);
    return {
      stage,
      label: STAGE_LABEL[stage] ?? stage,
      count: stageLeads.length,
      value: stageLeads.reduce((s, l) => s + (l.value ?? 0), 0),
      color: STAGE_COLOR[stage] ?? "bg-slate-400",
    };
  }).filter((s) => s.count > 0);
  const totalPipelineValue = pipelineByStage.reduce((s, st) => s + st.value, 0);

  // Content calendar week strip
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const postsByDay: Record<string, { platform: string }[]> = {};
  allWeekPosts.forEach((p: any) => {
    if (p.scheduledAt) {
      const dayKey = format(new Date(p.scheduledAt), "yyyy-MM-dd");
      if (!postsByDay[dayKey]) postsByDay[dayKey] = [];
      postsByDay[dayKey]!.push({ platform: p.platform ?? "INSTAGRAM" });
    }
  });

  // Project health donut
  const healthData = projectHealth
    ? [
        { name: "On Track",  value: projectHealth.onTrack,  color: "#10b981" },
        { name: "At Risk",   value: projectHealth.atRisk,   color: "#f59e0b" },
        { name: "Delayed",   value: projectHealth.delayed,  color: "#ef4444" },
        { name: "Completed", value: projectHealth.completed, color: "#94a3b8" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {greeting()}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayStr}</p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </Badge>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              label="Revenue MTD"
              value={`₹${((stats?.monthlyRevenue ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              change={`₹${((stats?.revenuePaid ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })} total collected`}
              changeType="positive"
              icon={<IndianRupee className="h-5 w-5" />}
            />
            <StatCard
              label="Active Projects"
              value={stats?.activeProjects ?? 0}
              change={`${stats?.totalClients ?? 0} total clients`}
              changeType="neutral"
              icon={<FolderOpen className="h-5 w-5" />}
            />
            <StatCard
              label="Tasks Due Today"
              value={tasksDueToday.length}
              change={tasksOverdue.length > 0 ? `${tasksOverdue.length} overdue` : "All on track"}
              changeType={(tasksDueToday.length + tasksOverdue.length) > 0 ? "danger" : "positive"}
              icon={<CheckSquare className="h-5 w-5" />}
            />
            <StatCard
              label="Open Leads"
              value={stats?.openLeads ?? 0}
              change={totalPipelineValue > 0 ? `₹${(totalPipelineValue / 100000).toFixed(1)}L pipeline` : "No pipeline value"}
              changeType="neutral"
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Revenue Trend
              </CardTitle>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((opt) => (
                  <Button key={opt.key} size="sm" variant={chartRange === opt.key ? "default" : "ghost"}
                    className="h-6 px-2 text-[10px] font-semibold" onClick={() => setChartRange(opt.key)}>
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueChart ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.55 0.22 260)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="oklch(0.55 0.22 260)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="oklch(0.55 0.22 260)"
                    strokeWidth={2.5} fill="url(#revenueGrad)"
                    dot={{ fill: "oklch(0.55 0.22 260)", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Project Health Donut */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" /> Project Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!projectHealth ? <Skeleton className="h-48" /> : healthData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No projects yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="45%" innerRadius={55} outerRadius={80}
                    paddingAngle={3} dataKey="value">
                    {healthData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Tooltip formatter={(v: number) => [v, "Projects"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tasks + Pipeline Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Tasks Due Today */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Tasks Due Today
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/tasks")}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tasksLoading ? <Skeleton className="h-40" /> : tasksDueToday.length === 0 && tasksOverdue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks due today — great work! 🎉</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {[...tasksDueToday, ...tasksOverdue.slice(0, 3)].map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card/50 hover:bg-muted/30 transition-colors">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[task.priority ?? "MEDIUM"])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(task as any).projectName && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{(task as any).projectName}</Badge>
                        )}
                        {task.dueDate && !isToday(parseISO(task.dueDate)) && (
                          <span className="text-[10px] text-rose-500 font-semibold">Overdue</span>
                        )}
                        {task.dueDate && isToday(parseISO(task.dueDate)) && (
                          <span className="text-[10px] text-amber-600 font-semibold">Due Today</span>
                        )}
                      </div>
                    </div>
                    {(task as any).assigneeName && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">
                          {(task as any).assigneeName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> Sales Pipeline
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/sales")}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pipelineByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active leads in pipeline</p>
            ) : (
              <div className="space-y-3">
                {pipelineByStage.map((stage) => {
                  const maxCount = Math.max(...pipelineByStage.map((s) => s.count));
                  const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold">{stage.count}</span>
                          {stage.value > 0 && <span className="text-muted-foreground">₹{(stage.value / 1000).toFixed(0)}k</span>}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", stage.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-1">
                  Total pipeline: ₹{(totalPipelineValue / 100000).toFixed(1)}L across {(leads ?? []).filter((l) => !["WON", "LOST", "CLOSED_WON", "CLOSED_LOST"].includes(l.stage ?? "")).length} active leads
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Content Calendar Week Strip ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-orange-500" /> Content Calendar — This Week
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/content")}>
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDay[dayKey] ?? [];
              const isCurrentDay = isToday(day);
              return (
                <div
                  key={dayKey}
                  onClick={() => navigate("/content")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-colors hover:border-primary/40",
                    isCurrentDay ? "bg-primary/5 border-primary/30" : "border-border bg-card/50"
                  )}
                >
                  <p className={cn("text-[10px] font-semibold uppercase", isCurrentDay ? "text-primary" : "text-muted-foreground")}>
                    {format(day, "EEE")}
                  </p>
                  <p className={cn("text-base font-bold font-heading leading-none", isCurrentDay ? "text-primary" : "text-foreground")}>
                    {format(day, "d")}
                  </p>
                  {dayPosts.length > 0 ? (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayPosts.slice(0, 4).map((p, i) => (
                        <div key={i} className={cn("h-2 w-2 rounded-full", PLATFORM_DOT[p.platform] ?? "bg-slate-400")} />
                      ))}
                      {dayPosts.length > 4 && (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 flex items-center justify-center">
                          <span className="text-[6px] text-white font-bold">+</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                  {dayPosts.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{dayPosts.length}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Activity ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))}
            </div>
          ) : (activity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {(activity ?? []).slice(0, 8).map((item) => {
                  const icon = item.type === "client" ? "🏢" : item.type === "project" ? "📁" : item.type === "invoice" ? "🧾" : "📋";
                  return (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center shrink-0 -ml-2.5 z-10 text-[10px]">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm text-foreground leading-snug">{item.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
