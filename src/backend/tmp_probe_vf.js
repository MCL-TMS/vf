(async () => {
  try {
    const login = await fetch('http://localhost:3011/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'vf_user', password: '654321' })
    });
    const ld = await login.json();
    const t0 = Date.now();
    const r = await fetch('http://localhost:3011/api/overview/kpi?dateFrom=2026-04-01&dateTo=2026-04-10&selfFlag=Y', {
      headers: { Authorization: 'Bearer ' + ld.token }
    });
    const d = await r.json();
    console.log(JSON.stringify({ loginStatus: login.status, loginSuccess: ld.success, kpiStatus: r.status, elapsedMs: Date.now()-t0, success: d.success, hasKpi: !!d?.data?.kpi, totalOrders: d?.data?.kpi?.totalOrders, code: d.code, error: d.error }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ err: e.message }, null, 2));
  }
})();
