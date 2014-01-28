var http = require('http');
var https = require('https');
var fs = require('fs');
var coffee = require('coffee-script');
var optimist = require('optimist');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

optimist.usage(
  'Usage:\n' +
  '  seed-translation --project [name] --env [local staging production] --deploy-path [file/path]\n\n' +
  'Examples:\n' +
  '  seed-translation --project galaxy_zoo --env production --deploy-path locales\n' +
  '  seed-translation --project galaxy_zoo --env staging --deploy-path locales\n'
);

var options = optimist.options({
  h: { alias: 'help', description: 'Print usage' },
  p: { alias: 'project', description: 'Project name ' },
  e: { alias: 'env', description: 'Environment (local, staging, or production)' },
  d: { alias: 'deploy-path', description: 'Deploy path for your language files' }
}).demand('env').demand('project').argv

var post = function (seed) {
  var json = {
    translation: seed.data,
    locale: seed.locale.toLowerCase().replace(/_/, '-')
  };
  
  var servers = {
    local: { host: '127.0.0.1', port: 3000, http: http },
    staging: { host: 'dev.zooniverse.org', port: 443, http: https },
    production: { host: 'api.zooniverse.org', port: 443, http: https }
  };
  
  var server = servers[options.env];
  
  var message = 'Seeding locale to ' + options.env;
  
  if(options['deploy-path']) {
    json.deploy_path = options['deploy-path'];
    message += ' with deploy path ' + json.deploy_path
  }
  
  json = JSON.stringify(json);
  
  var opts = {
    host: server.host,
    port: server.port,
    path: '/projects/' + options.project + '/translations/seed',
    method: 'POST',
    auth: process.env.OUROBOROS_AUTH,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json)
    }
  };
  
  console.log(message);
  
  var request = server.http.request(opts, function(res) {
    res.setEncoding('utf-8');
    var responseString = '';
    
    res.on('data', function(data) {
      responseString += data;
    });
    
    res.on('end', function() {
      try {
        var resultObject = JSON.parse(responseString);
        
        if(resultObject.id) {
          console.log('Done');
        }
        else {
          console.log('Something went wrong');
        }
      }
      catch(e) {
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
