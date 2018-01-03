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
    });

  },
  intro() {
    console.log('🥁 Introducing... 🥁');
    document.querySelector('.js-intro-wipe').classList.add('introduced');
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
