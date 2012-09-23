/*

    Copyright 2008 The University of North Carolina at Chapel Hill

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License atthis

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

 */
/*
 * Converts xml schemas to usable json objects, focused on elements and attributes.  Result is a javascript
 * object representing a starting node from the base schema, with recursive relations to all its children
 * and attributes.  The resulting structure can then be used or exported.
 * 
 * Intended for populating forms rather than validation.  Not all restrictions are extracted at this time.
 * 
 * Due to cross browser domain restrictions on ajax calls, the schema and its imports must all
 * be stored within the same domain as this script.
 * 
 * @author Ben Pennell
 */
;
function Xsd2Json(xsd, options) {
	var defaults = {
		"schemaURI": "",
		"rootElement": null,
		"generateRoot": false
	};
	this.options = $.extend({}, defaults, options);
	this.xsNS = "http://www.w3.org/2001/XMLSchema";
	this.xsPrefix = "xs:";
	$.xmlns['xs'] = this.xsNS;
	this.xsd = null;
	this.imports = {};
	this.elements = {};
	this.types = {};
	this.attributes = {};
	this.namespaces = {
			"xml": "http://www.w3.org/XML/1998/namespace",
			"xmlns": "http://www.w3.org/2000/xmlns/",
			"html": "http://www.w3.org/1999/xhtml/"
	};
	this.namespacePrefixes = {};
	this.defaultNS = null;
	this.targetNS = null;
	this.root = null;
	
	//if (xsd instanceof File){
		// Not implemented yet
		//var self = this;
		/*var reader = new FileReader();
		reader.onload = (function(theFile) {
	        return function(e) {
	        	self.xsd = $($($.parseXML(e.target.result)).children("xs:schema")[0]);
	        	var selected = self.xsd.children("xs|element[name='" + self.topLevelName + "']").first();
	        	this.root = self.buildElement(selected);
	        };
	      })(xsd);
		
		reader.readAsText(xsd);*/
	//} else {
		this.importAjax(xsd, false);
	//}
};

Xsd2Json.prototype.importAjax = function(url, originalAttempt) {
	var originalURL = url;
	// Prefer a local copy to the remote since likely can't get the remote copy due to cross domain ajax restrictions
	if (!originalAttempt)
		url = this.options.schemaURI + url.substring(url.lastIndexOf("/") + 1);
	var self = this;
	$.ajax({
		url: url,
		dataType: "text",
		async: false,
		success: function(data){
			//console.time("xsd2json" + self.options.rootElement);
			self.xsd = $($($.parseXML(data)).children("xs|schema")[0]);
			self.processSchema();
			//console.timeEnd("xsd2json" + self.options.rootElement);
		}, error: function() {
			if (!originalAttempt)
				throw new Error("Unable to import " + url);
			self.importAjax(originalURL, true);
		}
	});
};

Xsd2Json.prototype.processSchema = function() {
	var self = this;
	// Extract all the namespaces in use by this schema
	$.each(this.xsd[0].attributes, function(){
		var namespaceIndex = this.nodeName.indexOf("xmlns");
		if (namespaceIndex == 0){
			namespacePrefix = this.nodeName.substring(5).replace(":", "");
			// Local namespaces
			self.namespaces[namespacePrefix] = this.nodeValue;
			if (namespacePrefix == "")
				self.defaultNS = this.nodeValue;
			// Store the namespace prefix for the xs namespace
			if (this.nodeValue == self.xsNS){
				self.xsPrefix = namespacePrefix;
				if (self.xsPrefix != "")
					self.xsPrefix = self.xsPrefix + ":";
			}
		}
	});
	// Store namespaces so the prefixes can be found by uri
	$.each(this.namespaces, function(prefix, uri){
		self.namespacePrefixes[uri] = prefix;
	});
	// Store the target namespace of this schema.
	this.targetNS = this.xsd.attr("targetNamespace");
	// Load all of the imported schemas
	this.xsd.children("xs|import").each(function(){
		var importXSD = new Xsd2Json($(this).attr("schemaLocation"), $.extend({}, self.options, {"rootElement": null, "generateRoot": false}));
		var namespace = $(this).attr("namespace");
		self.imports[namespace] = importXSD;
	});
	// Begin constructing the element tree, either from a root element or from a generated root
	if (this.options.rootElement != null || this.options.generateRoot) {
		var selected = null;
		if (this.options.rootElement != null)
			selected = this.xsd.children("xs|element[name='" + this.options.rootElement + "']")[0];
		else selected = this.xsd[0];
		try {
			if (this.options.rootElement != null)
				this.root = this.buildElement(selected);
			else this.root = this.buildSchema(selected);
			// Add namespace prefixes to match the scoping of this document
			this.adjustPrefixes(this.root, []);
		} catch (e) {
			console.log(e);
		}
	}
}

