'use strict';

var select = document.querySelector('select');

chrome.runtime.sendMessage({
  cmd: 'get-links'
}, response => {
  response.forEach(url => {
    let option = document.createElement('option');
    option.value = option.textContent = url;
    select.appendChild(option);
  });
  select.value = response[0];
  select.focus();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    document.querySelector('[data-cmd="close-me"]').click();
  }
  if (e.code === 'Enter') {
    document.querySelector('[data-cmd="open-in"]').click();
  }
});

document.addEventListener('click', e => {
  let cmd = e.target.dataset.cmd;
  if (cmd === 'close-me') {
    chrome.runtime.sendMessage({
      cmd: 'close-me'
    });
  }
  else if (cmd === 'open-in') {
    chrome.runtime.sendMessage({
      cmd: 'open-in',
      url: select.value
    });
    chrome.runtime.sendMessage({
      cmd: 'close-me'
    });
  }
});
select.addEventListener('dblclick', (e) => {
  if (e.target.tagName === 'OPTION') {
    document.querySelector('[data-cmd="open-in"]').click();
  }
});
