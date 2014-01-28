var http = require('http');
var fs = require('fs');
var coffee = require('coffee-script');

var post = function (seed) {
  var json = JSON.stringify({
    translation: seed.data,
    locale: seed.locale.toLowerCase().replace(/_/, '-')
  });
  
  var servers = {
    local: { host: '127.0.0.1', port: '3000' },
    staging: { host: 'dev.zooniverse.org', port: 80 },
    production: { host: 'api.zooniverse.org', port: 80 }
  };
  
  var env = process.argv[2] || 'local'
  var server = servers[env];
  
  var opts = {
    host: server.host,
    port: server.port,
    path: '/projects/sunspot/translations/seed',
    method: 'POST',
    auth: process.env.OUROBOROS_AUTH,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': json.length
    }
  };
  
  console.log('Seeding locale to', env);
  
  var request = http.request(opts, function(res) {
    res.setEncoding('utf-8');
    var responseString = '';
    
    res.on('data', function(data) {
      responseString += data;
    });
    
    res.on('end', function() {
      var resultObject = JSON.parse(responseString);
      
      if(resultObject.id) {
        console.log('Done');
      }
      else {
        console.log('Something went wrong');
      }
    });
  });
  
  request.write(json);
  request.end();
}

var checkPath = function(path) {
  path = process.cwd() + '/' + path;
  if(fs.existsSync(path)) {
    return path;
  }
  else {
    return null;
  }
}

var findSeed = function() {
  var seedLocales = ['en-us', 'en-US', 'en_us', 'en_US', 'en-gb', 'en-GB', 'en_gb', 'en_GB'];
  var localePaths = ['app/lib', 'app/translations', 'lib'];
  var localeExtensions = ['coffee', 'json'];
  var seedPath = null;
  var seedLocale = null;
  localePaths.forEach(function(dir) {
    seedLocales.forEach(function(seed) {
      localeExtensions.forEach(function(ext) {
        seedLocale = seedLocale || seed
        seedPath = seedPath || checkPath(dir + '/' + seed + '.' + ext);
      });
    });
  });
  
  return { path: seedPath, locale: seedLocale };
}

var seed = findSeed();

if(!seed.path) {
  console.log('Could not find a language file');
  process.exit(0)
}

console.log('Found language file at', seed.path);
seed.data = fs.readFileSync(seed.path, 'utf-8');

if(seed.path.match(/\.coffee$/)) {
  seed.data = coffee.eval(seed.data);
}
else {
  seed.data = JSON.parse(seed.data);
}

post(seed);
