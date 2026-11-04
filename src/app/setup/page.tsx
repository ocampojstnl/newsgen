export default function SetupPage() {
  return (
    <main className="rise-in mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <h1 className="text-gradient text-3xl font-bold tracking-tight">Finish setting up NewsGen</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add these values to <code>.env.local</code> in the project folder, then restart the app.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
        <li>
          <code>SESSION_SECRET</code>: a long random value that signs sign-in sessions. Then create the first admin with <code>npm run create-user</code>.
        </li>
        <li>
          <code>DATABASE_URL</code>: the Supabase transaction pooler connection string.
        </li>
        <li>
          <code>GEMINI_API_KEY</code>: from Google AI Studio.
        </li>
      </ul>
    </main>
  );
}
