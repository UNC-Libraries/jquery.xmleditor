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
	this.xsd = null;
	this.imports = {};
	this.rootDefinitions = {};
	this.types = {};
	this.namespaces = {
			"xml": "http://www.w3.org/XML/1998/namespace",
			"xmlns": "http://www.w3.org/2000/xmlns/",
			"html": "http://www.w3.org/1999/xhtml/"
	};
	this.namespacePrefixes = {};
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
			self.xsd = $.parseXML(data).documentElement;
			self.processSchema();
		}, error: function() {
			if (!originalAttempt)
				throw new Error("Unable to import " + url);
			self.importAjax(originalURL, true);
		}
	});
};

Xsd2Json.prototype.getChildren = function(node, childName, nameAttribute) {
	var children = [];
	if (!node)
		node = this.xsd;
	var childNameSpecified = childName !== undefined;
	var attributeSpecified = nameAttribute !== undefined;
	var childNodes = node.childNodes;
	for (var index in childNodes) {
		var child = childNodes[index];
		if (child.nodeType == 1 && child.namespaceURI == this.xsNS && 
				((childNameSpecified && child.localName == childName) || (!childNameSpecified && child.localName != 'annotation')) &&
				(!attributeSpecified || child.getAttribute('name') == nameAttribute))
			children.push(child);
	}
	return children;
}

Xsd2Json.prototype.processSchema = function() {
	var self = this;
	// Extract all the namespaces in use by this schema
	for (var i = 0; i < this.xsd.attributes.length; i++) {
		var attr = this.xsd.attributes[i];
		if (!attr.specified)
			continue;
		var namespaceIndex = attr.nodeName.indexOf("xmlns");
		if (namespaceIndex == 0){
			namespacePrefix = attr.nodeName.substring(5).replace(":", "");
			// Local namespaces
			self.namespaces[namespacePrefix] = attr.nodeValue;
			// Store the namespace prefix for the xs namespace
			if (attr.nodeValue == self.xsNS){
				self.xsPrefix = namespacePrefix;
				if (self.xsPrefix != "")
					self.xsPrefix = self.xsPrefix + ":";
			}
		}
	}
	// Store namespaces so the prefixes can be found by uri
	$.each(this.namespaces, function(prefix, uri){
		self.namespacePrefixes[uri] = prefix;
	});
	// Store the target namespace of this schema.
	this.targetNS = this.xsd.getAttribute("targetNamespace");
	// Load all of the imported schemas
	var imports = this.getChildren(this.xsd, 'import');
	for (var index in imports) {
		var importNode = imports[index];
		var importXSD = new Xsd2Json(importNode.getAttribute("schemaLocation"), $.extend({}, self.options, {"rootElement": null}));
		var namespace = importNode.getAttribute("namespace");
		this.imports[namespace] = importXSD;
	}
	// Begin constructing the element tree, either from a root element or the schema element
	var selected = null;
	if (this.options.rootElement != null)
		selected = this.getChildren(this.xsd, "element", this.options.rootElement)[0];
	else selected = this.xsd;
	try {
		if (this.options.rootElement != null)
			this.root = this.buildElement(selected);
		else this.root = this.buildSchema(selected);
		// Add namespace prefixes to match the scoping of this document
		this.adjustPrefixes(this.root);
	} catch (e) {
		console.log(e);
	}
};

Xsd2Json.prototype.adjustPrefixes = function(object) {
	if (object.typeRef == null) {
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
			$.each(object.elements, function(){
				self.adjustPrefixes(this);
			});
			if (object.attributes != null) {
				$.each(object.attributes, function(){
					self.adjustPrefixes(this);
				});
			}
		}
	} else {
		// If there was a type definition on this object, merge it in and stop
		var typeDef = object.typeRef;
		delete object.typeRef;
		this.mergeType(object, typeDef);
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
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == 'element')
			this.buildElement(child, object);
	}
	return object;
};

