import { requireUser, canViewAll } from "@/lib/auth";
import { getRelatedEntityOptions } from "@/lib/relatedRecords";
import { getTasksForUser, getAssignableUsers } from "./data";
import { TasksView } from "./TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const viewAll = canViewAll(user);
  const [tasks, relatedOptions, assignableUsers] = await Promise.all([
    getTasksForUser(user),
    getRelatedEntityOptions(user),
    viewAll ? getAssignableUsers() : Promise.resolve([]),
  ]);

  return (
    <TasksView
      initialTasks={tasks}
      relatedOptions={relatedOptions}
      assignableUsers={assignableUsers}
      canAssignOthers={viewAll}
    />
  );
}
