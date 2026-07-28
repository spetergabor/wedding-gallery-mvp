"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, Clock3, GripVertical, ListChecks, Plus, Trash2, UserRound } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  CUSTOMER_TASK_PRIORITIES,
  CUSTOMER_TASK_STATUSES,
  CUSTOMER_TASK_TYPES,
  customerTaskPriorityLabel,
  customerTaskStatusLabel,
  customerTaskTypeLabel,
  isClosedCustomerTaskStatus,
  normalizeCustomerTaskStatus
} from "@/lib/customer-task-options";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  createDashboardTaskAction,
  deleteDashboardTaskAction,
  moveDashboardTaskStatusAction,
  updateDashboardTaskStatusAction
} from "@/lib/task-board-actions";

type TaskBoardCustomer = {
  id: string;
  coupleName: string;
};

type TaskBoardTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  dueTime: string | null;
  notes: string | null;
  updatedAt: Date | string;
  customer: TaskBoardCustomer | null;
  project: {
    title: string;
  } | null;
};

const BOARD_STATUSES = [
  { value: "planned", label: "Tervezett" },
  { value: "in_progress", label: "Folyamatban" },
  { value: "delivered", label: "Átadva" },
  { value: "closed", label: "Lezárva" }
];

function formatDueDate(task: { dueDate: Date | string | null; dueTime: string | null }) {
  if (!task.dueDate) {
    return "Nincs határidő";
  }

  const dueDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
  const date = dueDate.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });

  return task.dueTime ? `${date} · ${task.dueTime}` : date;
}

function priorityClass(priority: string) {
  if (priority === "high") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "low") {
    return "bg-ink/5 text-graphite";
  }

  return "bg-brass/10 text-brass";
}

function statusColumnClass(status: string) {
  if (status === "closed") {
    return "border-sage/20 bg-sage/[0.04]";
  }

  if (status === "delivered") {
    return "border-brass/25 bg-brass/[0.05]";
  }

  if (status === "in_progress") {
    return "border-ink/15 bg-white";
  }

  return "border-ink/10 bg-paper/70";
}

function nextStatus(status: string) {
  if (status === "planned") {
    return "in_progress";
  }

  if (status === "in_progress") {
    return "delivered";
  }

  if (status === "delivered") {
    return "closed";
  }

  return null;
}

function TaskStatusButton({ taskId, status }: { taskId: string; status: string }) {
  const next = nextStatus(status);

  if (!next) {
    return null;
  }

  return (
    <form action={updateDashboardTaskStatusAction.bind(null, taskId)}>
      <input type="hidden" name="status" value={next} />
      <FormSubmitButton variant="secondary" className="h-8 px-2 text-xs" pendingLabel="...">
        {customerTaskStatusLabel(next)}
        <ChevronRight size={13} />
      </FormSubmitButton>
    </form>
  );
}

