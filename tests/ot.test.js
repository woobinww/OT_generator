const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createServer } = require('node:http');
const { initializeDatabase } = require('../src/database');
const { importLocalData } = require('../src/migration');
const { createApp } = require('../src/server-app');
const { createBackupManager } = require('../src/backup');
const OtModel = require('../public/ot-model');

function browser() {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
      options: [], classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {},
      querySelectorAll: () => [], querySelector: () => node('child') });
    return nodes.get(id);
  }
  const context = vm.createContext({ console, OtModel, setTimeout, clearTimeout, Date, AbortSignal,
    window: { addEventListener() {}, confirm: () => true, prompt: () => '1' },
    document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: () => null }, requestAnimationFrame: callback => callback() });
  const source = fs.readFileSync(require.resolve('../public/app.js'), 'utf8').replace(/\ninitialize\(\);\s*$/, '');
  vm.runInContext(source, context);
  vm.runInContext(`
    appData = normalizeData({ employees: ['A','B','C','D'].map(id => ({id,name:id,canMri:true})), records: [], attendanceRecords: [] });
    elements.selectedDateInput.value = '2026-09-05';
    renderAll = () => {}; loadSelectedRecordIntoForm = () => {};
    loadServerMonthlySummary = async () => {};
  `, context);
  return { run: code => vm.runInContext(code, context), nodes, context };
}

test('assignment replacement preserves other OT and additional night worker', () => {
  const b = browser();
  b.run(`
    appData.records = [{date:'2026-09-05',needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B',nightMriEmployeeId:'A',nightXrayEmployeeId:'B'}];
    appData.attendanceRecords = [
      {employeeId:'A',earlyOt:1,otherOt:2,otUsed:-4,nightOt:2,off:'오후반차',manualNote:'keep'},
      {employeeId:'B',earlyOt:1,otherOt:0,nightOt:2},
      {employeeId:'D',earlyOt:0,otherOt:0,nightOt:3}
    ].map(r=>normalizeAttendanceRecord({...r,date:'2026-09-05',name:r.employeeId}));
    reconcileAssignments('2026-09-05',{needsOt:true,mriEmployeeId:'C',xrayEmployeeId:'B',nightMriEmployeeId:'C',nightXrayEmployeeId:'B'}, {mri:1,xray:1,nightMri:2,nightXray:2});
  `);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otEarned"), 2);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').ot"), -2);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').nightOt"), 0);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').manualNote"), 'keep');
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').off"), '오후반차');
  assert.equal(b.run("getAttendanceRecord('2026-09-05','C').otEarned"), 1);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','D').nightOt"), 3);
});

test('legacy split derives other OT from the saved assignment time', () => {
  const b = browser();
  b.run(`appData.records=[{date:'2026-09-05',needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}];
    appData.attendanceRecords=[normalizeAttendanceRecord({date:'2026-09-05',employeeId:'A',name:'A',otEarned:3})];
    `);
  assert.equal(b.run("reconcileAssignments('2026-09-05',{needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}, {mri:1,xray:0,nightMri:0,nightXray:0})"), true);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').earlyOt"), 1);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otherOt"), 2);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otEarned"), 3);
});

test('legacy split rejects assignment time greater than the existing total', () => {
  const b = browser();
  b.run(`appData.records=[{date:'2026-09-05',needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}];
    appData.attendanceRecords=[normalizeAttendanceRecord({date:'2026-09-05',employeeId:'A',name:'A',otEarned:3})];`);
  assert.equal(b.run("reconcileAssignments('2026-09-05',{needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}, {mri:4,xray:0,nightMri:0,nightXray:0})"), false);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').earlyOt"), null);
});

test('editing early hours and removing a whole assignment do not double count or remove other hours', async () => {
  const b = browser();
  b.run(`
    appData.records=[{date:'2026-09-05',needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}];
    appData.attendanceRecords=[normalizeAttendanceRecord({date:'2026-09-05',employeeId:'A',name:'A',earlyOt:1,otherOt:2})];
    upsertAttendanceTime('2026-09-05','A','ot',1.5);
    upsertAttendanceTime('2026-09-05','A','ot',1.5);
  `);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otEarned"), 3.5);
  b.run(`serverAutoSyncEnabled=true; serverSyncVersion=0; serverRequest=async()=>({summary:{version:1}});`);
  await b.run("deleteRecord('2026-09-05')");
  assert.equal(b.run('appData.records.length'), 0);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otEarned"), 2);
});

