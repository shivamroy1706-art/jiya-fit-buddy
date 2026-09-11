# Jiya's Fitness Journey

# AI Fitness Trainer — Master Build Prompt (v4, Final, Fully Specified)

You are building a complete, production-grade, full-stack mobile fitness application called **AI Fitness Trainer**, to be published on the Google Play Store. Every requirement below is mandatory. Do not skip, simplify, substitute, or "mock" any feature. Do not ship any button, tab, or list item that does not do something real when tapped. Read this entire document before starting, then build the whole app from it in one pass.

---

## 0. RULES THAT OVERRIDE EVERYTHING ELSE (read first — multiple previous build attempts failed on these exact points)

1. **No fake substitutions.** "Camera" = a real camera. "Barcode scanner" = real barcode detection. "Personalized workout" = mathematically derived from the user's actual saved answers.
2. **Every interactive element must be functional.** Every button, tab, checkbox, list item, and card must do what it visually implies when tapped. Before considering ANY screen complete, tap every element on it and confirm it responds.
3. **Grouped onboarding questions stay grouped on one screen** exactly as specified in Section 6 — do not split or merge differently.
4. **The AI Assistant (Jiya) must be a real, always-responsive, multi-turn conversational chat** — see Section 10, which is the most detailed and most important section in this entire document. Every message sent must receive a reply. No exceptions, no silent failures.
5. **Jiya must have one consistent avatar image** used everywhere she appears.
6. **Every onboarding answer must be persisted and actually used** by the personalization engine (Section 8) — two users with different answers must get visibly different plans.
7. **Every username in the app must be unique** — enforced at the database level, not just in the UI.
8. **Nutrition scan results must include a real ingredient list and a real nutrient breakdown** (not just a single grade letter) — see Section 12.
9. **All charts/graphs must be interactive** — see Section 13.
10. When in doubt, build the more complete, more real, more production-correct version — never the shortcut.

---

## 1. App Identity & Branding

- **App name:** AI Fitness Trainer
- **AI coach persona:** **Jiya** — warm, motivating, knowledgeable female AI fitness coach, represented by ONE consistent avatar image/illustration reused everywhere (welcome screen, onboarding, chat icon, chat header, every chat message bubble, walkthrough).
- **Logo:** circular badge, black background, neon-lime-green circular ring border, bold white "A" merged with a lowercase green "i" forming "Ai", a green sprinting-runner silhouette crossing a green barbell icon through the lettering, "AI FITNESS" in bold white uppercase below, "TRAINER" in green uppercase beneath, short green dash flourishes either side. Recreate as clean SVG vector — no third-party art. Use as app icon, splash mark, login/welcome mark.
- **Tagline:** "Let's build a stronger, healthier you. One step at a time."

---

## 2. Design System — apply identically on every screen, every component, every state

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | #0D1B14 | App background |
| `--bg-surface` | #14251D | Cards, modals, inputs |
| `--bg-surface-alt` | #16302A | Nested cards |
| `--accent-primary` | #AEEA00 | Buttons, active nav, progress rings, checkmarks |
| `--accent-primary-pressed` | #93C700 | Pressed state |
| `--text-primary` | #FFFFFF | Headings, primary text |
| `--text-secondary` | #C9D1CD | Captions, muted text |
| `--text-on-accent` | #0D1B14 | Text on lime-green buttons |
| `--border-subtle` | #223B31 | Borders, dividers |
| `--grade-a` | #4CAF50 | Nutri-score A |
| `--grade-b` | #8BC34A | Nutri-score B |
| `--grade-c` | #FFC107 | Nutri-score C |
| `--grade-d` | #FF9800 | Nutri-score D |
| `--grade-e` | #F44336 | Nutri-score E |

