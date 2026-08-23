# Wingback

A private Next.js + Supabase app for a five-player Premier League
goalscorer sweepstake — see `CLAUDE.md` for the architecture summary and
`DEPLOY.md` for setup.

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

Run the rules engine's test suite (no Docker required):

```bash
supabase/tests/run.sh
```
