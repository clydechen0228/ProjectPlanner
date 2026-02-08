import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8081;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ProjectPlanner'
});

app.use(cors());
app.use(express.json());

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY display_order ASC');
        const tasks = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            start: row.start_date.toISOString().split('T')[0],
            end: row.end_date.toISOString().split('T')[0],
            type: row.type,
            status: row.status,
            owner: row.owner,
            dependencies: row.dependencies,
            order: row.display_order,
            parentId: row.parent_id,
            isExpanded: row.is_expanded
        }));
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update or Create task
app.post('/api/tasks', async (req, res) => {
    const { id, name, start, end, type, status, owner, dependencies, order, parentId, isExpanded } = req.body;
    try {
        if (id) {
            // Update
            await pool.query(
                'INSERT INTO tasks (id, name, start_date, end_date, type, status, owner, dependencies, display_order, parent_id, is_expanded) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ' +
                'ON CONFLICT (id) DO UPDATE SET ' +
                'name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, ' +
                'type = EXCLUDED.type, status = EXCLUDED.status, owner = EXCLUDED.owner, ' +
                'dependencies = EXCLUDED.dependencies, display_order = EXCLUDED.display_order, ' +
                'parent_id = EXCLUDED.parent_id, is_expanded = EXCLUDED.is_expanded',
                [id, name, start, end, type, status, owner, dependencies, order, parentId, isExpanded]
            );
        } else {
            // Create new
            const result = await pool.query(
                'INSERT INTO tasks (name, start_date, end_date, type, status, owner, dependencies, display_order, parent_id, is_expanded) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
                [name, start, end, type, status, owner, dependencies, order, parentId, isExpanded]
            );
            return res.json({ id: result.rows[0].id });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Bulk update (Sync all)
app.put('/api/tasks/sync', async (req, res) => {
    const tasks = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // For simplicity, we can truncate and re-insert or use upsert
        // User data is small enough for now, let's use upsert in a loop or a more complex query
        // Here we'll just delete and re-insert for a clean sync if requested, 
        // but better to upsert provided tasks.
        for (const task of tasks) {
            await client.query(
                'INSERT INTO tasks (id, name, start_date, end_date, type, status, owner, dependencies, display_order, parent_id, is_expanded) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ' +
                'ON CONFLICT (id) DO UPDATE SET ' +
                'name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, ' +
                'type = EXCLUDED.type, status = EXCLUDED.status, owner = EXCLUDED.owner, ' +
                'dependencies = EXCLUDED.dependencies, display_order = EXCLUDED.display_order, ' +
                'parent_id = EXCLUDED.parent_id, is_expanded = EXCLUDED.is_expanded',
                [task.id, task.name, task.start, task.end, task.type, task.status, task.owner, task.dependencies, task.order, task.parentId, task.isExpanded]
            );
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset data (Delete all and optionally seed)
app.post('/api/tasks/reset', async (req, res) => {
    try {
        await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Backend service running on port ${port}`);
});
