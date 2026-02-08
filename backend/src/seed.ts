import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const INITIAL_TASKS = [
    { id: 1, name: '预切换准备与演练', start: '2025-03-17', end: '2025-03-23', type: 'prep', status: 'done', owner: 'PMO', dependencies: [], order: 0, isExpanded: true },
    { id: 2, name: '数据冻结与系统停机', start: '2025-03-24', end: '2025-03-24', type: 'cutover', status: 'todo', owner: '运维组', dependencies: [1], order: 1, isExpanded: true },
    { id: 3, name: '上游系统接入 (第一周: ERP/HR)', start: '2025-03-24', end: '2025-03-30', type: 'upstream', status: 'todo', owner: '上游开发组', dependencies: [2], order: 2, isExpanded: true },
    { id: 4, name: '上游系统接入 (第二周: CRM/外部数据)', start: '2025-03-31', end: '2025-04-06', type: 'upstream', status: 'todo', owner: '上游开发组', dependencies: [3], order: 3, isExpanded: true },
    { id: 5, name: 'MDM 生产环境核心上线 (Go-Live)', start: '2025-03-31', end: '2025-03-31', type: 'milestone', status: 'todo', owner: 'MDM团队', dependencies: [4], order: 4, isExpanded: true },
    { id: 6, name: '下游接入 Batch 1: 财务报表系统', start: '2025-03-31', end: '2025-04-06', type: 'downstream', status: 'todo', owner: '下游组A', dependencies: [5], order: 5, isExpanded: true },
    { id: 7, name: '下游接入 Batch 2: 营销分析平台', start: '2025-04-07', end: '2025-04-13', type: 'downstream', status: 'todo', owner: '下游组B', dependencies: [6], order: 6, isExpanded: true },
    { id: 8, name: '下游接入 Batch 3: 供应链执行系统', start: '2025-04-14', end: '2025-04-20', type: 'downstream', status: 'todo', owner: '下游组C', dependencies: [7], order: 7, isExpanded: true },
    { id: 9, name: '下游接入 Batch 4: 历史归档与全渠道同步', start: '2025-04-21', end: '2025-04-27', type: 'downstream', status: 'todo', owner: '下游组D', dependencies: [8], order: 8, isExpanded: true },
    { id: 10, name: '上线后保障与项目收尾', start: '2025-04-28', end: '2025-05-04', type: 'prep', status: 'todo', owner: '全组', dependencies: [9], order: 9, isExpanded: true },
];

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ProjectPlanner'
});

async function seed() {
    try {
        for (const task of INITIAL_TASKS) {
            await pool.query(
                'INSERT INTO tasks (id, name, start_date, end_date, type, status, owner, dependencies, display_order, is_expanded) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING',
                [task.id, task.name, task.start, task.end, task.type, task.status, task.owner, task.dependencies, task.order, task.isExpanded]
            );
        }
        console.log('Seeding completed');
    } catch (err) {
        console.error('Seeding failed', err);
    } finally {
        await pool.end();
    }
}

seed();
