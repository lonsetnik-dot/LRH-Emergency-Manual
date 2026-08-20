/* ===========================================================================
   case-shell.js — shared runtime behavior for the case shell (SHELL.md).

   Injected by build.mjs wherever a tool's <script> carries the marker
   (slash-star) @shell-js (star-slash), the same mechanism as design-system.css
   and inventory.js, so deployed tools stay self-contained and offline
   (CLAUDE.md rule 1) and this behavior is edited ONCE for every engine.

   ---------------------------------------------------------------------------
   WHAT THIS FIXES: the next step was off the top of the screen.

   Every live-protocol engine renders one OPERATING CARD — the box that says
   what to do now (arrest's cycle card, neonatal/pph/dystocia's phase box,
   airway's plan box, tca's decision card). Reference content sits below it:
   the full ladder, the scope note, the sources.

   A clinician scrolls down to read the ladder. From there they tap the action
   the ladder just told them to take. The protocol advances — and the operating
   card, now showing the NEXT step, is a thousand pixels above the viewport.
   Nothing on screen changed where they were looking. Measured before this fix,
   after scrolling to the bottom and acting: dystocia -883px, neonatal -585px,
   pph -902px, arrest -1132px, airway -441px. All six engines, every time.

   During a shoulder dystocia the head-to-body interval is the clock. Asking
   someone to find and scroll a page to learn the next maneuver is spending the
   one resource the tool exists to protect.

   ---------------------------------------------------------------------------
   THE RULE: an action you took, whose result you cannot see, brings the result
   to you. Nothing else moves the page.

   Deliberately narrow, because an unrequested scroll mid-code is its own
   hazard — it takes the text away from whoever is reading it, which is the
   same reason the offline shell never reloads a page by itself (issue #120):

   1. ONLY AFTER A REAL USER GESTURE. Armed by pointerdown/keydown, and only
      for ~1.5 s. A countdown ticking, a metronome beat, or a cross-tab sync
      can never scroll the page — they mutate the card constantly and nobody
      asked them to move anything.
   2. ONLY IF THE STEP ITSELF CHANGED — not merely the card's DOM. Every engine
      re-renders the whole operating card on the 1 s clock tick, so "the card
      mutated" means almost nothing: measured, it made ANY tap within the gesture
      window scroll the page, including opening a reference accordion at the
      bottom. What is compared instead is the card's text WITH DIGITS AND
      PUNCTUATION STRIPPED. A countdown going 2:31 -> 2:30 leaves that signature
      identical; advancing from PRESSURE to LEGS changes it. Words changed = the
      step changed. No engine has to declare which of its buttons advance
      anything, and tapping MUTE still scrolls nothing.
   3. ONLY IF THE NEXT STEP IS NOT ALREADY READABLE. If the card's head is
      already below the app bar and in the top half of the screen, nothing
      moves. Most taps therefore scroll nothing at all.
   4. ONCE PER GESTURE, AND ONLY ONCE THE DOM HAS SETTLED. Mutations are coalesced
      over a short window and a cooldown covers the scroll animation, so a card
      that re-renders in several batches is scrolled to once, at its final size.
   5. A DELIBERATE SCROLL WINS. If the clinician scrolls after acting, they have
      said where they want to be; the pending reveal is cancelled. Never argue
      with someone's thumb.
   6. NEVER BEHIND AN OPEN SHEET. Scrolling the page under the timeline sheet
      would be invisible now and disorienting when it closes.

   Motion respects prefers-reduced-motion, per ACCESSIBILITY.md.

   ---------------------------------------------------------------------------
   WIRING: mark the operating card with data-opcard. One attribute per engine:

       <div class="card" id="phasebox" data-opcard> … </div>

   Nothing else. A tool with no such element gets no behavior and no error.
   =========================================================================== */
