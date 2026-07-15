import { useState } from "react";
import {
  useGetTodayAttendance,
  useCheckIn,
  useCheckOut,
  useListAttendance,
  getGetTodayAttendanceQueryKey,
  getListAttendanceQueryKey,
  useOvertimeCheckIn,
  useOvertimeCheckOut,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, CheckCircle2, AlertTriangle, Users, Download } from "lucide-react";
import { format } from "date-fns";

function calculateDuration(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  return Math.max(0, end.getTime() - start.getTime());
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0 && mins === 0) return "—";
  return `${hrs}h ${mins}m`;
}

function exportAttendanceCSV(records: any[]) {
  const headers = ["Date", "Employee", "Check In", "Check Out", "Overtime", "Total Hours", "Status"];
  const rows = records.map((r) => {
    const normalMs = calculateDuration(r.checkInAt, r.checkOutAt);
    const otMs = calculateDuration(r.overtimeCheckInAt, r.overtimeCheckOutAt);
    const totalMs = normalMs + otMs;

    let otStr = "—";
    if (r.overtimeCheckInAt) {
      const otStart = format(new Date(r.overtimeCheckInAt), "HH:mm");
      const otEnd = r.overtimeCheckOutAt ? format(new Date(r.overtimeCheckOutAt), "HH:mm") : "Working";
      otStr = `${otStart} - ${otEnd}`;
    }

    return [
      r.date ?? format(new Date(r.checkInAt), "yyyy-MM-dd"),
      r.userName ?? "",
      r.checkInAt ? format(new Date(r.checkInAt), "HH:mm") : "",
      r.checkOutAt ? format(new Date(r.checkOutAt), "HH:mm") : "",
      otStr,
      totalMs > 0 ? formatDuration(totalMs) : "—",
      r.isLate ? "Late" : "On Time",
    ];
  });
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${format(new Date(), "yyyy-MM")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: todayStatus, isLoading: todayLoading } = useGetTodayAttendance();
  const { data: attendanceHistory, isLoading: historyLoading } = useListAttendance();

  const isUserAdminOrManager = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "MANAGER";

  const checkInMutation = useCheckIn({
    mutation: {
      onSuccess: () => {
        toast.success("Checked in successfully");
        qc.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to check in");
      },
    },
  });

  const checkOutMutation = useCheckOut({
    mutation: {
      onSuccess: () => {
        toast.success("Checked out successfully");
        qc.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to check out");
      },
    },
  });

  const overtimeCheckInMutation = useOvertimeCheckIn({
    mutation: {
      onSuccess: () => {
        toast.success("Overtime started successfully");
        qc.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to start overtime");
      },
    },
  });

  const overtimeCheckOutMutation = useOvertimeCheckOut({
    mutation: {
      onSuccess: () => {
        toast.success("Overtime completed successfully");
        qc.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to complete overtime");
      },
    },
  });

  // Filter attendance history to get checked-in users for today (regular active check-in OR overtime active check-in)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const liveBoardUsers = isUserAdminOrManager
    ? (attendanceHistory ?? []).filter((r) => {
        const isToday = r.date === todayDateStr;
        const activeRegular = r.checkInAt !== null && r.checkOutAt === null;
        const activeOvertime = r.overtimeCheckInAt !== null && r.overtimeCheckOutAt === null;
        return isToday && (activeRegular || activeOvertime);
      })
    : [];

  const handleCheckIn = () => {
    checkInMutation.mutate();
  };

  const handleCheckOut = () => {
    checkOutMutation.mutate();
  };

  const handleOvertimeCheckIn = () => {
    overtimeCheckInMutation.mutate();
  };

  const handleOvertimeCheckOut = () => {
    overtimeCheckOutMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily check-in, live board & history logs
          </p>
        </div>
        {isUserAdminOrManager && (attendanceHistory ?? []).length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportAttendanceCSV(attendanceHistory ?? [])}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Check In / Out Control Card */}
        <Card className="md:col-span-1 shadow-sm border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Daily Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !todayStatus?.checkedIn ? (
              <div className="space-y-4 text-center py-4">
                <p className="text-sm text-muted-foreground">
                  You are not checked in for today. Click below to mark your attendance.
                </p>
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full btn-micro-anim"
                  data-testid="check-in-btn"
                >
                  {checkInMutation.isPending ? "Checking in..." : "Check In Now"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Regular Shift Details */}
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Regular Shift</span>
                    </div>
                    {todayStatus.checkOutAt ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                        Completed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] animate-pulse">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                    <p>
                      <strong>Check In:</strong>{" "}
                      {todayStatus.checkInAt ? format(new Date(todayStatus.checkInAt), "p") : "—"}
                    </p>
                    {todayStatus.checkOutAt && (
                      <p>
                        <strong>Check Out:</strong>{" "}
                        {format(new Date(todayStatus.checkOutAt), "p")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Overtime Shift Details */}
                {todayStatus.overtimeCheckInAt && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300 font-semibold text-sm">
                        <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                        <span>Overtime Shift</span>
                      </div>
                      {todayStatus.overtimeCheckOutAt ? (
                        <Badge variant="secondary" className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 text-[10px]">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-violet-500 text-white dark:bg-violet-600 text-[10px] animate-pulse">
                          🟣 Overtime
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-violet-700 dark:text-violet-400 space-y-1">
                      <p>
                        <strong>Overtime Check In:</strong>{" "}
                        {format(new Date(todayStatus.overtimeCheckInAt), "p")}
                      </p>
                      {todayStatus.overtimeCheckOutAt && (
                        <p>
                          <strong>Overtime Check Out:</strong>{" "}
                          {format(new Date(todayStatus.overtimeCheckOutAt), "p")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Active Action Button */}
                {!todayStatus.checkOutAt ? (
                  <Button
                    variant="outline"
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="w-full btn-micro-anim text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid="check-out-btn"
                  >
                    {checkOutMutation.isPending ? "Checking out..." : "Check Out"}
                  </Button>
                ) : !todayStatus.overtimeCheckInAt ? (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      Your regular shift is completed. Do you want to start overtime?
                    </p>
                    <Button
                      variant="default"
                      onClick={handleOvertimeCheckIn}
                      disabled={overtimeCheckInMutation.isPending}
                      className="w-full btn-micro-anim bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-700 dark:hover:bg-violet-600"
                      data-testid="overtime-check-in-btn"
                    >
                      {overtimeCheckInMutation.isPending ? "Starting Overtime..." : "Overtime Check In"}
                    </Button>
                  </div>
                ) : !todayStatus.overtimeCheckOutAt ? (
                  <Button
                    variant="outline"
                    onClick={handleOvertimeCheckOut}
                    disabled={overtimeCheckOutMutation.isPending}
                    className="w-full btn-micro-anim border-violet-500 text-violet-400 hover:bg-violet-950/20 dark:border-violet-600 dark:text-violet-300 dark:hover:bg-violet-900/20"
                    data-testid="overtime-check-out-btn"
                  >
                    {overtimeCheckOutMutation.isPending ? "Ending Overtime..." : "Overtime Check Out"}
                  </Button>
                ) : (
                  <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border">
                    🎉 Attendance is complete for today!
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Board */}
        {isUserAdminOrManager && (
          <Card className="md:col-span-2 shadow-sm border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Live Board — Checked in now ({liveBoardUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                  ))}
                </div>
              ) : liveBoardUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No team members checked in currently.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {liveBoardUsers.map((r) => {
                    const isOvertime = r.overtimeCheckInAt !== null && r.overtimeCheckOutAt === null;
                    return (
                      <Badge key={r.id} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
                        <span className="font-medium">{r.userName ?? "Unknown"}</span>
                        {isOvertime ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-300 text-violet-400 bg-violet-950/20 font-bold dark:border-violet-600 dark:text-violet-300">
                            🟣 Overtime
                          </Badge>
                        ) : r.isLate ? (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 scale-95 origin-center font-bold">
                            LATE
                          </Badge>
                        ) : null}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* History Table */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Your Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (attendanceHistory ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance logs found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attendanceHistory ?? []).map((r) => {
                  const normalMs = calculateDuration(r.checkInAt, r.checkOutAt);
                  const otMs = calculateDuration(r.overtimeCheckInAt, r.overtimeCheckOutAt);
                  const totalMs = normalMs + otMs;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {format(new Date(r.checkInAt), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(r.checkInAt), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        {r.checkOutAt ? format(new Date(r.checkOutAt), "HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        {r.overtimeCheckInAt ? (
                          <span className="text-violet-400 dark:text-violet-300 font-medium">
                            {format(new Date(r.overtimeCheckInAt), "HH:mm")} – {r.overtimeCheckOutAt ? format(new Date(r.overtimeCheckOutAt), "HH:mm") : "Working"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {totalMs > 0 ? formatDuration(totalMs) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
                            Present
                          </Badge>
                          {r.isLate && (
                            <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Late
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
