const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const app = require('./index');
const clients = require('./router/general');
const output = path.resolve(__dirname, '../evidence');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync('.private', { recursive: true });
const show = args => 'curl.exe ' + args.map(a => /[\s"']/.test(a) ? `'${a.replaceAll("'", "'\\''")}'` : a).join(' ');
function run(name, args, expected, payload) {
  const result = spawnSync('curl.exe', ['--silent', '--show-error', ...args, '--write-out', '\nHTTP_STATUS: %{http_code}\n'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `curl failed: ${name}`);
  assert.match(result.stdout, new RegExp(`HTTP_STATUS: ${expected}\\s*$`));
  const text = `${payload ? `# Disposable local test request body:\n${JSON.stringify(payload, null, 2)}\n\n` : ''}$ ${show([...args, '--write-out', '\\nHTTP_STATUS: %{http_code}\\n'])}\n\n${result.stdout}`;
  fs.writeFileSync(path.join(output, `${name}.txt`), text);
  console.log(`${name}: HTTP ${expected}`);
}
async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.BOOK_API_URL = base;
  // curl runs in a worker process asynchronously; the API event loop stays free.
  const { Worker } = require('node:worker_threads');
  const workerCode = `const {parentPort,workerData}=require('node:worker_threads');const {spawnSync}=require('node:child_process');parentPort.on('message',args=>parentPort.postMessage(spawnSync('curl.exe',args,{encoding:'utf8'})));`;
  const worker = new Worker(workerCode, { eval: true });
  async function capture(name, args, status, payload) {
    const actual = ['--silent', '--show-error', ...args, '--write-out', '\nHTTP_STATUS: %{http_code}\n'];
    const result = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); worker.postMessage(actual); });
    if (result.status !== 0) throw new Error(result.stderr);
    assert.match(result.stdout, new RegExp(`HTTP_STATUS: ${status}\\s*$`));
    fs.writeFileSync(path.join(output, `${name}.txt`), `${payload ? `# Disposable local test request body:\n${JSON.stringify(payload, null, 2)}\n\n` : ''}$ ${show(actual)}\n\n${result.stdout}`);
    console.log(`${name}: HTTP ${status}`);
  }
  const bodyFile = (name, payload) => { const file = `.private/${name}.json`; fs.writeFileSync(file, JSON.stringify(payload)); return ['-H', 'Content-Type: application/json', '--data-binary', `@${file}`]; };
  try {
    await capture('getallbooks', [base + '/'], 200);
    await capture('getbooksbyISBN', [base + '/isbn/1'], 200);
    await capture('getbooksbyauthor', [base + '/author/Unknown'], 200);
    await capture('getbooksbytitle', [base + '/title/Things%20Fall%20Apart'], 200);
    await capture('getbookreview', [base + '/review/1'], 200);
    const account = { username: 'cristian_demo', password: 'DisposableLab123!' };
    await capture('register', ['-X', 'POST', base + '/register', ...bodyFile('register', account)], 201, account);
    await capture('login', ['-X', 'POST', base + '/customer/login', ...bodyFile('login', account), '-c', '.private/customer.cookies'], 200, account);
    const review = { review: 'A powerful novel about culture, identity, and change.' };
    await capture('reviewadded', ['-X', 'PUT', base + '/customer/auth/review/1', '-b', '.private/customer.cookies', ...bodyFile('review', review)], 201, review);
    const modified = { review: 'Updated: a compelling exploration of tradition and change.' };
    await capture('reviewmodified', ['-X', 'PUT', base + '/customer/auth/review/1', '-b', '.private/customer.cookies', ...bodyFile('modified', modified)], 200, modified);
    await capture('deletereview', ['-X', 'DELETE', base + '/customer/auth/review/1', '-b', '.private/customer.cookies'], 200);
    const results = [
      ['task10-async-callback', await new Promise((resolve, reject) => clients.getAllBooks((err, data) => err ? reject(err) : resolve(data)))],
      ['task11-isbn-async-await', await clients.getBookByISBN('1')],
      ['task12-author-promise', await clients.getBooksByAuthor('Unknown')],
      ['task13-title-async-await', await clients.getBooksByTitle('Things Fall Apart')]
    ];
    for (const [name, data] of results) fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(data, null, 2));
    fs.writeFileSync(path.join(output, 'execution.json'), JSON.stringify({ executedAt: new Date().toISOString(), baseURL: base, note: 'Actual loopback API responses. Lab state is in memory and resets on restart.' }, null, 2));
    run('githubrepo', ['--fail', 'https://api.github.com/repos/cristianalexandruiordachi-gif/expressBookReviews'], 200);
  } finally { await worker.terminate(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