Xsd2Json.prototype.adjustPrefixes = function(object, stack) {
	for (var i = 0; i < stack.length; i++) {
		if (stack[i] === object){
			return;
		}
			
	}
	
	if (object.name.indexOf(":") == -1){
		// Replace object name's prefix with the relative
		var prefix = this.namespacePrefixes[object.namespace];
		if (prefix != null && prefix != "") {
			object.name = prefix + ":" + object.name;
		}
		object.nameEsc = object.name.replace(':', '-');
	} else {
		return;
	}
	// Adjust all the children
	if (object.element || object.schema) {
		var self = this;
		stack.push(object);
		$.each(object.elements, function(){
			self.adjustPrefixes(this, stack);
		});
		stack.pop();
		if (object.attributes != null) {
			$.each(object.attributes, function(){
				self.adjustPrefixes(this, stack);
			});
		}
	}
};

Xsd2Json.prototype.buildSchema = function(node) {
	var object = {
		"name": "",
		"elements": [],
		"namespace": this.targetNS,
		"schema": true
	};
	var self = this;
	$(node).children().not("xs|annotation").each(function(){
		if (self.xsEq(this, "element")) {
			self.buildElement(this, object);
		}
	});
	return object;
};

Xsd2Json.prototype.buildElement = function(node, parentObject) {
	var element = null;
	var name = $(node).attr("name");
	if (name != null && name in this.elements) {
		element = this.elements[name];
		console.log("Reusing element " + name);
	} else {
		if ($(node).attr("ref") != null){
			this.execute(node, 'buildElement', parentObject);
			return;
		}
		
		// Element has a name, means its a new element
		element = {
				"name": name,
				"elements": [],
				"attributes": [],
				"values": [],
				"type": null,
				"namespace": this.targetNS,
				"element": true
		};
		// Cache global elements for future use
		if ($(node).parents().length == 1) {
			this.elements[name] = element;
		}
		
		if ($(node).attr("substitutionGroup") != null) {
			var subGroup = $(node).attr("substitutionGroup");
			var xsdObj = this.resolveXSD(subGroup);
			subGroup = this.stripPrefix(subGroup);
			var targetElement = null;
			if (subGroup in xsdObj.elements) {
				targetElement = xsdObj.elements[subGroup];
			} else {
				targetElement = xsdObj.buildElement(xsdObj.xsd.children("*[name='" + subGroup + "']")[0]);
			}
			this.mergeType(element, targetElement);
		} else {
			var type = $(node).attr("type");
			if (type == null) {
				this.buildType($(node).children().not("xs|annotation")[0], element);
			} else {
				element.type = this.resolveType(type, element);
				if (element.type == null)
					this.execute($(node)[0], 'buildType', element);
			}
		}
	}
	
	if (parentObject != null && $(node).attr("abstract") != "true")
		parentObject.elements.push(element);
	
	return element;
};

