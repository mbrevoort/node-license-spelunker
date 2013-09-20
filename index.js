#!/usr/bin/env node
var path = require('path')
  , fs = require('fs')
  , async = require('async')
  ;


var projPath = path.resolve(process.argv[2] || '.');
console.log('Project Path', projPath);
var topPkg = require(path.join(projPath, 'package.json'));

var modules = [];
var count = 0;

doLevel(projPath);


function doLevel(nodePath) {
  var pkg = require(path.join(nodePath, 'package.json'));
  var nodeModulesPath = path.join(nodePath, 'node_modules');
  count ++;

  //console.log('package.json license', pkg.license);

  fs.exists(nodeModulesPath, function (dirExists) {
    if (dirExists) {
      fs.readdir(nodeModulesPath, function (err, files) {
        if (err) throw err;
        var directories = [];

        files = files.map(function (f) { return path.join(nodeModulesPath, f); })
        async.filter(files, isModuleDirectory, function(directories){
          //console.log('module directories', directories);
          directories.forEach(doLevel);
        });
      })
    }
  })

  licenseText(nodePath, function (license) {
    modules.push({
      name: pkg.name,
      version: pkg.version,
      url: 'http://npmjs.org/package/' + pkg.name,
      localPath: path.relative(projPath,nodePath),
      pkgLicense: pkg.license,
      license: license
    });
    count--;

    if (count == 0) {
      var noLicenseFile = modules.filter(function (m) { return m.license === 'NO LICENSE FILE' });
      var andNoPkgJsonLicense = noLicenseFile.filter(function (m) { return !m.pkgLicense });
      console.log('LICENSE FILE REPORT FOR ', topPkg.name);
      console.log(modules.length + ' nested dependencies')
      console.log(noLicenseFile.length +  ' without identifiable license text')
      console.log(andNoPkgJsonLicense.length +  ' without even a package.json license declaration', '\n\n')
      modules.forEach(function(m) {
        console.log((modules.indexOf(m)+1) + ' ----------------------------------------------------------------------------');
        console.log(m.name + '@' + m.version);
        console.log(m.url);
        console.log(m.localPath);
        if (m.pkgLicense) console.log('From package.json license property:', JSON.stringify(m.pkgLicense));
        console.log('');
        console.log(m.license);
        console.log('');
      })
    }
  })


}

function licenseText (nodePath, cb) {
  var possibleLicensePaths = [ path.join(nodePath, 'LICENSE'),
                               path.join(nodePath, 'LICENCE'),
                               path.join(nodePath, 'LICENSE.md'),
                               path.join(nodePath, 'LICENSE.txt'),
                               path.join(nodePath, 'Readme.md'),
                               path.join(nodePath, 'README.md'),
                               path.join(nodePath, 'README.markdown')];

 var emptyState  = "NO LICENSE FILE";

  async.reduceRight(possibleLicensePaths, emptyState, function (state, licensePath, reduceCb) {
    var isAReadme = (licensePath.toLowerCase().indexOf('/readme') > 0);

    // if we already found a licnese, don't bother looking at READMEs
    if (state !== emptyState && isAReadme) return reduceCb (null, state);

    fs.exists(licensePath, function (exists) {
      if (!exists) return reduceCb(null, state);
      fs.readFile(licensePath, { encoding: 'utf8' }, function (err, text) {
        if (err) return logError(err, reduceCb)(err, state);

        if (isAReadme) {
          var match = text.match(/\n[# ]*license[ \t]*\n/i);
          if (match) {
            //console.log(match.input.substring(match.index))
            return reduceCb (null, 'FROM README:\n' + match.input.substring(match.index));
          }
          else {
            return reduceCb(null, state);
          }
        }
        else {
          return reduceCb (null, text);
        }


        return reduceCb (null, text);
      })

    });
  }, function (err, license) {
    if (err) return cb('ERROR FINDING LICENSE FILE ' + err );
    cb (license);
  });
}

function isModuleDirectory (dirPath, cb) {
  var pkgPath = path.join(dirPath, 'package.json');
  fs.stat(dirPath, function (err, stat) {
    if (err) return logError(err, cb)(false);

    var isdir = stat.isDirectory();
    if (isdir) {
      fs.exists(pkgPath, cb);
    }
    else {
      cb(false);
    }
  });
}

function logError(err, cb) {
  console.log('ERROR', err);
  return cb
}