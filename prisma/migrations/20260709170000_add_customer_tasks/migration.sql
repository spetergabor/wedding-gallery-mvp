CREATE TABLE "CustomerTask" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" TIMESTAMP(3),
    "dueTime" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerTask_customerId_idx" ON "CustomerTask"("customerId");
CREATE INDEX "CustomerTask_projectId_idx" ON "CustomerTask"("projectId");
CREATE INDEX "CustomerTask_taskType_idx" ON "CustomerTask"("taskType");
CREATE INDEX "CustomerTask_status_idx" ON "CustomerTask"("status");
CREATE INDEX "CustomerTask_priority_idx" ON "CustomerTask"("priority");
CREATE INDEX "CustomerTask_dueDate_idx" ON "CustomerTask"("dueDate");

ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTask" ADD CONSTRAINT "CustomerTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
