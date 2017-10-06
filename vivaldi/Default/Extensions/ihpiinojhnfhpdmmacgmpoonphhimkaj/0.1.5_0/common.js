'use strict';

var Native = function() {
  this.callback = null;
  this.channel = chrome.runtime.connectNative('com.add0n.node');

  function onDisconnect() {
    chrome.tabs.create({
      url: './data/helper/index.html'
    });
  }

  this.channel.onDisconnect.addListener(onDisconnect);
  this.channel.onMessage.addListener(res => {
    if (!res) {
      chrome.tabs.create({
        url: './data/helper/index.html'
      });
    }
    else if (res.code && (res.code !== 0 && (res.code !== 1 || res.stderr !== ''))) {
      window.alert(`Something went wrong!

-----
Code: ${res.code}
Output: ${res.stdout}
Error: ${res.stderr}`
      );
    }
    else if (this.callback) {
      this.callback(res);
    }
    else {
      console.error(res);
    }
    // https://github.com/andy-portmen/native-client/issues/32#issuecomment-328252287
    if (res && 'code' in res) {
      this.channel.disconnect();
    }
  });
};
Native.prototype.env = function(callback) {
  this.callback = function(res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'env'
  });
};

Native.prototype.exec = function(command, args, callback = function() {}) {
  this.callback = function(res) {
    callback(res);
  };
  this.channel.postMessage({
    cmd: 'exec',
    command,
    arguments: args
  });
};

function open(url, native) {
  if (url.startsWith('https://www.google.') && url.indexOf('&url=') !== -1) {
    url = decodeURIComponent(url.split('&url=')[1].split('&')[0]);
  }

  if (navigator.userAgent.indexOf('Mac') !== -1) {
    native.exec('open', ['-a', 'VLC', url]);
  }
  else {
    chrome.storage.local.get({
      path: null
    }, prefs => {
      if (navigator.userAgent.indexOf('Linux') !== -1) {
        native.exec(prefs.path || 'vlc', [url]);
      }
      else if (prefs.path) {
        native.exec(prefs.path, [url]);
      }
      else {
        native.env(res => {
          const path = res.env['ProgramFiles(x86)'] + '\\VideoLAN\\VLC\\vlc.exe'
            .replace('(x86)', window.navigator.platform === 'Win32' ? '' : '(x86)');
          chrome.storage.local.set({
            path
          }, () => native.exec(path, [url]));
        });
      }
    });
  }
}

chrome.contextMenus.create({
  id: 'player',
  title: 'Open in VLC',
  contexts: ['video', 'audio'],
  documentUrlPatterns: ['*://*/*']
});
chrome.contextMenus.create({
  id: 'link',
  title: 'Open in VLC',
  contexts: ['link'],
  documentUrlPatterns: ['*://*/*'],
  targetUrlPatterns: [
    '*://www.youtube.com/watch?v=*',
    '*://www.youtube.com/embed/*',
    '*://www.google.com/url?*www.youtube.com%2Fwatch*'
  ]
});
chrome.contextMenus.create({
  id: 'page',
  title: 'Open in VLC',
  contexts: ['page'],
  documentUrlPatterns: [
    '*://www.youtube.com/watch?v=*'
  ]
});

var tabs = {};

function update(id) {
  chrome.pageAction.show(id);
}

chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.type === 'main_frame') {
    tabs[d.tabId] = {};
  }

  const types = d.responseHeaders.filter(h => h.name === 'Content-Type' || h.name === 'content-type')
    .map(h => h.value.split('/')[0]).filter(v => v === 'video' || v === 'audio');
  if (types.length) {
    tabs[d.tabId] = tabs[d.tabId] || {};
    tabs[d.tabId][d.url] = true;

    update(d.tabId);
  }
}, {
  urls: ['*://*/*'],
  types: ['main_frame', 'other', 'xmlhttprequest']
}, ['responseHeaders']);
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (info.url || info.favIconUrl) {
    if (tab.url.startsWith('https://www.youtube.com/watch?v=')) {
      return update(id);
    }
  }
});
// clean up
chrome.tabs.onRemoved.addListener(tabId => delete tabs[tabId]);

// actions
chrome.contextMenus.onClicked.addListener(info => {
  const native = new Native();
  open(info.srcUrl || info.linkUrl || info.pageUrl, native);
});

chrome.pageAction.onClicked.addListener(tab => {
  if (tab.url.startsWith('https://www.youtube.com/watch?v=')) {
    const native = new Native();
    open(tab.url, native);
  }
  else {
    const links = Object.keys(tabs[tab.id]);
    if (links.length === 1) {
      const native = new Native();
      open(links[0], native);
    }
    else {
      chrome.tabs.executeScript(tab.id, {
        'runAt': 'document_start',
        'allFrames': false,
        'file': '/data/inject/inject.js'
      });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.cmd === 'get-links') {
    response(Object.keys(tabs[sender.tab.id]));
  }
  else if (request.cmd === 'close-me') {
    chrome.tabs.executeScript(sender.tab.id, {
      'runAt': 'document_start',
      'allFrames': false,
      'code': `
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      `
    });
  }
  else if (request.cmd === 'open-in') {
    const native = new Native();
    open(request.url, native);
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.indexOf('Firefox') === -1
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://add0n.com/open-in.html?from=vlc&version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
}
