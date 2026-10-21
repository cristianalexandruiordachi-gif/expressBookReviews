# Online Book Reviews — Cristian Alexandru Iordachi

Fork of IBM's `ibm-developer-skills-network/expressBookReviews` for Developing Back-End Apps with Node.js and Express.

## Run and test
Requires Node.js 20 or newer.

```sh
cd final_project
npm ci
npm test
npm start
# In another terminal:
npm run client
```

The server binds to 127.0.0.1:5000 by default. PORT and HOST can be configured. The Axios clients use BOOK_API_URL. No deployment or paid service is required by the current evaluation.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | / | All 10 original IBM books |
| GET | /isbn/:isbn | One book |
| GET | /author/:author | Exact author, case insensitive |
| GET | /title/:title | Exact title, case insensitive |
| GET | /review/:isbn | Reviews for a book |
| POST | /register | JSON username and password |
| POST | /customer/login | Session cookie after valid login |
| PUT | /customer/auth/review/:isbn | Add/update only the logged-in user's review |
| DELETE | /customer/auth/review/:isbn | Delete only the logged-in user's review |

Review text can be passed as JSON `review` or the lab's `?review=` query parameter. Authentication verifies signed JWTs stored in the session; Bearer JWTs are also supported. Passwords use salted scrypt hashes. Sessions are regenerated at login. Inputs and missing records are validated; 400, 401, 404, and 409 responses are tested.

## All 14 lab tasks
| Task | Implementation / actual evidence |
|---|---|
| 1 All books | evidence/getallbooks.txt |
| 2 ISBN | evidence/getbooksbyISBN.txt |
| 3 Author | evidence/getbooksbyauthor.txt |
| 4 Title | evidence/getbooksbytitle.txt |
| 5 Initial reviews | evidence/getbookreview.txt |
| 6 Register | evidence/register.txt |
| 7 Login | evidence/login.txt |
| 8 Add/modify review | evidence/reviewadded.txt and reviewmodified.txt |
| 9 Delete own review | evidence/deletereview.txt |
| 10 Async callback, all books | getAllBooks in final_project/router/general.js; evidence/task10-async-callback.json |
| 11 Async ISBN | getBookByISBN; evidence/task11-isbn-async-await.json |
| 12 Promise author lookup | getBooksByAuthor; evidence/task12-author-promise.json |
| 13 Async title lookup | getBooksByTitle; evidence/task13-title-async-await.json |
| 14 GitHub fork | evidence/githubrepo.txt; GitHub parent metadata |

The current Mark form combines tasks 10–13 into the general.js URL, resulting in 11 submission fields. Evidence comes from actual cURL requests against a locally running Express server. No responses or screenshots are fabricated. `generate-evidence.js` reproduces requests using an available ephemeral port and records execution time. Demo credentials are disposable local test fixtures, not personal account credentials. Cookie jars and environment secrets are ignored by Git.

## Scope
This is the in-memory teaching application requested by the lab: users, sessions, and reviews reset on server restart. For production, use a persistent datastore and session store, configured JWT_SECRET and SESSION_SECRET, HTTPS/proxy settings, rate limiting, and managed secret storage. Do not treat the teaching server as a hosted production service.

Original booksdb.js and Apache 2.0 license are preserved. The final assessment is prepared only; submission requires the learner's approval.
