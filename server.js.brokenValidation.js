'use strict';

var express = require('express');
var dns = require('dns');
var dotenv = require('dotenv');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
const Schema = mongoose.Schema;
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

const shortUrlSchema = new Schema({
  short: { type: Number },
  full: {
    type: String,
    required: true,
    validate: {
      isAsync: true,
      validator: function (url, cb) {
          dns.lookup(url, (err, address, family) => {
            console.log('callback for validation:');
            console.log(cb);
            console.log('error from validation');
            console.log(err);
            let ok = true;
            let props = {};
            if(err){ ok = false;}
            cb(ok, 'INVALID URL');
        });
      },
      message: "url is not valid"
    }
  }
});

shortUrlSchema.pre('validate', async function(next){

});

shortUrlSchema.pre('save', async function (next) {
  console.log(this);
  let doc = this;
  doc.validate((err, next) => {
    if (err)
      next();
  });
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


app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({ greeting: 'hello API' });
});

app.post('/api/shorturl/new', (req, res) => {
  let url = req.body.url;
  ShortUrl.findOne({ full: url }, (err, data) => {
    if (err)
      res.json({ error: 'Failed to generate shortened url' });
    if (data)
      res.json({ original_url: data.full, short_url: data.short });
    else {
      let shortUrl = new ShortUrl({ full: url });
      shortUrl.validate((err) => {
        if (err)
          res.json({ error: err });
        shortUrl.save((err) => {
          if (err){
            res.json({ error: err });
            return;
          }
          res.json({ full_url: shortUrl.full, short_url: shortUrl.short });
        });
      });
    }
  });
});

app.get("/api/shorturl/:num", (req, res) => {
  let num = Number(req.params.num);
  ShortUrl.findOne({ short: num }, (err, data) => {
    if (err) {
      console.log(err);
      res.redirect('back');
    }
    if (!data) {
      console.log("requested link doesn't exists");
      res.redirect('back');
    }
    else {
      res.redirect(data.full);
    }
  });
});



app.listen(port, function () {
  console.log('Node.js listening on port: ' + port);
});