Xsd2Json.prototype.buildAttribute = function(node, object) {
	if ($(node).attr("ref") != null){
		this.execute(node, 'buildAttribute', object);
		return;
	}
	
	var attributeObject = {
			"name": $(node).attr("name"),
			"values": [],
			"namespace": this.targetNS,
			"attribute": true
		};
	// Cache global elements for future use
	if ($(node).parents().length == 1) {
		this.attributes[$(node).attr("name")] = attributeObject;
	}
	var type = $(node).attr("type");
	if (type == null) {
		this.buildType($(node).children().not("xs|annotation")[0], attributeObject);
	} else {
		attributeObject.type = this.resolveType(type, attributeObject);
		if (attributeObject.type == null){
			this.execute($(node)[0], 'buildType', attributeObject);
		}
	}
	
	if (object != null) {
		object.attributes.push(attributeObject);
	}
		
	
	return attributeObject;
};

Xsd2Json.prototype.buildType = function(node, object) {
	if (node == null)
		return;
	var needsMerge = false;
	var extendingObject = object;
	if ($(node).attr("name") != null){
		// If this type has already been processed, then apply it
		if ($(node).attr("name") in this.types) {
			this.mergeType(object, this.types[$(node).attr("name")]);
			return;
		}
		// New type, create base
		var type = {
				elements: [],
				attributes: [],
				values: [],
				namespace: node.namespaceURI
			};
		this.types[$(node).attr("name")] = type;
		extendingObject = type;
		needsMerge = true;
	}
	
	if (this.xsEq(node, "complexType")) {
		this.buildComplexType(node, extendingObject);
	} else if (this.xsEq(node, "simpleType")) {
		this.buildSimpleType(node, extendingObject);
	} else if (this.xsEq(node, "restriction")) {
		this.buildRestriction(node, extendingObject);
	}
	
	if (needsMerge) {
		this.mergeType(object, extendingObject);
	}
};

Xsd2Json.prototype.buildComplexType = function(node, object) {
	var self = this;
	$(node).children().not("xs|annotation").each(function(){
		if (self.xsEq(this, "group")) {
			self.execute(this, 'buildGroup', object);
		} else if (self.xsEq(this, "simpleContent")) {
			self.buildSimpleContent(this, object);
		} else if (self.xsEq(this, "complexContent")) {
			self.buildComplexContent(this, object);
		} else if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "attribute")) {
			self.buildAttribute(this, object);
		} else if (self.xsEq(this, "attributeGroup")) {
			self.execute(this, 'buildAttributeGroup', object);
		} else if (self.xsEq(this, "sequence")) {
			self.buildSequence(this, object);
		} else if (self.xsEq(this, "all")) {
			self.buildAll(this, object);
		}
	});
};

Xsd2Json.prototype.buildSimpleType = function(node, object) {
	var child = $(node).children().not("xs|annotation").first()[0];
	if (this.xsEq(child, "restriction")) {
		this.buildRestriction(child, object);
	} else if (this.xsEq(child, "list")) {
		this.buildList(child, object);
	} else if (this.xsEq(child, "union")) {
		this.buildUnion(child, object);
	}
};

Xsd2Json.prototype.buildList = function(node, object) {
	var itemType = $(node).attr('itemType');
	object.type = this.resolveType(itemType, object);
	if (object.type == null) {
		this.execute(node, 'buildType', object);
	}
	object.multivalued = true;
};

Xsd2Json.prototype.buildUnion = function(node, object) {
	var memberTypes = $(node).attr('memberTypes').split(" ");
	var self = this;
	$.each(memberTypes, function(){
		var xsdObj = self.resolveXSD(this);
		var targetNode = xsdObj.xsd.children("xs|simpleType[name='" + this + "']")[0];
		xsdObj.buildType(targetNode, object);
	});
};

Xsd2Json.prototype.buildGroup = function(node, object) {
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "all")) {
			self.buildAll(this, object);
		} else if (self.xsEq(this, "sequence")) {
			self.buildSequence(this, object);
		}
	});
};

