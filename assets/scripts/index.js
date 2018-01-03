---
---

/**
 * Element.closest polyfill
 * element-closest | CC0-1.0 | github.com/jonathantneal/closest
 */
(function (ElementProto) {
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
})(window.Element.prototype);

/**
 * All JS for the site.
 */
let site = {
  // Starts the party.
  init() {
    console.log('🥂 Welcome! 🎉');
    document.addEventListener("DOMContentLoaded", function(){
      site.intro();
      site.modalController();
      site.animationController();
    });

  },
  intro() {
    console.log('🥁 Introducing... 🥁');

    // Show circle wipe animation
    document.querySelector('.js-intro-wipe').classList.add('introduced');

    // Only show the pointer finger if user doesn't scroll
    let hasScrolled = false;
    window.addEventListener('scroll', () => {
      hasScrolled = true;
    });

    setTimeout(() => {
      if(!hasScrolled) {
        document.querySelector('.js-hello-finger').classList.add('is-active');
      }
    }, 5000);
  },
  /**
   * animationController()
   * Contains the code that disables animations site wide. It disables them by
   * adding a class to the body of the page.
   * TODO Re-enable animations? This will cause them all to play again...
   */
  animationController() {
    console.log('🚶‍ Disabling animations... 🕴');

    const animationToggleButtons = document.querySelectorAll('.js-toggle-animation');
    const body = document.querySelector('body');
    for(let i = 0; i < animationToggleButtons.length; i++) {
      animationToggleButtons[i].addEventListener('click', () => {
        if(body.classList.contains('no-animation')) {
          body.classList.remove('no-animation');
        } else {
          body.classList.add('no-animation');
        }
      });
    }
  },
  // Controls the hiding and showing of modals
  // TODO Esc key support
  modalController() {
    let modalOpeners = document.querySelectorAll('.js-work-link');
    let modalClosers = document.querySelectorAll('.js-modal-close-button, .js-work-modal-screen');

    function toggleModal(modal) {
      if(modal.classList.contains('is-hidden')) {
        showModal(modal);
      } else {
        hideModal(modal);
      }
    }

    function showModal(modal) {
      modal.setAttribute('aria-hidden', false);
      modal.classList.remove('is-hidden');
    }

    function hideModal(modal) {
      modal.setAttribute('aria-hidden', true);
      modal.classList.add('is-hidden');
    }

    for (let i = 0; i < modalOpeners.length; i++) {
      modalOpeners[i].addEventListener('click', e => {
        e.preventDefault();
        toggleModal(e.target.closest('.js-work-link').parentNode.nextElementSibling);
        return false;
      });
    }

    for(let i = 0; i < modalClosers.length; i++) {
      modalClosers[i].addEventListener('click', e => {
        e.preventDefault();
        hideModal(e.target.closest('.js-work-modal'));
        return false;
      });
    }
  }
};

  site.init();
