# NewsGen

Internal tool for Philippine reporters. It lists local news by outlet, captures articles as evidence, and uses Gemini to write up to five sourced versions of a story. Every sentence links back to the passage it came from.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000 and sign in with your username and password. See `.env.example` for all settings.

## Accounts and sharing

- Each person signs in with their own username and password. Admins create accounts on the Users page (`/admin/users`), reset passwords and disable accounts.
- The first admin is created from the command line: `npm run create-user -- --username admin --name "Your Name" --role admin`. Without `--password` a password is generated and printed once. Use the same command if every admin is locked out.
- Every story has one owner. From the story's Share button, the owner shares it with other users as viewers or editors. Shared stories appear under Shared with me, with every version, and changes appear on everyone's screen within a few seconds.
- A viewer can ask for edit access from the story. The owner answers on the Requests page. Only the owner can delete the story or change who it is shared with.
- Public links need an admin. Admins publish directly; owners and editors send a request, which admins answer on the Requests page. The admin chooses whether the link shows the article only or the article with the original news. The original is the outlet's copyrighted text, so publish it only with permission. The owner or an admin can turn a link off.
- A new password or a disabled account signs that person out everywhere. Changing `SESSION_SECRET` signs everyone out. To run a production build, use `npm run build` and then `npm start`.

To deploy, set the same variables on the host. Keep `.env.local` out of git. It is already ignored.

## Bugs and feature requests

Everyone signed in can report a bug or request a feature from **Bugs & requests** in the sidebar (`/feedback`). Each report becomes a numbered task (NG-1, NG-2, ...) on a board with the columns New, Accepted, In progress, Done and Not doable. Others can add a "Me too" vote and comment. Admins act as the developers: they set the status and priority and leave a note for the reporter, and a reason is required for "Not doable". Every status change is recorded in the task's activity. Reporters can edit or delete their own task until a developer starts on it.

## How a version is made

1. **Capture.** The article text is saved with a timestamp and SHA-256 fingerprint. Saved sources cannot be changed.
2. **Facts.** Gemini extracts facts with exact quotes. Code discards any fact whose quote is not in the captured text.
3. **Write.** Gemini writes from the facts, without seeing the original articles, and each sentence cites its facts.
4. **Check.** An independent Gemini pass tests each sentence against the cited paragraphs and flags libel risk. Unsupported sentences are removed. Code also checks figures, direct quotations and copied wording.
5. **Review.** The reporter reads the version and approves it. PDFs and share links are available only after approval. Any later change pauses the link until it is approved again.

Proofreading runs only when the reporter clicks **Proofread**. If it changes anything, the version is re-checked.

Every version carries a source credit in the copied text, the PDF and the share link.

## Limits

- Gemini's free tier allows 20 requests per model per day, and one version uses about 3 to 5. The app moves to the next model when one is full. Turn on billing for the key for regular use.
- The checks confirm that copy matches its sources. They cannot confirm that the sources are right.
- This is not legal clearance. Repeating a defamatory claim can create liability even with attribution.
- Sites that refuse automated reading (ABS-CBN, Inquirer, TV5 and Manila Bulletin at the time of writing) also refused an openly identified headless browser. The reporter brings these in from their own browser with the extension in `extension/` or the bookmark (setup is at `/import`), or by pasting. Each source is labelled with how it was captured. The extension only opens an article when the reporter clicks one, and it does not solve bot checks. It runs on `localhost`, so add a deployed address to `content_scripts.matches` in its manifest.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Unit tests for the checks and sign-in |
| `npm run lint` | ESLint |
| `supabase/migrations/` | Database schema, already applied to the project database |
