;var Xsd2Json = function() {

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

function Xsd2Json(originatingXsdName, options) {
	var defaults = {
		schemaURI: ""
	};
	this.options = $.extend({}, defaults, options);
	
	this.xsdManager = new SchemaManager(originatingXsdName, options);

};

Xsd2Json.prototype.getSchema = function() {
	var self = this;
	return function() {
		return self.xsdManager.originatingRoot;
	};
};

/**
 * Converts the computed schema object into JSON and returns as a string.  If pretty is
 * true, then the json will use pretty formatting.
 * @param pretty
 * @returns
 */
Xsd2Json.prototype.stringify = function(pretty) {
	if (this.xsdManager.originatingRoot == null)
		throw new Error("Root element was not set, cannot convert to JSON.");
	if (pretty) {
		return vkbeautify.json(JSON.stringify(JSON.decycle(this.xsdManager.originatingRoot)));
	}
	return JSON.stringify(JSON.decycle(this.xsdManager.originatingRoot));
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
/**
 * Manages processing of a set of schemas to produce a single resulting
 * tree of elements
 * 
 * @author bbpennel
 */

function SchemaManager(originatingXsdName, options) {
	var defaults = {
			globalNamespaces : {}
	};
	
	this.options = $.extend({}, defaults, options);
	
	var self = this;
	
	this.isHttpUrl = new RegExp(/^https?:\/\//);
	
	// Map of schema processors for imported schemas.  Stored by namespace
	this.imports = {};
	// Map of schema processors for included schemas.  Stored by schemaLocation
	this.includes = {};
	
	// Reference to the schema object being used as the starting schema
	this.originatingSchema = null;
	// Root element of the originating schema
	this.originatingRoot = null;
	
	// Shared namespace index registry, used by all schemas being processed
	this.namespaceIndexes = [];
	
	this.xsNS = "http://www.w3.org/2001/XMLSchema";
	
	/// Registering the "special" namespaces that are automatically added by web browsers
	this.globalNamespaces = $.extend({}, options.globalNamespaces, {
		"xml" : "http://www.w3.org/XML/1998/namespace",
		"xmlns" : "http://www.w3.org/2000/xmlns/",
		"html" : "http://www.w3.org/1999/xhtml/"
	});
	
	$.each(this.globalNamespaces, function(prefix, namespaceUri) {
		self.registerNamespace(namespaceUri);
	});
	
	// Load in the orginating schema and start processing from there
	this.importSchema(this.computeSchemaLocation(originatingXsdName));
	
	// Establish originatingRoot reference
	this.setOriginatingRoot();
	
	this.resolveTypeReferences(this.originatingRoot);
	
	// Add namespace uris into the final schema object
	this.exportNamespaces();
};

SchemaManager.prototype.retrieveSchema = function(url, callback) {
	this.importAjax(url, callback);
};

SchemaManager.prototype.importAjax = function(url, callback, failedLocalAttempt) {
	var self = this;
	var isHttpRequest = url.match(this.isHttpUrl);
	var schemaPath = url;
	// Try http urls as local calls first since the full urls generally fail
	if (isHttpRequest && !failedLocalAttempt)
		schemaPath = self.options.schemaURI + url.substring(url.lastIndexOf("/") + 1);
	
	$.ajax({
		url: schemaPath,
		dataType: "text",
		async: false,
		success: function(data){
			var xsdDocument = $.parseXML(data).documentElement;
			callback.call(self, xsdDocument, url);
		}, error: function() {
			if (!isHttpRequest || failedLocalAttempt)
				throw new Error("Unable to import " + url);
			// Try treating as a relative url since original path wasn't retrievable
			self.importAjax(url, callback, true);
		}
	});
};

SchemaManager.prototype.computeSchemaLocation = function(url, parentSchema) {
	if (!url)
		return null;
	
	var isNotRelative = url.match(this.isHttpUrl);
	if (isNotRelative) {
		return url;
	} else {
		if (parentSchema && parentSchema.schemaPath) {
			// Path relative to its parent
			return parentSchema.schemaPath + url;
		} else if (this.options.schemaURI) {
			// No parent path, so use go relative to base schema uri
			return this.options.schemaURI + url;
		}
	}
};

/**
 * Only one schema per namespace will be imported.  All future namespaces imported into the 
 * same schema are ignored.
 * Provided namespaceUri is favored over the target namespace in the imported schema.
 */
SchemaManager.prototype.importSchema = function(schemaLocation, namespaceUri) {
	
	// Namespace already imported, circular import or already imported by another schema
	if (namespaceUri in this.imports)
		return;
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument, schemaUrl) {
		// Instantiate schema processor
		var schema = new SchemaProcessor(xsdDocument, this, schemaUrl);
		
		// Register schema
		if (namespaceUri)
			this.imports[namespaceUri] = [schema];
		else {
			// Discard schema if another schema was already imported in its target namespace
			if (schema.targetNS in this.imports)
				return;
			this.imports[schema.targetNS] = [schema];
		}
		
		// Store the first schema picked up as the originating schema
		if (!this.originatingSchema)
			this.originatingSchema = schema;
		
		// Process imported schemas before processing this one
		this.processImports(schema);
		this.processIncludes(schema);
		
		// Process the target schema
		schema.processSchema();
	});
};

SchemaManager.prototype.processImports = function(schema) {
	// Load all of the imported schemas
	var imports = schema.getChildren(schema.xsd, 'import');

	for (var index in imports) {
		var importNode = imports[index];
		var importNamespace = importNode.getAttribute('namespace');
		var schemaLocation = 
			this.computeSchemaLocation(importNode.getAttribute("schemaLocation"), schema);
		
		this.importSchema(schemaLocation, importNode.getAttribute("namespace"));
	}
};

SchemaManager.prototype.includeSchema = function(schemaLocation, namespaceIndex) {
	
	// Check for duplicate include by namespace and schemaLocation
	if (namespaceIndex in this.includes) {
		if ($.inArray(schemaLocation, this.includes[namespaceIndex]) != -1)
			return;
		this.includes[namespaceIndex].push(schemaLocation);
	} else {
		// Register schema to includes list for duplicate/circular reference detection
		this.includes[namespaceIndex] = [schemaLocation];
	}
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument, schemaUrl) {
		// Instantiate schema processor using parents namespace
		var schema = new SchemaProcessor(xsdDocument, this, schemaUrl, namespaceIndex);
		
		// Register schema to imports list as part of namespace bucket
		this.imports[this.getNamespaceUri(namespaceIndex)].push(schema);
		
		// Process imported schemas before processing this one
		this.processImports(schema);
		this.processIncludes(schema);
		
		// Process the target schema
		schema.processSchema();
	});
};

