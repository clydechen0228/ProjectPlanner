import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Task, INITIAL_TASKS, TaskVersion } from '../types';

// Initialize Yjs Document
const doc = new Y.Doc();

// Use a Map for tasks for easier CRUD operations by ID
// We store stringified IDs as keys
// V4: Fresh start with new keys to ensure no legacy conflicts
const yTasks = doc.getMap<Task>('tasks_v4'); 

// Use an Array for shared version history (Snapshots)
const yVersions = doc.getArray<string>('versions_v4');

// Connect to WebRTC (Peer-to-Peer)
// V4: New Room Name
const ROOM_NAME = 'mdm-cutover-planner-room-v4'; 

const provider = new WebrtcProvider(ROOM_NAME, doc, {
    // Extensive list of public signaling servers to ensure connectivity
    // If one fails, others will be tried
    signaling: [
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com', 
        'wss://y-webrtc-signaling-us.herokuapp.com',
        'wss://signaling.yjs.dev'
    ],
    // EXTREMELY IMPORTANT: Add STUN servers to allow NAT traversal (connecting behind routers/firewalls)
    peerOpts: {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    },
    password: null,
});

// Connect to IndexedDB for offline persistence
const persistence = new IndexeddbPersistence('mdm-cutover-yjs-v4', doc);

// Initial Data Seeding
persistence.on('synced', () => {
    // Only seed if empty AND we are not receiving data from peers (simple heuristic)
    if (yTasks.size === 0) {
        doc.transact(() => {
             INITIAL_TASKS.forEach(task => {
                 yTasks.set(task.id.toString(), task);
             });
        });
    }
});

// Helper to convert Y.Map/Y.Array to plain JS Objects
const getTasksArray = (): Task[] => {
    const jsonMap = yTasks.toJSON() as Record<string, Task>;
    return Object.values(jsonMap);
};

// Store Service Export
export const store = {
    doc,
    provider,
    persistence,
    
    // Subscribe to changes
    subscribe: (callback: (tasks: Task[]) => void) => {
        const handler = () => {
            callback(getTasksArray());
        };
        yTasks.observe(handler);
        // Initial call
        callback(getTasksArray());
        return () => yTasks.unobserve(handler);
    },

    // Subscribe to awareness (peer count)
    subscribeAwareness: (callback: (count: number, status: string) => void) => {
        const awarenessHandler = () => {
            // Check connected status
            // Note: provider.connected refers to Signaling Server connection
            const state = provider.awareness.getStates();
            callback(state.size, provider.connected ? 'connected' : 'disconnected');
        };
        
        const statusHandler = ({ status }: { status: string }) => {
            // 'connected', 'connecting', 'disconnected'
            const state = provider.awareness.getStates();
            callback(state.size, status);
        };

        provider.awareness.on('change', awarenessHandler);
        provider.on('status', statusHandler);
        
        // Initial
        callback(provider.awareness.getStates().size, provider.connected ? 'connected' : 'connecting');
        
        return () => {
            provider.awareness.off('change', awarenessHandler);
            provider.off('status', statusHandler);
        };
    },

    // --- Task Operations ---
    addTask: (task: Task) => {
        doc.transact(() => {
            yTasks.set(task.id.toString(), task);
        });
    },

    updateTask: (task: Task) => {
        doc.transact(() => {
            yTasks.set(task.id.toString(), task);
        });
    },

    deleteTask: (id: number) => {
        doc.transact(() => {
            yTasks.delete(id.toString());
        });
    },
    
    // Batch operations
    replaceAllTasks: (tasks: Task[]) => {
        doc.transact(() => {
            // clear map
            const keys = Array.from(yTasks.keys());
            keys.forEach(k => yTasks.delete(k));
            
            // add new
            tasks.forEach(task => {
                yTasks.set(task.id.toString(), task);
            });
        });
    },

    resetToDefault: () => {
        doc.transact(() => {
            const keys = Array.from(yTasks.keys());
            keys.forEach(k => yTasks.delete(k));
            INITIAL_TASKS.forEach(task => {
                yTasks.set(task.id.toString(), task);
            });
        });
    },

    // --- Version/Snapshot Operations (Shared) ---
    
    subscribeVersions: (callback: (versions: TaskVersion[]) => void) => {
        const handler = () => {
            const arr = yVersions.toArray();
            const parsedVersions: TaskVersion[] = [];
            
            arr.forEach(vStr => {
                try {
                    // Handle case where it might be a String object or primitive string
                    const str = typeof vStr === 'string' ? vStr : String(vStr);
                    const parsed = JSON.parse(str);
                    if (parsed && parsed.name && Array.isArray(parsed.tasks)) {
                        parsedVersions.push(parsed);
                    }
                } catch (e) {
                    console.warn("Failed to parse version entry", e);
                }
            });
            
            callback(parsedVersions);
        };
        
        yVersions.observe(handler);
        // Trigger initial
        handler();
        
        return () => yVersions.unobserve(handler);
    },

    addVersion: (name: string, tasks: Task[]) => {
        doc.transact(() => {
            const version: TaskVersion = {
                id: Date.now(),
                name,
                createdAt: new Date().toISOString(),
                tasks: JSON.parse(JSON.stringify(tasks)) // Deep copy
            };
            // Use insert(0) to put at top
            yVersions.insert(0, [JSON.stringify(version)]); 
        });
    },

    deleteVersion: (id: number) => {
        doc.transact(() => {
            const arr = yVersions.toArray();
            let indexToDelete = -1;
            
            for(let i=0; i<arr.length; i++) {
                try {
                    const v = JSON.parse(arr[i]) as TaskVersion;
                    if (v.id === id) {
                        indexToDelete = i;
                        break;
                    }
                } catch (e) { }
            }

            if (indexToDelete !== -1) {
                yVersions.delete(indexToDelete, 1);
            }
        });
    }
};