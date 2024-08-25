// import { initializeApp } from 'firebase/app';
// import { getDatabase, ref, push } from 'firebase/database'
// const { initializeApp } = require('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js');
// const { getDatabase, ref, push } = require('https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js')

// await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js')
// await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js')

var jcrop, selection, token

var overlay = ((active) => (state) => {
  active = typeof state === 'boolean' ? state : state === null ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  chrome.runtime.sendMessage({message: 'active', active})
})(false)

var image = (done) => {
  var image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/content/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

var init = (done) => {
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      selection = e
      capture()
    },
    onChange: (e) => {
      selection = e
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null
      }, 100)
    }
  }, function ready () {
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: `url(${chrome.runtime.getURL('/vendor/Jcrop.gif')})`
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }

    done && done()
  })
}

var capture = (force) => {
  chrome.storage.sync.get((config) => {
    if (selection && (config.method === 'crop' || (config.method === 'wait' && force))) {
      jcrop.release()
      setTimeout(() => {
        chrome.runtime.sendMessage({
          message: 'capture', area: selection, dpr: devicePixelRatio
        }, (res) => {
          overlay(false)
          selection = null
          crop(...res.args, (image) => {
            save(image, config.format, config.save)
          })
        })
      }, 50)
    }
    else if (config.method === 'view') {
      chrome.runtime.sendMessage({
        message: 'capture',
        area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
      }, (res) => {
        overlay(false)
        if (res.args) {
          crop(...res.args, (image) => {
            save(image, config.format, config.save)
          })
        }
        else if (res.image) {
          save(res.image, config.format, config.save)
        }
      })
    }
  })
}

var filename = (format) => {
  var pad = (n) => (n = n + '', n.length >= 2 ? n : `0${n}`)
  var ext = (format) => format === 'jpeg' ? 'jpg' : format === 'png' ? 'png' : 'png'
  var timestamp = (now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  return `Screenshot Capture - ${timestamp(new Date())}.${ext(format)}`
}

var successful_screenshot_handler = (frontend_url, response) => {
  const screenshotId = response.external_id;
  const redirectUrl = `${frontend_url}/item/${screenshotId}`; // Update port if needed
  window.location.href = redirectUrl; // Redirect the browser
}

var backend_save = (image, backend_url, token, frontend_url) => {
  var [header, base64] = image.split(',')
  const img_url = window.location.toString();
  const screenshotData = {
    url: img_url,
    img: image
  };
  fetch(`${backend_url}/screenshots`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(screenshotData)
  })
  .then(response => {
    if (response.ok) {
      response.json().then(data => {
        successful_screenshot_handler(frontend_url, data);
      });
    } else {
      console.error('Error sending screenshot:', response.statusText);
    }
  })
}

var backend_login_and_save = (image, format, save) => {
  chrome.storage.local.get('screenshot_backend', (data) => {
    let formData = new FormData();
    let backend_url = null, frontend_url = null;
    if (data.screenshot_backend) {
      backend_url = data.screenshot_backend.url;
      frontend_url = data.screenshot_backend.frontend_url;
      formData.append('username', data.screenshot_backend.user);
      formData.append('password', data.screenshot_backend.password);
    } else {
      throw new Error('Attempt to use the backend without configuring the URL');
    }
    fetch(`${backend_url}/token`, {
      method: 'POST',
      body: formData
    }).then((response) => {
      if (!response.ok) {
        alert('Wrong username or password');
        throw new Error(`Login failed with status: ${response.status}`);
      }
      return response.json();
    }).then((data) => {
      const token = data.access_token;
      // Login is successful, proceed to save using the token
      backend_save(image, backend_url, token, frontend_url);
    }).catch((error) => {
      console.error('Login error:', error);
    });
  })
}

var frontend_save = (image, format, save) => {
  chrome.storage.local.get('screenshot_backend', (data) => {
    let frontend_url = null;
    if (data.screenshot_backend) {
      frontend_url = data.screenshot_backend.frontend_url;
    } else {
      throw new Error('Attempt to use the backend without configuring the URL');
    }
    const img_url = window.location.toString();
    const screenshotData = {
      url: img_url,
      img: image
    };
    console.log("send_screenshot");
    chrome.runtime.sendMessage({
      message: 'send_screenshot', 
      frontend_url:`${frontend_url}/screenshot/plugin`,
      screenshot_data: screenshotData
    }, (res) => {
      console.log(res)
    })
    console.log("exiting send_screenshot");
  });
}

var save = (image, format, save) => {
  if (save === 'file') {
    var link = document.createElement('a')
    link.download = filename(format)
    link.href = image
    link.click()
  }
  else if (save === 'url') {
    navigator.clipboard.writeText(image).then(() => {
      alert([
        'Screenshot Capture:',
        'Data URL String',
        'Saved to Clipboard!'
      ].join('\n'))
    })
  }
  else if (save === 'binary') {
    var [header, base64] = image.split(',')
    var [_, type] = /data:(.*);base64/.exec(header)
    var binary = atob(base64)
    var array = Array.from({length: binary.length})
      .map((_, index) => binary.charCodeAt(index))
    navigator.clipboard.write([
      new ClipboardItem({
        // jpeg is not supported on write, though the encoding is preserved
        'image/png': new Blob([new Uint8Array(array)], {type: 'image/png'})
      })
    ]).then(() => {
      alert([
        'Screenshot Capture:',
        'Binary Image',
        'Saved to Clipboard!'
      ].join('\n'))
    })
  } else if (save == 'server') {
    //backend_login_and_save(image, format, save)
    frontend_save(image, format, save);
  }
}

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'init') {
    res({}) // prevent re-injecting

    if (!jcrop) {
      image(() => init(() => {
        overlay()
        capture()
      }))
    }
    else {
      overlay()
      capture(true)
    }
  }
  return true
})
