var mongoose = require('mongoose')
  , crypto = require('crypto')
  ;

var BlobCache = mongoose.model('blobcache');

exports.cacheFunction = function(name, func, cb) {
  var cid = 'function_' + name;
  BlobCache.findOne({ cid: cid }, function(err, doc) {
    if (!err && doc) {
      // cache lookup succeeded; return cached item
      cb(err, doc.data);
    }
    else {
      // cache lookup failed; try to generate original
      func(function(err, data) {
        // in all cases, return function's value
        cb(err, data);

        if (!err) {
          // generation succeeded; save to cache
          var item = new BlobCache({
            cid: cid
           ,data: data
          });

          item.save();
        }
      });
    }
  });
};
