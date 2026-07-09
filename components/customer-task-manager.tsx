import { CheckCircle2, Clock3, FolderKanban, ListChecks, Plus, Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  createCustomerTaskAction,
  deleteCustomerTaskAction,
  updateCustomerTaskAction,
  updateCustomerTaskStatusAction
} from "@/lib/customer-actions";
import {
  CUSTOMER_TASK_PRIORITIES,
  CUSTOMER_TASK_STATUSES,
  CUSTOMER_TASK_TYPES,
  customerTaskPriorityLabel,
  customerTaskStatusLabel,
  customerTaskTypeLabel,
  isClosedCustomerTaskStatus
} from "@/lib/customer-task-options";
import { APP_TIME_ZONE } from "@/lib/date-format";

type TaskProjectOption = {
  id: string;
  title: string;
};

type CustomerTask = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  dueTime: string | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  project: {
    id: string;
    title: string;
  } | null;
};

function dateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDueDate(task: { dueDate: Date | null; dueTime: string | null }) {
  if (!task.dueDate) {
    return "Nincs határidő";
  }

  const date = task.dueDate.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });

  return task.dueTime ? `${date} · ${task.dueTime}` : date;
}

function isOverdue(task: CustomerTask) {
  if (!task.dueDate || isClosedCustomerTaskStatus(task.status)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return task.dueDate.getTime() < today.getTime();
}

function statusClass(status: string, overdue: boolean) {
  if (overdue) {
    return "bg-red-50 text-red-700";
  }

  if (status === "done") {
    return "bg-sage/10 text-sage";
  }

  if (status === "in_progress") {
    return "bg-brass/10 text-brass";
  }

  if (status === "postponed") {
    return "bg-ink/5 text-graphite";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-ink/5 text-graphite";
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

function ProjectSelect({
  projects,
  defaultValue = ""
}: {
  projects: TaskProjectOption[];
  defaultValue?: string;
}) {
  return (
    <select
      name="projectId"
      defaultValue={defaultValue}
      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
    >
      <option value="">Nincs projekthez kötve</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.title}
        </option>
      ))}
    </select>
  );
}

export function CustomerTaskManager({
  customerId,
  tasks,
  projects
}: {
  customerId: string;
  tasks: CustomerTask[];
  projects: TaskProjectOption[];
}) {
  const openTasks = tasks.filter((task) => !isClosedCustomerTaskStatus(task.status));
  const doneTasks = tasks.filter((task) => isClosedCustomerTaskStatus(task.status));

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <ListChecks size={15} />
              Feladatok
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Teendők és határidők</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              Ide jöhet minden, ami nem önálló projekt: album rendelés, ügyfél hívása, számla ellenőrzése vagy bármilyen apró következő lépés.
            </p>
          </div>
          <span className="inline-flex h-9 w-fit items-center rounded-full bg-ink/5 px-3 text-xs font-medium text-graphite">
            {openTasks.length} nyitott
          </span>
        </div>

        <form action={createCustomerTaskAction.bind(null, customerId)} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-graphite">Feladat</span>
            <input
              name="title"
              required
              placeholder="pl. Album rendelés, ügyfél visszahívása..."
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">Típus</span>
            <select
              name="taskType"
              defaultValue="general"
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
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
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
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
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">Időpont</span>
            <input
              name="dueTime"
              type="time"
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-graphite">Kapcsolódó projekt</span>
            <ProjectSelect projects={projects} />
          </label>
          <input type="hidden" name="status" value="open" />
          <label className="space-y-2 xl:col-span-4">
            <span className="text-sm font-medium text-graphite">Megjegyzés</span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Opcionális belső megjegyzés..."
              className="w-full rounded-md border border-ink/15 bg-paper px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <div className="xl:col-span-4">
            <FormSubmitButton pendingLabel="Feladat mentése...">
              <Plus size={16} />
              Feladat létrehozása
            </FormSubmitButton>
          </div>
        </form>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white p-6 text-sm text-graphite/70">
          Még nincs feladat ennél az ügyfélnél. Ha csak egy teendőt akarsz rögzíteni, nem kell projektet létrehoznod.
        </div>
      ) : (
        <div className="space-y-4">
          {[...openTasks, ...doneTasks].map((task) => {
            const overdue = isOverdue(task);

            return (
              <article key={task.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{task.title}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(task.status, overdue)}`}>
                        {overdue ? "Lejárt" : customerTaskStatusLabel(task.status)}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {customerTaskTypeLabel(task.taskType)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass(task.priority)}`}>
                        {customerTaskPriorityLabel(task.priority)}
                      </span>
                      {task.project ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                          <FolderKanban size={13} />
                          {task.project.title}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-graphite/70">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {formatDueDate(task)}
                      </span>
                      {task.completedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-sage">
                          <CheckCircle2 size={14} />
                          Kész
                        </span>
                      ) : null}
                    </div>
                    {task.notes ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-graphite/70">{task.notes}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {!isClosedCustomerTaskStatus(task.status) ? (
                      <form action={updateCustomerTaskStatusAction.bind(null, customerId, task.id)}>
                        <input type="hidden" name="status" value="done" />
                        <FormSubmitButton variant="secondary" className="h-10 px-3" pendingLabel="Mentés...">
                          <CheckCircle2 size={15} />
                          Kész
                        </FormSubmitButton>
                      </form>
                    ) : null}
                    <form action={deleteCustomerTaskAction.bind(null, customerId, task.id)}>
                      <ConfirmSubmitButton
                        message="Biztosan törlöd ezt a feladatot?"
                        variant="danger"
                        className="h-10 px-3"
                      >
                        <Trash2 size={15} />
                        Törlés
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <details className="group mt-4 rounded-md bg-paper">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
                    <span>Feladat szerkesztése</span>
                    <span className="text-xs text-graphite/60 group-open:hidden">Megnyitás</span>
                    <span className="hidden text-xs text-graphite/60 group-open:inline">Bezárás</span>
                  </summary>
                  <form action={updateCustomerTaskAction.bind(null, customerId, task.id)} className="grid gap-3 border-t border-ink/10 p-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium text-graphite">Feladat</span>
                      <input
                        name="title"
                        required
                        defaultValue={task.title}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Típus</span>
                      <select
                        name="taskType"
                        defaultValue={task.taskType}
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
                      <span className="text-sm font-medium text-graphite">Státusz</span>
                      <select
                        name="status"
                        defaultValue={task.status}
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
                      <span className="text-sm font-medium text-graphite">Prioritás</span>
                      <select
                        name="priority"
                        defaultValue={task.priority}
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
                        defaultValue={dateInputValue(task.dueDate)}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Időpont</span>
                      <input
                        name="dueTime"
                        type="time"
                        defaultValue={task.dueTime ?? ""}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Kapcsolódó projekt</span>
                      <ProjectSelect projects={projects} defaultValue={task.project?.id ?? ""} />
                    </label>
                    <label className="space-y-2 xl:col-span-4">
                      <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={task.notes ?? ""}
                        className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <div className="xl:col-span-4">
                      <FormSubmitButton variant="secondary" className="h-10" pendingLabel="Mentés...">
                        Feladat mentése
                      </FormSubmitButton>
                    </div>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
