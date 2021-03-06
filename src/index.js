const {promisify} = require('lv-util')
const fs = require('fs')
const postcss = require('postcss')
const scss = require('postcss-scss')
const less = require('postcss-less')
const stylefmt = require('stylefmt')
const path = require('path')
const os = require('os')

const files = []

function isVue (str) {
  return /\.vue$/.test(str)
}

function isScss (str) {
  return /\.s?(a|c)ss$/.test(str)
}

function isLess (str) {
  return /\.less$/.test(str)
}

const readDir = promisify(fs.readdir)
const fsStat = promisify(fs.stat)
const readFile = promisify(fs.readFile)

function walk (dir) {
  return readDir(dir).then(list => {
    return Promise.all(list.map(pathname => {
      return fsStat(path.resolve(dir, pathname)).then(stats => {
        if (stats.isFile()) {
          if (isVue(pathname)) {
            files.push({
              path: path.resolve(dir, pathname),
              syntax: 'vue'
            })
          } else if (isScss(pathname)) {
            files.push({
              path: path.resolve(dir, pathname),
              syntax: scss
            })
          } else if (isLess(pathname)) {
            files.push({
              path: path.resolve(dir, pathname),
              syntax: less
            })
          }
        } else {
          if (pathname !== 'node_modules') {
            return walk(path.resolve(dir, pathname))
          }
        }
      }).catch(console.error)
    }))
  }).catch(console.error)
}

function formatVueStyle (dir) {
  readFile(dir).then(data => {
    const vueStyleReg = /(<style[\s\S]*?>)([\s\S]*?)(<\/style>)/
    if (vueStyleReg.test(data)) {
      const [startTag, endTag] = [RegExp.$1, RegExp.$3]
      const style = RegExp.$2.replace(/^[\r\n]+|[\r\n]+$/g, '')
      const match = startTag.match(/\slang=['"](.*?)['"]/)
      let syntaxText
      let syntax
      if (match) {
        syntaxText = match[1]
      }
      if (syntaxText === 'less') {
        syntax = less
      } else {
        syntax = scss
      }
      format(style, syntax).then(result => {
        writeFile(dir, data.replace(vueStyleReg, startTag + os.EOL + result.css + os.EOL + endTag))
      }).catch(err => {
        console.error('format error! in file: ' + dir, err)
      })
    }
  }).catch(err => {
    console.error('readFile error: ' + dir, err)
  })
}

function format (data, syntax) {
  return new Promise((resolve, reject) => {
    postcss([stylefmt]).process(data, {
      syntax
    }).then(resolve).catch(reject)
  })
}

function writeFile (dir, data) {
  fs.writeFile(dir, data, err => {
    if (err) {
      console.error('writeFile error in file: ' + dir)
    } else {
      console.log(dir + ' ------- format done')
    }
  })
}

function formatStyle (dir, syntax) {
  readFile(dir).then(style => {
    format(style, syntax).then(result => {
      writeFile(dir, result.css)
    })
  }).catch(err => {
    console.error('readFile error: ' + dir, err)
  })
}

function formatter (_path) {
  walk(_path).then(() => {
    files.forEach(({path, syntax}) => {
      if (syntax === 'vue') {
        formatVueStyle(path)
      } else {
        formatStyle(path, syntax)
      }
    })
  })
}

module.exports = formatter
