require('dotenv').config();
const jwt = require('jsonwebtoken');
(async () => {
  try {
    const token = jwt.sign({ userId:'admin_probe', userName:'admin_probe', customerNo:'all', customerNos:[], isAdmin:true }, process.env.JWT_SECRET, { expiresIn:'1h' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60000);
    const t0 = Date.now();
    const r = await fetch('http://localhost:3011/api/overview/kpi?dateFrom=2026-04-01&dateTo=2026-04-10&selfFlag=Y', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal
    });
    const d = await r.json().catch(() => null);
    console.log(JSON.stringify({ kpiStatus: r.status, elapsedMs: Date.now()-t0, success: d?.success, hasKpi: !!d?.data?.kpi, totalOrders: d?.data?.kpi?.totalOrders, code: d?.code, error: d?.error }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ errorType: e.name, error: e.message }, null, 2));
  }
})();
