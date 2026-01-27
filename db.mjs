import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { randomBytes } from 'crypto'
import * as permissions from "./permissions.mjs"

export async function load() {
    global.db =  await mysql.createPool({
        host: global.config.database.host,
        port: global.config.database.port,
        user: global.config.database.user,
        password: global.config.database.password,
        database: global.config.database.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });
    await createTables();
}

async function createTables() {
    const [tablesDb] = await global.db.query(`SELECT table_name AS 'table' FROM information_schema.tables WHERE table_schema = '${global.config.database.database}'`);
    const tables = tablesDb.map(a => a.table)

    if(!tables.includes("settings")) {
        await global.db.execute(`
            CREATE TABLE settings (
	            name varchar(100) NOT NULL,
	            value TEXT NULL,
	            CONSTRAINT settings_pk PRIMARY KEY (name)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
            COLLATE=utf8mb4_general_ci;`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("db_version", "1")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("lang", "en_us")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("bcrypt_salt_rounds", "13")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("jwt_key", ?)`, [randomBytes(12).toString("hex")])
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("default_password", "changeme")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("anti_password_recycle_count", "10")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("internal_id_required", "0")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("default_permissions", ?)`, [permissions.CHANGE_EMAIL + permissions.CHANGE_PASSWORD])
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("mifare_key", ?)`, [randomBytes(6).toString("hex")])
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("company_name", "OpenClocking")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("company_domain", "openclocking.com")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("service_url", "https://demo.openclocking.com")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("first_login", "1")`)
        await global.db.execute(`INSERT INTO settings (name, value) VALUES ("setup_step", "1")`)
    }
    if(!tables.includes("users")) {
        await global.db.execute(`
            CREATE TABLE users (
            	id INT auto_increment NOT NULL,
            	first_name TEXT NULL,
            	last_name TEXT NULL,
            	display_name TEXT NULL,
                email varchar(320) NULL,
                password_hash varchar(72) NULL,
                password_history TEXT NULL,
            	permissions BIGINT DEFAULT 0 NOT NULL,
            	internal_id varchar(100) NULL,
            	admin_only TINYINT(1) DEFAULT 0 NOT NULL,
                change_password TINYINT(1) DEFAULT 0 NOT NULL,
            	CONSTRAINT users_pk PRIMARY KEY (id),
            	CONSTRAINT users_unique UNIQUE KEY (internal_id),
                CONSTRAINT email_unique UNIQUE KEY (email)
            )
            ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
            COLLATE=utf8mb4_general_ci;`)
        const [settingsDb] = await global.db.query(`SELECT * FROM settings`)
        const settings = Object.fromEntries(
            settingsDb.map(({ name, value }) => [name, value])
        );
        const password_bcrypt = await bcrypt.hash(settings.default_password, parseInt(settings.bcrypt_salt_rounds))
        await global.db.execute(`INSERT INTO users (display_name, email, password_hash, password_history, permissions, admin_only, change_password) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [
                "OpenClocking Manager",
                "manager@openclocking.com",
                password_bcrypt,
                JSON.stringify([password_bcrypt]),
                permissions.ALL,
                1,
                1
            ])
    }
}