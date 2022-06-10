const ctx = require('continuation-local-storage').createNamespace('app')
const config = require('./config')
const express = require('express')
const session = require('express-session')
const passport = require('./config/passport')(require('passport'))
const logger = require('morgan')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
if (!Object.entries) require('object.entries').shim()
const path = require('path');

const sessionOpts = {
  secret: config.get('SESSION_SECRET'),
  saveUninitialized: true, // saved new sessions
  resave: false, // do not automatically write to the session store
  rolling: true, // prolong session by each request
  cookie: {
    maxAge: 5 * 60 * 1000
  }
}

if (config.get('REDIS')) {
  const RedisStore = require('connect-redis')(session)
  sessionOpts.store = new RedisStore({url: config.get('REDIS')})
} else {
  console.warn('No redis in config, no session storage')
}

function notFound (req, res, next) {
  next(Error(404))
}

const NumericErrors = {
  '400': 'Bad Request',
  '401': 'Authorization Required',
  '403': 'Permission Denied',
  '404': 'Not Found'
}
const NUMERIC_RE = /^\d\d\d:/
function handleError (err, req, res, next) {
  err =
    (typeof err === 'string' && NUMERIC_RE.test(err)) ? {
      message: err.slice(4).trim,
      status: Number(err.slice(0, 3))
    }
    : (typeof err === 'string') ? {
      message: err,
      status: 400
    }
    : (typeof err === 'number') ? {
      message: NumericErrors[err],
      status: err
    }
    : (typeof err === 'object' && err.message && err.message in NumericErrors) ? {
      message: NumericErrors[err.message],
      status: Number(err.message),
      stack: err.stack
    }
    : (typeof err === 'object' && err.message && NUMERIC_RE.test(err.message)) ? {
      message: err.message.slice(4).trim(),
      status: Number(err.message.slice(0, 3)),
      stack: err.stack
    }
    : err
  if (String(err.status) !== '404') {
    console.error(`Status: ${err.status}, Message: ${err.message}, Stack: ${err.stack}`)
  }
  if (res.headersSent) {
    console.info('Error handler will not send responce, since headers are already sent')
    return
  }
  res.status(err.status || 500)
  const result = app.get('env') === 'development' ? {
    message: err.message,
    error: err,
    stack: err.stack
  } : {
    message: err.message,
    error: {}
  }
  res.json(result)
}

function setAnonCtx (req, res, next) {
  ctx.run(function () {
    ctx.set('ip', req.headers['x-forwarded-for'] || req.connection.remoteAddress)
    ctx.set('user', req.user || null)
    next()
  })
}

const app = express()

app.set('trust proxy', true)

const client = new express.Router()

if (app.get('env') === 'production') {
  console.warn('production build')
  client.use(express.static('../BigmediaClient_v7/build/production/Bigmedia'))
  client.use('/Presenter', express.static('../Presenter/build/production/Presenter'))
  client.use('/easy-board/', express.static('../easyboard-react/build'));
  app.get('/easy-board/faces/*',(req,res)=>{
    res.sendFile(path.join(__dirname+'../../../easyboard-react/build/index.html'));
  });
  app.get('/easy-board/request/*',(req,res)=>{
    res.sendFile(path.join(__dirname+'../../../easyboard-react/build/index.html'));
  });
  app.get('/easy-board/sides/*',(req,res)=>{
    res.sendFile(path.join(__dirname+'../../../easyboard-react/build/index.html'));
  });
  app.get('/easy-board/checkout',(req,res)=>{
    res.sendFile(path.join(__dirname+'../../../easyboard-react/build/index.html'));
  });
  app.get('/easy-board/about',(req,res)=>{
    res.sendFile(path.join(__dirname+'../../../easyboard-react/build/index.html'));
  });
} else if (app.get('env') === 'testing') {

} else {

}

client.use('/constants/bigmedia.js', (req, res) => {
  const {enums} = require('./models')
  res.writeHead(200, {'Content-Type': 'application/javascript'})
  res.end(`Bigmedia.lib.Constants= ${JSON.stringify(enums, null, 2)}`)
})
client.use('/constants', express.static('./node_modules/bigmedia-constants/lib'))

app.use(client)
app.use('/client', client)

app.use(cookieParser())
var sessionMiddleware = session(sessionOpts)
app.use(function (req, res, next) {
  return sessionMiddleware.call(this, req, res, ctx.bind(next))
})
app.use(passport.initialize())
app.use(passport.session()) // persistent login sessions
app.use(logger('tiny'))
app.use(bodyParser.json({limit: '10mb'}))
app.use(bodyParser.urlencoded({limit: '10mb',  extended: false }))
const api = require('./routes')(passport)
app.use(setAnonCtx)
app.use('/api/v1/', api)

app.use('/', api)
app.use(notFound)
app.use(handleError)

process.on('unhandledRejection', e => { console.error('unhandledRejection', e) })
process.on('uncaughtException', e => { console.error('uncaughtException', e) })

module.exports = app