SchemaManager.prototype.processIncludes = function(schema) {
	// Load all of the imported schemas
	var includes = schema.getChildren(schema.xsd, 'include');

	for (var index in includes) {
		var includeNode = includes[index];
		var schemaLocation =
			this.computeSchemaLocation(includeNode.getAttribute("schemaLocation"),
					schema);
		
		this.includeSchema(schemaLocation, schema.targetNSIndex);
	}
};

SchemaManager.prototype.setOriginatingRoot = function() {
	this.originatingRoot = {
			schema : true,
			ns : this.originatingSchema.targetNSIndex,
			namespaces : [],
			elements : [],
			np : true
		};
	
	for (var ns in this.imports) {
		var importSet = this.imports[ns];
		
		for (var index in importSet) {
			var schema = importSet[index];
			
			for (var elIndex in schema.root.elements) {
				this.originatingRoot.elements.push(schema.root.elements[elIndex]);
			}
		}
	}
};

SchemaManager.prototype.mergeRootLevelElements = function() {
	for (var ns in this.imports) {
		var importSet = this.imports[ns];
		
		for (var index in importSet) {
			var schema = importSet[index];
			
			for (var elIndex in schema.root.elements) {
				this.originatingRoot.elements.push(schema.root.elements[elIndex]);
			}
		}
	}
};