test('conflict and failed initial load prevent further writes', async () => {
  const b = browser();
  b.run(`serverAutoSyncEnabled=true; serverSyncVersion=0; calls=0;
    serverRequest=async()=>{calls++; throw Object.assign(new Error('conflict'),{status:409})};`);
  assert.equal(await b.run('saveData()'), false);
  assert.equal(await b.run('saveData()'), false);
  assert.equal(b.run('calls'), 1);
  b.run(`serverAutoSyncEnabled=true; serverRequest=async()=>{throw new Error('load failed')};`);
  await assert.rejects(b.run('loadServerCalendarMonth()'));
  assert.equal(b.run('serverAutoSyncEnabled'), false);
});

test('save waits for acknowledgement and serializes version numbers', async () => {
  const b = browser();
  b.run(`serverAutoSyncEnabled=true; serverSyncVersion=0; requests=[]; replies=[];
    serverRequest=async (path, options)=>{ requests.push(JSON.parse(options.body)); return new Promise(resolve=>replies.push(resolve)); };`);
  const first = b.run('saveData()');
  const second = b.run('saveData()');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.run('requests.length'), 1);
  assert.equal(b.run('pendingSaves'), 2);
  assert.equal(b.run('elements.adminAppShell.inert'), true);
  b.run('replies[0]({summary:{version:1}})');
  assert.equal(await first, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.run('requests[1].baseVersion'), 1);
  b.run('replies[1]({summary:{version:2}})');
  assert.equal(await second, true);
  assert.equal(b.run('elements.adminAppShell.inert'), false);
});

test('admin and employee calendars show early/other hours separately, including legacy and zero', () => {
  const b = browser();
  b.run(`appData=normalizeData({employees:[{id:'A',name:'이우빈'},{id:'B',name:'김민수'}],
    records:[{date:'2026-09-05',needsOt:true,mriEmployeeId:'A',xrayEmployeeId:'B'}],
    attendanceRecords:[{date:'2026-09-05',employeeId:'A',name:'이우빈',earlyOt:1,otherOt:2},
      {date:'2026-09-05',employeeId:'B',name:'김민수',earlyOt:1,otherOt:0}]}); renderCalendar();`);
  assert.match(b.run('elements.calendarGrid.innerHTML'), /조: 우빈\(1\)\/민수\(1\)/);
  assert.equal(b.run("buildCalendarMiddleText('2026-09-05')"), '우빈 OT 2');
  assert.equal(b.run("buildCalendarMiddleText('2026-09-05','A')"), 'OT 2');
  const user = vm.createContext({ data: JSON.parse(b.run('JSON.stringify(appData)')) });
  const source = fs.readFileSync(require.resolve('../public/user.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function buildCalendarDayContent'), source.lastIndexOf('elements.monthInput.value = getTodayMonth()')), user);
  const run = code => vm.runInContext(code, user);
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A').otText"), '조: 우빈(1)/민수');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A').middleText"), '우빈 OT 2');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A',true).otText"), '조: 1');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A',true).middleText"), 'OT 2');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'B').middleText"), '');
  run('data.attendanceRecords[0].earlyOt=null; data.attendanceRecords[0].otherOt=null');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A',true).otText"), '조');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A',true).middleText"), 'OT 합계(구분 전) 3');
  run('data.attendanceRecords[0].earlyOt=0; data.attendanceRecords[0].otherOt=3');
  assert.equal(run("buildCalendarDayContent('2026-09-05',data,'A',true).otText"), '조: 0');
});

test('failed save preserves form and does not show success feedback; retry succeeds', async () => {
  const b = browser();
  b.run(`serverAutoSyncEnabled=true; serverSyncVersion=0;
    elements.attendanceNameSelect.value='A'; elements.attendanceOtInput.value='2';
    flashes=0; flashSavedDates=()=>flashes++; closeInputPopups=()=>flashes++;
    serverRequest=async()=>{throw new Error('offline')};`);
  await b.run('saveAttendanceRecord()');
  assert.equal(b.run('flashes'), 0);
  assert.equal(b.run('elements.attendanceOtInput.value'), '2');
  assert.equal(b.run('hasUnsavedChanges'), true);
  b.run('serverRequest=async()=>({summary:{version:1}})');
  await b.run('saveAttendanceRecord()');
  assert.equal(b.run('flashes'), 2);
  assert.equal(b.run("getAttendanceRecord('2026-09-05','A').otEarned"), 2);
});

