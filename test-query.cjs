const { executeQuery } = require('./src/backend/src/config/database-api.js');
async function test() {
  await executeQuery(`EXPLAIN PLAN FOR SELECT DISTINCT PLATFORM_CLASS FROM APP_CMS.VIEW_TSK_LIST_TASK WHERE WMS_OUTBOUND_TIME >= TO_DATE('2024-03-01 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AND WMS_OUTBOUND_TIME <= TO_DATE('2024-03-31 23:59:59', 'YYYY-MM-DD HH24:MI:SS') AND PLATFORM_CLASS IS NOT NULL`);
  const res = await executeQuery(`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY)`);
  console.log(res.rows.map(r => r[0]).join('\n'));
}
test().catch(console.error);
