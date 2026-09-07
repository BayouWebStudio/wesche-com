'use strict';

// Native image links remain usable without JavaScript. Enhance them with
// a keyboard-accessible modal; the browser handles focus containment.
const artDialog = document.getElementById('art-dialog');
const artImage = document.getElementById('art-image');
const artCaption = document.getElementById('art-caption');
const artCount = document.getElementById('art-count');
let artworkGroup = [];
let artworkIndex = 0;
let artworkTrigger = null;

function showArtwork(index) {
  artworkIndex = (index + artworkGroup.length) % artworkGroup.length;
  const artwork = artworkGroup[artworkIndex];
  artImage.src = artwork.href;
  artImage.alt = artwork.dataset.caption;
  artCaption.textContent = artwork.dataset.caption;
  artCount.textContent = `${artworkIndex + 1} / ${artworkGroup.length}`;
}

document.querySelectorAll('[data-gallery]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (typeof artDialog.showModal !== 'function') return;
    event.preventDefault();
    artworkTrigger = link;
    artworkGroup = Array.from(document.querySelectorAll('[data-gallery]'))
      .filter(item => item.dataset.gallery === link.dataset.gallery);
    showArtwork(artworkGroup.indexOf(link));
    artDialog.showModal();
    document.getElementById('art-close').focus();
  });
});
document.getElementById('art-close').addEventListener('click', () => artDialog.close());
document.getElementById('art-prev').addEventListener('click', () => showArtwork(artworkIndex - 1));
document.getElementById('art-next').addEventListener('click', () => showArtwork(artworkIndex + 1));
artDialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showArtwork(artworkIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
artDialog.addEventListener('click', event => {
  const rect = artDialog.getBoundingClientRect();
  if (event.target === artDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) artDialog.close();
});
artDialog.addEventListener('close', () => artworkTrigger?.focus({preventScroll:true}));

// <details> keeps navigation available even without JavaScript.
const mobileNav = document.querySelector('.mobile-nav');
mobileNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => { mobileNav.open = false; });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobileNav.open) {
    mobileNav.open = false;
    mobileNav.querySelector('summary').focus();
  }
});
document.addEventListener('click', event => {
  if (!mobileNav.contains(event.target)) mobileNav.open = false;
});

// Same production newsletter endpoint as the existing site. This preview
// never reports success unless both the HTTP response and application say OK.
const newsletterForm = document.getElementById('newsletter-form');
const newsletterEmail = document.getElementById('newsletter-email');
const newsletterStatus = document.getElementById('newsletter-status');
const subscribeButton = newsletterForm.querySelector('button');
newsletterForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (subscribeButton.disabled || !newsletterForm.reportValidity()) return;
  const email = newsletterEmail.value.trim();
  subscribeButton.disabled = true;
  newsletterForm.setAttribute('aria-busy', 'true');
  newsletterStatus.dataset.state = 'pending';
  newsletterStatus.textContent = 'Subscribing…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://fn.bayouwebstudio.com/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error('Subscription was not confirmed');
    newsletterStatus.dataset.state = 'success';
    newsletterStatus.textContent = "You're in. Watch your inbox for the next studio note.";
    newsletterForm.reset();
  } catch {
    newsletterStatus.dataset.state = 'error';
    newsletterStatus.textContent = 'We could not confirm your subscription. Please try again.';
  } finally {
    clearTimeout(timeout);
    subscribeButton.disabled = false;
    newsletterForm.removeAttribute('aria-busy');
  }
});
newsletterEmail.disabled = false;
subscribeButton.disabled = false;
