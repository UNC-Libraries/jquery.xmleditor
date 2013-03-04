# jquery.xmleditor
A web browser based XML editor.   It provides a general use graphical tool for creating new or modifying existing XML documents in your web browser.  Information is extracted from an XML schema (XSD file) to provide the user with information about what elements, subelements and attributes are available at different points in the structure, and a GUI based means of adding or removing them from the document.

Additionally, this project includes a tool for generating JSON objects from XML schemas, which can either be directly used in browsers or precompiled (see xsd/xsd2json.js).

Try it out in our [jquery.xmleditor demo page](http://unc-libraries.github.com/jquery.xmleditor) using the MODS 3.4 schema.

This project was developed as a part of the [Carolina Digital Repository](https://cdr.lib.unc.edu/) for use in our administrative tools, but is fully functional as a standalone client. 
This tool is intended to serve as a general schema driven XML editor that runs in web browsers, although some default behaviors are oriented towards it.  
For our own usage, it retrieves and submits documents to a SWORD 2.0 enabled repository.

## Features
- Graphical editor mode for displaying and modifying XML elements
- Text editor mode for directly modifying the underlying document (using the [Cloud9](https://github.com/ajaxorg/cloud9) editor) 
- Contextual, schema driven menus for adding new elements, subelements and attributes in both the graphical and text editing modes
- Fully javascript and CSS based, jquery widget
- AJAX submission of document modifications
- Export the document to a file in web browsers that support it
- Keyboard shortcuts for navigation and other operations
- Standalone tool for building JSON representations of XML schemas (see the xsd/ folder in this project)

## How to use
### Locating schema files
Due to restrictions most web browsers have on cross domain requests in javascript, all necessary XSD files must be located in the same domain as the page the editor is embedded in.  
But rather than lugging the XSD files around everywhere, you can precompile a JSON representation of your schemas to include instead.  
It'll also save your users some loading time.

### Embedding the editor
`
<div id="xml_editor"><root></root></div>
<script>
  $(function() {
		$("#xml_editor").modsEditor({
                schemaObject: schemaObject
        });
  });
</script>`

### Generate and use the schema object at run time instead of precompiling
See the [runtime schema generation demo](http://unc-libraries.github.com/demo/xsd2json_example.html)
`<script>
  $(function() {
        var extractor = new Xsd2Json("mods-3-4.xsd", {"schemaURI":"mods-3-4/", "rootElement": "mods"});

        $("#mods_editor").modsEditor({
                schemaObject: extractor.getSchema()
        });
  });
</script>`

### Startup options for jquery.xmleditor
### Startup options for xsd2json

### Building the plugin yourself
If we wish to build the combined jquery.xmleditor.js yourself, you can use the provided rake script.  With rake installed, simple type "rake" in the root directory of this project.

License Information
---------
Copyright 2013 The University of North Carolina at Chapel Hill

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Authors
---------
Ben Pennell (bbpennel)

Mike Daines (daines)

Attribution
------
[Cloud9 IDE](https://github.com/ajaxorg/cloud9)
[vkbeautify](http://code.google.com/p/vkbeautify/)
[expanding.js](https://github.com/bgrins/ExpandingTextareas)
[jquery](http://jquery.com/)
[jquery.xmlns](https://github.com/rfk/jquery-xmlns)
[json2.js and cycle.js](https://github.com/douglascrockford/JSON-js)