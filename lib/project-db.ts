import { openDB } from "idb";
import type { Project } from "@/types/editor";

const DB_NAME = "isoforge-projects";
const STORE_NAME = "projects";

export async function saveProject(project: Project): Promise<void> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
  await db.put(STORE_NAME, project);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
  return db.get(STORE_NAME, id);
}
