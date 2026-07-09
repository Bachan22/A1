import { useState } from "react";
import {
  useListProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useListClients, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import type { ProjectInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { Plus, FolderKanban, Trash2, Pencil, Calendar, PlayCircle, CheckCircle2, PauseCircle } from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 border-slate-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-700 border-orange-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600" },
  MEDIUM: { label: "Medium", className: "bg-blue-100 text-blue-700" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700" },
  URGENT: { label: "Urgent", className: "bg-rose-100 text-rose-700" },
};

interface ProjectFormData {
  name: string;
  description?: string;
  clientId?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: projects, isLoading } = useListProjects();
  const { data: clients } = useListClients();

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project created");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create project"),
    },
  });

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project updated");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
        setEditId(null);
      },
      onError: () => toast.error("Failed to update project"),
    },
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project deleted");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: () => toast.error("Failed to delete project"),
    },
  });

  const { register, handleSubmit, control, reset } = useForm<ProjectFormData>({
    defaultValues: { name: "", status: "NOT_STARTED", priority: "MEDIUM" },
  });

  const openAdd = () => {
    reset({ name: "", status: "NOT_STARTED", priority: "MEDIUM" });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (p: NonNullable<typeof projects>[number]) => {
    setEditId(p.id);
    reset({
      name: p.name,
      status: p.status ?? "NOT_STARTED",
      priority: p.priority ?? "MEDIUM",
      clientId: p.clientId ?? undefined,
      startDate: p.startDate ? p.startDate.split("T")[0] : undefined,
      dueDate: p.dueDate ? p.dueDate.split("T")[0] : undefined,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const filtered = (projects ?? []).filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalInProgress = (projects ?? []).filter((p) => p.status === "IN_PROGRESS").length;
  const totalCompleted  = (projects ?? []).filter((p) => p.status === "COMPLETED").length;
  const totalOnHold     = (projects ?? []).filter((p) => p.status === "ON_HOLD").length;

  const projectStatChips = [
    { label: "Total Projects", value: projects?.length ?? 0, accent: "border-l-primary",     icon: <FolderKanban className="h-4 w-4" /> },
    { label: "In Progress",    value: totalInProgress,       accent: "border-l-blue-500",    icon: <PlayCircle className="h-4 w-4" /> },
    { label: "Completed",      value: totalCompleted,        accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "On Hold",        value: totalOnHold,           accent: "border-l-amber-400",   icon: <PauseCircle className="h-4 w-4" /> },
  ];

  const STATUS_BORDER: Record<string, string> = {
    NOT_STARTED: "border-l-slate-400",
    IN_PROGRESS:  "border-l-blue-500",
    UNDER_REVIEW: "border-l-amber-400",
    COMPLETED:    "border-l-emerald-500",
    ON_HOLD:      "border-l-orange-400",
    CANCELLED:    "border-l-rose-400",
  };

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {projects?.length ?? 0} projects shown
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2 btn-micro-anim" data-testid="add-project-btn">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {projectStatChips.map(({ label, value, accent, icon }) => (
          <div key={label} className={cn("bg-card border border-l-[3px] rounded-xl p-4 scale-hover shadow-xs", accent)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold font-heading mt-1">{value}</p>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <SearchBar
          placeholder="Search projects…"
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-48 max-w-72"
        />
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">No projects found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter !== "ALL"
              ? "Try adjusting your search or status filter"
              : "Create your first project to get started"}
          </p>
          {!search && statusFilter === "ALL" && (
            <Button onClick={openAdd} className="mt-4 gap-2 btn-micro-anim" size="sm">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sc = STATUS_CONFIG[p.status ?? "NOT_STARTED"];
            const pc = PRIORITY_CONFIG[p.priority ?? "MEDIUM"];
            const borderAccent = STATUS_BORDER[p.status ?? "NOT_STARTED"] ?? "border-l-slate-400";
            const isOverdue = p.dueDate && p.status !== "COMPLETED" && p.status !== "CANCELLED" &&
              new Date(p.dueDate) < new Date();
            return (
              <Card key={p.id} className={cn("scale-hover border-l-[3px] group", borderAccent)}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold line-clamp-2 text-sm">{p.name}</p>
                      {p.clientName && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.clientName}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: p.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={sc.className + " text-[11px] border"}>{sc.label}</Badge>
                    <Badge variant="outline" className={pc.className + " text-[11px]"}>{pc.label}</Badge>
                  </div>

                  {(p.startDate || p.dueDate) && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs pt-2 border-t border-border/50",
                      isOverdue ? "text-rose-500 font-medium" : "text-muted-foreground"
                    )}>
                      <Calendar className="h-3 w-3 shrink-0" />
                      {p.startDate && <span>{format(new Date(p.startDate), "dd MMM")}</span>}
                      {p.startDate && p.dueDate && <span>—</span>}
                      {p.dueDate && <span>{format(new Date(p.dueDate), "dd MMM yyyy")}</span>}
                      {isOverdue && <span className="ml-auto bg-rose-100 text-rose-600 dark:bg-rose-950/40 px-1.5 py-0.5 rounded text-[10px] font-semibold">Overdue</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input {...register("name", { required: "Required" })} placeholder="Website Redesign" data-testid="project-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No client</SelectItem>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value ?? "NOT_STARTED"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Controller control={control} name="priority" render={({ field }) => (
                  <Select value={field.value ?? "MEDIUM"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input {...register("startDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={3} placeholder="Project description..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="save-project-btn">
                {editId ? "Save Changes" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