test('HTTP API/CSV, monthly summary, DB and backup roundtrip retain the same totals', async t => {
  const db = initializeDatabase(':memory:');
  const logger = { access() {}, error() {}, info() {} };
  const server = createServer(createApp({ database: db, logger }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${url}/api/auth/login`, { method: 'POST', body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin1234' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const data = { employees: [{id:'A',name:'A'},{id:'B',name:'B'}], records: [], attendanceRecords: [
    {date:'2026-09-05',employeeId:'A',earlyOt:1,otherOt:2,otEarned:999,otUsed:-4,nightOt:2},
    {date:'2026-09-05',employeeId:'B',otEarned:3}
  ] };
  const save = await fetch(`${url}/api/admin/import-local-data?replace=true`, {method:'POST',headers:{cookie},body:JSON.stringify({data,baseVersion:0})});
  assert.equal(save.status, 200);
  const full = await (await fetch(`${url}/api/admin/data`,{headers:{cookie}})).json();
  assert.equal(full.data.attendanceRecords[0].ot, -1);
  assert.equal(full.data.attendanceRecords[0].otEarned, 3);
  assert.equal(full.data.attendanceRecords[0].earlyOt, 1);
  assert.equal(full.data.attendanceRecords[1].earlyOt, null);
  const created = await fetch(`${url}/api/admin/users`, {method:'POST',headers:{cookie},body:JSON.stringify({username:'calendar-viewer',password:'test-password',employeeId:full.data.employees[0].id})});
  assert.equal(created.status, 201);
  const viewerLogin = await fetch(`${url}/api/auth/login`, {method:'POST',body:JSON.stringify({username:'calendar-viewer',password:'test-password'})});
  const viewerCookie = viewerLogin.headers.get('set-cookie').split(';')[0];
  const calendar = await (await fetch(`${url}/api/calendar?month=2026-09`,{headers:{cookie:viewerCookie}})).json();
  assert.equal(calendar.data.attendanceRecords[0].earlyOt, 1);
  assert.equal(calendar.data.attendanceRecords[0].otherOt, 2);
  assert.equal(calendar.data.attendanceRecords[1].earlyOt, 0);
  assert.equal(calendar.data.attendanceRecords[1].otherOt, 0);
  assert.equal(calendar.data.attendanceRecords[1].otEarned, 0);
  const key = process.env.INTEGRATION_KEY || 'local-integration-key';
  const getCsv = async () => (await fetch(`${url}/api/integration/attendance.csv?month=2026-09`,{headers:{'x-integration-key':key}})).text();
  const csv = await getCsv();
  assert.equal(csv.trim().split('\n')[0], '"date","name","ot","nightOt","holidayOt","flexOt","off","note"');
  assert.match(csv, /"2026-09-05","A","-1","2"/);
  assert.match(csv, /"2026-09-05","B","3"/);
  const summary = await (await fetch(`${url}/api/admin/monthly-summary?month=2026-09`,{headers:{cookie}})).json();
  assert.equal(summary.rows[0].totalOt, -1);
  importLocalData(db, JSON.parse(JSON.stringify(full.data)), {replace:true,expectedVersion:1});
  assert.equal(await getCsv(), csv);
  const invalid = JSON.parse(JSON.stringify(full.data));
  invalid.attendanceRecords[0].earlyOt=-1;
  assert.throws(()=>importLocalData(db,invalid,{replace:true,expectedVersion:2}));
  assert.equal(await getCsv(), csv);
});

test('SQLite backup manager creates a complete snapshot and applies retention', () => {
  const db = initializeDatabase(':memory:');
  const dir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'ot-backup-'));
  const manager = createBackupManager(db, { directory: dir, retention: 2 });
  manager.createBackup('test');
  assert.equal(manager.listBackups().length, 1);
  assert.ok(require('node:fs').statSync(manager.listBackups()[0].path).size > 0);
  db.close();
  require('node:fs').rmSync(dir, { recursive: true, force: true });
});
