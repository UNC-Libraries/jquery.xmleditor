var system = require("system");
var fs = require("fs");
var page = require("webpage").create();

if (system.args.length < 2) {
  console.log("Usage: build.js <output filename>");
  phantom.exit(1);
}

var output = system.args[1];

page.open("./build.html", function() {
  
  var json = page.evaluate(function() {
    var extractor = new Xsd2Json("mods-3-4.xsd", {
      schemaURI: "mods-3-4/",
      rootElement: "mods"
    });
    
    return extractor.stringify();
  });
  
  if (json)
    fs.write(output, "var MODS = " + json + ";", "w");
  else
    console.error("null result from script evaluation");
  
  phantom.exit();
  
});