export function DashboardTaskBoard({
  tasks,
  customers
}: {
  tasks: TaskBoardTask[];
  customers: TaskBoardCustomer[];
}) {
  const [taskItems, setTaskItems] = useState(tasks);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const normalizedTasks = useMemo(
    () =>
      taskItems.map((task) => ({
        ...task,
        normalizedStatus: normalizeCustomerTaskStatus(task.status)
      })),
    [taskItems]
  );
  const activeCount = normalizedTasks.filter((task) => !isClosedCustomerTaskStatus(task.normalizedStatus)).length;

  function moveTaskLocally(taskId: string, status: string) {
    setTaskItems((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status, updatedAt: new Date() } : task))
    );
  }

  function handleDrop(status: string) {
    if (!draggingTaskId) {
      return;
    }

    const task = taskItems.find((item) => item.id === draggingTaskId);

    setDropTargetStatus(null);
    setDraggingTaskId(null);

    if (!task || normalizeCustomerTaskStatus(task.status) === status) {
      return;
    }

    const previousStatus = task.status;
    moveTaskLocally(task.id, status);

    startTransition(async () => {
      const result = await moveDashboardTaskStatusAction(task.id, status);

      if (!result.ok) {
        moveTaskLocally(task.id, previousStatus);
      }
    });
  }

  return (
    <section id="task-board" className="mt-8 rounded-md border border-ink/12 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)]">
      <div className="border-b border-ink/10 px-5 py-5 md:px-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
              <ListChecks size={15} />
              Feladatkezelő
            </div>
            <h2 className="mt-2 text-base font-semibold text-ink">Összes teendő egy helyen</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">
              A határidős munkák blokk marad időrendben. Itt minden létrehozott feladat státusz szerint él tovább, akkor is, ha már lejárt a határideje.
            </p>
          </div>
          <span className="inline-flex h-9 w-fit items-center gap-2 rounded-full bg-ink/5 px-3 text-xs font-semibold text-graphite">
            <CheckCircle2 size={14} />
            {activeCount} aktív
          </span>
        </div>

        <details className="group mt-5 rounded-md border border-dashed border-ink/15 bg-paper">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              Új feladat
            </span>
            <span className="text-xs font-medium text-graphite/60 group-open:hidden">Megnyitás</span>
            <span className="hidden text-xs font-medium text-graphite/60 group-open:inline">Bezárás</span>
          </summary>
          <form action={createDashboardTaskAction} className="grid gap-3 border-t border-ink/10 p-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-graphite">Feladat</span>
              <input
                name="title"
                required
                placeholder="pl. Album rendelés, ügyfél visszahívása..."
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-graphite">Ügyfél</span>
              <select
                name="customerId"
                defaultValue=""
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                <option value="">Belső feladat, nincs ügyfélhez kötve</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.coupleName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Státusz</span>
              <select
                name="status"
                defaultValue="planned"
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_TASK_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Típus</span>
              <select
                name="taskType"
                defaultValue="general"
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_TASK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Prioritás</span>
              <select
                name="priority"
                defaultValue="normal"
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_TASK_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Határidő</span>
              <input
                name="dueDate"
                type="date"
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Időpont</span>
              <input
                name="dueTime"
                type="time"
                className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-graphite">Megjegyzés</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Opcionális belső megjegyzés..."
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <div className="flex items-end xl:col-span-3">
              <FormSubmitButton className="h-10" pendingLabel="Feladat mentése...">
                <Plus size={16} />
                Feladat létrehozása
              </FormSubmitButton>
            </div>
          </form>
        </details>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-4">
        {BOARD_STATUSES.map((status) => {
          const columnTasks = normalizedTasks.filter((task) => task.normalizedStatus === status.value);
          const isDropTarget = dropTargetStatus === status.value;

          return (
            <div
              key={status.value}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTargetStatus(status.value);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                  setDropTargetStatus(null);
                }
              }}
              onDrop={() => handleDrop(status.value)}
              className={`min-h-48 rounded-md border p-3 transition ${statusColumnClass(status.value)} ${
                isDropTarget ? "border-ink/35 bg-brass/10 shadow-inner" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">{status.label}</h3>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-graphite shadow-sm">{columnTasks.length}</span>
              </div>
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", task.id);
                      setDraggingTaskId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingTaskId(null);
                      setDropTargetStatus(null);
                    }}
                    className={`group rounded-md border border-ink/10 bg-white p-3 shadow-sm transition hover:border-ink/25 ${
                      draggingTaskId === task.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <GripVertical className="mt-0.5 shrink-0 text-graphite/35 opacity-0 transition group-hover:opacity-100" size={15} />
                          <p className="font-semibold leading-5 text-ink">{task.title}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-graphite">
                            {customerTaskTypeLabel(task.taskType)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass(task.priority)}`}>
                            {customerTaskPriorityLabel(task.priority)}
                          </span>
                        </div>
                      </div>
                      <form action={deleteDashboardTaskAction.bind(null, task.id)}>
                        <ConfirmSubmitButton
                          message="Biztosan törlöd ezt a feladatot?"
                          variant="ghost"
                          className="h-8 w-8 px-0 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </ConfirmSubmitButton>
                      </form>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-graphite/70">
                      <p className="flex items-center gap-1.5">
                        <UserRound size={13} />
                        {task.customer ? task.customer.coupleName : "Belső feladat"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Clock3 size={13} />
                        {formatDueDate(task)}
                      </p>
                      {task.project ? (
                        <p className="flex items-center gap-1.5">
                          <CalendarClock size={13} />
                          {task.project.title}
                        </p>
                      ) : null}
                    </div>

                    {task.notes ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-graphite/70">{task.notes}</p> : null}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
                      <TaskStatusButton taskId={task.id} status={status.value} />
                      {status.value !== "closed" ? (
                        <form action={updateDashboardTaskStatusAction.bind(null, task.id)}>
                          <input type="hidden" name="status" value="closed" />
                          <FormSubmitButton variant="ghost" className="h-8 px-2 text-xs" pendingLabel="...">
                            Lezárás
                          </FormSubmitButton>
                        </form>
                      ) : (
                        <span className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-sage">
                          <CheckCircle2 size={13} />
                          Lezárva
                        </span>
                      )}
                    </div>
                  </article>
                ))}
                {columnTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-ink/10 bg-white/70 px-3 py-6 text-center text-xs text-graphite/55">
                    Nincs feladat ebben az oszlopban.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
