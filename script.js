(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== MOBILE MENU ===== */
  var toggle = document.getElementById('nav-toggle');
  var menu = document.getElementById('mobile-menu');
  var desktop = window.matchMedia('(min-width: 521px)');

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
  }

  function isOpen() {
    return menu.classList.contains('open');
  }

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

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  desktop.addEventListener('change', function (event) {
    if (event.matches && isOpen()) setOpen(false);
  });

  /* ===== NAVBAR SCROLL STATE ===== */
  var navbar = document.querySelector('.navbar');
  var ticking = false;

  function updateNavbar() {
    navbar.classList.toggle('scrolled', window.scrollY > 24);
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateNavbar);
      }
    },
    { passive: true }
  );

  updateNavbar();

  /* ===== SCROLL REVEALS ===== */
  var revealEls = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window && !reducedMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('in-view');
    });
  }

  /* ===== STAT COUNT-UP ===== */
  var counters = document.querySelectorAll('[data-count-to]');

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    var suffix = el.getAttribute('data-count-suffix') || '';
    var duration = 1100;
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && !reducedMotion) {
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
})();
