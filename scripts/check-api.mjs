import assert from 'node:assert/strict'

// Comprueba el proxy y los contratos reales sin crear, editar ni eliminar registros.
const base = (process.env.ZENROOM_CHECK_URL || 'http://127.0.0.1:5173/cloud').replace(/\/+$/, '')
let token
async function get(path, expected = 200, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    signal: AbortSignal.timeout(30000),
  })
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}, expected ${expected}`)
  return response.json()
}
const health = await get('/actuator/health')
assert.equal(health.status, 'UP')
const spec = await get('/v3/api-docs')
for (const [path, method] of [
  ['/api/v1/auth/login', 'post'], ['/api/v1/users', 'get'], ['/api/v1/users', 'post'],
  ['/api/v1/sites', 'get'], ['/api/v1/sites', 'post'],
  ['/api/v1/sites/{siteId}/room-types', 'get'], ['/api/v1/sites/{siteId}/room-types', 'post'],
  ['/api/v1/rooms', 'get'], ['/api/v1/rooms/{roomId}', 'patch'],
  ['/api/v1/rooms/{roomId}/readings', 'get'],
  ['/api/v1/room-types/{roomTypeId}/thresholds', 'get'],
  ['/api/v1/room-types/{roomTypeId}/thresholds/{metric}', 'put'],
  ['/api/v1/devices', 'get'], ['/api/v1/edges', 'get'],
  ['/api/v1/credentials', 'get'], ['/api/v1/credentials', 'post'],
  ['/api/v1/credentials/{credentialId}', 'delete'], ['/api/v1/insights/rooms/{roomId}', 'get'],
]) assert.ok(spec.paths[path]?.[method], `Missing endpoint: ${method.toUpperCase()} ${path}`)
assert.ok(spec.paths['/api/v1/insights/rooms/{roomId}'].get.parameters.some(parameter => parameter.name === 'period' && parameter.required))
await get('/api/v1/rooms', 401)
console.log('OK: proxy, health, protected endpoints and OpenAPI contracts')

const email = process.env.ZENROOM_CHECK_EMAIL
const password = process.env.ZENROOM_CHECK_PASSWORD
if (!email || !password) {
  console.log('Set ZENROOM_CHECK_EMAIL and ZENROOM_CHECK_PASSWORD to check authenticated reads.')
  process.exit(0)
}
const login = await get('/api/v1/auth/login', 200, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
assert.equal(login.token_type.toLowerCase(), 'bearer')
assert.ok(login.expires_in > 0)
token = login.access_token
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
const sites = await get('/api/v1/sites')
const rooms = await get('/api/v1/rooms')
assert.ok(Array.isArray(sites))
assert.ok(Array.isArray(rooms))
for (const site of sites) {
  const types = await get(`/api/v1/sites/${site.id}/room-types`)
  assert.ok(Array.isArray(types))
  for (const type of types) {
    const thresholds = await get(`/api/v1/room-types/${type.id}/thresholds`)
    assert.ok(Array.isArray(thresholds))
    for (const threshold of thresholds) assert.equal(typeof threshold.warn_value, 'number')
  }
}
for (const room of rooms) {
  assert.ok(sites.some(site => site.id === room.site_id), 'Room must belong to a returned site')
  if (!room.latest) continue
  const to = new Date(Date.parse(room.latest.ts) + 60000).toISOString()
  const from = new Date(Date.parse(to) - 3600000).toISOString()
  const readings = await get(`/api/v1/rooms/${room.id}/readings?${new URLSearchParams({ from, to })}`)
  assert.ok(Array.isArray(readings))
  const site = sites.find(site => site.id === room.site_id)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: site.timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(room.latest.ts))
  const period = parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value
  const analysis = await get(`/api/v1/insights/rooms/${room.id}?${new URLSearchParams({ period })}`)
  assert.equal(analysis.room_id, room.id)
  assert.equal(analysis.period, period)
  assert.equal(typeof analysis.data_quality.received_minutes, 'number')
  for (const measure of ['noise_vs_occupancy', 'thermal_drift', 'indoor_vs_outdoor']) assert.ok(['conclusive', 'not_enough_evidence', 'no_data'].includes(analysis.measures[measure].verdict))
}
if (claims.roles.includes('ADMIN')) {
  for (const endpoint of ['devices', 'edges', 'users', 'credentials']) assert.ok(Array.isArray(await get(`/api/v1/${endpoint}`)))
}
console.log(`OK: ${claims.roles.join(', ')} login, ${sites.length} sites, ${rooms.length} rooms, room types, thresholds, readings and analysis`)