Xsd2Json.prototype.buildAll = function(node, object) {
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "element")) {
			self.buildElement(this, object);
		}
	});
};

Xsd2Json.prototype.buildChoice = function(node, object) {
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "element")) {
			self.buildElement(this, object);
		} else if (self.xsEq(this, "group")) {
			self.execute(this, 'buildGroup', object);
		} else if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "sequence")) {
			self.buildSequence(this, object);
		} else if (self.xsEq(this, "any")) {
			self.buildAny(this, object);
		}
	});
};

Xsd2Json.prototype.buildSequence = function(node, object) {
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "element")) {
			self.buildElement(this, object);
		} else if (self.xsEq(this, "group")) {
			self.execute(this, 'buildGroup', object);
		} else if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "sequence")) {
			self.buildSequence(this, object);
		} else if (self.xsEq(this, "any")) {
			self.buildAny(this, object);
		}
	});
};

Xsd2Json.prototype.buildAny = function(node, object) {
	object.any = !($(node).attr("minOccurs") == "0" && $(node).attr("maxOccurs") == "0");
};

Xsd2Json.prototype.buildComplexContent = function(node, object) {
	if ($(node).attr("mixed") == "true") {
		object.type = "mixed";
	}
	
	var child = $(node).children().not("xs|annotation")[0];
	if (this.xsEq(child, "extension")) {
		this.buildExtension(child, object);
	} else if (this.xsEq(child, "restriction")) {
		this.buildRestriction(child, object);
	}
};

Xsd2Json.prototype.buildSimpleContent = function(node, object) {
	var child = $(node).children().not("xs|annotation")[0];
	if (this.xsEq(child, "extension")) {
		this.buildExtension(child, object);
	} else if (this.xsEq(child, "restriction")) {
		this.buildRestriction(child, object);
	}
};

Xsd2Json.prototype.buildRestriction = function(node, object) {
	var base = $(node).attr("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		this.execute(node, 'buildType', object);
	}
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "enumeration")){
			object.values.push($(this).attr("value"));
		} else if (self.xsEq(this, "group")) {
			self.execute(this, 'buildGroup', object);
		} else if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "attribute")) {
			self.buildAttribute(this, object);
		} else if (self.xsEq(this, "attributeGroup")) {
			self.execute(this, 'buildAttributeGroup', object);
		} else if (self.xsEq(this, "sequence")) {
			self.buildSequence(this, object);
		} else if (self.xsEq(this, "all")) {
			self.buildAll(this, object);
		} else if (self.xsEq(node, "simpleType")) {
			self.buildSimpleType(this, object);
		}
	});
};

Xsd2Json.prototype.buildExtension = function(node, object) {
	var base = $(node).attr("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		this.execute(node, 'buildType', object);
	}
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "attribute")){
			self.buildAttribute(this, object);
		} else if (self.xsEq(this, "attributeGroup")){
			self.execute(this, 'buildAttributeGroup', object);
		} else if (self.xsEq(this, "sequence")){
			self.buildSequence(this, object);
		} else if (self.xsEq(this, "all")) {
			self.buildAll(this, object);
		} else if (self.xsEq(this, "choice")) {
			self.buildChoice(this, object);
		} else if (self.xsEq(this, "group")) {
			self.buildGroup(this, object);
		}
	});
};

Xsd2Json.prototype.buildAttributeGroup = function(node, object) {
	var self = this;
	$(node).children().each(function(){
		if (self.xsEq(this, "attribute")){
			self.buildAttribute(this, object);
		} else if (self.xsEq(this, "attributeGroup")){
			self.execute(this, 'buildAttributeGroup', object);
		}
	});
};

