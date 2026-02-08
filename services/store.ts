import { Task, INITIAL_TASKS, TaskVersion } from '../types';
import { dataService } from './data';

// Mimic the old store structure but with backend persistence
let currentTasks: Task[] = [];
const subscribers: ((tasks: Task[]) => void)[] = [];

const notify = () => {
    subscribers.forEach(cb => cb([...currentTasks]));
};

export const store = {
    // Subscribe to changes
    subscribe: (callback: (tasks: Task[]) => void) => {
        subscribers.push(callback);
        // Initial load
        dataService.getTasks().then(tasks => {
            currentTasks = tasks.length > 0 ? tasks : INITIAL_TASKS;
            // If we used defaults because DB was empty, sync them to DB once
            if (tasks.length === 0) {
                dataService.syncTasks(INITIAL_TASKS);
            }
            notify();
        }).catch(err => {
            console.error("Failed to fetch initial tasks", err);
            currentTasks = INITIAL_TASKS;
            notify();
        });

        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    },

    // Awareness (Optional, can be mocked or removed if not needed)
    subscribeAwareness: (callback: (count: number, status: string) => void) => {
        // Just mock it as online
        callback(1, 'connected');
        return () => { };
    },

    // --- Task Operations ---
    addTask: async (task: Task) => {
        try {
            const { id } = await dataService.saveTask(task);
            if (id) task.id = id;
            currentTasks.push(task);
            notify();
        } catch (err) {
            console.error(err);
        }
    },

    updateTask: async (task: Task) => {
        try {
            await dataService.saveTask(task);
            const index = currentTasks.findIndex(t => t.id === task.id);
            if (index > -1) {
                currentTasks[index] = task;
                notify();
            }
        } catch (err) {
            console.error(err);
        }
    },

    deleteTask: async (id: number) => {
        try {
            await dataService.deleteTask(id);
            currentTasks = currentTasks.filter(t => t.id !== id);
            notify();
        } catch (err) {
            console.error(err);
        }
    },

    // Batch operations
    replaceAllTasks: async (tasks: Task[]) => {
        try {
            await dataService.syncTasks(tasks);
            currentTasks = tasks;
            notify();
        } catch (err) {
            console.error(err);
        }
    },

    resetToDefault: async () => {
        try {
            await dataService.resetData();
            await dataService.syncTasks(INITIAL_TASKS);
            currentTasks = INITIAL_TASKS;
            notify();
        } catch (err) {
            console.error(err);
        }
    },

    // --- Version Operations (Simplified for now) ---
    subscribeVersions: (callback: (versions: TaskVersion[]) => void) => {
        // Versioning could be moved to backend too, but keeping it local or simple for now
        callback([]);
        return () => { };
    },

    addVersion: (name: string, tasks: Task[]) => {
        // Implement backend versioning if needed
    },

    deleteVersion: (id: number) => {
        // Implement backend versioning if needed
    }
};