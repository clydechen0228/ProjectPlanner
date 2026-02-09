const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL
});
client.connect()
    .then(() => {
        console.log("Connected Successfully");
        return client.query('SELECT current_database(), current_user');
    })
    .then(res => {
        console.log("Details:", res.rows[0]);
        client.end();
    })
    .catch(err => {
        console.error("Connection Failed!");
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);
        process.exit(1);
    });