Xsd2Json.prototype.buildElement = function(node, parentObject) {
	var definition = null;
	var name = node.getAttribute("name");
	
	var hasSubGroup = node.getAttribute("substitutionGroup") != null;
	var hasRef = node.getAttribute("ref") != null;
	if (hasSubGroup || hasRef){
		definition = this.execute(node, 'buildElement');
		if (hasSubGroup) {
			definition = $.extend({}, definition, {'name' : name, 'localName' : name});
			if (node.parentNode === this.xsd && !hasRef)
				this.rootDefinitions[name] = definition;
		}
	} else {
		// Element has a name, means its a new element
		definition = {
				"name": name,
				"localName" : name,
				"elements": [],
				"attributes": [],
				"values": [],
				"type": null,
				"namespace": this.targetNS,
				"element": true
		};
		
		if (node.parentNode === this.xsd)
			this.rootDefinitions[name] = definition;
		
		var type = node.getAttribute("type");
		if (type == null) {
			this.buildType(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.execute(node, 'buildType', definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
	if (parentObject != null && node.getAttribute("abstract") != "true")
		parentObject.elements.push(definition);
	
	return definition;
}

Xsd2Json.prototype.buildAttribute = function(node, parentObject) {
	
	var definition = null;
	var name = node.getAttribute("name");
	
	var hasRef = node.getAttribute("ref") != null;
	if (hasRef){
		definition = this.execute(node, 'buildAttribute');
	} else {
		definition = {
				"name": name,
				"localName" : name,
				"values": [],
				"namespace": this.targetNS,
				"attribute": true
			};
		
		var type = node.getAttribute("type");
		if (type == null) {
			this.buildType(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.execute(node, 'buildType', definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
	if (node.parentNode === this.xsd && !hasRef) {
		this.rootDefinitions[name] = definition;
	}
	
	if (parentObject != null)
		parentObject.attributes.push(definition);
	
	return definition;
};

Xsd2Json.prototype.buildType = function(node, object) {
	if (node == null)
		return;
	var needsMerge = false;
	var extendingObject = object;
	var name = node.getAttribute("name");
	if (name != null){
		// If this type has already been processed, then apply it
		if (name in this.rootDefinitions) {
			this.mergeType(object, this.types[name]);
			return;
		}
		// New type, create base
		var type = {
				elements: [],
				attributes: [],
				values: [],
				namespace: node.namespaceURI
			};
		this.rootDefinitions[name] = type;
		//this.types[name] = type;
		extendingObject = type;
		needsMerge = true;
	}
	
	if (node.localName == "complexType") {
		this.buildComplexType(node, extendingObject);
	} else if (node.localName == "simpleType") {
		this.buildSimpleType(node, extendingObject);
	} else if (node.localName == "restriction") {
		this.buildRestriction(node, extendingObject);
	}
	
	if (needsMerge) {
		this.mergeType(object, extendingObject);
	}
};

Xsd2Json.prototype.buildComplexType = function(node, object) {
	var self = this;
	if (node.getAttribute("mixed") == "true") {
		object.type = "mixed";
	}
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "group") {
			self.execute(child, 'buildGroup', object);
		} else if (child.localName == "simpleContent") {
			self.buildSimpleContent(child, object);
		} else if (child.localName == "complexContent") {
			self.buildComplexContent(child, object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.execute(child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		}
	}
};

Xsd2Json.prototype.buildSimpleType = function(node, object) {
	var child = this.getChildren(node)[0];
	if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	} else if (child.localName == "list") {
		this.buildList(child, object);
	} else if (child.localName == "union") {
		this.buildUnion(child, object);
	}
};

Xsd2Json.prototype.buildList = function(node, object) {
	var itemType = node.getAttribute('itemType');
	object.type = this.resolveType(itemType, object);
	if (object.type == null) {
		this.execute(node, 'buildType', object);
	}
	object.multivalued = true;
};

Xsd2Json.prototype.buildUnion = function(node, object) {
	var memberTypes = node.getAttribute('memberTypes');
	if (memberTypes) {
		memberTypes = memberTypes.split(' ');
		var self = this;
		for (var i in memberTypes) {
			var memberType = memberTypes[i];
			var xsdObj = self.resolveXSD(memberType);
			var targetNode = xsdObj.getChildren(null, 'simpleType', memberType)[0];
			xsdObj.buildType(targetNode, object);
		}
	}
	var self = this;
	var children = this.getChildren(node, 'simpleType');
	for (var i in children)
		self.buildSimpleType(children[i], object);
};

Xsd2Json.prototype.buildGroup = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "choice")  {
			self.buildChoice(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		}
	}
};

Xsd2Json.prototype.buildAll = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			self.buildElement(child, object);
		}
	}
};

Xsd2Json.prototype.buildChoice = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			self.buildElement(child, object);
		} else if (child.localName == "group") {
			self.execute(child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "any") {
			self.buildAny(child, object);
		}
	}
};

