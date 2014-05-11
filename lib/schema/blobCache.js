var blobCacheSchema;

function factory(mongoose) {
  return new mongoose.Schema({
    cid: {
      type: String
     ,unique: true
    }
   ,data: {}
   ,expires: {
      type: Date
     ,default: function() { return Date.now() + 3600; }
    }
   ,updated: {
      type: Date
     ,default: Date.now
    }
  });
}

module.exports = function(mongoose) {
  blobCacheSchema = blobCacheSchema || factory(mongoose);
  return mongoose.model('blobcache', blobCacheSchema);
};
