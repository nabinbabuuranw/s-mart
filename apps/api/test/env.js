const fs = require('fs'); const path = require('path'); const os = require('os');
const f = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for tests (a database whose name contains "test")');
if (!/test/.test(new URL(process.env.TEST_DATABASE_URL).pathname)) throw new Error('Refusing to run tests against a database without "test" in its name');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'smart-test-uploads');
process.env.BACKUP_DIR = path.join(os.tmpdir(), 'smart-test-backups');
process.env.RATE_LIMIT_GLOBAL = '100000';
process.env.PATH = '/usr/lib/postgresql/15/bin:' + process.env.PATH;