SchemaManager.prototype.exportNamespaces = function() {

	// Add all the namespaces from imported schemas into the registry of namespaces for the root schema
	var self = this;
	var namespacePrefixes = {};
	var prefixUsed = {};
	this.addNamespacePrefixes(namespacePrefixes, prefixUsed, {'xs': self.xsNS});
	this.addNamespacePrefixes(namespacePrefixes, prefixUsed, self.originatingSchema.localNamespaces);
	this.addNamespacePrefixes(namespacePrefixes, prefixUsed, {'': self.originatingSchema.targetNS});
	for (var targetNS in self.imports) {
		self.imports[targetNS].forEach(function(schema) {
			self.addNamespacePrefixes(namespacePrefixes, prefixUsed, schema.localNamespaces);
		});
	}
	var namespaceRegistry = [];
	var anonymousNamespaceIndex = 1;
	this.namespaceIndexes.forEach(function(namespaceUri) {
		var prefix = namespacePrefixes[namespaceUri];
		if (prefix === undefined) {
			while (true) {
				prefix = 'ns' + anonymousNamespaceIndex;
				anonymousNamespaceIndex++;
				if (prefixUsed[prefix] === undefined) {
					break;
				}
			}
		}
		namespaceRegistry.push({'prefix' : prefix, 'uri' : namespaceUri});
	});
	
	this.originatingRoot.namespaces = namespaceRegistry;
};

SchemaManager.prototype.addNamespacePrefixes = function(namespacePrefixes, prefixUsed, namespaces) {

	for (var prefix in namespaces) {
		if (prefixUsed[prefix] !== undefined) {
			continue;
		}
		var namespaceUri = namespaces[prefix];
		if (namespacePrefixes[namespaceUri] !== undefined) {
			continue;
		}
		namespacePrefixes[namespaceUri] = prefix;
		prefixUsed[prefix] = true;
	}
};

//Post processing step which recursively walks the schema tree and merges type definitions
//into elements that reference them.
SchemaManager.prototype.resolveTypeReferences = function(definition) {
	
	// Prevent processing the same object more than once
	if (definition.np)
		delete definition.np;
	else
		return definition;

	if (definition.ref) {
		var ref = definition.ref;
		delete definition.ref;
		
		var refDef = this.resolveDefinition(ref);
		if (!refDef)
			throw new Error("Could not resolve reference " + ref 
					+ " from definition " + definition.name);
		
		// Compute nested types depth first before merging in this type
		this.resolveTypeReferences(refDef);
		
		this.mergeRef(definition, refDef);
	} else {
		// Process children
		var self = this;
		if (definition.typeRef) {
			// Merge in any type references
			var typeRefs = definition.typeRef;
			delete definition.typeRef;
			
			for (var index in typeRefs) {
				var typeRef = typeRefs[index];
				
				// Find the definition being referenced across all schemas
				var typeDef = this.resolveDefinition(typeRef.indexedName);
				if (!typeDef)
					throw new Error("Could not resolve reference to type " + typeRef.indexedName
							+ " from definition " + definition.name);
				
				// Compute nested types depth first before merging in this type
				this.resolveTypeReferences(typeDef);
				
				this.mergeType(definition, typeDef, typeRef.mergeMode);
			}
		}
		if (definition.elements) {
			$.each(definition.elements, function(){
				self.resolveTypeReferences(this);
			});
		}
		if (definition.attributes != null) {
			$.each(definition.attributes, function(){
				self.resolveTypeReferences(this);
			});
		}
	}
};

SchemaManager.prototype.resolveDefinition = function(indexedName) {
	var index = indexedName.substring(0, indexedName.indexOf(":"));
	
	var schemaSet = this.imports[this.getNamespaceUri(index)];
	for (var index in schemaSet) {
		var schema = schemaSet[index];
		
		//Check for cached version of the definition
		if (indexedName in schema.rootDefinitions){
			var definition = schema.rootDefinitions[indexedName];
			if (definition != null) {
				return definition;
			}
		}
	}
};

/**
 * Inspects the reference name and returns the set of schema objects that
 * correspond to its namespace
 */
SchemaManager.prototype.resolveSchema = function(schema, name) {
	if (name != null){
		var index = name.indexOf(":");
		var prefix = index == -1? "": name.substring(0, index);
		var namespace = schema.localNamespaces[prefix];
		var xsdObj = this.imports[namespace];
		if (xsdObj == null)
			xsdObj = [schema];
		return xsdObj;
	}
	return this;
};

SchemaManager.prototype.mergeType = function(base, type, mergeMode) {
	for (var key in type) {
		if (type.hasOwnProperty(key)) {
			var value = type[key];
			if (value != null && base[key] == null){
				base[key] = value;
			} else if ($.isArray(value) && $.isArray(base[key])){
				base[key] = this.mergeTypeArray(base[key], value, key, mergeMode);
			}
		}
	}
};

