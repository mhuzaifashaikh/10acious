(function () {
  'use strict';

  var doc = document;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function $(selector, context) {
    return (context || doc).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.prototype.slice.call((context || doc).querySelectorAll(selector));
  }

  /* One rAF-throttled scroll listener shared by every scroll-linked effect */
  var scrollHandlers = [];
  var scrollTicking = false;

  function runScrollHandlers() {
    scrollTicking = false;
    for (var i = 0; i < scrollHandlers.length; i++) scrollHandlers[i]();
  }

  function onScroll(handler) {
    if (!scrollHandlers.length) {
      window.addEventListener(
        'scroll',
        function () {
          if (!scrollTicking) {
            scrollTicking = true;
            requestAnimationFrame(runScrollHandlers);
          }
        },
        { passive: true }
      );
    }
    scrollHandlers.push(handler);
    handler();
  }

  /* ===== MOBILE MENU ===== */
  var toggle = doc.getElementById('nav-toggle');
  var menu = doc.getElementById('mobile-menu');

  if (toggle && menu) {
    var desktop = window.matchMedia('(min-width: 641px)');

    var setOpen = function (open) {
      menu.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      doc.body.classList.toggle('menu-open', open);
    };

    var isOpen = function () {
      return menu.classList.contains('open');
    };

    toggle.addEventListener('click', function () {
      var open = !isOpen();
      setOpen(open);
      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      } else {
        toggle.focus();
      }
    });

    menu.addEventListener('click', function (event) {
      if (event.target === menu || event.target.closest('a')) {
        setOpen(false);
      }
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    var onDesktopChange = function (event) {
      if (event.matches && isOpen()) setOpen(false);
    };

    if (desktop.addEventListener) desktop.addEventListener('change', onDesktopChange);
    else if (desktop.addListener) desktop.addListener(onDesktopChange);
  }

  /* ===== NAVBAR ===== */
  var navbar = $('.navbar');

  if (navbar) {
    /* Scroll state */
    onScroll(function () {
      navbar.classList.toggle('scrolled', window.scrollY > 24);
    });

    /* Call to action: appears once the hero button has scrolled away,
       steps aside again while the form itself is on screen */
    var heroCta = $('.hero .cta-btn');
    var formCard = $('.form-card');

    if (heroCta && formCard && hasIO) {
      var ctaGone = false;
      var formSeen = true;

      var syncCta = function () {
        navbar.classList.toggle('show-cta', ctaGone && !formSeen);
      };

      new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        ctaGone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        syncCta();
      }).observe(heroCta);

      new IntersectionObserver(
        function (entries) {
          formSeen = entries[entries.length - 1].isIntersecting;
          syncCta();
        },
        { threshold: 0.25 }
      ).observe(formCard);
    }

    /* Sliding highlight + current section */
    var navList = $('.nav-links', navbar);
    var navLinks = navList ? $$('a', navList) : [];

    if (navList && navLinks.length) {
      var indicator = doc.createElement('li');
      indicator.className = 'nav-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.setAttribute('role', 'presentation');
      navList.insertBefore(indicator, navList.firstChild);
      navList.classList.add('has-indicator');

      var activeLink = null;
      var hoverLink = null;

      var placeIndicator = function () {
        var link = hoverLink || activeLink;
        if (!link || !link.offsetWidth) {
          indicator.classList.remove('is-visible');
          return;
        }
        indicator.style.setProperty('--x', link.offsetLeft + 'px');
        indicator.style.setProperty('--w', link.offsetWidth + 'px');
        indicator.classList.add('is-visible');
      };

      navLinks.forEach(function (link) {
        link.addEventListener('pointerenter', function () {
          hoverLink = link;
          placeIndicator();
        });
        link.addEventListener('focus', function () {
          hoverLink = link;
          placeIndicator();
        });
        link.addEventListener('blur', function () {
          hoverLink = null;
          placeIndicator();
        });
      });

      navList.addEventListener('pointerleave', function () {
        hoverLink = null;
        placeIndicator();
      });

      window.addEventListener('resize', placeIndicator);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(placeIndicator);

      /* Mark the link whose section crosses the middle of the viewport */
      var sectionLinks = {};
      navLinks.forEach(function (link) {
        var href = link.getAttribute('href') || '';
        if (href.charAt(0) === '#' && href.length > 1) sectionLinks[href.slice(1)] = link;
      });

      var watched = Object.keys(sectionLinks)
        .map(function (id) {
          return doc.getElementById(id);
        })
        .filter(Boolean);

      if (watched.length && hasIO) {
        var inMiddle = {};

        var sectionObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              inMiddle[entry.target.id] = entry.isIntersecting;
            });

            var current = null;
            watched.forEach(function (section) {
              if (inMiddle[section.id]) current = sectionLinks[section.id];
            });

            if (current !== activeLink) {
              if (activeLink) {
                activeLink.classList.remove('is-active');
                activeLink.removeAttribute('aria-current');
              }
              activeLink = current;
              if (activeLink) {
                activeLink.classList.add('is-active');
                activeLink.setAttribute('aria-current', 'location');
              }
              placeIndicator();
            }
          },
          { rootMargin: '-45% 0px -55% 0px' }
        );

        watched.forEach(function (section) {
          sectionObserver.observe(section);
        });
      }
    }
  }

  /* ===== OPENING FILM =====
     The class is set by an inline script in the head, before first paint.
     Hero reveals wait for the film to end so the form rises as it does. */
  var root = doc.documentElement;
  var introActive = root.classList.contains('intro-active');
  var afterIntro = [];

  function endIntro(immediate) {
    if (!introActive) return;
    introActive = false;
    root.classList.remove('intro-active');
    /* The long rise of the form only makes sense while the hero is on screen */
    if (window.scrollY < 40) root.classList.add('intro-arrive');

    var layer = $('.hero-intro');
    if (layer) layer.classList.add('is-leaving');

    setTimeout(function () {
      if (layer) {
        var film = $('video', layer);
        if (film) {
          film.pause();
          film.removeAttribute('src');
          film.load();
        }
        layer.parentNode.removeChild(layer);
      }
    }, 700);

    /* next frame, so the arrival styles are in place before reveals fire */
    requestAnimationFrame(function () {
      afterIntro.forEach(function (fn) {
        fn();
      });
    });
  }

  if (introActive) {
    window.__introStarted = true;
    var introLayer = $('.hero-intro');

    if (!introLayer || window.scrollY > 40) {
      endIntro(true);
    } else {
      var film = doc.createElement('video');
      film.muted = true;
      film.defaultMuted = true;
      film.playsInline = true;
      film.setAttribute('muted', '');
      film.setAttribute('playsinline', '');
      film.preload = 'auto';
      film.poster = 'intro-poster.jpg';
      film.src = 'intro-desktop.mp4';
      /* A touch quicker than filmed */
      film.defaultPlaybackRate = 1.25;
      film.playbackRate = 1.25;
      introLayer.appendChild(film);

      var playing = false;

      /* A slow connection gets the site, not a wait */
      var giveUp = setTimeout(function () {
        if (!playing) endIntro(false);
      }, 3500);

      film.addEventListener('playing', function () {
        playing = true;
        clearTimeout(giveUp);
      });

      /* The film itself dissolves into the painting and holds on it, so
         the hand-over waits for the true last frame: nothing shifts. */
      film.addEventListener('ended', function () {
        endIntro(false);
      });
      film.addEventListener('error', function () {
        endIntro(false);
      });

      var attempt = film.play();
      if (attempt && attempt.catch) {
        attempt.catch(function () {
          endIntro(false);
        });
      }

      /* The film always plays through: scrolling is held until it ends.
         The one exception is a refresh that the browser restores to a
         spot further down the page, where there is no film to watch. */
      window.addEventListener('scroll', function onRestore() {
        if (window.scrollY > 40) {
          window.removeEventListener('scroll', onRestore);
          endIntro(true);
        }
      }, { passive: true });
    }
  }

  /* ===== SCROLL REVEALS ===== */
  var revealEls = $$('[data-reveal]');

  /* Once an element has arrived, hand it back to its own styles so the
     reveal transition never slows down hover and press feedback. */
  function settle(el) {
    var delay = parseFloat(getComputedStyle(el).getPropertyValue('--reveal-delay')) || 0;
    var done = false;

    var finish = function () {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      el.removeAttribute('data-reveal');
    };

    var onEnd = function (event) {
      if (event.target === el && event.propertyName === 'transform') finish();
    };

    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, (delay + 0.9) * 1000 + 400);
  }

  if (hasIO && !reducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            settle(entry.target);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    var heroEl = doc.getElementById('hero');

    revealEls.forEach(function (el) {
      if (introActive && heroEl && heroEl.contains(el)) {
        afterIntro.push(function () {
          revealObserver.observe(el);
        });
      } else {
        revealObserver.observe(el);
      }
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('in-view');
    });
  }

  /* ===== STAT COUNT-UP ===== */
  var counters = $$('[data-count-to]');

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    var duration = 1100;
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  if (hasIO && !reducedMotion && counters.length) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach(function (el) {
      counterObserver.observe(el);
    });
  }

  /* ===== PARALLAX: hero painting + services grid ===== */
  var heroBg = $('.hero-bg');
  var gridBg = $('.grid-bg');
  var gridSection = doc.getElementById('services');

  if (!reducedMotion && (heroBg || (gridBg && gridSection))) {
    var updateParallax = function () {
      var wide = window.innerWidth > 768;

      if (heroBg) {
        /* The painting trails the scroll slightly; phones keep their
           fold-pinned artwork untouched. */
        var shift = wide ? Math.min(window.scrollY * 0.1, 96) : 0;
        heroBg.style.setProperty('--hero-shift', shift.toFixed(1) + 'px');
      }

      if (gridBg && gridSection) {
        if (!wide) {
          gridBg.style.transform = '';
        } else {
          var rect = gridSection.getBoundingClientRect();
          var y = Math.max(-360, Math.min(360, rect.top * 0.3));
          gridBg.style.transform = 'translate3d(0, ' + y + 'px, 0)';
        }
      }
    };

    onScroll(updateParallax);
    window.addEventListener('resize', updateParallax);
  }

  /* ===== HERO POLLEN ===== */
  var motes = $('.hero-motes');

  if (motes && !reducedMotion) {
    var moteCount = window.innerWidth > 768 ? 22 : 10;
    var rand = function (min, max) {
      return min + Math.random() * (max - min);
    };

    for (var m = 0; m < moteCount; m++) {
      var mote = doc.createElement('i');
      var life = rand(14, 30);
      mote.style.setProperty('--x', rand(-4, 96).toFixed(1) + '%');
      mote.style.setProperty('--y', rand(46, 98).toFixed(1) + '%');
      mote.style.setProperty('--s', rand(0.25, 0.6).toFixed(2) + 'rem');
      mote.style.setProperty('--d', life.toFixed(1) + 's');
      mote.style.setProperty('--delay', (-rand(0, life)).toFixed(1) + 's');
      mote.style.setProperty('--dx', rand(1.5, 7).toFixed(1) + 'rem');
      mote.style.setProperty('--dy', (-rand(3, 10)).toFixed(1) + 'rem');
      mote.style.setProperty('--o', rand(0.35, 0.9).toFixed(2));
      motes.appendChild(mote);
    }
  }

  /* ===== VOICE WAVEFORM =====
     A row of the logo's pills, breathing while idle and speaking up each
     time a new task phrase arrives. */
  var wave = (function () {
    var wrap = $('.voice-wave');
    var canvas = wrap && $('canvas', wrap);
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;

    var width = 0;
    var height = 0;
    var dpr = 1;
    var count = 0;
    var barWidth = 0;
    var gap = 0;
    var levels = [];
    var seeds = [];
    var gradient = null;
    var energy = 0;
    var visible = false;
    var frame = 0;
    var last = 0;

    function pill(x, y, w, h) {
      var r = w / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.arc(x + r, y + r, r, Math.PI, 0);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + r, y + h - r, r, 0, Math.PI);
        ctx.closePath();
      }
      ctx.fill();
    }

    function target(i, t) {
      var position = (i + 0.5) / count;
      var envelope = Math.pow(Math.sin(Math.PI * position), 1.25);
      var idle = 0.5 + 0.5 * Math.sin(t * 0.0011 - i * 0.38);
      var speech = Math.abs(Math.sin(t * 0.011 + seeds[i])) * (0.62 + 0.38 * Math.sin(t * 0.0043 + i * 0.9));
      return envelope * (0.09 + 0.15 * idle + energy * (0.2 + 0.62 * speech));
    }

    function draw(t, ease) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gradient;

      var step = barWidth + gap;
      var startX = (width - (count * step - gap)) / 2;

      for (var i = 0; i < count; i++) {
        levels[i] += (target(i, t) - levels[i]) * ease;
        var h = Math.max(barWidth, levels[i] * height);
        pill((startX + i * step) * dpr, ((height - h) / 2) * dpr, barWidth * dpr, h * dpr);
      }
    }

    function tick(t) {
      frame = 0;
      var dt = Math.min(t - last, 64);
      last = t;
      energy *= Math.pow(0.5, dt / 620);
      draw(t, 1 - Math.pow(0.0001, dt / 1000));
      if (visible && !doc.hidden) frame = requestAnimationFrame(tick);
    }

    function start() {
      if (reducedMotion || frame || !visible || doc.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function resize() {
      var rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      barWidth = Math.max(3, Math.round(height * 0.075));
      gap = Math.round(barWidth * 1.05);
      count = Math.max(12, Math.floor((width + gap) / (barWidth + gap)));

      while (levels.length < count) {
        levels.push(0.08);
        seeds.push(Math.random() * Math.PI * 2);
      }

      /* Same stops as the pill in the logo */
      gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0.04, '#002242');
      gradient.addColorStop(0.3, '#264e4b');
      gradient.addColorStop(0.52, '#5f8e59');
      gradient.addColorStop(0.76, '#97d067');
      gradient.addColorStop(0.98, '#c1ff72');

      if (reducedMotion) {
        /* A single composed frame, mid-sentence */
        energy = 0.7;
        draw(1400, 1);
      } else if (!frame) {
        draw(performance.now(), 1);
      }
    }

    resize();
    window.addEventListener('resize', resize);

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        start();
      }).observe(wrap);
    } else {
      visible = true;
      start();
    }

    doc.addEventListener('visibilitychange', start);

    return {
      pulse: function () {
        energy = 1;
      }
    };
  })();

  /* ===== TASK PHRASE ROTATOR ===== */
  var shuffleViewport = $('.shuffle-viewport');
  var chips = $$('.task-chip');

  if (shuffleViewport && !reducedMotion) {
    var shufflePhrases = [
      'customer service inquiries',
      'appointment bookings',
      'reception calls',
      'taking orders',
      'billing/account inquiries',
      'booking reservations',
      'tech support quotes'
    ];
    var shuffleWord = shuffleViewport.querySelector('.shuffle-word');
    var shuffleIndex = 0;
    var SWAP_MS = 380;
    var HOLD_MS = 1900;
    var swapping = false;
    var queued = null;
    var hovering = false;

    var chipStrip = chips.length ? chips[0].parentNode : null;

    var markChip = function (index) {
      chips.forEach(function (chip, i) {
        chip.classList.toggle('is-active', i === index);
      });

      /* On phones the tasks sit in one swipeable row: keep the current
         one centred. Scrolls the row only, never the page. */
      var chip = chips[index];
      if (chip && chipStrip.scrollWidth > chipStrip.clientWidth + 1) {
        var left = chip.offsetLeft - (chipStrip.clientWidth - chip.offsetWidth) / 2;
        if (chipStrip.scrollTo) chipStrip.scrollTo({ left: left, behavior: 'smooth' });
        else chipStrip.scrollLeft = left;
      }
    };

    var showPhrase = function (next) {
      if (next === shuffleIndex) return;
      if (swapping) {
        queued = next;
        return;
      }

      swapping = true;
      shuffleWord.classList.add('is-leaving');

      setTimeout(function () {
        shuffleIndex = next;
        shuffleWord.textContent = shufflePhrases[shuffleIndex];
        shuffleWord.classList.remove('is-leaving');
        shuffleWord.classList.add('is-entering');
        void shuffleWord.offsetWidth;
        shuffleWord.classList.remove('is-entering');
        markChip(shuffleIndex);
        if (wave) wave.pulse();

        setTimeout(function () {
          swapping = false;
          if (queued !== null) {
            var pending = queued;
            queued = null;
            showPhrase(pending);
          }
        }, SWAP_MS);
      }, SWAP_MS);
    };

    setInterval(function () {
      if (doc.hidden || hovering) return;
      showPhrase((shuffleIndex + 1) % shufflePhrases.length);
    }, HOLD_MS);

    /* With a mouse, pointing at a task holds it in the headline */
    if (finePointer && chips.length === shufflePhrases.length) {
      chips.forEach(function (chip, i) {
        chip.addEventListener('pointerenter', function () {
          hovering = true;
          showPhrase(i);
        });
      });

      chipStrip.addEventListener('pointerleave', function () {
        hovering = false;
      });
    }
  }

  /* ===== FAQ: animated open and close ===== */
  $$('.faq-item').forEach(function (item) {
    var summary = $('summary', item);
    var answer = $('.faq-answer', item);
    if (!summary || !answer || reducedMotion || !answer.animate) return;

    var running = null;
    var EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

    var reset = function () {
      running = null;
      answer.style.overflow = '';
    };

    summary.addEventListener('click', function (event) {
      event.preventDefault();
      if (running) running.cancel();

      var opening = !item.open || item.classList.contains('is-closing');
      item.classList.toggle('is-closing', !opening);
      if (opening) item.open = true;

      var style = getComputedStyle(answer);
      var full = { height: answer.offsetHeight + 'px', paddingBottom: style.paddingBottom, opacity: 1 };
      var shut = { height: '0px', paddingBottom: '0px', opacity: 0 };

      answer.style.overflow = 'hidden';
      running = answer.animate(opening ? [shut, full] : [full, shut], {
        duration: opening ? 460 : 340,
        easing: EASE
      });

      running.onfinish = function () {
        if (!opening) {
          item.open = false;
          item.classList.remove('is-closing');
        }
        reset();
      };
      running.oncancel = reset;
    });
  });

  /* ===== POINTER SPOTLIGHT on cards ===== */
  if (finePointer) {
    $$('[data-spot]').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (event.clientX - rect.left).toFixed(0) + 'px');
        card.style.setProperty('--my', (event.clientY - rect.top).toFixed(0) + 'px');
      });
    });
  }

  /* ===== FORM SHORTCUTS: land in the first field, ready to type ===== */
  var firstField = doc.getElementById('business-name');

  if (firstField && finePointer) {
    $$('a[href="#form"]').forEach(function (link) {
      link.addEventListener('click', function () {
        var focused = false;

        var focusField = function () {
          if (focused) return;
          focused = true;
          window.removeEventListener('scrollend', focusField);
          firstField.focus({ preventScroll: true });
        };

        if ('onscrollend' in window) window.addEventListener('scrollend', focusField);
        setTimeout(focusField, 1100);
      });
    });
  }
})();
