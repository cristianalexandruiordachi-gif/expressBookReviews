const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-key-not-for-deployment';
const jwt = require('jsonwebtoken');
const app = require('../index');
const { users } = require('../router/auth_users');
const books = require('../router/booksdb');
const clients = require('../router/general');
let server, base, cookie;
const password = 'DisposableTest123!';
async function request(path, method = 'GET', body, sessionCookie) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(sessionCookie ? { Cookie: sessionCookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.BOOK_API_URL = base;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
test('public catalog, ISBN, author, title and initial reviews', async () => {
  assert.equal(Object.keys((await request('/')).body).length, 10);
  assert.equal((await request('/isbn/1')).body.title, 'Things Fall Apart');
  assert.equal(Object.keys((await request('/author/Unknown')).body).length, 4);
  assert.equal((await request('/title/Pride%20and%20Prejudice')).body['8'].author, 'Jane Austen');
  assert.deepEqual((await request('/review/1')).body, {});
});
test('missing books and inherited object keys return 404', async () => {
  for (const path of ['/isbn/999', '/isbn/toString', '/review/constructor', '/author/Nobody', '/title/Missing']) assert.equal((await request(path)).status, 404);
});
test('registration rejects invalid inputs and duplicate users', async () => {
  assert.equal((await request('/register', 'POST', {})).status, 400);
  assert.equal((await request('/register', 'POST', { username: '__proto__', password })).status, 400);
  assert.equal((await request('/register', 'POST', { username: 'alice', password })).status, 201);
  assert.equal((await request('/register', 'POST', { username: 'alice', password })).status, 409);
  assert.notEqual(users.get('alice').hash, password);
});
test('concurrent registrations cannot overwrite a user', async () => {
  const results = await Promise.all([request('/register', 'POST', { username: 'racer', password }), request('/register', 'POST', { username: 'racer', password: 'DifferentTest123!' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
});
test('wrong password denied; successful login creates a session', async () => {
  assert.equal((await request('/customer/login', 'POST', { username: 'alice', password: 'WrongPassword!' })).status, 401);
  const result = await request('/customer/login', 'POST', { username: 'alice', password });
  assert.equal(result.status, 200); assert.match(result.cookie, /^bookshop.sid=/); cookie = result.cookie;
});
test('anonymous review writes and malformed JWTs denied', async () => {
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'No session' })).status, 401);
  const invalid = await fetch(base + '/customer/auth/review/1', { method: 'DELETE', headers: { Authorization: 'Bearer forged' } });
  assert.equal(invalid.status, 401);
});
test('create and modify review belongs to authenticated user, not body username', async () => {
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'Original', username: 'someone_else' }, cookie)).status, 201);
  const updated = await request('/customer/auth/review/1', 'PUT', { review: 'Updated' }, cookie);
  assert.equal(updated.status, 200); assert.equal(updated.body.reviews.alice, 'Updated'); assert.equal(updated.body.reviews.someone_else, undefined);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: '' }, cookie)).status, 400);
  assert.equal((await request('/customer/auth/review/999', 'PUT', { review: 'Missing' }, cookie)).status, 404);
});
test('second user cannot delete first user review; concurrent writes stay separate', async () => {
  await request('/register', 'POST', { username: 'bob', password });
  const bobCookie = (await request('/customer/login', 'POST', { username: 'bob', password })).cookie;
  assert.equal((await request('/customer/auth/review/1', 'DELETE', undefined, bobCookie)).status, 404);
  await Promise.all([request('/customer/auth/review/1', 'PUT', { review: 'Alice concurrent' }, cookie), request('/customer/auth/review/1', 'PUT', { review: 'Bob concurrent' }, bobCookie)]);
  assert.deepEqual((await request('/review/1')).body, { alice: 'Alice concurrent', bob: 'Bob concurrent' });
  await request('/customer/auth/review/1', 'DELETE', undefined, cookie);
  assert.deepEqual((await request('/review/1')).body, { bob: 'Bob concurrent' });
});
test('signed JWT accepted, expired JWT rejected', async () => {
  const token = jwt.sign({ sub: 'bob' }, process.env.JWT_SECRET, { issuer: 'bookshop', audience: 'bookshop-customers', expiresIn: '1h' });
  const accepted = await fetch(base + '/customer/auth/review/2', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ review: 'JWT authenticated review' }) });
  assert.equal(accepted.status, 201);
  const expired = jwt.sign({ sub: 'bob' }, process.env.JWT_SECRET, { issuer: 'bookshop', audience: 'bookshop-customers', expiresIn: -1 });
  assert.equal((await fetch(base + '/customer/auth/review/2', { method: 'DELETE', headers: { Authorization: `Bearer ${expired}` } })).status, 401);
});
test('all four asynchronous Axios methods call the real HTTP server', async () => {
  const all = await new Promise((resolve, reject) => clients.getAllBooks((err, data) => err ? reject(err) : resolve(data)));
  assert.equal(Object.keys(all).length, 10);
  assert.equal((await clients.getBookByISBN('1')).author, 'Chinua Achebe');
  assert.equal(Object.keys(await clients.getBooksByAuthor('Unknown')).length, 4);
  assert.equal((await clients.getBooksByTitle('Things Fall Apart'))['1'].author, 'Chinua Achebe');
  await assert.rejects(() => clients.getBookByISBN('999'));
});