SchemaManager.prototype.mergeTypeArray = function(baseArray, typeArray, key, mergeMode) {
	var mergeFunction = this['mergeType_' + key + '_' + mergeMode];
	if (mergeFunction === undefined) {
		throw Error('Invalid definition key ' + JSON.stringify(key) + ' or merge mode ' + JSON.stringify(mergeMode));
	}
	return mergeFunction.call(this, baseArray, typeArray);
};

SchemaManager.prototype.mergeType_choices_extension = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_choices_restriction = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_attributes_extension = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_attributes_restriction = function(baseArray, typeArray) {
	var baseNames = {};
	for (var i = 0; i < baseArray.length; i++) {
		baseNames[baseArray[i].name] = true;
	}
	var typeResult = [];
	for (var j = 0; j < typeArray.length; j++) {
		var typeItem = typeArray[j];
		if (!baseNames[typeItem.name]) {
			typeResult.push(typeItem);
		}
	}
	return typeResult.concat(baseArray);
};

SchemaManager.prototype.mergeType_elements_extension = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_elements_restriction = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_values_extension = function(baseArray, typeArray) {
	return baseArray.concat(typeArray);
};

SchemaManager.prototype.mergeType_values_restriction = function(baseArray, typeArray) {
	return baseArray;
};

SchemaManager.prototype.mergeRef = function(base, ref) {
	if (ref.name)
		base.name = ref.name;
	base.ns = ref.ns;
	
	var mergeMode = 'extension';
	this.mergeType(base, ref, mergeMode);
}

//Register a namespace if it is new
SchemaManager.prototype.registerNamespace = function(namespaceUri) {
	var namespaceIndex = $.inArray(namespaceUri, this.namespaceIndexes);
	if (namespaceIndex == -1) {
		this.namespaceIndexes.push(namespaceUri);
		return this.namespaceIndexes.length - 1;
	}
	
	return namespaceIndex;
};

SchemaManager.prototype.getNamespaceIndex = function(namespaceUri) {
	return $.inArray(namespaceUri, this.namespaceIndexes);
};

SchemaManager.prototype.getNamespaceUri = function(index) {
	return this.namespaceIndexes[index];
};
/**
 * Processes an XML schema, extracting key features and storing them into
 * javascript structures.
 * 
 * @author bbpennel
 */

/**
 * xsdDocument XML document representaton of the schema document to be processed
 * xsdManager schema manager which this processor belongs to
 */

function SchemaProcessor(xsdDocument, xsdManager, schemaUrl, parentNSIndex) {
	
	this.xsd = xsdDocument;
	this.xsdManager = xsdManager;
	this.schemaUrl = schemaUrl;
	this.schemaPath = this.schemaUrl.substring(0, this.schemaUrl.lastIndexOf("/") + 1);
	
	// Object definitions defined at the root level of the schema
	this.rootDefinitions = {};
	
	// Local namespace prefix registry
	this.localNamespaces = $.extend({}, this.xsdManager.globalNamespaces);

	this.extractNamespaces();

	if (parentNSIndex !== undefined) {
		this.targetNSIndex = parentNSIndex;
		this.targetNS = this.xsdManager.getNamespaceUri(parentNSIndex);
	} else {
		this.targetNS = this.xsd.getAttribute('targetNamespace');
		this.targetNSIndex = this.xsdManager.registerNamespace(this.targetNS);
	}
	
	// Register the correct default namespace if none was specified, see:
	// * https://www.w3.org/TR/xmlschema11-1/#src-include
	// * https://www.w3.org/TR/xmlschema11-1/#sec-src-resolve
	if (!('' in this.localNamespaces)) {
		if (this.xsd.getAttribute('targetNamespace') === null) {
			this.localNamespaces[''] = this.targetNS;
		} else {
			this.localNamespaces[''] = this.xsdManager.xsNS;
		}
	}

	// Root definition for this schema, either an element or a schema object
	this.root = null;
};

// Process the schema file to extract its structure into javascript objects
SchemaProcessor.prototype.processSchema = function() {
	
	// Begin constructing the element tree, starting from the schema element
	this.root = this.build_schema(this.xsd);
};

