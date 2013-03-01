jquery.modseditor
=================
A web browser based XML editor.   It provides a general use graphical tool for creating new or modifying existing XML documents in your web browser.  Information is extracted from an XML schema (XSD file) to provide the user with information about what elements, subelements and attributes are available at different points in the structure, and a GUI based means of adding or removing them from the document.

Additionally, this project includes a tool for generating JSON objects from XML schemas, which can either be directly used in browsers or precompiled (see xsd/xsd2json.js).

Try it out in our [jquery.modseditor demo page]{http://unc-libraries.github.com/jquery.modseditor) using the MODS 3.4 schema.

This project was developed as a part of the [Carolina Digital Repository](https://cdr.lib.unc.edu/) for use in our administrative tools, but is fully functional as a standalone client.  Despite the monicker "modseditor", this tool is intended to serve as a general schema driven XML editor that runs in web browsers, although some default behaviors are oriented towards it.  For our own usage, it retrieves and submits documents to a SWORD 2.0 enabled repository.

Features
------------
- Graphical editor mode for displaying and modifying XML elements
- Text editor mode for directly modifying the underlying document (using the [Cloud9](https://github.com/ajaxorg/cloud9) editor) 
- Contextual, schema driven menus for adding new elements, subelements and attributes in both the graphical and text editing modes
- Fully javascript and CSS based, jquery widget
- AJAX submission of document modifications
- Export the document to a file in web browsers that support it
- Keyboard shortcuts for navigation and other operations
- Standalone tool for building JSON representations of XML schemas (see the xsd/ folder in this project)

How to use
---------------

(Snippets for how to include in page)

Due to restrictions on cross domain requests in javascript, all necessary XSD files most be located in the same domain as .  But rather than lugging the XSD files around everywhere, instead you can precompile a JSON representation of the schemas in question and include them .  See the 

(List of the options for the widget) 
(List of options for xsd2json, although maybe this should go in xsd/README.md)

(Instructions for how to build with rake)

(How to use xsd2json directly with the editor)

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

Credits
------
ajax.org (Cloud9 editor)
vkbeautify
expanding.js
jquery community
jquery.xmlns creator
json2.js and cycle.js