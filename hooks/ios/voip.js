

module.exports = function (ctx) {
    var Q = ctx.requireCordovaModule("q");
    var fs = ctx.requireCordovaModule("fs");
    var plist = ctx.requireCordovaModule("plist");
    var path = ctx.requireCordovaModule("path");
    var CordovaError = ctx.requireCordovaModule("cordova-common").CordovaError;
    var deferral = Q.defer();
    
    function searchRecursiveFromPath(startPath, filter, rec, multiple) {
        if (!fs.existsSync(startPath)) {
            console.log("no dir ", startPath);
            return;
        }

        var files = fs.readdirSync(startPath);
        var resultFiles = []
        for (var i = 0; i < files.length; i++) {
            var filename = path.join(startPath, files[i]);
            var stat = fs.lstatSync(filename);
            if (stat.isDirectory() && rec) {
                var found = searchRecursiveFromPath(filename, filter); //recurse
                if(found !== undefined) {
                    if(!multiple) {
                        return found;
                    }
                }
            }

            if (filename.indexOf(filter) >= 0) {
                if (multiple) {
                    resultFiles.push(filename);
                } else {
                    return filename;
                }
            }
        }
        if (multiple) {
            return resultFiles;
        }
    }
    
    var projectRoot = ctx.opts.projectRoot;
    var platform = "ios";
    var platformPath = path.join(projectRoot, "platforms", platform);
    var plistFilePath = searchRecursiveFromPath(platformPath, "-Info.plist", true);
    fs.readFile(plistFilePath, "utf8", function(err, file){
        
        if(err) {
            deferral.reject(new CordovaError("An error occurred while trying to copy google service configuration file. " + err));
            return;
        }
        var obj = plist.parse(file);
        if(obj["UIBackgroundModes"] === undefined) {
            obj["UIBackgroundModes"] = ["voip"];
        } else {
            var backgroundModes = obj["UIBackgroundModes"];
            var exists = backgroundModes.find(function(mode) {
                return mode === "voip";
            })
            if(!exists) {
                obj["UIBackgroundModes"].push("voip");
            }
        }
        
        // Fix NSMainNibFile and NSMainNibFile~ipad
        // The version of plist available on cordova has a bug
        // when building the plist to be output to the end file where
        // it simply ignores the values of keys that have no values
        // For that reason, lets just simply add them here
        if(obj["NSMainNibFile~ipad"] === null) {
            obj["NSMainNibFile~ipad"] = "";
        }
        
        if(obj["NSMainNibFile"] === null) {
            obj["NSMainNibFile"] = "";
        }

        fs.writeFile(plistFilePath, plist.build(obj), 'utf8', function (err) {
            if (err) {
                deferral.reject(err);
                return;
            }
            console.log("Added \"voip\" to UIBackgroundModes.");
            deferral.resolve();
        });
    });
    return deferral.promise;
  };