SchemaProcessor.prototype.extractNamespaces = function() {
	
	for (var i = 0; i < this.xsd.attributes.length; i++) {
		var attr = this.xsd.attributes[i];
		if (!attr.specified)
			continue;
		
		var namespaceIndex = attr.nodeName.indexOf("xmlns");
		if (namespaceIndex == 0){
			var namespacePrefix = attr.nodeName.substring(5).replace(":", "");
			var namespaceUri = attr.nodeValue;
			this.registerNamespace(namespaceUri, namespacePrefix);
		}
	}
};

SchemaProcessor.prototype.createDefinition = function(node, name) {
	if (!name) {
		name = node.getAttribute("name");
	}
		
	// New root definition
	var definition = {
		values : [],
		type : null,
		ns: this.targetNSIndex,
		np : true
	};
	
	if (name)
		definition.name = name;
	
	if (node.localName == "attribute") {
		definition.attribute = true;
	} else {
		if (node.localName == "element")
			definition.element = true;
		definition.attributes = [];
		definition.elements = [];
	}
	
	return definition;
};

SchemaProcessor.prototype.addElement = function(node, definition, parentDef) {
	
	if (!parentDef.schema) {
		// Store min/max occurs on the the elements parent, as they only apply to this particular relationship
		// Root level elements can't have min/max occurs attributes
		var minOccurs = node.getAttribute("minOccurs");
		var maxOccurs = node.getAttribute("maxOccurs");
		if (parentDef && (minOccurs || maxOccurs)) {
			var name = node.getAttribute('name');
			var indexedNameOrRef = name ? this.indexedDefinitionName(name) : this.extractName(node.getAttribute('ref')).indexedName;
			if (!("occurs" in parentDef))
				parentDef.occurs = {};
			parentDef.occurs[indexedNameOrRef] = {
					'min' : minOccurs,
					'max' : maxOccurs
			};
		}
	}
	
	// Add this element as a child of the parent, unless it is abstract or already added
	if (parentDef != null && node.getAttribute("abstract") != "true"
			&& !this.containsChild(parentDef, definition))
		parentDef.elements.push(definition);
	
	return definition;
};

SchemaProcessor.prototype.addAttribute = function(node, definition, parentDef) {
	// Add the definition to its parents attributes array
	if (parentDef != null)
		parentDef.attributes.push(definition);
};

SchemaProcessor.prototype.addReference = function(definition, refName) {
	var nameParts = this.extractName(refName);
	definition.ref = nameParts.indexedName;
};

SchemaProcessor.prototype.addTypeReference = function(definition, refName, mergeMode) {
	var nameParts = this.extractName(refName);
	if (!definition.typeRef) {
		definition.typeRef = [];
	}
	
	definition.typeRef.push({indexedName: nameParts.indexedName, mergeMode: mergeMode});
};

// Build the schema tag
SchemaProcessor.prototype.build_schema = function(node) {
	var definition = {
		elements : [],
		ns : this.targetNSIndex,
		schema : true,
		np : true
	};
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];

		if (child.localName == 'element') {
			var element = this.buildTopLevel(child, definition);
			this.addElement(child, element, definition);
		} else if (child.localName == 'simpleType' || 
				child.localName == 'attribute' || child.localName == 'complexType' ||
				child.localName == 'group' || child.localName == 'attributeGroup') {
			this.buildTopLevel(child, definition);
		}
	}
	return definition;
};

SchemaProcessor.prototype.buildTopLevel = function(node) {
	var name = node.getAttribute("name");
	// Root level definitions must have a name attribute
	if (!name)
		return;
	
	// New root definition
	var definition = this.createDefinition(node, name);
	this.rootDefinitions[this.indexedDefinitionName(name)] = definition;
	
	return this.build(node, definition);
};

SchemaProcessor.prototype.build = function(node, definition, parentDef) {
	return this["build_" + node.localName](node, definition, parentDef);
};

