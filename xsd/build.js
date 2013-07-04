var system = require("system");
var fs = require("fs");
var page = require("webpage").create();

if (system.args.length < 1) {
  console.log("Usage: build.js [<output filename> <path containing schemas> <base schema filename> <root schema element> <JSON variable name>]");
  console.log("Example: phantomjs build.js ../examples/mods.js ../examples/mods-3-4/ mods-3-4.xsd modsSchema mods");
  phantom.exit(1);
}

var output = system.args[1];
// This is the directory where all it will attempt to find all referenced schemas first before trying any URLs
var schemaPath = null;
if (system.args.length > 2) {
	schemaPath = system.args[2];
} else {
	schemaPath = "./";
}
// The filename of the first schema to process
var baseSchema;
if (system.args.length > 3) {
	baseSchema = system.args[3];
} else {
	baseSchema = "*.xsd";
}
// Name of the JSON variable constructed from this schema
var variableName = null;
if (system.args.length > 4) {
	variableName = system.args[4];
}
// If the schema defines a root element for documents, it can be specified here.  Otherwise a placeholder root element is generated
var rootElement = null;
if (system.args.length > 5) {
	rootElement = system.args[5];
}

page.open("./build.html", function() {
  var json = page.evaluate(function(schemaPath, baseSchema, rootElement) {
    var options = {
        'schemaURI': schemaPath
    }
    if (rootElement) {
    	options['rootElement'] = rootElement;
    } else {
    	options['generateRoot'] = true;
    }
    
    var extractor = new Xsd2Json(baseSchema, options);
    
    return extractor.stringify();
  }, schemaPath, baseSchema, rootElement);
  
  if (json) {
    if (variableName != null)
      json = "var " + variableName + " = " + json + ";";
    if (output)
      fs.write(output, json, "w");
    else
      console.log(json);
  } else
    console.error("null result from script evaluation");
  
  phantom.exit();
  
});