Corner radius 16–20px. Poppins/Inter fonts. Bottom nav (Home, Scan, Workout, Progress, Profile) persistent, active tab in `--accent-primary`. AI Assistant icon (Jiya's avatar) top-right on every main screen.

---

## 3. App Launch Flow

1. Splash screen: logo animates in, holds ~2.5–3s while checking session.
2. Valid session + onboarding complete → Home.
3. Valid session + onboarding incomplete → resume at saved step.
4. No session → Welcome/Login.
5. First-ever Home visit only → trigger Jiya's App Walkthrough (Section 4).

---

## 4. Jiya's First-Login App Walkthrough

Immediately after a brand-new user finishes onboarding and lands on Home the first time, run an interactive guided tour hosted by Jiya (avatar + speech-bubble captions): welcome + congratulations → spotlight bottom nav (one sentence per tab) → spotlight "Today's Plan" (explain it's personalized) → spotlight Scan tab (explain food/barcode logging) → spotlight chat icon (explain she's available anytime) → closing message with "Got it, let's go!" button that sets `first_login_tour_seen = true`. Re-triggerable later from Settings → "Replay app tour." Implement as a dimmed-background spotlight/coach-mark overlay, not a separate screen.

---

## 5. Authentication (now includes username creation)

- **Welcome screen:** logo, "Welcome to AI Fitness Trainer", "Hi, I'm Jiya, your AI Fitness Coach." with her avatar, tagline, green "Get Started →" button, "Already have an account? Log in" link.
- **Signup/Login screen:** Full Name, **Username** (new required field — see uniqueness rule below), Email/Phone, Password (show/hide toggle), green "Create Account" button, "or" divider, white "Continue with Google" button, toggle link. Step-progress bar at top.
- **Username rules:** must be unique across all users — validate in real time as the user types (debounced check against the database) and show a clear inline "Username already taken" error before allowing submit; enforce a unique constraint at the database level as the final safeguard; allow letters, numbers, underscores only, 3–20 characters. If signing up via Google, auto-suggest an available username (e.g., from their name + random digits) which they can edit before continuing.
- Real backend: hashed passwords, working email/password auth AND Google OAuth, JWT/secure session with refresh, server-side validation, working "Forgot password" flow.
- On signup: create `users` row (including username), then proceed into onboarding.
- On login: check `onboarding_completed_at`; route accordingly.

---

## 6. Onboarding Questionnaire — EXACT screen grouping (18 screens total, do not split or merge differently)

1. **"About You"** (ONE screen): Age + Gender together.
2. **"Body Measurements"** (ONE screen): unit toggle + Height + Weight together.
3. **"Primary Goal"** (single-select): Lose Weight, Build Muscle, Gain Strength, Improve Endurance, Stay Fit, Athletic Performance.
4. **"Where will you work out?"** (single-select): Home, Gym, Both.
5. **"Home Equipment"** (multi-select, if Home/Both): No Equipment, Yoga Mat, Resistance Bands, Dumbbells, Kettlebell, Pull-up Bar, Bench, Jump Rope, Exercise Bike, Treadmill, Other.
6. **"Gym Equipment"** (multi-select, if Gym/Both): Full Gym, Basic Gym, Cardio Machines, Free Weights, Smith Machine, Cable Machine, Power Rack, Functional Training Area, Other.
7. **"Desired Results"** (multi-select): Bigger Chest, Bigger Arms, Wider Shoulders, Bigger Back, Bigger Legs, Bigger Glutes, Six-Pack Abs, Better Posture, Better Stamina, Full Body Transformation.
8. **"Workout Planning Style"** (single-select): "Let Jiya decide everything," "Hybrid (Jiya + Me)," "I'll customize everything myself."
9. **"Muscle Focus"** (multi-select): Chest, Back, Shoulders, Biceps, Triceps, Forearms, Abs, Glutes, Quads, Hamstrings, Calves, Full Body.
10. **"Fitness Level"** (single-select): Beginner, Intermediate, Advanced.
11. **"Training Intensity"** (single-select): Easy, Moderate, Hard, Intense.
12. **"Past Exercise Experience"** (single-select): Never, Occasionally, Regularly, Very Experienced.
13. **"Workout Frequency"** (single-select): 2–7 days/week.
14. **"Session Duration"** (single-select): 15, 30, 45, 60, 90+ minutes.
15. **"Injuries / Health Conditions"** (multi-select, optional, default "None"): None, Knee Pain, Back Pain, Shoulder Injury, Neck Pain, High Blood Pressure, Diabetes, Other.
16. **"Workout Schedule"** (ONE screen): weekday multi-select + time block together.
17. **"Notification Preferences"** (one screen, all toggles default ON): Workout, Water, Meal, Weekly Progress Reports, Daily Motivation.
18. **"Plan Ready"** summary → "Let's Go! 🚀" → sets `onboarding_completed_at` → Home → triggers Section 4 walkthrough.

---

## 7. Home (Dashboard)

Greeting, real streak counter, Daily Summary (Calories Burned, Steps, Active Minutes, Workouts today, Goal Progress % ring) computed from real data, Leaderboard widget (Friends/Global toggle, see Section 14), "Today's Plan" card with working "Start Workout," functional Quick Actions (Scan Food, Log Water, Add Weight, Sleep Track).

---

## 8. Personalization Engine

Workout split generation from goal/fitness level/days/duration/focus muscles/equipment/intensity, filtering out exercises contraindicated for reported injuries and substituting safe alternatives. Nutrition targets via Mifflin-St Jeor BMR × activity factor, adjusted for goal, output as daily calories + protein/carbs/fat grams. Estimated timeline from goal delta ÷ safe weekly rate. Progressive overload every 1–2 weeks based on logged history. Re-generate on any later profile edit. **Test requirement:** two test accounts with different answers must produce visibly different plans before this is considered done.

---

## 9. Workout

"Today's Workout" header with real data. Every exercise row individually tappable, opening real Exercise Detail (Section 11) — verify every row works, not just the first. Checkboxes toggle a real completed state. "Start Workout" runs the full guided session (one exercise at a time, instructions/video, rest timer, weight/reps logging) ending in a real summary written to `workout_logs`. "Warm Up" section same tap behavior.

---

## 10. AI Assistant "Jiya" — FULL TECHNICAL SPEC (this has failed twice before — implement exactly as follows, do not simplify)

Jiya must function as a real, general-purpose fitness AI chat assistant with full context of the user's data. This is not optional or "nice to have" — treat it as a core feature equal in importance to the workout engine.

### 10.1 Backend architecture
- Integrate a real LLM API (Anthropic Claude API or OpenAI API — implement one fully, with a real API key placeholder the developer will supply) via a backend endpoint — never call the LLM directly from the client with an exposed key.
- On every user message: build a request containing (a) a system prompt defining Jiya's persona and rules (see 10.2), (b) the FULL prior conversation history for that chat session (not just the latest message — this is what makes her multi-turn and context-aware), and (c) a compact JSON block of the user's live data (see 10.3). Send this to the LLM and stream or return the response.
- **Every single message the user sends must produce a response.** If the API call errors or times out, show a visible retry button and a friendly "Jiya's having trouble connecting, tap to retry" message — never fail silently, never just stop responding after the first exchange.
- Store every message (both user and Jiya) in `chat_messages`, and load the full history when the chat screen reopens, so conversations persist across app sessions exactly as they were left.

### 10.2 System prompt / persona rules for Jiya (build this into the backend system prompt)
Jiya should behave as a knowledgeable, encouraging personal trainer who:
- Answers general exercise and fitness questions accurately (form cues, muscle groups worked, sets/reps guidance, safety considerations).
- When asked "how do I do [exercise]," gives clear step-by-step form instructions, and — if that exercise exists in the app's `exercises` table — offers to open its Exercise Detail page.
- When asked about future workouts ("what am I doing tomorrow," "what's next in my plan," "what exercises are coming up this week"), looks up and accurately reports the user's actual upcoming `workout_days` from their real generated plan — never invents an answer.
- Can modify today's plan on request ("swap this exercise," "make today easier," "I don't have dumbbells today") by calling the same personalization/substitution logic as Section 8, respecting equipment and injury constraints, and confirming the change back to the user in plain language.
- Answers basic nutrition questions and can reference the user's own recent scans/nutrition totals when relevant.
- Delivers the daily motivational message when that notification preference is enabled.
- Stays encouraging and safety-conscious; for anything outside fitness/nutrition scope (medical diagnoses, injuries needing a doctor, etc.), gently recommends consulting a professional rather than guessing.

### 10.3 Live user-data context sent with every request
Include, at minimum: user's first name, current goal, fitness level, today's and this week's scheduled workouts, current streak, recent workout completion history, recent nutrition scan summary, and any reported injuries/conditions — so her answers are always grounded in real data, not generic.

### 10.4 Chat UI
Standard chat interface: right-aligned user bubbles (`--accent-primary`-tinted), left-aligned Jiya bubbles with her avatar beside each one, persistent text input with a working send button (and ideally a mic icon for voice input as a stretch feature), a typing/loading indicator while awaiting her reply, full scrollback, and pull-to-refresh or auto-load of older history.

### 10.5 Required test before calling this done
Open the chat and send at least 6 different consecutive messages covering: a greeting, "how do I do a push-up," "what's my workout tomorrow," "swap today's bench press for something else," a nutrition question, and a random off-topic message. Confirm Jiya replies individually and appropriately to every single one, that she correctly answers the "what's my workout tomorrow" question using real plan data (not a guess), and that closing and reopening the chat preserves the full conversation. If any message goes unanswered, this feature is not complete.

---

## 11. Exercise Library ("How To" pages)

For every exercise: name, muscle group(s), difficulty, equipment needed, step-by-step form instructions, demonstration video/looping image sequence, common mistakes/safety notes, tagged alternatives (feeds Section 8 and Jiya's substitution logic). Independently browsable/searchable by muscle group, linked from Workout and from Jiya's chat.

---

## 12. Scan — full technical spec, now including ingredient & nutrient analysis

Three tabs: **Food, Barcode, Upload** — none may be a plain text-search box as the primary interface.

- **Food tab:** live camera viewfinder, circular capture button, photo sent to a real food-recognition API (LogMeal, Google Cloud Vision food model, Clarifai, or Nutritionix image endpoint), loading state, low-confidence fallback reveals a manual search field labeled as a fallback only.
- **Barcode tab:** live camera with scan-frame overlay, real-time detection via `react-zxing`/`@zxing/browser`/`html5-qrcode`/`expo-barcode-scanner`, auto-lookup on detection against **Open Food Facts** (`GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`).
- **Upload tab:** native gallery picker, same recognition pipeline as Food tab.

### 12.1 Detailed result screen (new — required, this was missing before)
After ANY successful scan (Food, Barcode, or Upload), the result screen must show, not just a single letter grade:
- **Nutri-Score grade badge** (A–E, color-coded).
- **Full ingredient list**, parsed from the source data (Open Food Facts provides `ingredients_text` and a structured `ingredients` array for barcode scans; for image-recognition results, request an ingredient breakdown from the food-recognition API response, or fall back to a standard ingredient list for that identified food from a nutrition database).
- **Allergen warnings**, if present in the source data (e.g., contains gluten, nuts, dairy).
- **Additives list**, if present (matching the "4 additives" style shown in the reference design), each tappable to show a one-line plain-language explanation of what that additive is.
- **Full nutrient breakdown per serving AND per 100g**, displayed as a clear table/list: Calories, Protein, Total Fat (+ saturated fat), Total Carbohydrates (+ sugar), **Fiber**, Sodium, and any other nutrients available in the source data (vitamins/minerals if present).
- A short plain-language summary line generated from the data (e.g., "High in sugar, low in fiber" or "Good source of protein") — derive this from simple threshold rules against the nutrient values, not an invented claim.
- Portion-size adjuster that recalculates the displayed nutrient values proportionally.

### 12.2 Shared behavior
Every successful scan writes to `nutrition_scans` (store the full ingredient/nutrient/allergen data, not just the grade) tied to the current user, and its calories/macros are added into that day's Home Daily Summary. "Recent Scans" reads real rows for the logged-in user, most recent first, with a genuine empty state only when the table has zero rows. "Scan History"/"See All" opens a full paginated list.

---

## 13. Progress — now with interactive charts

Week/Month/3 Months/Year tabs, each re-querying real data for that range.

**All charts in this app (weight trend, calorie trend, any future graphs) must be interactive**, not static images:
- Tap or drag along the line/bar to reveal a tooltip with the exact value and date at that point.
- Smooth animated transitions when switching between time-range tabs.
- Pinch-to-zoom or horizontal scroll for longer time ranges (3 Months, Year) where data points would otherwise be too dense to read.
- Use a real interactive charting library appropriate to the platform (e.g., `victory-native`, `react-native-gifted-charts`, or `recharts`/`nivo` for a web build) — do not render charts as flat non-interactive images.

Body Metrics cards (Weight, Body Fat %, Muscle Mass, BMI) editable/loggable, feeding the charts above. Achievements auto-unlock from real triggers. Leaderboard (Friends/Global) by real XP — see Section 14 for how "Friends" is populated.

---

## 14. Friends & Social System (new — required, was completely missing before)

- Every user has a unique, searchable `username` (created at signup, Section 5).
- **Add a "Find Friends" screen**, reachable from the Friends leaderboard tab and from Profile, containing a search bar where the user types a username and sees real-time matching results (partial match, debounced search against the `users` table) — never expose email addresses in search results, username only.
- Each search result shows the matched user's avatar, username, and a "Send Request" button (or "Requested"/"Friends" state if already applicable).
- **Friend request flow:** sending a request creates a `pending` row in `friend_requests`. The recipient sees incoming requests in a dedicated "Requests" tab/badge (with a notification badge count) with Accept/Decline buttons. Accepting creates a mutual `friendships` row (or flips status to `accepted`); declining removes/marks the request as `declined`.
- Once friends, both users' real activity (XP, streaks) populates each other's **Friends** leaderboard tab on Home and Progress — replacing any placeholder/fake leaderboard data with real friend relationships.
- Add a "Remove Friend" option in each friend's profile view.
- Add a small friend-activity element (optional but recommended): a notification or feed item when a friend completes a workout or hits a streak milestone, to encourage engagement.

---

## 15. Profile

Avatar, name, **username** (displayed, not editable after creation — or editable with the same uniqueness check as signup), email, Level/XP bar with title computed from cumulative XP (define a point table: e.g., +10 XP per completed workout, +5 per logged scan, +20 per streak milestone). "Your Goals" card (editable) showing live progress against target date. Menu → real wired sub-screens: Personal Info, Health Info, Activity Level, Achievements, Friends (Section 14), Reminders, Settings (include "Replay app tour"), Help & Support, Log Out. Any edit here triggers plan re-generation per Section 8.

---

## 16. Notifications

Real scheduled/push notifications respecting `notification_prefs` and schedule: Workout Reminders, Water Reminders, Meal Reminders, Weekly Progress Reports, Daily Motivation from Jiya, and (new) Friend Request/Friend Activity notifications.

---

## 17. Suggested Additional Features (recommended — implement if time allows, ranked by impact for a final-year project demo)

1. **Progress photos:** let users optionally upload a front/side photo alongside each weight log entry, viewable as a before/after slider on the Progress screen — a strong visual demo feature for a presentation.
2. **Google Fit / Health Connect integration:** auto-import steps and active minutes instead of requiring manual entry, making the Daily Summary more automatically accurate.
3. **Weekly recap:** an auto-generated end-of-week summary card (or email, if notifications are wired to email) recapping workouts completed, calories, streak, and a Jiya-written encouraging note — great for demonstrating "AI-generated" value to evaluators.
4. **Rest-day / active-recovery suggestions:** on scheduled rest days, show a light stretching/mobility routine instead of leaving the day blank.
5. **Offline workout mode:** cache today's workout so the guided session screen still works without an internet connection (common real-world gym scenario — patchy signal).
6. **Voice cues during a workout session:** simple text-to-speech announcing "Next exercise: Push Ups, 3 sets of 12" and counting rest-timer seconds aloud, hands-free during a set.
7. **Referral/invite friends:** shareable invite link/code that pre-fills the Find Friends search once the invited person signs up.
8. **Meal suggestions:** given the calculated nutrition targets (Section 8), suggest 2–3 sample meals/day hitting those macros, pulling from a small curated recipe dataset.
9. **Export progress report as PDF:** a shareable one-page summary (useful both as a real user feature and as something you can show off in your project demo/report).

---

## 18. Database Schema (minimum required tables — updated)

- `users` (id, name, **username unique**, email, password_hash, auth_provider, avatar_url, created_at)
- `user_profiles` (user_id FK, age, gender, height, weight, unit_system, goal, workout_location, equipment_home[], equipment_gym[], desired_results[], planning_style, focus_muscles[], fitness_level, intensity, past_experience, days_per_week, session_duration, injuries[], schedule_days[], schedule_time_block, notification_prefs jsonb, onboarding_step, onboarding_completed_at, first_login_tour_seen bool)
- `workout_plans` (id, user_id FK, generated_on, split_structure, active bool)
- `workout_days` (id, plan_id FK, day_of_week, name, exercise_ids[], estimated_duration, estimated_calories)
- `exercises` (id, name, muscle_group, equipment[], difficulty, instructions text, media_url, common_mistakes text, alternative_exercise_ids[], contraindicated_conditions[])
- `workout_logs` (id, user_id FK, date, exercise_ids_completed[], sets_logged jsonb, duration, calories_burned)
- `nutrition_scans` (id, user_id FK, scanned_at, source enum[food_image, barcode, upload], food_name, grade, calories, macros jsonb, **ingredients text**, **ingredients_structured jsonb**, **allergens[]**, **additives jsonb**, raw_api_response jsonb)
- `body_metrics_logs` (id, user_id FK, date, weight, body_fat, muscle_mass, **photo_url nullable**)
- `achievements` (id, user_id FK, badge_type, earned_at)
- `leaderboard` (user_id FK, points, rank_scope)
- `chat_messages` (id, user_id FK, sender enum[user, jiya], message text, timestamp)
- `friend_requests` (id, sender_id FK, recipient_id FK, status enum[pending, accepted, declined], created_at)
- `friendships` (user_id FK, friend_id FK, created_at)

---

## 19. Non-Functional Requirements

Responsive across common Android sizes. Inline validation on every form. Defined loading and empty states everywhere. Authenticated + ownership-checked API endpoints. Buildable as a signed Android App Bundle (.aab) with proper icon/splash for Play Store submission.

---

## 20. Definition of Done — walk through this checklist yourself before calling the app finished

- [ ] Onboarding is exactly 18 screens matching Section 6's groupings.
- [ ] Two test users with different onboarding answers get visibly different workout plans.
- [ ] First-time Home visit triggers Jiya's walkthrough; doesn't repeat unless replayed from Settings.
- [ ] Jiya's chat responds individually to at least 6 consecutive varied messages (including "what's my workout tomorrow" answered with REAL plan data), context carries across the conversation, and history persists after closing/reopening.
- [ ] Jiya's avatar appears identically everywhere she's shown.
- [ ] Signup enforces unique usernames with real-time feedback.
- [ ] Find Friends search returns real matching users by username; sending, accepting, and declining a friend request all work and correctly update the Friends leaderboard.
- [ ] A scanned food/barcode result shows a full ingredient list, allergens, additives (if any), and a full nutrient breakdown (protein, fat, carbs, sugar, fiber, sodium) — not just a single grade letter.
- [ ] Every chart on the Progress screen is genuinely interactive (tap for tooltip, smooth animated range switching).
- [ ] Every exercise row in Workout opens its Exercise Detail page when tapped; "Start Workout" runs a full session and writes to `workout_logs`.
- [ ] The Food tab opens a real camera; the Barcode tab resolves real barcodes via Open Food Facts.
- [ ] Every button/tab/list item on every screen does something real when tapped.
- [ ] Logging out and back in preserves profile, plan, chat history, friends, and progress exactly.
- [ ] Editing a profile field (e.g., adding an injury) visibly changes the generated workout plan.

Build the entire application to this specification now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/69ec8316-0c21-4a86-87ae-0fa0c655fd07).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
