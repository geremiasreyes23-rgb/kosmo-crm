-- CreateTable
CREATE TABLE "RoleModuleVisibility" (
    "roleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleModuleVisibility_pkey" PRIMARY KEY ("roleId","moduleKey")
);

-- AddForeignKey
ALTER TABLE "RoleModuleVisibility" ADD CONSTRAINT "RoleModuleVisibility_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
