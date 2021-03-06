---
---

// TODO Make the whole site work with no JS (modals, etc)
const site = {
  allImagesHaveLoaded: false,

  /**
   * Calls everything that makes the JS run.
   */
  init() {
    // Evil things
    this.polyfills();
    document.documentElement.setAttribute('data-useragent', navigator.userAgent);

    // Load the lettered intro
    this.intro();
    this.lazyLoadImages();
    console.log('🥂 Welcome! 🎉');

    // Run some DOM functions when site is ready
    window.addEventListener('load', () => {
      this.modalController();
      this.animationController();
    });
  },

  /**
   * Polyfills for JS methods.
   */
  polyfills() {
    const ElementProto = window.Element.prototype;

    if (typeof ElementProto.matches !== 'function') {
      ElementProto.matches = ElementProto.msMatchesSelector || ElementProto.mozMatchesSelector || ElementProto.webkitMatchesSelector || function matches(selector) {
        var element = this;
        var elements = (element.document || element.ownerDocument).querySelectorAll(selector);
        var index = 0;

        while (elements[index] && elements[index] !== element) {
          ++index;
        }

        return Boolean(elements[index]);
      };
    }

    if (typeof ElementProto.closest !== 'function') {
      ElementProto.closest = function closest(selector) {
        var element = this;

        while (element && element.nodeType === 1) {
          if (element.matches(selector)) {
            return element;
          }

          element = element.parentNode;
        }

        return null;
      };
    }
  },

  /**
   * Checks if images have loaded, shows the intro section,
   * gets everything ready for animation.
   */
  intro() {
    this.ciaoController();

    // TODO Only reveal wipe when header stuff is loaded
    document.location.href = '#top';
  },

  /**
   * Quick way to lazy load images.
   */
  lazyLoadImages() {
    const images = document.querySelectorAll('img');

    images.forEach((image, index) => {
      if(image.dataset.lazyload !== 'false') {
        image.src = image.dataset.src;
      }
    });

    this.allImagesHaveLoaded = true;
  },

  /**
   * Creates the images for Ciao, and calls showCiao() when they're ready.
   */
  ciaoController() {
    const word = 'ciao!'.split('');
    let images = [];
    let imageLoaded = 0;

    // Loop the word "ciao!" and create the image elements
    for(let i = 0; i < word.length; i++) {
      let image = new Image();

      // Use 'e' instead of '!' for files and classnames
      if(word[i] === '!') {
        word[i] = 'e';
      }

      image.src = `/assets/images/${word[i]}.svg`;
      image.className = `hello-header-img hello-header-${word[i]}`;
      image.alt = '';
      image.setAttribute('role','presentation');
      image.setAttribute('aria-hidden',true);
      image.onload = () => {
        imageLoaded++;
        if(imageLoaded === word.length) {
          this.showCiao(images);
        }
      };
      images.push(image);
    }
  },

  /**
   * Loops an array and shows a word.
   * @param {Array} ciao Each index should be a JS image element to be appended.
   */
  showCiao(ciao) {
    const wipe = document.querySelector('.js-intro-wipe');
    const header = document.querySelector('.js-hello-header');
    const burst = document.querySelector('.js-burst');
    const pointer = document.querySelector('.js-hello-finger');

    for(let n = 0; n < ciao.length; n++) {
      header.appendChild(ciao[n]);
    }

    // Remove the wipe, animate letter in
    wipe.classList.add('introduced');
    header.classList.add('is-ready');
    burst.classList.add('is-spinning');

    // Make letters "float" after a delay
    // Should happen after the initial animations
    setTimeout(() => {
      header.classList.add('is-bouncing');
    }, 3500, false);

    // Show the pointy finger
    setTimeout(() => {
      pointer.classList.add('is-active');
    }, 4500, false);
  },

  /**
   * Contains the code that disables animations site wide. It disables them by
   * adding a class to the body of the page.
   */
  animationController() {
    const animationToggleButtons = document.querySelectorAll('.js-toggle-animation');
    const body = document.querySelector('body');
    for (let i = 0; i < animationToggleButtons.length; i++) {
      animationToggleButtons[i].addEventListener('click', () => {
        console.log('🚶‍ Toggling animations... 🕴');
        if (body.classList.contains('no-animation')) {
          body.classList.remove('no-animation');
        } else {
          body.classList.add('no-animation');
        }
      });
    }
  },

  /**
   * Controls the showing/hiding of the modals, and toggling their attributes.
   */
  modalController() {
    const body = document.querySelector('body');
    const modalOpeners = document.querySelectorAll('.js-work-link');
    const modalClosers = document.querySelectorAll('.js-modal-close-button, .js-work-modal-screen');
    let trigger = '';
    let modal = '';

    // Calls showModal() or hideModal() based on if a modal is showing or not
    function toggleModal(modal) {
      if (modal.classList.contains('is-transitioning')) {
        return false;
      }

      if (modal.classList.contains('is-hidden')) {
        showModal(modal);
      } else {
        hideModal(modal);
      }
    }

    // Shows the modal
    function showModal(modal) {

      let transitionEndProperties = (event) => {
        if (event.propertyName === 'opacity') {
          modal.removeEventListener('transitionend ', transitionEndProperties, false);
          modal.addEventListener('keydown', focusManager);
          modal.setAttribute('aria-hidden', false);
          modal.setAttribute('tabindex', "0");
          modal.classList.remove('is-transitioning');
          modal.focus();
        }
      };

      body.classList.add('modal-open');
      modal.classList.remove('is-hidden');
      modal.addEventListener('transitionend', transitionEndProperties);

      setTimeout(() => {
        modal.classList.add('is-visible', 'is-transitioning');
      }, 10);
    }

    // Hides the modal
    function hideModal(modal) {

      let transitionEndProperties = (event) => {
        if (event.propertyName === 'opacity') {
          modal.removeEventListener('transitionend', transitionEndProperties, false);
          modal.removeEventListener('keydown', focusManager, false);
          modal.setAttribute('aria-hidden', true);
          modal.setAttribute('tabindex', "-1");
          modal.classList.remove('is-transitioning');
          modal.classList.add('is-hidden');
          body.classList.remove('modal-open');
          trigger.focus();
        }
      };

      modal.classList.add('is-transitioning');
      modal.classList.remove('is-visible');
      modal.addEventListener('transitionend', transitionEndProperties);
    }

    // Listens for tabbing and keypresses inside modal
    function focusManager(event) {

      // Find all focusable children
      const focusableElementsString = 'a[href], button:not([disabled]), [tabindex="0"]';
      let focusableElements = modal.querySelectorAll(focusableElementsString);

      // Convert NodeList to Array
      focusableElements = Array.prototype.slice.call(focusableElements);

      const firstTabStop = focusableElements[0];
      const lastTabStop = focusableElements[focusableElements.length - 1];

      // Escape key (close modal)
      if (event.keyCode === 27 && body.classList.contains('modal-open')) {
        hideModal(modal);
      }

      // Check for tab key press
      // Trap tab focus within modal while open
      if (event.keyCode === 9) {

        // Shift + tab
        if (event.shiftKey) {
          if (document.activeElement === firstTabStop) {
            event.preventDefault();
            lastTabStop.focus();
          }

          // Tab
        } else {
          if (document.activeElement === lastTabStop) {
            event.preventDefault();
            firstTabStop.focus();
          }
        }
      }
    }

    // Add toggle modal listeners
    for (let i = 0; i < modalOpeners.length; i++) {
      modalOpeners[i].addEventListener('click', e => {
        e.preventDefault();
        trigger = e.target.closest('.js-work-link');
        modal = trigger.parentNode.nextElementSibling;
        toggleModal(modal);
        return false;
      });
    }

    // Add close listeners to buttons, screens, etc.
    for (let i = 0; i < modalClosers.length; i++) {
      modalClosers[i].addEventListener('click', e => {
        e.preventDefault();
        hideModal(modal);
        return false;
      });
    }
  }
};

site.init();