Xsd2Json.prototype.execute = function(node, fnName, object) {
	var resolveName = $(node).attr("ref") || $(node).attr("type") || $(node).attr("base");
	var targetNode = node;
	var xsdObj = this;
	var name = resolveName;
	console.log("Execute " + name);
	if (resolveName != null && (this.xsPrefix == "" && resolveName.indexOf(":") != -1) 
			|| (this.xsPrefix != "" && resolveName.indexOf(this.xsPrefix) == -1)) {
		xsdObj = this.resolveXSD(resolveName);
		targetNode = xsdObj.xsd.children("*[name='" + this.stripPrefix(name) + "']")[0];
	} 
	
	try {
		xsdObj[fnName](targetNode, object);
	} catch (error) {
		$("body").append("<br/>" + name + ": " + error + " ");
		throw error;
	}
};

Xsd2Json.prototype.stripPrefix = function(name) {
	var index = name.indexOf(":");
	return index == -1? name: name.substring(index + 1);
};

Xsd2Json.prototype.resolveXSD = function(name) {
	if (name != null){
		var index = name.indexOf(":");
		var nameNamespace = index == -1? null: name.substring(0, index);
		var prefix = this.namespaces[nameNamespace];
		var xsdObj = this.imports[prefix];
		if (xsdObj == null)
			xsdObj = this;
		return xsdObj;
	}
	return this;
};

Xsd2Json.prototype.resolveType = function(type, object) {
	if (object.type != null)
		return object.type;
	if (type.indexOf(":") == -1) {
		if (this.xsPrefix == "")
			return type;
	} else {
		if (type.indexOf(this.xsPrefix) == 0){
			return type.substring(this.xsPrefix.length);
		}
	}
	return null;
};

Xsd2Json.prototype.xsEq = function(node, name) {
	return node.localName == name && node.namespaceURI == "http://www.w3.org/2001/XMLSchema";
};

Xsd2Json.prototype.mergeType = function(base, type) {
	$.each(type, function(key, value){
		if (value != null && base[key] == null){
			base[key] = value;
		} else if ($.isArray(value) && $.isArray(type[key])){
			base[key] = base[key].concat(value);
		}
	});
};

/**
 * Converts the computed schema object into JSON and returns as a string.  If pretty is
 * true, then the json will use pretty formatting.
 * @param pretty
 * @returns
 */
Xsd2Json.prototype.stringify = function(pretty) {
	if (this.root == null)
		throw new Error("Root element was not set, cannot convert to JSON.");
	if (pretty) {
		return vkbeautify.json(JSON.stringify(this.root));
	}
	return JSON.stringify(this.root);
};

/**
 * Creates a file named <filename> from the computed schema object, converted to JSON.
 * If variableName is provided, then the JSON will be output so that it is assigned to a variable of
 * the same name in the exported JSON file.  Allows for caching to a file without needing to use eval to reload.
 * If pretty is provided, the json will use pretty formatting.
 * @param filename
 * @param variableName
 * @param pretty
 * @returns {Boolean}
 */
Xsd2Json.prototype.exportJSON = function(filename, variableName, pretty) {
	// JSON versus JS
	window.URL = window.webkitURL || window.URL;
	window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
	
	if (window.BlobBuilder === undefined) {
		alert("Browser does not support saving files.");
		return false;
	}
	
	var jsonString = this.stringify(pretty);
	if (variableName != null){
		jsonString = "var " + variableName + " = " + jsonString + ";";
	}
	var blobBuilder = new BlobBuilder();
	blobBuilder.append(jsonString);
	
	var mimeType = "application/json";
	
	var a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blobBuilder.getBlob(mimeType));
	
	a.dataset.downloadurl = [mimeType, a.download, a.href].join(':');
	a.target = "exportJSON";
	
	var event = document.createEvent("MouseEvents");
	event.initMouseEvent(
		"click", true, false, window, 0, 0, 0, 0, 0
		, false, false, false, false, 0, null
	);
	a.dispatchEvent(event);
};