var CASE_SHELL = (function () {
  'use strict';

  /* How long after a tap a DOM change still counts as "the result of that tap".
     Long enough for a render behind an await/timeout, short enough that it can
     never be a coincidence with the 1 s clock tick. */
  var GESTURE_MS = 1500;
  /* The card's head must sit below the bar and within this fraction of the
     screen, or it is not readable without scrolling. */
  var READABLE_FRACTION = 0.5;
  /* Breathing room between the sticky bar and the card. */
  var GAP = 10;

  /* A re-render that lands in more than one batch (pph rewrites the phase box, then
     fills the uterotonic rows) must be scrolled to ONCE, after it settles — measuring on
     the first batch put the card 88px above the fold because it grew afterwards. */
  var SETTLE_MS = 140;
  /* Smooth scrolling takes a few hundred ms, during which the card's measured position is
     mid-flight. Do not let a mutation arriving in that window restart the animation. */
  var COOLDOWN_MS = 600;

  /* While a picker is open, re-check this often for it closing, and give up after this
     long so a sheet left open forever cannot leave a timer running for the whole case. */
  var OVERLAY_POLL_MS = 250;
  var OVERLAY_MAX_WAIT_MS = 60000;

  var lastGestureAt = 0, armed = false, observer = null, card = null;
  var settleTimer = null, lastRevealAt = 0, signatureAtGesture = '', overlayWaited = 0;

  /* The card's meaning, with everything that changes on its own removed: digits (clocks,
     counters, doses that recompute), punctuation and case. Two renders of the SAME step
     one second apart produce identical signatures. */
  function stepSignature(el) {
    if (!el) return '';
    return (el.textContent || '').replace(/[^a-z]+/gi, '').toLowerCase();
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* Measured, not hardcoded: the app bar is 56px on a phone and 60px from
     768px up (SHELL.md layer 1), and a tool may not have one at all. */
  function chromeHeight() {
    var h = 0;
    var sels = ['.shellbar', '.hdr'];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      var cs;
      try { cs = window.getComputedStyle(el); } catch (e) { continue; }
      if (cs && cs.position === 'sticky' && cs.display !== 'none') {
        h = Math.max(h, el.getBoundingClientRect().height);
      }
    }
    return h;
  }

  /* An open bottom sheet / modal overlay. Engines render these as fixed
     full-viewport layers; scrolling underneath one is pointless. */
  function overlayOpen() {
    var nodes = document.querySelectorAll('div,section,aside');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.offsetParent && el.style.display === 'none') continue;
      var cs;
      try { cs = window.getComputedStyle(el); } catch (e) { continue; }
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      /* covers most of the screen and is above the app bar's layer */
      if (r.height > window.innerHeight * 0.5 && r.width > window.innerWidth * 0.8
          && (parseInt(cs.zIndex, 10) || 0) >= 50) return true;
    }
    return false;
  }

  function needsReveal(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.height === 0 && r.width === 0) return false;      /* not rendered */
    var barH = chromeHeight();
    if (r.top < barH) return true;                          /* behind the bar, or above the screen */
    if (r.top > vh * READABLE_FRACTION) return true;        /* too low to read without scrolling */
    return false;
  }

  function reveal(el) {
    var target = window.scrollY + el.getBoundingClientRect().top - chromeHeight() - GAP;
    if (target < 0) target = 0;
    try {
      window.scrollTo({ top: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } catch (e) {
      window.scrollTo(0, target);                           /* older engines */
    }
  }

  function maybeReveal() {
    if (!armed || !card) return;
    if (Date.now() - lastGestureAt > GESTURE_MS) { armed = false; return; }
    if (Date.now() - lastRevealAt < COOLDOWN_MS) return;
    if (stepSignature(card) === signatureAtGesture) return;   /* only the clock moved */

    /* A picker is up. The step behind it has already changed — every engine advances the
       card when the sheet opens — so stay ARMED rather than resolving now: scrolling under
       a sheet is invisible, and disarming here stranded the clinician at the bottom of the
       page the moment they dismissed the sheet with ✕ instead of choosing from it.

       Waiting for "the next mutation" is not enough: some engines repaint the card every
       second and some only on a state change, so after the sheet closes there may be no
       mutation at all to re-trigger this. Poll instead, cheaply and with a hard cap, until
       the sheet is gone — then decide against the ORIGINAL pre-tap signature. */
    if (overlayOpen()) {
      lastGestureAt = Date.now();
      if (overlayWaited < OVERLAY_MAX_WAIT_MS) {
        overlayWaited += OVERLAY_POLL_MS;
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(function () { settleTimer = null; maybeReveal(); }, OVERLAY_POLL_MS);
      }
      return;
    }
    overlayWaited = 0;

    /* No sheet in the way, so this gesture is RESOLVED either way. Disarm before deciding
       whether to scroll: leaving it armed after concluding "already visible, nothing to do"
       let an unrelated later tick act on a stale gesture and scroll the page long after the
       tap that armed it. One tap, one decision. */
    armed = false;
    if (!needsReveal(card)) return;
    lastRevealAt = Date.now();
    reveal(card);
  }

  /* Coalesce a burst of mutations into one measurement of the finished DOM. */
  function scheduleReveal() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(function () { settleTimer = null; maybeReveal(); }, SETTLE_MS);
  }

  function noteGesture() {
    /* The baseline is captured only when arming FRESH. A second tap while a gesture is
       still in flight — dismissing the picker that the first tap opened — must not
       re-baseline, or the comparison is made against a card that has already advanced and
       the reveal never fires. What is being answered is "has the step changed since the
       clinician last acted from a settled screen", and that question survives the taps
       taken inside one interaction. */
    if (!armed || Date.now() - lastGestureAt > GESTURE_MS) {
      signatureAtGesture = stepSignature(card);
    }
    lastGestureAt = Date.now();
    armed = true;
  }

  /* A scroll the clinician performs THEMSELVES cancels a pending reveal — they have just
     said where they want to be. Never argue with a thumb.

     Deliberately listens for wheel/touchmove rather than the `scroll` event, which cannot
     tell intent from layout: advancing a step shortens the page, the browser clamps
     scrollY, and that emits `scroll` with nobody having touched anything. Listening to it
     silently cancelled the very reveals this module exists to perform — it looked like a
     reduced-motion bug and was actually every engine, every advance that shrank the page. */
  function noteUserScroll() {
    if (!armed) return;
    armed = false;
    overlayWaited = 0;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  }

  function start() {
    card = document.querySelector('[data-opcard]');
    if (!card) return;                                       /* nothing to do on this page */

    /* Capture phase: the gesture must be recorded before the engine's own
       handler runs and re-renders the card. */
    document.addEventListener('pointerdown', noteGesture, true);
    document.addEventListener('keydown', noteGesture, true);
    /* Some engines dispatch synthetic clicks; pointerdown does not fire for
       those, and a keyboard Enter on a button raises click without keydown on
       older paths. Cheap to cover both. */
    document.addEventListener('click', noteGesture, true);
    window.addEventListener('wheel', noteUserScroll, { passive: true });
    window.addEventListener('touchmove', noteUserScroll, { passive: true });

    if (typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(scheduleReveal);
    observer.observe(card, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, false);
  } else {
    start();
  }

  /* Exposed for the verify suite and for a champion reading behavior from the
     console — the same courtesy window.SITE gets (issues #116/#117/#118). */
  return {
    card: function () { return card; },
    needsReveal: function () { return card ? needsReveal(card) : false; },
    signature: function () { return stepSignature(card); },
    chromeHeight: chromeHeight,
    config: { gestureMs: GESTURE_MS, readableFraction: READABLE_FRACTION, gap: GAP,
              settleMs: SETTLE_MS, cooldownMs: COOLDOWN_MS }
  };
})();
