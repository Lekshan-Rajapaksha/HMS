const mysql = require('mysql2/promise');
const fs = require('fs');

async function runSQLFile() {
  const connection = await mysql.createConnection({
    host: 'shortline.proxy.rlwy.net',  // e.g., 'roundhouse.proxy.rlwy.net'
    port: 19136,                     // The public port (NOT 3306)
    user: 'root',
    password: 'eUPmSrkApsXdSOvZsRzTifuOCXXZJHPJ',
    database: 'railway',
    multipleStatements: true
  });

  try {
    const sqlFile = fs.readFileSync('database.sql', 'utf8');
    
    console.log('📂 Reading database.sql...');
    console.log('🚀 Executing SQL statements...');
    
    await connection.query(sqlFile);
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runSQLFile();