Xsd2Json.prototype.buildSequence = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			self.buildElement(child, object);
		} else if (child.localName == "group") {
			self.execute(child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "any") {
			self.buildAny(child, object);
		}
	}
};

Xsd2Json.prototype.buildAny = function(node, object) {
	object.any = !(node.getAttribute("minOccurs") == "0" && node.getAttribute("maxOccurs") == "0");
};

Xsd2Json.prototype.buildComplexContent = function(node, object) {
	if (node.getAttribute("mixed") == "true") {
		object.type = "mixed";
	}
	
	var child = this.getChildren(node)[0];
	if (child.localName == "extension") {
		this.buildExtension(child, object);
	} else if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	}
};

Xsd2Json.prototype.buildSimpleContent = function(node, object) {
	var child = this.getChildren(node)[0];
	if (child.localName == "extension") {
		this.buildExtension(child, object);
	} else if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	}
};

Xsd2Json.prototype.buildRestriction = function(node, object) {
	var base = node.getAttribute("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		var typeDef = this.execute(node, 'buildType', object);
		if (typeDef !== undefined)
			this.mergeType(object, typeDef);
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "enumeration") {
			object.values.push(child.getAttribute("value"));
		} else if (child.localName == "group") {
			self.execute(child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.execute(child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "simpleType") {
			self.buildSimpleType(child, object);
		}
	}
};

Xsd2Json.prototype.buildExtension = function(node, object) {
	var base = node.getAttribute("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		var typeDef = this.execute(node, 'buildType', object);
		if (typeDef !== undefined)
			this.mergeType(object, typeDef);
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.execute(child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "group") {
			self.buildGroup(child, object);
		}
	}
};

Xsd2Json.prototype.buildAttributeGroup = function(node, object) {
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "attribute") {
			this.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			this.execute(child, 'buildAttributeGroup', object);
		}
	}
};

Xsd2Json.prototype.execute = function(node, fnName, object) {
	var resolveName = node.getAttribute("ref") || node.getAttribute("substitutionGroup") 
			|| node.getAttribute("type") || node.getAttribute("base");
	var targetNode = node;
	var xsdObj = this;
	var name = resolveName;
	if (resolveName != null && (this.xsPrefix == "" && resolveName.indexOf(":") != -1) 
			|| (this.xsPrefix != "" && resolveName.indexOf(this.xsPrefix) == -1)) {
		xsdObj = this.resolveXSD(resolveName);
		var unprefixedName = this.stripPrefix(name);
		//Check for cached version of the definition
		if (unprefixedName in xsdObj.rootDefinitions){
			var definition = xsdObj.rootDefinitions[unprefixedName];
			if (definition != null) {
				return definition;
			}
		}
		
		targetNode = xsdObj.getChildren(xsdObj.xsd, undefined, this.stripPrefix(name))[0];
	} 
	
	try {
		return xsdObj[fnName](targetNode, object);
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

Xsd2Json.prototype.mergeType = function(base, type) {
	for (var key in type) {
		if (type.hasOwnProperty(key)) {
			var value = type[key];
			if (value != null && base[key] == null){
				base[key] = value;
			} else if ($.isArray(value) && $.isArray(type[key])){
				base[key] = base[key].concat(value);
			}
		}
	}
};

Xsd2Json.prototype.getSchema = function() {
	var self = this;
	return function() {return self.root;};
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
		return vkbeautify.json(JSON.stringify(JSON.decycle(this.root)));
	}
	return JSON.stringify(JSON.decycle(this.root));
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