// Build an element definition
// node - element schema node
// parentdefinition - definition of the parent this element will be added to
SchemaProcessor.prototype.build_element = function(node, definition, parentDef) {
	
	var ref = node.getAttribute("ref");
	if (ref) {
		this.addReference(definition, ref);
	} else {
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			var child = this.getChildren(node)[0];
			if (child) {
				this.build(child, definition);
			} else {
				var subGroup = node.getAttribute('substitutionGroup');
				if (subGroup) {
					this.addTypeReference(definition, subGroup, 'extension');
				} else {
					definition.type = 'anyType';
				}
			}
		} else {
			// Check to see if it is a built in type
			definition.type = this.getBuiltInType(type, definition);
			if (definition.type == null) {
				// Was not built in, make a reference to resolve later
				this.addTypeReference(definition, type, 'extension');
			}
		}
	}
	
	return definition;
}

SchemaProcessor.prototype.build_attribute = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref) {
		this.addReference(definition, ref);
	} else {
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			var child = this.getChildren(node)[0];
			if (child)
				this.build(this.getChildren(node)[0], definition);
			else // Fall back to string type if nothing else available
				definition.type = "string";
		} else {
			// Check to see if it is a built in type
			definition.type = this.getBuiltInType(type, definition);
			if (definition.type == null) {
				// Was not built in, make a reference to resolve later
				this.addTypeReference(definition, type, 'extension');
			}
		}
	}
	
	return definition;
};

// Process a complexType tag
SchemaProcessor.prototype.build_complexType = function(node, definition, parentDef) {
	if (node.getAttribute("mixed") == "true") {
		definition.type = "mixed";
	}
	
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "simpleContent" : case "complexContent" : case "choice" : 
		case "attributeGroup" : case "sequence" : case "all" : case "anyAttribute" :
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process a simpleType tag
SchemaProcessor.prototype.build_simpleType = function(node, definition) {
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "restriction" : case "list" : case "union" :
		this.build(child, definition);
	}
};

// Process a list tag, which allows for a single tag with multiple values
SchemaProcessor.prototype.build_list = function(node, definition) {
	// For the moment, lists will just be treated as free text fields
	definition.type = "string";
	definition.multivalued = true;
};

// Process a union tag
SchemaProcessor.prototype.build_union = function(node, definition) {
	var memberTypes = node.getAttribute('memberTypes');
	if (memberTypes) {
		memberTypes = memberTypes.split(' ');
		
		for (var i in memberTypes) {
			var memberType = memberTypes[i];
			
			definition.type = this.getBuiltInType(memberType, definition);
			if (definition.type == null) {
				this.addTypeReference(definition, memberType, 'extension');
			}
		}
	}
	
	var self = this;
	var children = this.getChildren(node, 'simpleType');
	for (var i in children)
		self.build_simpleType(children[i], definition);
};

// Process a group tag
SchemaProcessor.prototype.build_group = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref){
		this.addTypeReference(definition, ref, 'extension');
		return definition;
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "all" : case "sequence" :
			this.build(child, definition);
		}
	}
};

// Process an all tag
SchemaProcessor.prototype.build_all = function(node, definition) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process a choice tag
SchemaProcessor.prototype.build_choice = function(node, definition) {
	var self = this;
	var max = node.getAttribute("maxOccurs");
	var choice = {
			"elements": [],
			"minOccurs": node.getAttribute("minOccurs"),
			"maxOccurs": (max == null || (isNaN(max) && "unbounded" != max) || max < 0)? 1 : max
	};
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "group" : case "sequence" : case "any" :
			this.build(child, definition);
			break;
		case "element" :
			var element = this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
			if (element.name)
				choice.elements.push(element.ns + ":" + element.name);
			else
				choice.elements.push(element.ref);
		}
	}
	if (!('choices' in definition))
		definition.choices = [];
	definition.choices.push(choice);
};

// Process a sequence tag
SchemaProcessor.prototype.build_sequence = function(node, definition) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "group" : case "sequence" : case "any" :
			this.build(child, definition);
			break;
		case "element" :
			var element = this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process an any tag
SchemaProcessor.prototype.build_any = function(node, definition) {
	definition.any = !(node.getAttribute("minOccurs") == "0" && node.getAttribute("maxOccurs") == "0");
};

SchemaProcessor.prototype.build_anyAttribute = function(node, definition) {
	definition.anyAttribute = true;
};

// Process a complexContent tag
SchemaProcessor.prototype.build_complexContent = function(node, definition) {
	if (node.getAttribute("mixed") == "true") {
		definition.type = "mixed";
	}
	
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "extension" : case "restriction" :
		this.build(child, definition);
	}
};

