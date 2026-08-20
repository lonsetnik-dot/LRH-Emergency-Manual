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
   WIRING: mark the operating card with data-opcard.

       <div class="card" id="phasebox" data-opcard> … </div>

   Nothing else. A tool with no such element gets no behavior and no error.

   THE OPERATING CARD IS A REGION, NOT ALWAYS ONE BOX, and this cost a real
   defect. arrest/ renders the amber "PADS ON — CHECK THE RHYTHM" bar directly
   ABOVE its cycle card while the rhythm is still unknown, and that bar carries
   the only thing to do at that moment. With data-opcard on the cycle card
   alone, starting a case revealed the cycle card correctly and scrolled the
   PADS ON button off the top of the screen — the module hiding the very next
   action, which is the exact failure it exists to prevent. pph/ and dystocia/
   have the same shape: the blood-loss adder and the head-to-body clock sit
   above their phase boxes.

   So mark EVERY element that is part of "what to do now", and the module
   anchors on whichever of them is currently topmost on screen. Elements that
   are display:none are ignored, so a bar that only exists during one phase
   participates only during that phase. The step signature is their combined
   text, which means a bar APPEARING or DISAPPEARING is itself a step change.
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

  var lastGestureAt = 0, armed = false, observer = null, cards = [];
  var settleTimer = null, lastRevealAt = 0, signatureAtGesture = '', overlayWaited = 0;

  /* Rendered right now — not merely present in the DOM. Every engine keeps its phase bars
     in the document and toggles display, so this is what distinguishes "part of the
     operating region during this phase" from "part of it during some other phase". */
  function isRendered(el) {
    var r = el.getBoundingClientRect();
    return r.height > 0 || r.width > 0;
  }

  function liveCards() {
    var out = [];
    for (var i = 0; i < cards.length; i++) if (isRendered(cards[i])) out.push(cards[i]);
    return out;
  }

  /* The element the reveal scrolls to: the topmost piece of the operating region currently
     on screen. Measured rather than taken from document order, so an engine that reorders
     its bars cannot silently anchor on the wrong one. */
  function anchorCard() {
    var live = liveCards(), best = null, bestTop = Infinity;
    for (var i = 0; i < live.length; i++) {
      var t = live[i].getBoundingClientRect().top;
      if (t < bestTop) { bestTop = t; best = live[i]; }
    }
    return best;
  }

  /* The region's meaning, with everything that changes on its own removed: digits (clocks,
     counters, doses that recompute), punctuation and case. Two renders of the SAME step
     one second apart produce identical signatures. Combining the live cards means a bar
     appearing or disappearing — arrest/ retiring PADS ON once a rhythm is named — reads as
     the step change it is. */
  function stepSignature() {
    var live = liveCards(), s = '';
    for (var i = 0; i < live.length; i++) s += (live[i].textContent || '');
    return s.replace(/[^a-z]+/gi, '').toLowerCase();
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

  /* Would scrolling to `target` push a control the clinician can currently see up behind the
     bar? Content scrolled off the TOP is the worst outcome this module can produce: it cannot
     be reached by scrolling the way the page invites you to, and nothing on screen suggests
     there is anything up there. That is precisely the reported defect — starting a case on
     arrest/ scrolled the amber PADS ON button off the top while dutifully revealing the cycle
     card below it.

     Ignores controls inside the sticky chrome, which travel with the viewport. */
  function wouldHideAControl(target) {
    var delta = target - window.scrollY;
    if (delta <= 0) return false;                            /* scrolling UP hides nothing above */
    var barH = chromeHeight(), nodes = document.querySelectorAll('button,a[href],input,select');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.offsetParent) continue;
      var r = el.getBoundingClientRect();
      if (r.height === 0 || r.bottom <= barH || r.top >= (window.innerHeight || 0)) continue;
      var fixed = false;
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        var cs; try { cs = window.getComputedStyle(n); } catch (e) { break; }
        if (cs.position === 'fixed' || cs.position === 'sticky') { fixed = true; break; }
      }
      if (fixed) continue;
      if (r.bottom - delta <= barH) return true;              /* this one would go up and out */
    }
    return false;
  }

  function reveal(el) {
    var target = window.scrollY + el.getBoundingClientRect().top - chromeHeight() - GAP;
    if (target < 0) target = 0;
    if (wouldHideAControl(target)) return;
    try {
      window.scrollTo({ top: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } catch (e) {
      window.scrollTo(0, target);                           /* older engines */
    }
  }

  function maybeReveal() {
    if (!armed || !cards.length) return;
    if (Date.now() - lastGestureAt > GESTURE_MS) { armed = false; return; }
    if (Date.now() - lastRevealAt < COOLDOWN_MS) return;
    if (stepSignature() === signatureAtGesture) return;       /* only the clock moved */

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
    var target = anchorCard();
    if (!target || !needsReveal(target)) return;
    lastRevealAt = Date.now();
    reveal(target);
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
      signatureAtGesture = stepSignature();
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
    cards = [].slice.call(document.querySelectorAll('[data-opcard]'));
    if (!cards.length) return;                               /* nothing to do on this page */

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
    /* Every piece, not just the anchor: a bar being shown or hidden is a change to the
       operating region even when the card below it did not re-render. Watching attributes
       too, because that is how a `display:none` phase bar arrives. */
    for (var i = 0; i < cards.length; i++) {
      observer.observe(cards[i], { childList: true, subtree: true, characterData: true,
                                   attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  /* =========================================================================
     WHY toggle — the second half of the two-tier checklist row (design-system.css
     .t-why). One control per tool shows or hides every row's reasoning at once.

     A per-row disclosure was the obvious design and the wrong one: it puts a second
     tap target inside a label whose whole job is one big checkbox, and it makes the
     clinician decide, row by row, whether they are about to need the explanation.
     One switch, remembered per device, asks that question once.

     Default is OFF — terse. lrh-pref-why is a PREFERENCE, not case state: it
     survives RESET FOR NEXT CASE, because how much detail this reader wants is not
     a fact about this patient. See CASE-STATE.md. */
  var WHY_KEY = 'lrh-pref-why';

  function applyWhy(on) {
    try { document.body.classList.toggle('showwhy', !!on); } catch (e) {}
    var btn = document.getElementById('whybtn');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'WHY \u2212' : 'WHY +';
      btn.setAttribute('aria-label', on ? 'Hide the reasoning on every step' : 'Show the reasoning on every step');
    }
  }

  function startWhy() {
    var btn = document.getElementById('whybtn');
    /* The rows exist on pages with no button yet, and the button may exist on a page
       with no rows; neither is an error, and neither should throw. */
    var on = false;
    try { on = localStorage.getItem(WHY_KEY) === '1'; } catch (e) {}
    applyWhy(on);
    if (!btn) return;
    btn.addEventListener('click', function () {
      on = !on;
      try { localStorage.setItem(WHY_KEY, on ? '1' : '0'); } catch (e) {}
      applyWhy(on);
    });
  }

  function boot() { start(); startWhy(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  /* Exposed for the verify suite and for a champion reading behavior from the
     console — the same courtesy window.SITE gets (issues #116/#117/#118). */
  return {
    /* How many operating-region elements the module LATCHED ONTO at boot — not how many
       are on screen now. The two answer different questions, and a suite that asks the
       wrong one is unfalsifiable: before a case starts nothing is rendered, so "is the
       module wired to this page" cannot be answered by looking at what is visible. */
    bound: function () { return cards.length; },
    card: function () { return anchorCard(); },
    cards: function () { return liveCards(); },
    needsReveal: function () { var a = anchorCard(); return a ? needsReveal(a) : false; },
    signature: function () { return stepSignature(); },
    chromeHeight: chromeHeight,
    config: { gestureMs: GESTURE_MS, readableFraction: READABLE_FRACTION, gap: GAP,
              settleMs: SETTLE_MS, cooldownMs: COOLDOWN_MS }
  };
})();
