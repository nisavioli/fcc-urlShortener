'use strict';

var express = require('express');
var dns = require('dns');
var dotenv = require('dotenv');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
const Schema = mongoose.Schema;
const Url = require('url');
var cors = require('cors');

var app = express();

// Basic Configuration
dotenv.config();
var port = process.env.PORT || 3000;

/** this project needs a db !! **/
// mongoose.connect(process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGOLAB_URI);


let CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
})

let counter = mongoose.model('counter', CounterSchema);


// URL Validation function
let validateUrl = function(url)
{
  let isValid = new Promise((resolve, reject) => 
  {
    let validFormat = /^http(s)?:\/\/www\.(\w)+\.(\w){2,3}(\/(\w)*)*$/i;
    if(!validFormat.test(url))
      resolve(false);
    let urlToCheck = Url.parse(url);
    dns.lookup(urlToCheck.host, (err, address, family)=>
    {
      if(err)
        resolve(false);
      resolve(true);
    });
  });
  return isValid;
};

const shortUrlSchema = new Schema({
  short: { type: Number },
  full: 
  {
    type: String,
    required: true,
    validate: (url) => {console.log(url); return validateUrl(url);}
  }
});

shortUrlSchema.pre('save', async function (next) {
  let doc = this;
  await counter.findByIdAndUpdate({ _id: 'entityId' }, { $inc: { seq: 1 } }, { new: true, upsert: true })
    .then((count) => {
      doc.short = count.seq;
      next();
    })
    .catch((err) => {
      console.error('Counter error : ' + err);
      throw err;
    });
});

const ShortUrl = mongoose.model('ShortUrl', shortUrlSchema);

// Attatch generic middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));


app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({ greeting: 'hello API' });
});


// Post new url to shorten
app.post('/api/shorturl/new', (req, res) => {
  let url = req.body.url;
  ShortUrl.findOne({ full: url }, (err, data) => {
    if (err)
      res.json({ error: 'Failed to generate shortened url' });
    if (data)
      res.json({ original_url: data.full, short_url: data.short });
    else {
      let shortUrl = new ShortUrl({ full: url });
      shortUrl.save()
      .then((shortUrl)=> 
      { 
        res.json({original_url: shortUrl.full, short_url: shortUrl.short});
      })
      .catch((err)=>
      {
        res.json({Error: 'Invalid Url'});
      });
    }
  });
});

// Request shortened url
app.get("/api/shorturl/:num", (req, res) => 
{
  let num = Number(req.params.num);
  ShortUrl.findOne({ short: num }, (err, data) => 
  {
    if (err) {
      console.log(err);
      res.redirect('back');
    }
    if (!data) 
    {
      console.log("requested link doesn't exists");
      res.redirect('back');
    }
    else 
    {
      res.redirect(data.full);
    }
  });
});



app.listen(port, function () {
  console.log('Node.js listening on port: ' + port);
});