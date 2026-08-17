const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'ciclo_via.db');

let sqlDb = null;

function saveDb() {
  if (sqlDb) {
    const data = sqlDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

function prepare(sql) {
  return {
    get(...params) {
      const stmt = sqlDb.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const stmt = sqlDb.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
    run(...params) {
      sqlDb.run(sql, params);
      saveDb();
      const changes = sqlDb.getRowsModified();
      return { changes, lastInsertRowid: lastInsertId() };
    }
  };
}

function exec(sql) {
  sqlDb.exec(sql);
  saveDb();
}

function lastInsertId() {
  const stmt = sqlDb.prepare('SELECT last_insert_rowid() as id');
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row.id;
  }
  stmt.free();
  return 0;
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      institucion TEXT NOT NULL DEFAULT '',
      horas_completadas REAL NOT NULL DEFAULT 0,
      horas_totales REAL NOT NULL DEFAULT 480,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      horas REAL NOT NULL DEFAULT 0,
      observacion TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (estudiante_id) REFERENCES users(id)
    )
  `);

  try {
    sqlDb.run(`ALTER TABLE users ADD COLUMN institucion TEXT NOT NULL DEFAULT ''`);
  } catch (e) {}

  saveDb();

  return { prepare, exec };
}

module.exports = { initDatabase, prepare, exec, saveDb };
