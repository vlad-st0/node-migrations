require('dotenv').config();

const drivers = {
  default: 'mysql',
  mysql: 'mysql',
  pg: 'pg',
  psql: 'pg',
  postgre: 'pg',
  postgresql: 'pg',
};

const driverName = drivers[process.env.DB_DRIVER?.toLowerCase() ?? 'default'];
if (!driverName) throw new Error('Unsupported database driver');
const driver = require(`./${driverName}`);

async function migrate() {
  await driver.migrate();
}

async function rollback() {
  await driver.rollback();
}

async function refresh() {
  await driver.refresh();
}

async function fresh() {
  await driver.fresh();
}

async function seed() {
  await driver.seed();
}

module.exports = {
  migrate,
  rollback,
  refresh,
  fresh,
  seed,
};
