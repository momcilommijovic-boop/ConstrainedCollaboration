# Demo Recording Guide

## Setup

### 1. Start the demo

```bash
# First run (one-time):
npm run seed:demo

# Then start the app:
npm run dev
```

Navigate to `http://localhost:3000` and click **▶ Start** in the toolbar.

### 2. Browser window setup

- Resolution: **1920 × 1080**
- Browser: Chrome or Firefox, no extensions visible
- Zoom: 100% (no browser zoom)
- Hide browser UI: use F11 (fullscreen) or a clean Chrome profile
- Ensure the bottom toolbar (64px) is not obscured

---

## OBS Configuration

### Use Browser Source — not Window Capture

In OBS, add a **Browser Source** (not a Window Capture) pointing to `http://localhost:3000`.

- Width: `1920`
- Height: `1080`
- FPS: `60`
- Check **"Shutdown source when not visible"**: OFF
- Check **"Refresh browser when scene becomes active"**: OFF

Using Browser Source ensures:
- Pixel-perfect rendering at 1:1
- No window chrome captured
- Reliable navigation transitions

### Recommended OBS Scenes

#### Scene 1: Full App (toolbar visible)

Use for all demo steps. Default view.

- Source: Browser Source at `http://localhost:3000`
- No custom CSS

#### Scene 2: Publication Only (toolbar hidden)

Use during Step 15 (publication page) for a clean editorial view.

- Source: Same Browser Source
- Custom CSS in OBS Browser Source properties:

```css
.demo-toolbar {
  display: none !important;
}
```

The toolbar div has class `demo-toolbar` — this CSS hides it cleanly without affecting the rest of the page.

---

## Speed Recommendations

| Use case | Speed setting |
|---|---|
| Final recording | **1×** |
| Rehearsal / timing check | **2×** |
| Quick preview | **3×** |

---

## Scene Switching Instructions

### Step 15: Publication page

When the demo toolbar label reads **"Step 15/18: Elena publishes the issue"**, switch to **Scene 2: Publication Only** in OBS before the narration card disappears. Switch back to **Scene 1** at Step 16.

Keyboard shortcut: assign OBS scene switching to a hotkey (OBS → Settings → Hotkeys) so you can switch without moving the mouse on screen.

---

## Tips

- Run the demo at **2× speed** first to rehearse transitions.
- The narration card (top-right) fades in at each step — allow 0.4s before cutting.
- The demo toolbar progress bar shows time remaining in the current step.
- Use the **⏸ Pause** button to hold on any frame for commentary.
- Use **↺ Reset** to restart cleanly between takes — this deletes all demo data and returns to step 1.
- For voiceover: the narration text in the card is the scripted narration. Read it with a 0.5s delay after the card appears.

---

## Troubleshooting

**Demo won't start**: Check that `NEXT_PUBLIC_DEMO_MODE=true` is set in `.env.local`.

**Users not found**: Run `npm run seed:demo` again. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set.

**API errors in console**: Check Supabase is running and the `demo_content` table exists (run migration `20260520000010_demo_content.sql`).

**Toolbar not visible**: Confirm `NEXT_PUBLIC_DEMO_MODE=true` in your environment and restart `npm run dev`.
