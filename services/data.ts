import { Task } from '../types';

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8081/api'
    : `${window.location.protocol}//${window.location.hostname}:8081/api`;

export const dataService = {
    async getTasks(): Promise<Task[]> {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
    },

    async saveTask(task: Task): Promise<{ id?: number }> {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
        });
        if (!response.ok) throw new Error('Failed to save task');
        return response.json();
    },

    async deleteTask(id: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete task');
    },

    async syncTasks(tasks: Task[]): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/tasks/sync`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tasks),
        });
        if (!response.ok) throw new Error('Failed to sync tasks');
    },

    async resetData(): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/tasks/reset`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to reset data');
    }
};
