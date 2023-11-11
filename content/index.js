// import { initializeApp } from 'firebase/app';
// import { getDatabase, ref, push } from 'firebase/database'
// const { initializeApp } = require('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js');
// const { getDatabase, ref, push } = require('https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js')

// await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js')
// await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js')

// const firebase_config = {
//   databaseURL: "https://screen-shot-9edfb-default-rtdb.europe-west1.firebasedatabase.app/"
// }
const config = {
  projectId: "screen-shot-9edfb"
  // apiKey: "firebase_api_key",
  // storageBucket: "firebase_storage_bucket",
 };
const app = firebase.initializeApp(config);
const db = firebase.firestore();

var jcrop, selection

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
    // Make the server URL configurable
    var [header, base64] = image.split(',')
    let url = window.location.toString();
    db.collection("screenshots")
    .add({
      url: url,
      image: image,
    })
    .then(() => {
      console.log("Document successfully written!");
    })
    .catch((error) => {
      console.error("Error writing document: ", error);
    });
    // TODO: Redirect to screenshot view page
    alert([
      'Image inserted in database'
    ].join('\n'))
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