// Process a simpleContent tag
SchemaProcessor.prototype.build_simpleContent = function(node, definition) {
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "extension" : case "restriction" :
		this.build(child, definition);
	}
};

// Process a restriction tag
SchemaProcessor.prototype.build_restriction = function(node, definition) {
	var base = node.getAttribute("base");
	
	definition.type = this.getBuiltInType(base, definition);
	if (definition.type == null) {
		this.addTypeReference(definition, base, 'restriction');
	}
	
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "simpleType" : case "choice" : 
		case "attributeGroup" : case "sequence" : case "all" : case "anyAttribute":
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
			break;
		case "enumeration" :
			definition.values.push(child.getAttribute("value"));
		}
	}
};

// Process an extension tag
SchemaProcessor.prototype.build_extension = function(node, definition) {
	var base = node.getAttribute("base");
	
	definition.type = this.getBuiltInType(base, definition);
	if (definition.type == null) {
		this.addTypeReference(definition, base, 'extension');
	}
	
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "choice" : case "attributeGroup" : 
		case "sequence" : case "all" : case "anyAttribute":
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process an attributeGroup tag
SchemaProcessor.prototype.build_attributeGroup = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref){
		this.addTypeReference(definition, ref, 'extension');
		return definition;
	}
	
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "attributeGroup" : case "anyAttribute" :
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

SchemaProcessor.prototype.getBuiltInType = function(type, definition) {
	if (definition.type != null)
		return definition.type;
	var nameParts = this.extractName(type);
	if (nameParts.namespaceUri === this.xsdManager.xsNS) {
		return nameParts.localName;
	}
	return null;
};

//Retrieve all the children of node which belong to the schema namespace.  
//If they are specified, then the results will be filtered to only include children which
//match the given element name and/or have a name attribute of the given value
//filtered to
SchemaProcessor.prototype.getChildren = function(node, childName, nameAttribute) {
	var children = [];
	if (!node)
		node = this.xsd;
	var childNameSpecified = childName !== undefined;
	var attributeSpecified = nameAttribute !== undefined;
	var childNodes = node.childNodes;
	for (var index in childNodes) {
		var child = childNodes[index];
		if (child.nodeType == 1 && child.namespaceURI == this.xsdManager.xsNS && 
				((childNameSpecified && child.localName == childName) || (!childNameSpecified && child.localName != 'annotation')) &&
				(!attributeSpecified || child.getAttribute('name') == nameAttribute))
			children.push(child);
	}
	return children;
}

//Namespace aware check to see if a definition already contains parent child element
SchemaProcessor.prototype.containsChild = function(definition, child) {
	if (definition.elements) {
		var childName = child.ref || child.ns + ":" + child.name;
		for (var index in definition.elements) {
			var element = definition.elements[index];
			var existingName = element.ref || element.ns + ":" + element.name;
			
			if (childName == existingName)
				return true;
		}
	}
	return false;
};

SchemaProcessor.prototype.indexedDefinitionName = function(name) {
	return this.targetNSIndex + ':' + name;
};

SchemaProcessor.prototype.extractName = function(name) {
	if (!name)
		return null;
	var result = {};
	var index = name.indexOf(':');
	if (index == -1) {
		result['localName'] = name;
		result['prefix'] = "";
	} else {
		result['localName'] = name.substring(index + 1);
		result['prefix'] = name.substring(0, index);
	}
	var namespaceUri = this.localNamespaces[result.prefix];
	result['namespaceUri'] = namespaceUri;
	result['namespace'] = this.xsdManager.getNamespaceIndex(namespaceUri);
	result['indexedName'] = result.namespace + ":" + result.localName;
	return result;
};

//Register a namespace, and optionally its prefix, to the schema
SchemaProcessor.prototype.registerNamespace = function(namespaceUri, prefix) {
	var namespaceIndex = this.xsdManager.registerNamespace(namespaceUri);

	if (prefix !== undefined)
		this.localNamespaces[prefix] = namespaceUri;
	
	return namespaceIndex;
};

SchemaProcessor.prototype.getLocalNamespacePrefix = function(namespaceUri) {
	for (var prefix in this.localNamespaces) {
		if (this.localNamespaces[prefix] == namespaceUri)
			return prefix;
	}
	return null;
};
; return Xsd2Json;}.call();