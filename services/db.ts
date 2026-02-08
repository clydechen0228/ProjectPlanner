import { Task, TaskVersion, INITIAL_TASKS } from '../types';

const DB_NAME = 'MDMCutoverDB';
const DB_VERSION = 2; // Incremented for new store
const STORE_TASKS = 'tasks';
const STORE_VERSIONS = 'versions';

class CutoverDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB error:", event);
        reject("Could not open database");
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Tasks Store
        if (!db.objectStoreNames.contains(STORE_TASKS)) {
          const store = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
          INITIAL_TASKS.forEach(task => {
            store.put(task);
          });
        }

        // Versions Store
        if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
          db.createObjectStore(STORE_VERSIONS, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  // --- Task Operations ---

  async getAllTasks(): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      
      const transaction = this.db.transaction([STORE_TASKS], 'readonly');
      const store = transaction.objectStore(STORE_TASKS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");

      const transaction = this.db.transaction([STORE_TASKS], 'readwrite');
      const store = transaction.objectStore(STORE_TASKS);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      
      const transaction = this.db.transaction([STORE_TASKS], 'readwrite');
      const store = transaction.objectStore(STORE_TASKS);
      
      // Clear existing current tasks to match exact state of imported/restored data
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      tasks.forEach(task => store.put(task));
    });
  }

  async deleteTask(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");

      const transaction = this.db.transaction([STORE_TASKS], 'readwrite');
      const store = transaction.objectStore(STORE_TASKS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async resetData(): Promise<void> {
    return new Promise((resolve, reject) => {
       if (!this.db) return reject("Database not initialized");
       const transaction = this.db.transaction([STORE_TASKS], 'readwrite');
       const store = transaction.objectStore(STORE_TASKS);
       const clearRequest = store.clear();
       
       clearRequest.onsuccess = () => {
          // Re-seed
          let completed = 0;
          if (INITIAL_TASKS.length === 0) resolve();
          
          INITIAL_TASKS.forEach(task => {
            const req = store.put(task);
            req.onsuccess = () => {
                completed++;
                if (completed === INITIAL_TASKS.length) resolve();
            }
          });
       }
       clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // --- Version Operations ---

  async saveVersion(name: string, tasks: Task[]): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!this.db) return reject("Database not initialized");
        const transaction = this.db.transaction([STORE_VERSIONS], 'readwrite');
        const store = transaction.objectStore(STORE_VERSIONS);
        
        const version: TaskVersion = {
            name,
            createdAt: new Date().toISOString(),
            tasks
        };

        const request = store.add(version);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }

  async getVersions(): Promise<TaskVersion[]> {
    return new Promise((resolve, reject) => {
        if (!this.db) return reject("Database not initialized");
        const transaction = this.db.transaction([STORE_VERSIONS], 'readonly');
        const store = transaction.objectStore(STORE_VERSIONS);
        const request = store.getAll();
        
        request.onsuccess = () => {
            // Sort by createdAt descending
            const versions = request.result as TaskVersion[];
            versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            resolve(versions);
        };
        request.onerror = () => reject(request.error);
    });
  }

  async deleteVersion(id: number): Promise<void> {
     return new Promise((resolve, reject) => {
        if (!this.db) return reject("Database not initialized");
        const transaction = this.db.transaction([STORE_VERSIONS], 'readwrite');
        const store = transaction.objectStore(STORE_VERSIONS);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
     });
  }
}

export const dbService = new CutoverDB();